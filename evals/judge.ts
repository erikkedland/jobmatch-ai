import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod";
import { getOpenAI, usageOf, type Usage } from "../src/lib/llm";

/**
 * LLM-as-judge for the cover letter: finds claims about the candidate that the
 * CV doesn't support. Deterministic checks can't catch paraphrased inventions
 * ("led a team of ten"), so a second model reads the letter against the CV.
 *
 * The first version simply asked for "unsupported claims" and flagged almost
 * every sentence, including ones copied from the CV. Two changes made it
 * useful: the judge must quote the CV evidence before each verdict, and it only
 * checks hard facts (tools, employers, dates, numbers, education), since soft
 * phrasing like "this taught me to be careful" is expected in a cover letter.
 *
 * Limitation: the judge is itself a model and can still miss or over-flag
 * claims. Its findings are saved in the results file for spot-checking.
 */
const Verdict = z.object({
  claims: z.array(
    z.object({
      claim: z.string().describe("A factual claim the letter makes about the candidate."),
      cvEvidence: z
        .string()
        .nullable()
        .describe("The CV text that supports the claim, quoted. Null if nothing in the CV supports it."),
      verdict: z
        .enum(["supported", "embellished", "unsupported"])
        .describe(
          "supported = the CV says this or clearly implies it; embellished = based on the CV but overstated (e.g. 'daily', 'expert', added scope); unsupported = not in the CV at all.",
        ),
    }),
  ),
});

const JUDGE_PROMPT = `You are a careful fact-checker. Compare a cover letter against the candidate's CV.

Check only HARD facts about the candidate, the kind that would mislead an employer if invented:
- tools, technologies, languages and methods the candidate says they have used
- employers, job titles, projects, tasks and responsibilities
- dates, durations, years of experience
- numbers, metrics and results
- education, courses and certifications
- spoken languages and their level

Do NOT list:
- soft traits or lessons learned ("this taught me to be careful", "I am adaptable")
- motivation, interests, or what the candidate wants to learn
- honest statements that the candidate lacks something
- statements about the role or the employer

For each hard-fact claim, first quote the CV text that supports it (if any), then give a verdict. A faithful paraphrase or translation of the CV is "supported". Use "embellished" when the letter adds something the CV doesn't say (frequency, level, scope, results), and "unsupported" when the CV has no basis for it.`;

export type JudgedClaim = z.infer<typeof Verdict>["claims"][number];

export async function judgeLetter(
  cv: string,
  letter: string,
  model: string,
): Promise<{ unsupported: JudgedClaim[]; embellished: JudgedClaim[]; total: number; usage: Usage }> {
  const response = await getOpenAI().responses.parse({
    model,
    instructions: JUDGE_PROMPT,
    input: `<cv>\n${cv}\n</cv>\n\n<letter>\n${letter}\n</letter>`,
    text: { format: zodTextFormat(Verdict, "verdict") },
  });
  const claims = response.output_parsed?.claims ?? [];
  return {
    unsupported: claims.filter((c) => c.verdict === "unsupported"),
    embellished: claims.filter((c) => c.verdict === "embellished"),
    total: claims.length,
    usage: usageOf(response),
  };
}
