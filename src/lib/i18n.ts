export const LOCALES = ["en", "sv"] as const;
export type Locale = (typeof LOCALES)[number];

export type ErrorCode =
  | "bad_request"
  | "cv_missing"
  | "cv_empty"
  | "cv_too_large"
  | "cv_not_pdf"
  | "cv_unreadable"
  | "cv_no_text"
  | "ad_one_source"
  | "ad_too_short"
  | "ad_too_long"
  | "ad_invalid_url"
  | "no_requirements"
  | "fetch_not_found"
  | "fetch_private"
  | "fetch_unreachable"
  | "fetch_redirects"
  | "fetch_http_error"
  | "fetch_not_html"
  | "fetch_too_large"
  | "fetch_no_text"
  | "missing_key"
  | "refusal"
  | "auth"
  | "rate_limit"
  | "timeout"
  | "ai_unavailable"
  | "unknown";

export type Step = "reading_cv" | "fetching_ad" | "extracting" | "matching";

type Dictionary = {
  tagline: string;
  cvLabel: string;
  adLabel: string;
  pasteText: string;
  fromUrl: string;
  adPlaceholder: string;
  analyze: string;
  analyzing: string;
  categories: Record<"must_have" | "nice_to_have" | "soft_skill", string>;
  statuses: Record<"met" | "partial" | "gap", string>;
  steps: Record<Step, string>;
  pending: string;
  unverified: string;
  stats: (p: { seconds: string; tokens: number; cached: number; rejected: number }) => string;
  errors: Record<ErrorCode, string>;
};

