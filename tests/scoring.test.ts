import { describe, expect, it } from "vitest";
import type { Requirement, RequirementMatch } from "@/lib/schemas";
import { computeScore, normalizeForMatch, quoteExistsInCv, verifyMatch } from "@/lib/scoring";

const cv = "SKILLS\nTypeScript, React,\nNode.js  and   Docker basics\nI’m a “team player” – really";

const match = (status: RequirementMatch["status"], evidence: string | null): RequirementMatch => ({
  status,
  evidence,
  explanation: "",
  verified: true,
});

describe("quoteExistsInCv", () => {
  it("tolerates line breaks, case and extra whitespace from PDF extraction", () => {
    expect(quoteExistsInCv("react, node.js and docker", cv)).toBe(true);
  });

  it("tolerates typographic quotes and dashes the model may normalize", () => {
    expect(quoteExistsInCv(`I'm a "team player" - really`, cv)).toBe(true);
  });

  it("rejects text that is not in the CV", () => {
    expect(quoteExistsInCv("5 years of Kubernetes", cv)).toBe(false);
  });

  it("rejects empty quotes", () => {
    expect(quoteExistsInCv("   ", cv)).toBe(false);
  });
});

describe("normalizeForMatch", () => {
  it("collapses whitespace and lowercases", () => {
    expect(normalizeForMatch("  Foo\n\tBAR  ")).toBe("foo bar");
  });
});

describe("verifyMatch", () => {
  it("keeps a met claim backed by a real quote", () => {
    expect(verifyMatch(match("met", "Docker basics"), cv)).toEqual(match("met", "Docker basics"));
  });

  it("downgrades an invented quote to a flagged gap", () => {
    expect(verifyMatch(match("met", "Kubernetes in production"), cv)).toMatchObject({
      status: "gap",
      evidence: null,
      verified: false,
    });
  });

  it("downgrades a partial claim without any quote", () => {
    expect(verifyMatch(match("partial", null), cv)).toMatchObject({ status: "gap", verified: false });
  });

  it("clears evidence on gaps", () => {
    expect(verifyMatch(match("gap", "TypeScript"), cv)).toMatchObject({ status: "gap", evidence: null, verified: true });
  });
});

describe("computeScore", () => {
  const reqs: Requirement[] = [
    { text: "TypeScript", category: "must_have" },
    { text: "AWS", category: "nice_to_have" },
    { text: "Curious", category: "soft_skill" },
  ];

  it("weights must-haves three times as much", () => {
    // must (3) met + nice (1) gap + soft (1) gap = 3 / 5
    expect(computeScore(reqs, [match("met", "x"), match("gap", null), match("gap", null)])).toBe(60);
  });

  it("gives half credit for partial", () => {
    // 3 * 0.5 + 1 + 1 = 3.5 / 5
    expect(computeScore(reqs, [match("partial", "x"), match("met", "x"), match("met", "x")])).toBe(70);
  });

  it("treats missing matches as gaps", () => {
    expect(computeScore(reqs, [match("met", "x")])).toBe(60);
  });

  it("returns 0 for no requirements", () => {
    expect(computeScore([], [])).toBe(0);
  });
});
