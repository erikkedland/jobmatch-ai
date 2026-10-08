/**
 * A tiny stand-in for the OpenAI client: returns canned structured outputs by
 * format name and a canned streamed letter. Lets tests run the real pipeline
 * without network, cost or nondeterminism.
 */
export const CV_TEXT = `Alex Doe – Developer
Built web apps in TypeScript and React at Acme (2022 – present).
SKILLS: TypeScript, React, Git`;

const usage = { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 0 } };

export const CANNED: Record<string, unknown> = {
  job_requirements: {
    jobTitle: "Frontend Developer",
    company: "Example AB",
    language: "en",
    requirements: [
      { text: "TypeScript", category: "must_have" },
      { text: "Kubernetes", category: "must_have" },
      { text: "AWS", category: "nice_to_have" },
    ],
  },
  cv_match: {
    matches: [
      { requirementIndex: 0, status: "met", evidence: "Built web apps in TypeScript", explanation: "ok" },
      // An invented quote: the pipeline's verification must reject it.
      { requirementIndex: 1, status: "met", evidence: "5 years of Kubernetes", explanation: "made up" },
      { requirementIndex: 2, status: "gap", evidence: null, explanation: "not in CV" },
    ],
    summary: "Good TypeScript fit.",
  },
  cv_tips: { tips: [{ title: "Describe your React work", detail: "Be specific.", requirement: null }] },
};

export const LETTER_CHUNKS = ["Dear Example AB, ", "I build TypeScript apps. ", "Best, Alex"];

export function fakeOpenAI(overrides: { refuse?: boolean } = {}) {
  return {
    responses: {
      async parse(params: { text: { format: { name: string } } }) {
        const output = overrides.refuse
          ? [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }]
          : [];
        return { output, output_parsed: CANNED[params.text.format.name], status: "completed", usage };
      },
      stream() {
        return {
          async *[Symbol.asyncIterator]() {
            for (const delta of LETTER_CHUNKS) yield { type: "response.output_text.delta", delta };
          },
          async finalResponse() {
            return { output: [], output_text: LETTER_CHUNKS.join(""), usage };
          },
        };
      },
    },
  };
}
