import type { ErrorCode, Step } from "./i18n";
import type { JobRequirements, RequirementMatch } from "./schemas";

export type AnalysisResult = {
  score: number;
  summary: string;
  matches: RequirementMatch[];
  stats: {
    durationMs: number;
    inputTokens: number;
    cachedTokens: number;
    outputTokens: number;
    /** How many claims the model made that our quote check rejected. */
    unverifiedClaims: number;
  };
};

/** Events streamed from /api/analyze as newline-delimited JSON (NDJSON). */
export type AnalyzeEvent =
  | { type: "step"; step: Step; status: "start" | "done" }
  | { type: "requirements"; job: JobRequirements }
  | { type: "result"; result: AnalysisResult }
  | { type: "error"; code: ErrorCode };

/** Reads an NDJSON response body and yields one parsed event per line. */
export async function* readEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<AnalyzeEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line) as AnalyzeEvent;
    }
    if (done) break;
  }
  if (buffer.trim()) yield JSON.parse(buffer) as AnalyzeEvent;
}
