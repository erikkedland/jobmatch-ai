/**
 * Runs the real analysis pipeline on hand-labelled cases and reports quality,
 * hallucination, cost and latency metrics.
 *
 *   npm run eval                          # all cases, default model
 *   npm run eval -- --model gpt-5.4-mini  # compare models
 *   npm run eval -- --case weak-match     # one case
 *   npm run eval -- --runs 3              # repeat to see run-to-run variance
 *
 * Every run calls the OpenAI API and costs money: about $0.007 per case for the
 * app (gpt-5.4-mini) plus about $0.05 per case for the judge (gpt-5.5).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";

const { values: args } = parseArgs({
  options: {
    model: { type: "string" },
    "judge-model": { type: "string" },
    case: { type: "string" },
    runs: { type: "string", default: "1" },
    concurrency: { type: "string", default: "3" },
  },
});

// The model is read when the pipeline modules load, so set it before importing them.
if (args.model) process.env.OPENAI_MODEL = args.model;

const { CASES } = await import("./cases");
const { judgeLetter } = await import("./judge");
const { costUsd } = await import("./prices");
const { runAnalysis } = await import("../src/lib/pipeline");
const { MODEL, addUsage, EMPTY_USAGE } = await import("../src/lib/llm");
import type { AnalyzeEvent } from "../src/lib/events";
import type { EvalCase } from "./cases";

// A stronger model judges the letters: with the app's small model as judge, it ignored its
// instructions and flagged honest sentences ("I have not used React") as invented.
const judgeModel = args["judge-model"] ?? process.env.EVAL_JUDGE_MODEL ?? "gpt-5.5";
const runs = Number(args.runs);
const cases = args.case ? CASES.filter((c) => c.id === args.case) : CASES;
if (cases.length === 0) throw new Error(`No case with id "${args.case}"`);

type Check = { name: string; pass: boolean; detail?: string };

type CaseResult = {
  id: string;
  run: number;
  error?: string;
  checks: Check[];
  expectedFound: number;
  expectedTotal: number;
  statusCorrect: number;
  forbiddenExtracted: number;
  claimsMade: number;
  claimsRejected: number;
  letterClaims: number;
  letterUnsupported: string[];
  letterEmbellished: string[];
  letterPlaceholders: number;
  score?: number;
  scoreInRange?: boolean;
  durationMs: number;
  usage: { inputTokens: number; cachedTokens: number; outputTokens: number };
  costUsd: number | null;
  judgeCostUsd: number | null;
  letter?: string;
};

async function evaluate(c: EvalCase, run: number): Promise<CaseResult> {
  const events: AnalyzeEvent[] = [];
  const started = Date.now();
  const base: CaseResult = {
    id: c.id, run, checks: [], expectedFound: 0, expectedTotal: c.expect.requirements.length,
    statusCorrect: 0, forbiddenExtracted: 0, claimsMade: 0, claimsRejected: 0,
    letterClaims: 0, letterUnsupported: [], letterEmbellished: [], letterPlaceholders: 0, durationMs: 0, usage: EMPTY_USAGE, costUsd: null, judgeCostUsd: null,
  };

  try {
    await runAnalysis({ cv: { text: c.cv }, jobAd: { text: c.jobAd }, locale: c.locale, send: (e) => events.push(e) });
  } catch (err) {
    return { ...base, error: String(err), durationMs: Date.now() - started };
  }

  const job = events.find((e) => e.type === "requirements")!.job;
  const result = events.find((e) => e.type === "result")!.result;
  const done = events.find((e) => e.type === "done")!.stats;
  const letter = events.flatMap((e) => (e.type === "letter_delta" ? [e.text] : [])).join("");
  const checks: Check[] = [];

  // 1. Extraction + status per expected requirement.
  let found = 0;
  let correct = 0;
  for (const exp of c.expect.requirements) {
    const i = job.requirements.findIndex((r) => exp.pattern.test(r.text));
    if (i === -1) {
      checks.push({ name: `extract ${exp.pattern}`, pass: false, detail: "not extracted" });
      continue;
    }
    found++;
    const m = result.matches[i];
    const ok = exp.status.includes(m.status);
    if (ok) correct++;
    checks.push({
      name: `status ${exp.pattern}`,
      pass: ok,
      detail: `got ${m.status}, expected ${exp.status.join("|")}${m.evidence ? ` (evidence: "${m.evidence}")` : ""}`,
    });
  }

  // 2. Nothing that isn't a requirement (benefits, injected text) may be extracted.
  let forbidden = 0;
  for (const pattern of c.expect.notRequirements ?? []) {
    const hit = job.requirements.find((r) => pattern.test(r.text));
    if (hit) forbidden++;
    checks.push({ name: `not extracted ${pattern}`, pass: !hit, detail: hit?.text });
  }

  if (c.expect.language) {
    checks.push({ name: "ad language", pass: job.language === c.expect.language, detail: job.language });
  }

  const scoreInRange = c.expect.score
    ? result.score >= c.expect.score[0] && result.score <= c.expect.score[1]
    : undefined;
  if (c.expect.score) {
    checks.push({ name: "score in range", pass: scoreInRange!, detail: `${result.score} (expected ${c.expect.score.join("–")})` });
  }

  // 3. Evidence hallucination: claims the quote check had to reject.
  const rejected = result.matches.filter((m) => !m.verified).length;
  const claimsMade = result.matches.filter((m) => m.status !== "gap").length + rejected;

  // 4. Letter quality: placeholders (deterministic) and unsupported claims (judge).
  const placeholders = (letter.match(/\[[^\]]{2,}\]/g) ?? []).length;
  checks.push({ name: "letter has no placeholders", pass: placeholders === 0 });
  const verdict = await judgeLetter(c.cv, letter, judgeModel);
  // Only fully unsupported claims fail the check; embellishments are reported separately.
  checks.push({
    name: "letter has no unsupported claims",
    pass: verdict.unsupported.length === 0,
    detail: verdict.unsupported.map((c) => c.claim).join(" | ") || undefined,
  });

  const usage = { inputTokens: done.inputTokens, cachedTokens: done.cachedTokens, outputTokens: done.outputTokens };
  return {
    ...base,
    checks,
    expectedFound: found,
    statusCorrect: correct,
    forbiddenExtracted: forbidden,
    claimsMade,
    claimsRejected: rejected,
    letterClaims: verdict.total,
    letterUnsupported: verdict.unsupported.map((c) => c.claim),
    letterEmbellished: verdict.embellished.map((c) => `${c.claim} (CV: ${c.cvEvidence ?? "–"})`),
    letterPlaceholders: placeholders,
    score: result.score,
    scoreInRange,
    durationMs: done.durationMs,
    usage,
    costUsd: costUsd(MODEL, usage),
    judgeCostUsd: costUsd(judgeModel, verdict.usage),
    letter,
  };
}

/** Runs tasks with a small concurrency limit to stay clear of rate limits. */
async function pool<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, tasks.length) }, async () => {
      while (next < tasks.length) {
        const i = next++;
        results[i] = await tasks[i]();
      }
    }),
  );
  return results;
}

