import { buildContext } from "@/lib/context";
import type { AnalyzeEvent } from "@/lib/events";
import { extractRequirements } from "@/lib/extract-requirements";
import { fetchJobAd } from "@/lib/fetch-job-ad";
import { AppError, isLocale, messages, type ErrorCode, type Locale, type Step } from "@/lib/i18n";
import { addUsage, toAppError } from "@/lib/llm";
import { matchCv } from "@/lib/match-cv";
import { extractCvText } from "@/lib/pdf";
import { JobAdText, JobAdUrl } from "@/lib/schemas";
import { computeScore } from "@/lib/scoring";
import { writeLetter } from "@/lib/write-letter";
import { writeTips } from "@/lib/write-tips";

function errorResponse(code: ErrorCode, status = 400) {
  return Response.json({ code, error: messages.en.errors[code] }, { status });
}

export async function POST(request: Request) {
  // Validate everything we can before starting the stream, so input errors
  // get a proper HTTP status instead of an in-stream error event.
  const form = await request.formData().catch(() => null);
  if (!form) return errorResponse("bad_request");

  const cv = form.get("cv");
  if (!(cv instanceof File)) return errorResponse("cv_missing");

  const text = form.get("jobAdText");
  const url = form.get("jobAdUrl");
  if (!text === !url) return errorResponse("ad_one_source");

  const jobAd = text ? JobAdText.safeParse(text) : JobAdUrl.safeParse(url);
  if (!jobAd.success) return errorResponse(jobAd.error.issues[0].message as ErrorCode);

  const lang = form.get("lang");
  const locale: Locale = isLocale(lang) ? lang : "en";

  // Cancels in-flight AI calls (which cost money) when a step fails or the
  // user closes the page.
  const abort = new AbortController();
  request.signal.addEventListener("abort", () => abort.abort());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (event: AnalyzeEvent) => {
        if (abort.signal.aborted) return;
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        await analyze({ cv, jobAd: jobAd.data, isUrl: Boolean(url), locale, send, signal: abort.signal });
      } catch (err) {
        send({ type: "error", code: toAppError(err).code });
        abort.abort();
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed because the client disconnected.
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function analyze(opts: {
  cv: File;
  jobAd: string;
  isUrl: boolean;
  locale: Locale;
  send: (event: AnalyzeEvent) => void;
  signal: AbortSignal;
}) {
  const { send, signal } = opts;
  const started = Date.now();

  /** Wraps a step so the UI sees when it starts and finishes. */
  async function step<T>(name: Step, fn: () => Promise<T>): Promise<T> {
    send({ type: "step", step: name, status: "start" });
    const result = await fn();
    send({ type: "step", step: name, status: "done" });
    return result;
  }

  // Reading the CV and preparing the job ad are independent, so run them in parallel.
  const [cv, extraction] = await Promise.all([
    step("reading_cv", async () => extractCvText(new Uint8Array(await opts.cv.arrayBuffer()))),
    (async () => {
      const adText = opts.isUrl
        ? await step("fetching_ad", () => fetchJobAd(opts.jobAd, signal))
        : opts.jobAd;
      return step("extracting", () => extractRequirements(adText, signal));
    })(),
  ]);

  const job = extraction.data;
  if (job.requirements.length === 0) throw new AppError("no_requirements", 422);
  send({ type: "requirements", job });

  // From here on, every call starts with the same CV + job prefix (cacheable).
  const context = buildContext(cv.text, job);

  const match = await step("matching", () =>
    matchCv(context, cv.text, job.requirements, opts.locale, signal),
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
      writeTips(context, job.requirements, match.matches, opts.locale, signal).then((r) => {
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