export const messages: Record<Locale, Dictionary> = {
  en: {
    tagline:
      "Upload your CV and a job ad. AI finds out how well you match, backed by evidence from your CV.",
    cvLabel: "1. Your CV (PDF, max 5 MB)",
    adLabel: "2. The job ad",
    pasteText: "Paste text",
    fromUrl: "From URL",
    adPlaceholder: "Paste the full job ad here…",
    analyze: "Analyze match",
    analyzing: "Analyzing…",
    categories: { must_have: "Must have", nice_to_have: "Nice to have", soft_skill: "Soft skills" },
    statuses: { met: "Met", partial: "Partial", gap: "Gap" },
    steps: {
      reading_cv: "Reading your CV",
      fetching_ad: "Fetching the job ad",
      extracting: "Finding the requirements",
      matching: "Matching requirements against your CV",
    },
    pending: "Checking…",
    unverified: "⚠ The AI cited evidence that isn't in your CV, so this was marked as a gap.",
    stats: ({ seconds, tokens, cached, rejected }) =>
      `${seconds} s · ${tokens} tokens${cached ? ` (${cached} cached)` : ""} · ${rejected} unverified claims rejected`,
    errors: {
      bad_request: "The request was invalid.",
      cv_missing: "No CV file was uploaded.",
      cv_empty: "The file is empty.",
      cv_too_large: "The file is larger than 5 MB.",
      cv_not_pdf: "The file is not a valid PDF.",
      cv_unreadable: "Could not read the PDF. It may be corrupt or password-protected.",
      cv_no_text:
        "Found almost no text in the PDF. Is it a scanned image? Please export your CV as a text-based PDF.",
      ad_one_source: "Provide either the job ad text or a link, not both.",
      ad_too_short: "The job ad is too short. Paste the full ad.",
      ad_too_long: "The job ad is too long (max 30,000 characters).",
      ad_invalid_url: "Enter a valid http(s) link to the job ad.",
      no_requirements: "Couldn't find any requirements in the job ad.",
      fetch_not_found: "Could not find that website. Check the link.",
      fetch_private: "That link points to a private address and can't be fetched.",
      fetch_unreachable: "Could not reach the website (timeout or connection error).",
      fetch_redirects: "The link redirected too many times.",
      fetch_http_error:
        "The website answered with an error. Some job sites block automated access; paste the text instead.",
      fetch_not_html: "The link doesn't point to a web page.",
      fetch_too_large: "The page is too large.",
      fetch_no_text:
        "Found almost no text on that page. It may require JavaScript or a login; paste the text instead.",
      missing_key: "The server has no API key configured.",
      refusal: "The AI declined to process this input.",
      auth: "The server's API key is invalid.",
      rate_limit: "Too many requests right now. Please wait a minute and try again.",
      timeout: "The AI took too long to respond. Please try again.",
      ai_unavailable: "The AI service is having problems. Please try again.",
      unknown: "Something went wrong.",
    },
  },
  sv: {
    tagline:
      "Ladda upp ditt CV och en jobbannons. AI tar reda på hur väl du matchar, med bevis från ditt CV.",
    cvLabel: "1. Ditt CV (PDF, max 5 MB)",
    adLabel: "2. Jobbannonsen",
    pasteText: "Klistra in text",
    fromUrl: "Från länk",
    adPlaceholder: "Klistra in hela jobbannonsen här…",
    analyze: "Analysera matchning",
    analyzing: "Analyserar…",
    categories: { must_have: "Måste ha", nice_to_have: "Meriterande", soft_skill: "Personliga egenskaper" },
    statuses: { met: "Uppfyllt", partial: "Delvis", gap: "Saknas" },
    steps: {
      reading_cv: "Läser ditt CV",
      fetching_ad: "Hämtar jobbannonsen",
      extracting: "Hittar kraven",
      matching: "Matchar kraven mot ditt CV",
    },
    pending: "Kontrollerar…",
    unverified: "⚠ AI:n citerade något som inte finns i ditt CV, så kravet markerades som saknat.",
    stats: ({ seconds, tokens, cached, rejected }) =>
      `${seconds} s · ${tokens} tokens${cached ? ` (${cached} cachade)` : ""} · ${rejected} overifierade påståenden avvisade`,
    errors: {
      bad_request: "Förfrågan var ogiltig.",
      cv_missing: "Inget CV laddades upp.",
      cv_empty: "Filen är tom.",
      cv_too_large: "Filen är större än 5 MB.",
      cv_not_pdf: "Filen är inte en giltig PDF.",
      cv_unreadable: "Kunde inte läsa PDF:en. Den kan vara skadad eller lösenordsskyddad.",
      cv_no_text:
        "Hittade nästan ingen text i PDF:en. Är den inskannad? Exportera ditt CV som en textbaserad PDF.",
      ad_one_source: "Ange antingen annonstexten eller en länk, inte båda.",
      ad_too_short: "Annonsen är för kort. Klistra in hela annonsen.",
      ad_too_long: "Annonsen är för lång (max 30 000 tecken).",
      ad_invalid_url: "Ange en giltig http(s)-länk till annonsen.",
      no_requirements: "Hittade inga krav i jobbannonsen.",
      fetch_not_found: "Hittade inte webbplatsen. Kontrollera länken.",
      fetch_private: "Länken pekar på en privat adress och kan inte hämtas.",
      fetch_unreachable: "Kunde inte nå webbplatsen (timeout eller anslutningsfel).",
      fetch_redirects: "Länken omdirigerades för många gånger.",
      fetch_http_error:
        "Webbplatsen svarade med ett fel. Vissa jobbsajter blockerar automatisk hämtning – klistra in texten i stället.",
      fetch_not_html: "Länken pekar inte på en webbsida.",
      fetch_too_large: "Sidan är för stor.",
      fetch_no_text:
        "Hittade nästan ingen text på sidan. Den kan kräva JavaScript eller inloggning – klistra in texten i stället.",
      missing_key: "Servern har ingen API-nyckel konfigurerad.",
      refusal: "AI:n avböjde att behandla innehållet.",
      auth: "Serverns API-nyckel är ogiltig.",
      rate_limit: "För många förfrågningar just nu. Vänta en minut och försök igen.",
      timeout: "AI:n tog för lång tid på sig. Försök igen.",
      ai_unavailable: "AI-tjänsten har problem. Försök igen.",
      unknown: "Något gick fel.",
    },
  },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** An error that carries a code the UI can translate. */
export class AppError extends Error {
  constructor(
    public readonly code: ErrorCode,
    public readonly status: number = 400,
  ) {
    super(messages.en.errors[code]);
    this.name = "AppError";
  }
}
