// Turns a plain-text CV into a minimal text-based PDF (Helvetica, A4, multi-page).
// Used to generate demo and eval fixtures without a PDF library.
//
// Usage: node scripts/make-sample-pdf.mjs <input.txt> <output.pdf>
import { readFileSync, writeFileSync } from "node:fs";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage: node scripts/make-sample-pdf.mjs <input.txt> <output.pdf>");
  process.exit(1);
}

const LINES_PER_PAGE = 60;
const lines = readFileSync(input, "utf8").replace(/\r\n?/g, "\n").trimEnd().split("\n");

// PDF string escaping; non-ASCII (å, ä, ö) as octal escapes in WinAnsiEncoding.
const encode = (s) =>
  s
    .replace(/[\\()]/g, (c) => "\\" + c)
    .replace(/[^\x00-\x7f]/g, (c) => "\\" + c.charCodeAt(0).toString(8).padStart(3, "0"));

const pages = [];
for (let i = 0; i < lines.length; i += LINES_PER_PAGE) {
  const chunk = lines.slice(i, i + LINES_PER_PAGE);
  pages.push("BT /F1 9 Tf 40 800 Td 12.5 TL\n" + chunk.map((l) => `(${encode(l)}) '`).join("\n") + "\nET");
}

// Object layout: 1 catalog, 2 pages, 3 font, then (page, content) pairs.
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  `<< /Type /Pages /Kids [${pages.map((_, i) => `${4 + i * 2} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
];
pages.forEach((content, i) => {
  objects.push(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${5 + i * 2} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
  );
  objects.push(`<< /Length ${Buffer.byteLength(content, "latin1")} >>\nstream\n${content}\nendstream`);
});

let pdf = "%PDF-1.4\n";
const offsets = objects.map((obj, i) => {
  const offset = Buffer.byteLength(pdf, "latin1");
  pdf += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  return offset;
});
const xref = Buffer.byteLength(pdf, "latin1");
pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;

writeFileSync(output, pdf, "latin1");
console.log(`Wrote ${output} (${pages.length} page${pages.length === 1 ? "" : "s"})`);
