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

/** Input validation for the API route (the job ad comes from the user). */
export const ExtractRequest = z.object({
  jobAdText: z
    .string()
    .trim()
    .min(50, "The job ad is too short. Paste the full ad.")
    .max(30_000, "The job ad is too long (max 30,000 characters)."),
});
