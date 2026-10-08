import { buildContext } from "./context";
import type { AnalyzeEvent } from "./events";
import { extractRequirements } from "./extract-requirements";
import { fetchJobAd } from "./fetch-job-ad";
import { AppError, type Locale, type Step } from "./i18n";
import { addUsage } from "./llm";
import { matchCv } from "./match-cv";
import { extractCvText } from "./pdf";
import { computeScore } from "./scoring";
import { writeLetter } from "./write-letter";
import { writeTips } from "./write-tips";

export type AnalysisInput = {
  /** A PDF upload, or plain text (used by the evals, which skip PDF parsing). */
  cv: { pdf: Uint8Array } | { text: string };
  jobAd: { text: string } | { url: string };
  locale: Locale;
  send: (event: AnalyzeEvent) => void;
  signal?: AbortSignal;
};

/**
 * The full analysis: read CV + job ad → extract requirements → match with
 * verified evidence → tips and cover letter. Progress and results are reported
 * through `send`, so the same code serves the streaming API and the evals.
 */
export async function runAnalysis({ cv, jobAd, locale, send, signal }: AnalysisInput) {
  const started = Date.now();

  /** Wraps a step so the UI sees when it starts and finishes. */
  async function step<T>(name: Step, fn: () => Promise<T>): Promise<T> {
    send({ type: "step", step: name, status: "start" });
    const result = await fn();
    send({ type: "step", step: name, status: "done" });
    return result;
  }

  // Reading the CV and preparing the job ad are independent, so run them in parallel.
  const [cvText, extraction] = await Promise.all([
    step("reading_cv", async () => ("pdf" in cv ? (await extractCvText(cv.pdf)).text : cv.text)),
    (async () => {
      const adText =
        "url" in jobAd ? await step("fetching_ad", () => fetchJobAd(jobAd.url, signal)) : jobAd.text;
      return step("extracting", () => extractRequirements(adText, signal));
    })(),
  ]);

  const job = extraction.data;
  if (job.requirements.length === 0) throw new AppError("no_requirements", 422);
  send({ type: "requirements", job });

  // From here on, every call starts with the same CV + job prefix (cacheable).
  const context = buildContext(cvText, job);

  const match = await step("matching", () =>
    matchCv(context, cvText, job.requirements, locale, signal),
  );
  send({
    type: "result",
    result: {
      score: computeScore(job.requirements, match.matches),
      summary: match.summary,
      matches: match.matches,
    },
  });

  // Tips and the letter both build on the verified matches but not on each other.
  const [tips, letter] = await step("writing", () =>
    Promise.all([
      writeTips(context, job.requirements, match.matches, locale, signal).then((r) => {
        send({ type: "tips", tips: r.tips });
        return r;
      }),
      writeLetter(context, job, match.matches, (text) => send({ type: "letter_delta", text }), signal),
    ]),
  );

  const usage = [match.usage, tips.usage, letter.usage].reduce(addUsage, extraction.usage);
  send({
    type: "done",
    stats: {
      durationMs: Date.now() - started,
      ...usage,
      unverifiedClaims: match.matches.filter((m) => !m.verified).length,
    },
  });
}
