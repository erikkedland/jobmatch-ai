"use client";

import { useState, type FormEvent } from "react";

type JobAdMode = "text" | "url";

type ParsedCv = { text: string; pages: number; chars: number };

export default function Home() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jobAdMode, setJobAdMode] = useState<JobAdMode>("text");
  const [jobAdText, setJobAdText] = useState("");
  const [jobAdUrl, setJobAdUrl] = useState("");
  const [parsedCv, setParsedCv] = useState<ParsedCv | null>(null);
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
    setParsedCv(null);

    try {
      const body = new FormData();
      body.append("cv", cvFile);
      const res = await fetch("/api/parse-cv", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Unknown error");
      setParsedCv(data);
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
          {loading ? "Reading CV…" : "Analyze match"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-6 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {parsedCv && (
        <section className="mt-8">
          <h2 className="font-medium">
            CV text extracted ({parsedCv.pages} {parsedCv.pages === 1 ? "page" : "pages"},{" "}{parsedCv.chars.toLocaleString()} characters)
          </h2>
          <pre className="mt-2 max-h-80 overflow-auto whitespace-pre-wrap rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs dark:border-zinc-800 dark:bg-zinc-900">
            {parsedCv.text}
          </pre>
          <p className="mt-2 text-sm text-zinc-500">The AI analysis is coming in phase 2.</p>
        </section>
      )}
    </main>
  );
}
