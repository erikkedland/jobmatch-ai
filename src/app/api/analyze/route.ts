import { extractRequirements } from "@/lib/extract-requirements";
import { fetchJobAd, JobAdFetchError } from "@/lib/fetch-job-ad";
import { toErrorResponse } from "@/lib/llm";
import { matchCv } from "@/lib/match-cv";
import { CvParseError, extractCvText } from "@/lib/pdf";
import { JobAdText, JobAdUrl } from "@/lib/schemas";
import { computeScore } from "@/lib/scoring";

export type AnalyzeResponse = Awaited<ReturnType<typeof analyze>>;

function badRequest(error: string) {
  return Response.json({ error }, { status: 400 });
}

export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  if (!form) return badRequest("Expected a multipart form upload.");

  const cv = form.get("cv");
  if (!(cv instanceof File)) return badRequest("No CV file was uploaded.");

  const text = form.get("jobAdText");
  const url = form.get("jobAdUrl");
  if (!text === !url) return badRequest("Provide either the job ad text or a link, not both.");

  const jobAd = text ? JobAdText.safeParse(text) : JobAdUrl.safeParse(url);
  if (!jobAd.success) return badRequest(jobAd.error.issues[0].message);

  try {
    return Response.json(await analyze(cv, jobAd.data, Boolean(url)));
  } catch (err) {
    if (err instanceof CvParseError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    if (err instanceof JobAdFetchError) return badRequest(err.message);
    return toErrorResponse(err);
  }
}

async function analyze(cvFile: File, jobAd: string, isUrl: boolean) {
  const started = Date.now();

  // Steps 1–2 are independent: read the CV while the job ad is fetched/extracted.
  const [cv, extraction] = await Promise.all([
    cvFile.arrayBuffer().then((buf) => extractCvText(new Uint8Array(buf))),
    (isUrl ? fetchJobAd(jobAd) : Promise.resolve(jobAd)).then(extractRequirements),
  ]);

  const { requirements, language } = extraction.data;
  const match = await matchCv(cv.text, requirements, language);

  return {
    job: extraction.data,
    cv: { pages: cv.pages, chars: cv.text.length },
    score: computeScore(requirements, match.matches),
    summary: match.summary,
    matches: match.matches,
    stats: {
      durationMs: Date.now() - started,
      inputTokens: extraction.usage.inputTokens + match.usage.inputTokens,
      cachedTokens: match.usage.cachedTokens,
      outputTokens: extraction.usage.outputTokens + match.usage.outputTokens,
      /** How many claims the model made that our quote check rejected. */
      unverifiedClaims: match.matches.filter((m) => !m.verified).length,
    },
  };
}
