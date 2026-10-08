import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnalyzeEvent } from "@/lib/events";
import { CV_TEXT, fakeOpenAI, LETTER_CHUNKS } from "./fake-openai";

let client = fakeOpenAI();
vi.mock("@/lib/llm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/llm")>()),
  getOpenAI: () => client,
}));

const { runAnalysis } = await import("@/lib/pipeline");
const { AppError } = await import("@/lib/i18n");

async function run() {
  const events: AnalyzeEvent[] = [];
  await runAnalysis({
    cv: { text: CV_TEXT },
    jobAd: { text: "Frontend Developer at Example AB ..." },
    locale: "en",
    send: (e) => events.push(e),
  });
  return events;
}

describe("runAnalysis", () => {
  beforeEach(() => {
    client = fakeOpenAI();
  });

  it("emits steps, requirements, result, tips, letter and stats in order", async () => {
    const types = (await run()).map((e) => (e.type === "step" ? `${e.step}:${e.status}` : e.type));
    expect(types.filter((t) => !t.includes(":"))).toEqual([
      "requirements",
      "result",
      "tips",
      ...LETTER_CHUNKS.map(() => "letter_delta"),
      "done",
    ]);
    expect(types).toContain("matching:start");
    expect(types).toContain("writing:done");
    expect(types).not.toContain("fetching_ad:start"); // text ads are not fetched
  });

  it("rejects the model's invented evidence and scores what's left", async () => {
    const events = await run();
    const result = events.find((e) => e.type === "result")!;
    if (result.type !== "result") throw new Error();

    expect(result.result.matches[0]).toMatchObject({ status: "met", verified: true });
    expect(result.result.matches[1]).toMatchObject({ status: "gap", evidence: null, verified: false });
    // must TypeScript met (3) + must Kubernetes gap (0) + nice AWS gap (0) = 3 / 7
    expect(result.result.score).toBe(43);

    const done = events.at(-1)!;
    expect(done).toMatchObject({ type: "done", stats: { unverifiedClaims: 1, inputTokens: 400 } });
  });

  it("streams the letter in chunks", async () => {
    const letter = (await run()).flatMap((e) => (e.type === "letter_delta" ? [e.text] : [])).join("");
    expect(letter).toBe(LETTER_CHUNKS.join(""));
  });

  it("turns a model refusal into a typed error", async () => {
    client = fakeOpenAI({ refuse: true });
    await expect(run()).rejects.toBeInstanceOf(AppError);
    await expect(run()).rejects.toMatchObject({ code: "refusal" });
  });
});
