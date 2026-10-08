import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/i18n";
import { MAX_CV_BYTES } from "@/lib/limits";
import { extractCvText, isPdf, normalizeText } from "@/lib/pdf";

const demoPdf = new Uint8Array(readFileSync(new URL("../public/demo/sara-bergstrom-cv.pdf", import.meta.url)));
const bytes = (s: string) => new TextEncoder().encode(s);

async function errorCode(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return err instanceof AppError ? err.code : String(err);
  }
  return "no error";
}

describe("isPdf", () => {
  it("checks the magic bytes, not the file name", () => {
    expect(isPdf(demoPdf)).toBe(true);
    expect(isPdf(bytes("hello"))).toBe(false);
  });
});

describe("normalizeText", () => {
  it("collapses runs of spaces and blank lines", () => {
    expect(normalizeText("a   b \r\n\r\n\r\n\r\nc")).toBe("a b\n\nc");
  });
});

describe("extractCvText", () => {
  it("extracts text from a real PDF, including Swedish characters", async () => {
    const { text, pages } = await extractCvText(demoPdf);
    expect(pages).toBe(1);
    expect(text).toContain("Sara Bergström");
    expect(text).toContain("Göteborg");
  });

  it("rejects empty files", async () => {
    expect(await errorCode(extractCvText(new Uint8Array()))).toBe("cv_empty");
  });

  it("rejects files that aren't PDFs", async () => {
    expect(await errorCode(extractCvText(bytes("not a pdf at all")))).toBe("cv_not_pdf");
  });

  it("rejects files over the size limit", async () => {
    const big = new Uint8Array(MAX_CV_BYTES + 1);
    big.set(bytes("%PDF-"));
    expect(await errorCode(extractCvText(big))).toBe("cv_too_large");
  });

  it("rejects corrupt PDFs", async () => {
    expect(await errorCode(extractCvText(bytes("%PDF-1.4\ngarbage")))).toBe("cv_unreadable");
  });
});
