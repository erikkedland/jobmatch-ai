"use client";

import { useState, type FormEvent } from "react";
import { readEvents, type AnalysisResult, type AnalysisStats } from "@/lib/events";
import { LOCALES, messages, type ErrorCode, type Step } from "@/lib/i18n";
import type { CvTip, JobRequirements, MatchStatus, Requirement } from "@/lib/schemas";
import { useLocale } from "@/lib/use-locale";

type JobAdMode = "text" | "url";
type StepState = "active" | "done";
type Dict = (typeof messages)["en"];

const CATEGORIES: Requirement["category"][] = ["must_have", "nice_to_have", "soft_skill"];

const STATUS_CLASS: Record<MatchStatus, string> = {
  met: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  partial: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  gap: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
};

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function Home() {
  const { locale, t, setLocale } = useLocale();
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jobAdMode, setJobAdMode] = useState<JobAdMode>("text");
  const [jobAdText, setJobAdText] = useState("");
  const [jobAdUrl, setJobAdUrl] = useState("");

  const [steps, setSteps] = useState<Partial<Record<Step, StepState>>>({});
  const [job, setJob] = useState<JobRequirements | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [tips, setTips] = useState<CvTip[] | null>(null);
  const [letter, setLetter] = useState("");
  const [stats, setStats] = useState<AnalysisStats | null>(null);
  const [errorCode, setErrorCode] = useState<ErrorCode | null>(null);
  const [loading, setLoading] = useState(false);

  const jobAdReady =
    jobAdMode === "text" ? jobAdText.trim().length > 0 : jobAdUrl.trim().length > 0;
  const canSubmit = cvFile !== null && jobAdReady && !loading;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!cvFile) return;

    setLoading(true);
    setErrorCode(null);
    setSteps({});
    setJob(null);
    setResult(null);
    setTips(null);
    setLetter("");
    setStats(null);

    try {
      const body = new FormData();
      body.append("cv", cvFile);
      body.append("lang", locale);
      if (jobAdMode === "text") body.append("jobAdText", jobAdText);
      else body.append("jobAdUrl", jobAdUrl);

      const res = await fetch("/api/analyze", { method: "POST", body });
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setErrorCode(data.code ?? "unknown");
        return;
      }

      for await (const ev of readEvents(res.body)) {
        if (ev.type === "step") setSteps((s) => ({ ...s, [ev.step]: ev.status === "start" ? "active" : "done" }));
        else if (ev.type === "requirements") setJob(ev.job);
        else if (ev.type === "result") setResult(ev.result);
        else if (ev.type === "tips") setTips(ev.tips);
        else if (ev.type === "letter_delta") setLetter((l) => l + ev.text);
        else if (ev.type === "done") setStats(ev.stats);
        else if (ev.type === "error") setErrorCode(ev.code);
      }
    } catch {
      setErrorCode("unknown");
    } finally {
      setLoading(false);
    }
  }

  const visibleSteps: Step[] =
    jobAdMode === "url"
      ? ["reading_cv", "fetching_ad", "extracting", "matching", "writing"]
      : ["reading_cv", "extracting", "matching", "writing"];

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-10">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight">JobMatch AI</h1>
          <div className="flex rounded-md border border-zinc-300 p-0.5 text-xs dark:border-zinc-700" aria-label="Language">
            {LOCALES.map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={locale === l}
                onClick={() => setLocale(l)}
                className={`rounded px-2 py-1 uppercase ${
                  locale === l ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "text-zinc-500"
                }`}
              >
                {l}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{t.tagline}</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section>
          <label htmlFor="cv" className="block font-medium">
            {t.cvLabel}
          </label>
          <input
            id="cv"
            type="file"
            accept="application/pdf"
            onChange={(e) => setCvFile(e.target.files?.[0] ?? null)}
            className="mt-2 block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-white hover:file:bg-zinc-700 dark:file:bg-zinc-100 dark:file:text-zinc-900"
          />
        </section>

        <section>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium">{t.adLabel}</span>
            <div role="tablist" className="flex rounded-md border border-zinc-300 p-0.5 text-sm dark:border-zinc-700">
              {(["text", "url"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  role="tab"
                  aria-selected={jobAdMode === mode}
                  onClick={() => setJobAdMode(mode)}
                  className={`rounded px-3 py-1 ${
                    jobAdMode === mode
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                      : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  {mode === "text" ? t.pasteText : t.fromUrl}
                </button>
              ))}
            </div>
          </div>

          {jobAdMode === "text" ? (
            <textarea
              aria-label={t.adLabel}
              value={jobAdText}
              onChange={(e) => setJobAdText(e.target.value)}
              rows={10}
              placeholder={t.adPlaceholder}
              className="mt-2 w-full rounded-md border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"
            />
          ) : (
            <input
              aria-label={t.fromUrl}
              type="url"
              value={jobAdUrl}
              onChange={(e) => setJobAdUrl(e.target.value)}
              placeholder="https://…"
              className="mt-2 w-full rounded-md border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"
            />
          )}
        </section>

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-md bg-zinc-900 px-4 py-3 font-medium text-white transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading ? t.analyzing : t.analyze}
        </button>
      </form>

      {Object.keys(steps).length > 0 && !stats && !errorCode && (
        <ol className="mt-8 space-y-2 text-sm" aria-live="polite">
          {visibleSteps.map((s) => (
            <li key={s} className="flex items-center gap-3">
              <StepIcon state={steps[s]} />
              <span className={steps[s] ? "" : "text-zinc-400"}>{t.steps[s]}</span>
            </li>
          ))}
        </ol>
      )}

      {errorCode && (
        <p role="alert" className="mt-6 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {t.errors[errorCode] ?? t.errors.unknown}
        </p>
      )}

      {job && <Results job={job} result={result} t={t} />}
      {tips && <Tips tips={tips} t={t} />}
      {letter && <Letter letter={letter} done={stats !== null || errorCode !== null} t={t} />}
      {stats && (
        <p className="mt-8 text-xs text-zinc-500">
          {t.stats({
            seconds: (stats.durationMs / 1000).toFixed(1),
            tokens: stats.inputTokens + stats.outputTokens,
            cached: stats.cachedTokens,
            rejected: stats.unverifiedClaims,
          })}
        </p>
      )}
    </main>
  );
}

function StepIcon({ state }: { state?: StepState }) {
  if (state === "done") return <span className="w-4 text-center text-emerald-600">✓</span>;
  if (state === "active")
    return <span className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100" />;
  return <span className="h-4 w-4 rounded-full border-2 border-zinc-200 dark:border-zinc-800" />;
}

function Results({ job, result, t }: { job: JobRequirements; result: AnalysisResult | null; t: Dict }) {
  const indexed = job.requirements.map((req, i) => ({ req, match: result?.matches[i] }));

  return (
    <section className="mt-10 space-y-8">
      <div className="flex items-center gap-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <div className={`text-5xl font-bold tabular-nums ${result ? scoreColor(result.score) : "text-zinc-300 dark:text-zinc-700"}`}>
          {result ? result.score : "–"}
        </div>
        <div>
          <h2 className="text-lg font-semibold">
            {job.jobTitle}
            {job.company && <span className="font-normal text-zinc-500"> · {job.company}</span>}
          </h2>
          {result && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{result.summary}</p>}
        </div>
      </div>

      {CATEGORIES.map((category) => {
        const items = indexed.filter(({ req }) => req.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category}>
            <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
              {t.categories[category]}
            </h3>
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {items.map(({ req, match }) => (
                <li key={req.text} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-medium">{req.text}</span>
                    {match ? (
                      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[match.status]}`}>
                        {t.statuses[match.status]}
                      </span>
                    ) : (
                      <span className="shrink-0 animate-pulse text-xs text-zinc-400">{t.pending}</span>
                    )}
                  </div>
                  {match?.evidence && (
                    <blockquote className="mt-2 border-l-2 border-zinc-300 pl-3 text-sm italic text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                      “{match.evidence}”
                    </blockquote>
                  )}
                  {match && <p className="mt-1 text-sm text-zinc-500">{match.explanation}</p>}
                  {match && !match.verified && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{t.unverified}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

    </section>
  );
}

function Tips({ tips, t }: { tips: CvTip[]; t: Dict }) {
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-semibold">{t.tipsTitle}</h2>
      <ol className="space-y-3">
        {tips.map((tip, i) => (
          <li key={i} className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="font-medium">
              {i + 1}. {tip.title}
            </p>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{tip.detail}</p>
            {tip.requirement && <p className="mt-2 text-xs text-zinc-500">→ {tip.requirement}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}

function Letter({ letter, done, t }: { letter: string; done: boolean; t: Dict }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(letter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the text is still selectable.
    }
  }

  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">{t.letterTitle}</h2>
        {done && (
          <button
            type="button"
            onClick={copy}
            className="rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {copied ? t.copied : t.copy}
          </button>
        )}
      </div>
      <div className="whitespace-pre-wrap rounded-lg border border-zinc-200 p-5 text-sm leading-relaxed dark:border-zinc-800">
        {letter}
        {!done && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-zinc-400 align-middle" />}
      </div>
      <p className="mt-2 text-xs text-zinc-500">{t.letterNote}</p>
    </section>
  );
}
