import { z } from "zod";

export const RequirementCategory = z.enum(["must_have", "nice_to_have", "soft_skill"]);

export const Requirement = z.object({
  text: z
    .string()
    .describe("The requirement in short, self-contained form, e.g. '3+ years of TypeScript'."),
  category: RequirementCategory.describe(
    "must_have = explicitly required; nice_to_have = meritorious/bonus; soft_skill = personal qualities.",
  ),
});

export const JobRequirements = z.object({
  jobTitle: z.string(),
  company: z.string().nullable().describe("Company name, or null if not stated."),
  language: z.enum(["sv", "en"]).describe("Language the job ad is written in."),
  requirements: z.array(Requirement),
});

export type Requirement = z.infer<typeof Requirement>;
export type JobRequirements = z.infer<typeof JobRequirements>;

export const MatchStatus = z.enum(["met", "partial", "gap"]);

/** What the model returns for each requirement. */
export const ModelMatch = z.object({
  requirementIndex: z.number().int().describe("Index of the requirement in the numbered list."),
  status: MatchStatus.describe(
    "met = the CV clearly shows it; partial = related or weaker evidence; gap = no evidence in the CV.",
  ),
  evidence: z
    .string()
    .nullable()
    .describe("An exact, verbatim quote from the CV that proves the match. Null when status is gap."),
  explanation: z.string().describe("One short sentence explaining the assessment."),
});

export const ModelMatchResult = z.object({
  matches: z.array(ModelMatch),
  summary: z.string().describe("2–3 sentences on the overall fit, strengths and the most important gaps."),
});

/** A match after our own verification step. */
export type RequirementMatch = Omit<z.infer<typeof ModelMatch>, "requirementIndex"> & {
  /** False if the model claimed evidence that does not exist in the CV. */
  verified: boolean;
};

export type MatchStatus = z.infer<typeof MatchStatus>;
export type ModelMatchResult = z.infer<typeof ModelMatchResult>;

export const JobAdText = z
  .string()
  .trim()
  .min(50, "The job ad is too short. Paste the full ad.")
  .max(30_000, "The job ad is too long (max 30,000 characters).");

export const JobAdUrl = z
  .string()
  .trim()
  .pipe(z.url({ protocol: /^https?$/, error: "Enter a valid http(s) link to the job ad." }));
