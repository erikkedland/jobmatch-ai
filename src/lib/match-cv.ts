import { zodTextFormat } from "openai/helpers/zod";
import { languageName, SHARED_INSTRUCTIONS, taskMessage, type AnalysisContext } from "./context";
import { AppError, type Locale } from "./i18n";
import { getOpenAI, isRefusal, MODEL, usageOf, type Usage } from "./llm";
import { ModelMatchResult, type Requirement, type RequirementMatch } from "./schemas";
import { verifyMatch } from "./scoring";

const matchTask = (locale: Locale) => `Task: assess how well the CV matches each requirement.

For every requirement, decide:
- "met": the CV clearly demonstrates it.
- "partial": the CV shows something closely related or a weaker level. This includes: "basic" knowledge; skills known only from courses, certifications, education or hobby projects when the requirement asks for (professional) experience; fewer years than required; a different but related tool.
- "gap": the CV contains no evidence for it.

Evidence rules (these are checked automatically and violations are discarded):
- "evidence" must be copied verbatim from the CV, character for character. Do not paraphrase, translate, fix typos or merge text from different places.
- Keep the quote short: the smallest phrase that proves the point. Prefer quotes that show applied experience over bare skill lists.
- If you cannot find a verbatim quote, the status must be "gap" and evidence must be null.

Return exactly one match per requirement, using its index from the numbered list.
Write "explanation" and "summary" in ${languageName(locale)}.`;

export type MatchResult = {
  matches: RequirementMatch[];
  summary: string;
  usage: Usage;
};

export async function matchCv(
  context: AnalysisContext,
  cvText: string,
  requirements: Requirement[],
  locale: Locale,
  signal?: AbortSignal,
): Promise<MatchResult> {
  const response = await getOpenAI().responses.parse(
    {
      model: MODEL,
      instructions: SHARED_INSTRUCTIONS,
      input: [...context.input, taskMessage(matchTask(locale))],
      prompt_cache_key: context.cacheKey,
      text: { format: zodTextFormat(ModelMatchResult, "cv_match") },
    },
    { signal },
  );

  if (isRefusal(response)) {
    throw new AppError("refusal", 422);
  }
  if (!response.output_parsed) {
    throw new Error(`Could not parse model output (status: ${response.status})`);
  }

  // Align the model's answers with our requirement list. Missing or out-of-range
  // indexes become gaps instead of silently shifting results.
  const byIndex = new Map(response.output_parsed.matches.map((m) => [m.requirementIndex, m]));
  const matches = requirements.map((_, i): RequirementMatch => {
    const m = byIndex.get(i);
    if (!m) {
      return { status: "gap", evidence: null, explanation: "Not assessed.", verified: true };
    }
    return verifyMatch(
      { status: m.status, evidence: m.evidence, explanation: m.explanation, verified: true },
      cvText,
    );
  });

  return { matches, summary: response.output_parsed.summary, usage: usageOf(response) };
}
