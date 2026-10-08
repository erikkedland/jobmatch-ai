import OpenAI from "openai";
import { AppError, type ErrorCode } from "./i18n";

/** Model is configurable so evals can compare models without code changes. */
export const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

let client: OpenAI | null = null;

/** Lazily creates the client so a missing key gives a clear error at request time. */
export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    console.error("OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server.");
    throw new AppError("missing_key", 500);
  }
  client ??= new OpenAI({ timeout: 60_000, maxRetries: 2 });
  return client;
}

export type Usage = { inputTokens: number; cachedTokens: number; outputTokens: number };

export const EMPTY_USAGE: Usage = { inputTokens: 0, cachedTokens: 0, outputTokens: 0 };

export function usageOf(response: OpenAI.Responses.Response): Usage {
  return {
    inputTokens: response.usage?.input_tokens ?? 0,
    cachedTokens: response.usage?.input_tokens_details?.cached_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
  };
}

export function addUsage(a: Usage, b: Usage): Usage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    cachedTokens: a.cachedTokens + b.cachedTokens,
    outputTokens: a.outputTokens + b.outputTokens,
  };
}

/** True if the model answered with a refusal instead of the requested output. */
export function isRefusal(response: OpenAI.Responses.Response): boolean {
  return response.output.some(
    (item) => item.type === "message" && item.content.some((c) => c.type === "refusal"),
  );
}

/** Maps any error to a translatable code and an HTTP status. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  const map = (code: ErrorCode, status: number) => new AppError(code, status);
  // We cancelled it ourselves (another step failed or the user left): not an error.
  if (err instanceof OpenAI.APIUserAbortError) return map("unknown", 499);
  if (err instanceof OpenAI.AuthenticationError) return map("auth", 500);
  if (err instanceof OpenAI.RateLimitError) return map("rate_limit", 429);
  if (err instanceof OpenAI.APIConnectionTimeoutError) return map("timeout", 504);
  if (err instanceof OpenAI.APIError) {
    console.error("OpenAI API error", err.status, err.message);
    return map("ai_unavailable", 502);
  }
  console.error("Unexpected error", err);
  return map("unknown", 500);
}
