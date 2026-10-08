import { zodTextFormat } from "openai/helpers/zod";
import {
  formatMatches,
  languageName,
  SHARED_INSTRUCTIONS,
  taskMessage,
  type AnalysisContext,
} from "./context";
import { AppError, type Locale } from "./i18n";
import { getOpenAI, isRefusal, MODEL, usageOf, type Usage } from "./llm";
import { CvTips, type CvTip, type Requirement, type RequirementMatch } from "./schemas";

const tipsTask = (assessment: string, locale: Locale) => `Task: suggest 3–5 concrete improvements to the CV for this specific job.

This is the verified assessment of each requirement:
<assessment>
${assessment}
</assessment>

Prioritize, in this order:
1. "partial" requirements, and "met" ones where the evidence is only a bare keyword: suggest how the candidate can show the experience they already have more clearly (e.g. describe what they built with it, and where).
2. Wording: use the job ad's terminology where the CV describes the same thing differently.
3. "gap" requirements: never suggest adding a skill the CV doesn't show. Suggest honest options instead, such as a small project or course, or highlighting genuinely related experience.

Each tip must refer to something actually in this CV or this job. Write in ${languageName(locale)}.`;

export async function writeTips(
  context: AnalysisContext,
  requirements: Requirement[],
  matches: RequirementMatch[],
  locale: Locale,
  signal?: AbortSignal,
): Promise<{ tips: CvTip[]; usage: Usage }> {
  const response = await getOpenAI().responses.parse(
    {
      model: MODEL,
      instructions: SHARED_INSTRUCTIONS,
      input: [...context.input, taskMessage(tipsTask(formatMatches(requirements, matches), locale))],
      prompt_cache_key: context.cacheKey,
      text: { format: zodTextFormat(CvTips, "cv_tips") },
    },
    { signal },
  );

  if (isRefusal(response)) throw new AppError("refusal", 422);
  if (!response.output_parsed) {
    throw new Error(`Could not parse model output (status: ${response.status})`);
  }
  return { tips: response.output_parsed.tips, usage: usageOf(response) };
}
