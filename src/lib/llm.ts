import OpenAI from "openai";

/** Model is configurable so evals can compare models without code changes. */
export const MODEL = process.env.OPENAI_MODEL || "gpt-5.4-mini";

let client: OpenAI | null = null;

/** Lazily creates the client so a missing key gives a clear error at request time. */
export function getOpenAI(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new MissingApiKeyError();
  }
  client ??= new OpenAI({ timeout: 60_000, maxRetries: 2 });
  return client;
}

export class MissingApiKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server.");
    this.name = "MissingApiKeyError";
  }
}

/** Raised when the model declines a request. */
export class ModelRefusalError extends Error {
  constructor() {
    super("The AI declined to process this input.");
    this.name = "ModelRefusalError";
  }
}

/** Maps any error from a model call to a status code and a user-safe message. */
export function toErrorResponse(err: unknown): Response {
  if (err instanceof MissingApiKeyError) {
    return Response.json({ error: err.message }, { status: 500 });
  }
  if (err instanceof ModelRefusalError) {
    return Response.json({ error: err.message }, { status: 422 });
  }
  if (err instanceof OpenAI.AuthenticationError) {
    return Response.json({ error: "The server's API key is invalid." }, { status: 500 });
  }
  if (err instanceof OpenAI.RateLimitError) {
    return Response.json(
      { error: "Too many requests right now. Please wait a minute and try again." },
      { status: 429 },
    );
  }
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return Response.json({ error: "The AI took too long to respond. Please try again." }, { status: 504 });
  }
  if (err instanceof OpenAI.APIError) {
    console.error("OpenAI API error", err.status, err.message);
    return Response.json({ error: "The AI service is having problems. Please try again." }, { status: 502 });
  }
  console.error("Unexpected error", err);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}
