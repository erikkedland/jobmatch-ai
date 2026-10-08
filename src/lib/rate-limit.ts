/**
 * Simple in-memory rate limiting to protect the API budget of a public demo.
 *
 * Limitation: state lives in one server instance's memory, so on serverless
 * platforms each instance counts separately and counts reset on cold starts.
 * Good enough for a portfolio demo; production would use a shared store
 * (e.g. Redis) instead.
 */

type Window = { count: number; resetAt: number };

const PER_IP_LIMIT = Number(process.env.RATE_LIMIT_PER_IP ?? 5);
const PER_IP_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const GLOBAL_DAILY_LIMIT = Number(process.env.RATE_LIMIT_DAILY ?? 300);
const DAY_MS = 24 * 60 * 60 * 1000;

const perIp = new Map<string, Window>();
let global: Window = { count: 0, resetAt: 0 };

export type RateLimitResult =
  | { ok: true }
  | { ok: false; scope: "ip" | "global"; retryAfterSeconds: number };

function hit(window: Window | undefined, limit: number, windowMs: number, now: number) {
  const current = !window || now >= window.resetAt ? { count: 0, resetAt: now + windowMs } : window;
  if (current.count >= limit) return { window: current, allowed: false };
  return { window: { ...current, count: current.count + 1 }, allowed: true };
}

export function checkRateLimit(ip: string, now = Date.now()): RateLimitResult {
  // Check the global budget first so a blocked request doesn't use up the IP quota.
  const g = hit(global, GLOBAL_DAILY_LIMIT, DAY_MS, now);
  if (!g.allowed) {
    return { ok: false, scope: "global", retryAfterSeconds: Math.ceil((g.window.resetAt - now) / 1000) };
  }

  const p = hit(perIp.get(ip), PER_IP_LIMIT, PER_IP_WINDOW_MS, now);
  if (!p.allowed) {
    return { ok: false, scope: "ip", retryAfterSeconds: Math.ceil((p.window.resetAt - now) / 1000) };
  }

  global = g.window;
  perIp.set(ip, p.window);

  // Keep memory bounded: drop expired entries now and then.
  if (perIp.size > 10_000) {
    for (const [key, w] of perIp) if (now >= w.resetAt) perIp.delete(key);
  }
  return { ok: true };
}

/** Client IP as reported by the hosting proxy (Vercel sets x-forwarded-for). */
export function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
}

/** For tests. */
export function resetRateLimits() {
  perIp.clear();
  global = { count: 0, resetAt: 0 };
}
