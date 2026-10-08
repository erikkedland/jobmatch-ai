import { extractText, getDocumentProxy } from "unpdf";

export const MAX_CV_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_TEXT_CHARS = 200;

/** Error with a message that is safe to show to the user. */
export class CvParseError extends Error {
  constructor(
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "CvParseError";
  }
}

/** Checks the "%PDF-" magic bytes instead of trusting the file extension. */
export function isPdf(bytes: Uint8Array): boolean {
  const magic = [0x25, 0x50, 0x44, 0x46, 0x2d];
  return magic.every((byte, i) => bytes[i] === byte);
}

/** Collapses the irregular whitespace PDF extraction tends to produce. */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractCvText(
  bytes: Uint8Array,
): Promise<{ text: string; pages: number }> {
  if (bytes.byteLength === 0) {
    throw new CvParseError("The file is empty.");
  }
  if (bytes.byteLength > MAX_CV_BYTES) {
    throw new CvParseError("The file is larger than 5 MB.", 413);
  }
  if (!isPdf(bytes)) {
    throw new CvParseError("The file is not a valid PDF.");
  }

  let result: { text: string; totalPages: number };
  try {
    const pdf = await getDocumentProxy(bytes);
    result = await extractText(pdf, { mergePages: true });
  } catch {
    throw new CvParseError(
      "Could not read the PDF. It may be corrupt or password-protected.",
    );
  }

  const text = normalizeText(result.text);
  if (text.length < MIN_TEXT_CHARS) {
    throw new CvParseError(
      "Found almost no text in the PDF. Is it a scanned image? Please export your CV as a text-based PDF.",
      422,
    );
  }

  return { text, pages: result.totalPages };
}
