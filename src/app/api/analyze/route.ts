import type { AnalyzeEvent } from "@/lib/events";
import { isLocale, messages, type ErrorCode, type Locale } from "@/lib/i18n";
import { toAppError } from "@/lib/llm";
import { MAX_CV_BYTES } from "@/lib/limits";
import { isPdf } from "@/lib/pdf";
import { runAnalysis } from "@/lib/pipeline";
import { JobAdText, JobAdUrl } from "@/lib/schemas";
import { checkRateLimit, clientIp } from "@/lib/rate-limit";

// A full analysis (four model calls) usually takes 10–20 s; leave headroom for slow responses.
export const maxDuration = 60;

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
  // Cheap checks up front, so an obviously bad file never starts an AI call.
  if (cv.size > MAX_CV_BYTES) return errorResponse("cv_too_large", 413);
  if (!isPdf(new Uint8Array(await cv.slice(0, 5).arrayBuffer()))) return errorResponse("cv_not_pdf");

  const text = form.get("jobAdText");
  const url = form.get("jobAdUrl");
  if (!text === !url) return errorResponse("ad_one_source");

  const jobAd = text ? JobAdText.safeParse(text) : JobAdUrl.safeParse(url);
  if (!jobAd.success) return errorResponse(jobAd.error.issues[0].message as ErrorCode);

  const lang = form.get("lang");
  const locale: Locale = isLocale(lang) ? lang : "en";

  // Checked after validation, so mistakes in the form don't use up the quota.
  const limit = checkRateLimit(clientIp(request));
  if (!limit.ok) {
    const code = limit.scope === "ip" ? "too_many_analyses" : "daily_budget";
    return Response.json(
      { code, error: messages.en.errors[code] },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

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
        await runAnalysis({
          cv: { pdf: new Uint8Array(await cv.arrayBuffer()) },
          jobAd: url ? { url: jobAd.data } : { text: jobAd.data },
          locale,
          send,
          signal: abort.signal,
        });
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
