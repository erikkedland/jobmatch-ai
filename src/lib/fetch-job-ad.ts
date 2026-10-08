import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;

/** Error with a message that is safe to show to the user. */
export class JobAdFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JobAdFetchError";
  }
}

/** Private, loopback and link-local ranges that a public job ad never lives on. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v6 = ip.toLowerCase();
    if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
    return v6 === "::1" || v6 === "::" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
  }
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168)
  );
}

/**
 * Blocks SSRF: without this, anyone could make our server request internal
 * addresses (e.g. cloud metadata at 169.254.169.254) by submitting them as a "job ad".
 */
async function assertPublicHost(url: URL): Promise<void> {
  const addresses = await lookup(url.hostname, { all: true }).catch(() => {
    throw new JobAdFetchError("Could not find that website. Check the link.");
  });
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new JobAdFetchError("That link points to a private address and can't be fetched.");
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  aring: "å", auml: "ä", ouml: "ö", Aring: "Å", Auml: "Ä", Ouml: "Ö",
};

/** Good-enough HTML-to-text for job ads: drops scripts/styles/navigation, keeps line structure. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|header|footer)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "• ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name] ?? m)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function fetchJobAd(rawUrl: string): Promise<string> {
  let url = new URL(rawUrl);

  // Follow redirects manually so every hop is checked against private addresses.
  for (let hop = 0; ; hop++) {
    await assertPublicHost(url);

    let res: Response;
    try {
      res = await fetch(url, {
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { "User-Agent": "JobMatchAI/1.0 (+portfolio project)", Accept: "text/html" },
      });
    } catch {
      throw new JobAdFetchError("Could not reach the website (timeout or connection error).");
    }

    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      if (hop >= MAX_REDIRECTS) throw new JobAdFetchError("Too many redirects.");
      url = new URL(res.headers.get("location")!, url);
      if (!/^https?:$/.test(url.protocol)) throw new JobAdFetchError("Unsupported redirect.");
      continue;
    }
    if (!res.ok) {
      throw new JobAdFetchError(
        `The website answered with an error (${res.status}). Some job sites block automated access; paste the text instead.`,
      );
    }

    const type = res.headers.get("content-type") ?? "";
    if (!/text\/html|text\/plain/.test(type)) {
      throw new JobAdFetchError("The link doesn't point to a web page.");
    }
    if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) {
      throw new JobAdFetchError("The page is too large.");
    }

    const body = await res.text();
    const text = type.includes("html") ? htmlToText(body.slice(0, MAX_BYTES)) : body;
    if (text.length < 200) {
      throw new JobAdFetchError(
        "Found almost no text on that page. It may require JavaScript or a login; paste the text instead.",
      );
    }
    return text.slice(0, 30_000);
  }
}
