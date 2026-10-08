import { extractText, getDocumentProxy } from "unpdf";
import { AppError } from "./i18n";

export const MAX_CV_BYTES = 5 * 1024 * 1024; // 5 MB
const MIN_TEXT_CHARS = 200;

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
  if (bytes.byteLength === 0) throw new AppError("cv_empty");
  if (bytes.byteLength > MAX_CV_BYTES) throw new AppError("cv_too_large", 413);
  if (!isPdf(bytes)) throw new AppError("cv_not_pdf");

  let result: { text: string; totalPages: number };
  try {
    const pdf = await getDocumentProxy(bytes);
    result = await extractText(pdf, { mergePages: true });
  } catch {
    throw new AppError("cv_unreadable");
  }

  const text = normalizeText(result.text);
  if (text.length < MIN_TEXT_CHARS) throw new AppError("cv_no_text", 422);

  return { text, pages: result.totalPages };
}
