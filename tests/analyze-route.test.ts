import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The pipeline has its own tests; here we only test the HTTP layer around it.
vi.mock("@/lib/pipeline", () => ({
  runAnalysis: vi.fn(async ({ send }) => {
    send({ type: "step", step: "reading_cv", status: "start" });
    send({ type: "done", stats: { durationMs: 1, inputTokens: 0, cachedTokens: 0, outputTokens: 0, unverifiedClaims: 0 } });
  }),
}));

const { POST } = await import("@/app/api/analyze/route");
const { resetRateLimits } = await import("@/lib/rate-limit");

const pdf = new Blob([readFileSync(new URL("../public/demo/sara-bergstrom-cv.pdf", import.meta.url))], {
  type: "application/pdf",
});
const AD = "Frontend Developer. Requirements: React, TypeScript and automated testing experience.";

function request(fields: Record<string, string | Blob>, ip = "203.0.113.1") {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return new Request("http://localhost/api/analyze", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": ip },
  });
}

async function errorOf(res: Response) {
  return { status: res.status, code: (await res.json()).code };
}

describe("POST /api/analyze", () => {
  beforeEach(resetRateLimits);

  it("streams NDJSON for a valid request", async () => {
    const res = await POST(request({ cv: pdf, jobAdText: AD, lang: "sv" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/x-ndjson");
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    expect(lines.at(-1).type).toBe("done");
  });

  it("requires a CV", async () => {
    expect(await errorOf(await POST(request({ jobAdText: AD })))).toEqual({ status: 400, code: "cv_missing" });
  });

  it("rejects non-PDF uploads before any AI work", async () => {
    const res = await POST(request({ cv: new Blob(["hello"]), jobAdText: AD }));
    expect(await errorOf(res)).toEqual({ status: 400, code: "cv_not_pdf" });
  });

  it("requires exactly one job ad source", async () => {
    const both = await POST(request({ cv: pdf, jobAdText: AD, jobAdUrl: "https://example.com" }));
    expect(await errorOf(both)).toEqual({ status: 400, code: "ad_one_source" });
    const none = await POST(request({ cv: pdf }));
    expect(await errorOf(none)).toEqual({ status: 400, code: "ad_one_source" });
  });

  it("validates the job ad text and URL", async () => {
    expect(await errorOf(await POST(request({ cv: pdf, jobAdText: "too short" })))).toEqual({
      status: 400,
      code: "ad_too_short",
    });
    expect(await errorOf(await POST(request({ cv: pdf, jobAdUrl: "ftp://example.com/ad" })))).toEqual({
      status: 400,
      code: "ad_invalid_url",
    });
  });

  it("rate-limits per IP with Retry-After, but not invalid requests", async () => {
    for (let i = 0; i < 3; i++) await POST(request({ cv: pdf, jobAdText: "short" })); // invalid: not counted
    for (let i = 0; i < 5; i++) expect((await POST(request({ cv: pdf, jobAdText: AD }))).status).toBe(200);

    const blocked = await POST(request({ cv: pdf, jobAdText: AD }));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await blocked.json()).code).toBe("too_many_analyses");

    expect((await POST(request({ cv: pdf, jobAdText: AD }, "198.51.100.9"))).status).toBe(200);
  });
});
