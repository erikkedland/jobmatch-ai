import {
  formatMatches,
  languageName,
  SHARED_INSTRUCTIONS,
  taskMessage,
  type AnalysisContext,
} from "./context";
import { AppError } from "./i18n";
import { getOpenAI, isRefusal, MODEL, usageOf, type Usage } from "./llm";
import type { JobRequirements, RequirementMatch } from "./schemas";

const letterTask = (assessment: string, job: JobRequirements) => `Task: write a cover letter for this job.

This is the verified assessment of each requirement:
<assessment>
${assessment}
</assessment>

Guidelines:
- Write in ${languageName(job.language)}, the language of the job ad.
- 200–300 words, 3–4 short paragraphs. Plain text only: no markdown, no placeholders like [Your name] or [Date].
- Open with why this specific role${job.company ? ` at ${job.company}` : ""} fits the candidate, not with "I am writing to apply".
- Build the middle around the strongest "met" requirements, using concrete details from the CV.
- Do not claim anything marked "gap". If a must-have is a gap, you may briefly and honestly show willingness to learn it, but never pretend to have it.
- For "partial" requirements, describe exactly what the CV shows and nothing more. Never upgrade it: no added years, seniority, production use or "experience" when the CV only shows a course.
- Only state years, numbers and results that appear in the CV.
- Sign off with the candidate's name if it appears in the CV.`;

/** Streams the letter text through onDelta as it is generated. */
export async function writeLetter(
  context: AnalysisContext,
  job: JobRequirements,
  matches: RequirementMatch[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<{ letter: string; usage: Usage }> {
  const stream = getOpenAI().responses.stream(
    {
      model: MODEL,
      instructions: SHARED_INSTRUCTIONS,
      input: [...context.input, taskMessage(letterTask(formatMatches(job.requirements, matches), job))],
      prompt_cache_key: context.cacheKey,
    },
    { signal },
  );

  for await (const event of stream) {
    if (event.type === "response.output_text.delta") onDelta(event.delta);
  }

  const response = await stream.finalResponse();
  if (isRefusal(response)) throw new AppError("refusal", 422);
  return { letter: response.output_text, usage: usageOf(response) };
}