const pct = (n: number, d: number) => (d === 0 ? "–" : `${((n / d) * 100).toFixed(0)}%`);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

console.log(`Running ${cases.length} case(s) × ${runs} run(s) with ${MODEL} (judge: ${judgeModel})…\n`);
const tasks = Array.from({ length: runs }, (_, run) => cases.map((c) => () => evaluate(c, run))).flat();
const results = await pool(
  tasks.map((task) => async () => {
    const r = await task();
    const failed = r.checks.filter((ch) => !ch.pass).length;
    const status = r.error ? "ERROR" : failed === 0 ? "pass" : `${failed} failed`;
    console.log(`  ${r.id.padEnd(22)} ${status.padEnd(9)} score ${String(r.score ?? "–").padStart(3)}  ${(r.durationMs / 1000).toFixed(1)} s`);
    return r;
  }),
  Number(args.concurrency),
);

const ok = results.filter((r) => !r.error);
const totalUsage = ok.map((r) => r.usage).reduce(addUsage, EMPTY_USAGE);
const costs = ok.map((r) => r.costUsd).filter((c): c is number => c !== null);
const durations = ok.map((r) => r.durationMs).sort((a, b) => a - b);
const letters = ok.length;
const scoreChecks = ok.filter((r) => r.scoreInRange !== undefined);

