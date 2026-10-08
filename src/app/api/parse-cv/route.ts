import { CvParseError, extractCvText } from "@/lib/pdf";

export async function POST(request: Request) {
  let file: FormDataEntryValue | null;
  try {
    const form = await request.formData();
    file = form.get("cv");
  } catch {
    return Response.json({ error: "Expected a multipart form upload." }, { status: 400 });
  }

  if (!(file instanceof File)) {
    return Response.json({ error: "No CV file was uploaded." }, { status: 400 });
  }

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { text, pages } = await extractCvText(bytes);
    return Response.json({ text, pages, chars: text.length });
  } catch (err) {
    if (err instanceof CvParseError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error("Unexpected error while parsing CV", err);
    return Response.json({ error: "Something went wrong while reading the CV." }, { status: 500 });
  }
}
