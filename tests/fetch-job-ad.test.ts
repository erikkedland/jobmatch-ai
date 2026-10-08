import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Fake DNS so the SSRF tests are deterministic and work offline.
vi.mock("node:dns/promises", () => ({
  lookup: vi.fn(async (host: string) => {
    // Like real DNS, IP literals resolve to themselves.
    if (/^[\d.]+$/.test(host)) return [{ address: host, family: 4 }];
    const table: Record<string, string> = {
      "jobs.example.com": "93.184.216.34",
      "internal.example.com": "10.0.0.5",
      localhost: "127.0.0.1",
    };
    if (!table[host]) throw new Error("ENOTFOUND");
    return [{ address: table[host], family: 4 }];
  }),
}));

const { fetchJobAd, htmlToText, isPrivateAddress } = await import("@/lib/fetch-job-ad");
const { AppError } = await import("@/lib/i18n");

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return err instanceof AppError ? err.code : String(err);
  }
  return "no error";
}

const AD_HTML = `<html><head><style>.x{}</style><script>alert(1)</script></head><body>
<nav>Home | Jobs</nav><h1>Backend Developer</h1><p>We are looking for someone with &amp; experience in Node.js.</p>
<ul><li>TypeScript</li><li>PostgreSQL</li></ul><p>${"Lorem ipsum dolor sit amet. ".repeat(10)}</p></body></html>`;

describe("isPrivateAddress", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1", "0.0.0.0", "::1", "fd00::1", "fe80::1", "::ffff:127.0.0.1"])(
    "blocks %s",
    (ip) => expect(isPrivateAddress(ip)).toBe(true),
  );

  it.each(["93.184.216.34", "8.8.8.8", "172.32.0.1", "2606:4700::1111"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("htmlToText", () => {
  it("drops scripts, styles and navigation and keeps the content", () => {
    const text = htmlToText(AD_HTML);
    expect(text).toContain("Backend Developer");
    expect(text).toContain("• TypeScript");
    expect(text).toContain("& experience");
    expect(text).not.toMatch(/alert|\.x\{|Home \| Jobs/);
  });
});

describe("fetchJobAd", () => {
  const fetchMock = vi.fn<typeof fetch>();
  beforeEach(() => vi.stubGlobal("fetch", fetchMock));
  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it("fetches and converts a public page", async () => {
    fetchMock.mockResolvedValue(new Response(AD_HTML, { headers: { "content-type": "text/html" } }));
    expect(await fetchJobAd("https://jobs.example.com/ad/1")).toContain("Backend Developer");
  });

  it("refuses private addresses without making a request", async () => {
    expect(await errorCode(fetchJobAd("http://localhost:3000/admin"))).toBe("fetch_private");
    expect(await errorCode(fetchJobAd("http://169.254.169.254/latest/meta-data"))).toBe("fetch_private");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks every redirect hop, so a public URL can't redirect to an internal one", async () => {
    fetchMock.mockResolvedValue(
      new Response(null, { status: 302, headers: { location: "http://internal.example.com/secret" } }),
    );
    expect(await errorCode(fetchJobAd("https://jobs.example.com/ad/1"))).toBe("fetch_private");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("rejects non-HTML responses", async () => {
    fetchMock.mockResolvedValue(new Response("%PDF-", { headers: { "content-type": "application/pdf" } }));
    expect(await errorCode(fetchJobAd("https://jobs.example.com/ad.pdf"))).toBe("fetch_not_html");
  });

  it("reports unknown hosts", async () => {
    expect(await errorCode(fetchJobAd("https://does-not-exist.example.com/"))).toBe("fetch_not_found");
  });
});
