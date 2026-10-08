/**
 * USD per 1M tokens. Source: https://developers.openai.com/api/docs/models
 * (checked 2026-10-08). Update when prices change; unknown models report tokens only.
 */
export const PRICES: Record<string, { input: number; cachedInput: number; output: number }> = {
  "gpt-5.4-mini": { input: 0.75, cachedInput: 0.075, output: 4.5 },
  "gpt-5.5": { input: 5, cachedInput: 0.5, output: 30 },
};

export function costUsd(
  model: string,
  usage: { inputTokens: number; cachedTokens: number; outputTokens: number },
): number | null {
  const p = PRICES[model];
  if (!p) return null;
  const uncached = usage.inputTokens - usage.cachedTokens;
  return (uncached * p.input + usage.cachedTokens * p.cachedInput + usage.outputTokens * p.output) / 1_000_000;
}
