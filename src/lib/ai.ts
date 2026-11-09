import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { extractResumeText, parseSearchText, pdfToText } from "./parse";

/** AI is optional: without ANTHROPIC_API_KEY the free rule-based parsers in ./parse are used. */
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY);

// Created on first use so the app still loads when ANTHROPIC_API_KEY is not set.
let _client: Anthropic | null = null;
function client() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("AI is not set up yet: add ANTHROPIC_API_KEY to .env.local");
  return (_client ??= new Anthropic());
}
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5";

export const ExtractedProfile = z.object({
  first_name: z.string(),
  last_name: z.string(),
  headline: z.string().describe("Main role, e.g. 'PHP programmer'"),
  total_years: z.number().describe("Total years of professional experience"),
  skills: z
    .array(z.object({ skill: z.string(), years: z.number() }))
    .describe("Each skill with years of hands-on use, e.g. PHP 6, Management 2"),
  recent_roles: z
    .array(z.object({ title: z.string(), employer: z.string(), years: z.number() }))
    .describe("Up to 4 most recent roles"),
  salary_min: z.number().nullable().describe("Expected monthly salary minimum if stated, else null"),
  salary_max: z.number().nullable(),
  salary_currency: z.string().describe("ISO currency, default PHP"),
  country: z.string().nullable().describe("ISO 3166 alpha-2 country of residence, e.g. PH"),
  languages: z.array(z.string()).describe("Spoken languages, lower-case, e.g. english, filipino"),
  resume_text: z.string().describe("The resume as plain text, with phone numbers and email addresses removed"),
});
export type ExtractedProfile = z.infer<typeof ExtractedProfile>;

/** Read a resume (PDF bytes) and extract the structured seeker profile. */
export async function extractResume(pdf: Buffer): Promise<ExtractedProfile> {
  if (!aiEnabled()) return extractResumeText(await pdfToText(pdf));
  const message = await client().messages.parse({
    model: MODEL,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: pdf.toString("base64") },
          },
          {
            type: "text",
            text:
              "Extract this job seeker's profile from the resume. Estimate years per skill from the roles " +
              "where the skill was used. Use lower-case for languages. If something is not stated, use null " +
              "or an empty list rather than guessing.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(ExtractedProfile) },
  });
  if (!message.parsed_output) throw new Error("Could not read the resume");
  return message.parsed_output;
}

export const SearchFilters = z.object({
  role: z.string().nullable().describe("Role keyword, e.g. 'programmer', or null"),
  skills: z.array(z.object({ skill: z.string(), min_years: z.number() })),
  country: z.string().nullable(),
  remote: z.boolean().nullable(),
  salary_min: z.number().nullable(),
  languages: z.array(z.string()),
});
export type SearchFilters = z.infer<typeof SearchFilters>;

/** Turn one sentence ("programmer with 5 years in management and PHP") into filters. */
export async function parseSearch(query: string): Promise<SearchFilters> {
  if (!aiEnabled()) return parseSearchText(query);
  const message = await client().messages.parse({
    model: MODEL,
    max_tokens: 1000,
    messages: [
      {
        role: "user",
        content:
          "Turn this recruiting search into filters. Skills are lower-case. If no years are given for a " +
          "skill, use 0. Only include what the text says.\n\nSearch: " + query,
      },
    ],
    output_config: { format: zodOutputFormat(SearchFilters) },
  });
  if (!message.parsed_output) throw new Error("Could not understand the search");
  return message.parsed_output;
}
