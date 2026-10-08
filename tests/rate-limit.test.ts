import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, clientIp, resetRateLimits } from "@/lib/rate-limit";

const T0 = 1_000_000;

describe("checkRateLimit", () => {
  beforeEach(resetRateLimits);

  it("allows 5 analyses per IP and then blocks for the rest of the window", () => {
    for (let i = 0; i < 5; i++) expect(checkRateLimit("1.2.3.4", T0).ok).toBe(true);
    expect(checkRateLimit("1.2.3.4", T0)).toEqual({ ok: false, scope: "ip", retryAfterSeconds: 600 });
  });

  it("counts IPs separately", () => {
    for (let i = 0; i < 5; i++) checkRateLimit("1.2.3.4", T0);
    expect(checkRateLimit("5.6.7.8", T0).ok).toBe(true);
  });

  it("resets after the window", () => {
    for (let i = 0; i < 6; i++) checkRateLimit("1.2.3.4", T0);
    expect(checkRateLimit("1.2.3.4", T0 + 10 * 60 * 1000).ok).toBe(true);
  });

  it("enforces the global daily budget across IPs", () => {
    let blockedAt = -1;
    for (let i = 0; i < 400 && blockedAt === -1; i++) {
      if (!checkRateLimit(`10.0.${i >> 8}.${i & 255}`, T0).ok) blockedAt = i;
    }
    expect(blockedAt).toBe(300);
  });
});

describe("clientIp", () => {
  it("uses the first x-forwarded-for address", () => {
    const req = new Request("http://x", { headers: { "x-forwarded-for": "203.0.113.7, 10.0.0.1" } });
    expect(clientIp(req)).toBe("203.0.113.7");
  });

  it("falls back when the header is missing", () => {
    expect(clientIp(new Request("http://x"))).toBe("local");
  });
});
