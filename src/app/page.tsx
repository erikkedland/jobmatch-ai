"use client";

import { useState, type FormEvent } from "react";
import type { AnalyzeResponse } from "@/app/api/analyze/route";
import type { MatchStatus, Requirement } from "@/lib/schemas";

type JobAdMode = "text" | "url";

const CATEGORY_LABELS: Record<Requirement["category"], string> = {
  must_have: "Must have",
  nice_to_have: "Nice to have",
  soft_skill: "Soft skills",
};

const STATUS_STYLES: Record<MatchStatus, { label: string; className: string }> = {
  met: { label: "Met", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300" },
  gap: { label: "Gap", className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300" },
};

function scoreColor(score: number) {
  if (score >= 70) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

export default function Home() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jobAdMode, setJobAdMode] = useState<JobAdMode>("text");
  const [jobAdText, setJobAdText] = useState("");
  const [jobAdUrl, setJobAdUrl] = useState("");
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const jobAdReady =
    jobAdMode === "text" ? jobAdText.trim().length > 0 : jobAdUrl.trim().length > 0;
  const canSubmit = cvFile !== null && jobAdReady && !loading;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!cvFile) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const body = new FormData();
      body.append("cv", cvFile);
      if (jobAdMode === "text") body.append("jobAdText", jobAdText);
      else body.append("jobAdUrl", jobAdUrl);

      const res = await fetch("/api/analyze", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <header className="mb-10">
        <h1 className="text-3xl font-semibold tracking-tight">JobMatch AI</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Upload your CV and a job ad. An AI agent finds out how well you match, backed by
          evidence from your CV.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-8">
        <section>
          <label htmlFor="cv" className="block font-medium">
            1. Your CV (PDF, max 5 MB)
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
          <div className="flex items-center justify-between">
            <span className="font-medium">2. The job ad</span>
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
                  {mode === "text" ? "Paste text" : "From URL"}
                </button>
              ))}
            </div>
          </div>

          {jobAdMode === "text" ? (
            <textarea
              aria-label="Job ad text"
              value={jobAdText}
              onChange={(e) => setJobAdText(e.target.value)}
              rows={10}
              placeholder="Paste the full job ad here…"
              className="mt-2 w-full rounded-md border border-zinc-300 bg-transparent p-3 text-sm dark:border-zinc-700"
            />
          ) : (
            <input
              aria-label="Job ad URL"
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
          {loading ? "Analyzing… (10–20 s)" : "Analyze match"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-6 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {result && <Results result={result} />}
    </main>
  );
}

function Results({ result }: { result: AnalyzeResponse }) {
  const { job, matches, score, summary, stats } = result;
  const indexed = job.requirements.map((req, i) => ({ req, match: matches[i] }));

  return (
    <section className="mt-10 space-y-8">
      <div className="flex items-center gap-6 rounded-lg border border-zinc-200 p-6 dark:border-zinc-800">
        <div className={`text-5xl font-bold tabular-nums ${scoreColor(score)}`}>{score}</div>
        <div>
          <h2 className="text-lg font-semibold">
            {job.jobTitle}
            {job.company && <span className="font-normal text-zinc-500"> · {job.company}</span>}
          </h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{summary}</p>
        </div>
      </div>

      {(Object.keys(CATEGORY_LABELS) as Requirement["category"][]).map((category) => {
        const items = indexed.filter(({ req }) => req.category === category);
        if (items.length === 0) return null;
        return (
          <div key={category}>
            <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-zinc-500">
              {CATEGORY_LABELS[category]}
            </h3>
            <ul className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {items.map(({ req, match }) => (
                <li key={req.text} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-medium">{req.text}</span>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[match.status].className}`}>
                      {STATUS_STYLES[match.status].label}
                    </span>
                  </div>
                  {match.evidence && (
                    <blockquote className="mt-2 border-l-2 border-zinc-300 pl-3 text-sm italic text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
                      “{match.evidence}”
                    </blockquote>
                  )}
                  <p className="mt-1 text-sm text-zinc-500">{match.explanation}</p>
                  {!match.verified && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                      ⚠ The AI cited evidence that isn&apos;t in your CV, so this was marked as a gap.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}

      <p className="text-xs text-zinc-500">
        {(stats.durationMs / 1000).toFixed(1)} s · {stats.inputTokens + stats.outputTokens} tokens
        {stats.cachedTokens > 0 && ` (${stats.cachedTokens} cached)`} · {stats.unverifiedClaims} unverified
        claims rejected
      </p>
    </section>
  );
}
