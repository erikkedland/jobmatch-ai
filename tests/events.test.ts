import { describe, expect, it } from "vitest";
import { readEvents, type AnalyzeEvent } from "@/lib/events";

/** A stream that delivers the given byte chunks one at a time. */
function streamOf(chunks: Uint8Array[]) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((c) => controller.enqueue(c));
      controller.close();
    },
  });
}

async function collect(stream: ReadableStream<Uint8Array>) {
  const events: AnalyzeEvent[] = [];
  for await (const e of readEvents(stream)) events.push(e);
  return events;
}

describe("readEvents", () => {
  const events: AnalyzeEvent[] = [
    { type: "step", step: "reading_cv", status: "start" },
    { type: "letter_delta", text: "Hej Göteborg! " },
    { type: "error", code: "unknown" },
  ];
  const bytes = new TextEncoder().encode(events.map((e) => JSON.stringify(e)).join("\n") + "\n");

  it("parses one event per line", async () => {
    expect(await collect(streamOf([bytes]))).toEqual(events);
  });

  it("handles lines and multi-byte characters split across network chunks", async () => {
    // Split every 7 bytes: cuts through JSON and through the two-byte "ö".
    const chunks = [];
    for (let i = 0; i < bytes.length; i += 7) chunks.push(bytes.slice(i, i + 7));
    expect(await collect(streamOf(chunks))).toEqual(events);
  });

  it("parses a final line without a trailing newline", async () => {
    const noNewline = new TextEncoder().encode(JSON.stringify(events[0]));
    expect(await collect(streamOf([noNewline]))).toEqual([events[0]]);
  });
});
