import { toErrorResponse } from "@/lib/llm";
import { extractRequirements } from "@/lib/extract-requirements";
import { ExtractRequest } from "@/lib/schemas";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (body === null) {
    return Response.json({ error: "Expected a JSON body with a jobAdText field." }, { status: 400 });
  }
  const input = ExtractRequest.safeParse(body);
  if (!input.success) {
    return Response.json({ error: input.error.issues[0].message }, { status: 400 });
  }

  try {
    const result = await extractRequirements(input.data.jobAdText);
    return Response.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