const summary = {
  model: MODEL,
  judgeModel,
  date: new Date().toISOString().slice(0, 10),
  cases: cases.length,
  runs,
  errors: results.length - ok.length,
  requirementRecall: pct(sum(ok.map((r) => r.expectedFound)), sum(ok.map((r) => r.expectedTotal))),
  statusAccuracy: pct(sum(ok.map((r) => r.statusCorrect)), sum(ok.map((r) => r.expectedFound))),
  forbiddenExtractions: sum(ok.map((r) => r.forbiddenExtracted)),
  evidenceRejected: `${sum(ok.map((r) => r.claimsRejected))} of ${sum(ok.map((r) => r.claimsMade))} claims (${pct(sum(ok.map((r) => r.claimsRejected)), sum(ok.map((r) => r.claimsMade)))})`,
  lettersWithUnsupportedClaims: `${ok.filter((r) => r.letterUnsupported.length > 0).length} of ${letters}`,
  letterClaimsUnsupported: `${sum(ok.map((r) => r.letterUnsupported.length))} of ${sum(ok.map((r) => r.letterClaims))} claims`,
  letterClaimsEmbellished: `${sum(ok.map((r) => r.letterEmbellished.length))} of ${sum(ok.map((r) => r.letterClaims))} claims`,
  lettersWithPlaceholders: `${ok.filter((r) => r.letterPlaceholders > 0).length} of ${letters}`,
  scoreInExpectedRange: `${scoreChecks.filter((r) => r.scoreInRange).length} of ${scoreChecks.length}`,
  avgCostPerAnalysisUsd: costs.length ? (sum(costs) / costs.length).toFixed(4) : "unknown model price",
  avgLatencySeconds: (sum(durations) / Math.max(durations.length, 1) / 1000).toFixed(1),
  maxLatencySeconds: ((durations.at(-1) ?? 0) / 1000).toFixed(1),
  cachedInputShare: pct(totalUsage.cachedTokens, totalUsage.inputTokens),
  judgeCostTotalUsd: sum(ok.map((r) => r.judgeCostUsd ?? 0)).toFixed(3),
};

const rows: [string, string][] = [
  ["Requirements found (recall)", summary.requirementRecall],
  ["Correct match status", summary.statusAccuracy],
  ["Non-requirements extracted (benefits, injected text)", String(summary.forbiddenExtractions)],
  ["Invented evidence caught by the quote check", summary.evidenceRejected],
  ["Cover letters with invented hard facts (LLM judge)", summary.lettersWithUnsupportedClaims],
  ["Hard-fact letter claims judged unsupported / embellished", `${summary.letterClaimsUnsupported} / ${summary.letterClaimsEmbellished}`],
  ["Cover letters with placeholders", summary.lettersWithPlaceholders],
  ["Score within expected range", summary.scoreInExpectedRange],
  ["Average cost per analysis (USD)", `$${summary.avgCostPerAnalysisUsd}`],
  ["Average / max latency", `${summary.avgLatencySeconds} s / ${summary.maxLatencySeconds} s`],
  ["Input tokens served from cache", summary.cachedInputShare],
  ["Judge cost for this eval run (USD, not part of the app)", `${summary.judgeCostTotalUsd}`],
];

const failures = results.flatMap((r) =>
  r.error
    ? [`- **${r.id}** (run ${r.run + 1}): error: ${r.error}`]
    : r.checks.filter((c) => !c.pass).map((c) => `- **${r.id}**: ${c.name}${c.detail ? ` — ${c.detail}` : ""}`),
);

const embellishments = ok.flatMap((r) => r.letterEmbellished.map((e) => `- **${r.id}**: ${e}`));

const markdown = [
  `**Model:** \`${MODEL}\` · **Judge:** \`${judgeModel}\` · **Cases:** ${cases.length} × ${runs} run(s) · **Date:** ${summary.date}`,
  "",
  "| Metric | Result |",
  "| --- | --- |",
  ...rows.map(([k, v]) => `| ${k} | ${v} |`),
  "",
  failures.length ? `**Failed checks (${failures.length}):**\n\n${failures.join("\n")}` : "**All checks passed.**",
  ...(embellishments.length
    ? ["", `**Embellished letter claims (reported, not counted as failures):**\n\n${embellishments.join("\n")}`]
    : []),
].join("\n");

console.log("\n" + rows.map(([k, v]) => `${k.padEnd(54)} ${v}`).join("\n"));
if (failures.length) console.log(`\nFailed checks:\n${failures.join("\n")}`);

const outDir = new URL("./results/", import.meta.url);
mkdirSync(outDir, { recursive: true });
writeFileSync(new URL(`${MODEL}.json`, outDir), JSON.stringify({ summary, results }, null, 2));
writeFileSync(new URL(`${MODEL}.md`, outDir), markdown + "\n");
console.log(`\nSaved evals/results/${MODEL}.json and .md`);
