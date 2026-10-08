import type { MatchStatus, Requirement, RequirementMatch } from "./schemas";

/** Must-haves weigh more than nice-to-haves and soft skills. */
const CATEGORY_WEIGHT: Record<Requirement["category"], number> = {
  must_have: 3,
  nice_to_have: 1,
  soft_skill: 1,
};

const STATUS_CREDIT: Record<MatchStatus, number> = {
  met: 1,
  partial: 0.5,
  gap: 0,
};

/**
 * Normalizes text for quote comparison: case, whitespace (PDF extraction breaks
 * lines unpredictably) and typographic quotes/dashes the model may "fix".
 */
export function normalizeForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** True if the quote appears verbatim (after normalization) in the CV. */
export function quoteExistsInCv(quote: string, cvText: string): boolean {
  const q = normalizeForMatch(quote);
  return q.length > 0 && normalizeForMatch(cvText).includes(q);
}

/**
 * The hallucination guard: any claim of "met" or "partial" must be backed by a
 * quote that actually exists in the CV. Otherwise it is downgraded to a gap and
 * flagged, so we can count how often the model invents evidence.
 */
export function verifyMatch(match: RequirementMatch, cvText: string): RequirementMatch {
  if (match.status === "gap") {
    return { ...match, evidence: null, verified: true };
  }
  if (match.evidence && quoteExistsInCv(match.evidence, cvText)) {
    return { ...match, verified: true };
  }
  return { ...match, status: "gap", evidence: null, verified: false };
}

/** Weighted score 0–100, computed in code so it is deterministic and explainable. */
export function computeScore(requirements: Requirement[], matches: RequirementMatch[]): number {
  let earned = 0;
  let possible = 0;
  requirements.forEach((req, i) => {
    const weight = CATEGORY_WEIGHT[req.category];
    possible += weight;
    earned += weight * STATUS_CREDIT[matches[i]?.status ?? "gap"];
  });
  return possible === 0 ? 0 : Math.round((earned / possible) * 100);
}
