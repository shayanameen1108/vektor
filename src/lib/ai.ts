import { z } from "zod";

import { runtimeEnv } from "@/lib/runtime-env";

const nullableText = z.string().trim().min(1).max(300).nullable();
const aiResultSchema = z
  .object({
    tender_title: z.string().trim().min(1).max(500),
    tender_number: nullableText,
    issuing_entity: nullableText,
    required_cidb: z.string().trim().min(1).max(80).nullable(),
    closing_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .refine((value) => {
        const date = new Date(`${value}T00:00:00Z`);
        return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
      })
      .nullable(),
    mandatory_returnables: z.array(z.string().trim().min(1).max(300)).max(100),
    evaluation_criteria: z.array(z.string().trim().min(1).max(500)).max(100),
  })
  .strict();

export type AiResult = z.infer<typeof aiResultSchema>;

/** Single Workers AI model — no stub, no fallback. */
const TENDER_MODEL = "@cf/zai-org/glm-4.7-flash";
/** ~10k tokens; enough for the leading pages without filling the Worker payload. */
const TENDER_TEXT_CHARS = 40_000;

const tenderJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    tender_title: { type: "string", minLength: 1, maxLength: 500 },
    tender_number: { type: ["string", "null"], minLength: 1, maxLength: 300 },
    issuing_entity: { type: ["string", "null"], minLength: 1, maxLength: 300 },
    required_cidb: { type: ["string", "null"], minLength: 1, maxLength: 80 },
    closing_date: { type: ["string", "null"], pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    mandatory_returnables: {
      type: "array",
      maxItems: 100,
      items: { type: "string", minLength: 1, maxLength: 300 },
    },
    evaluation_criteria: {
      type: "array",
      maxItems: 100,
      items: { type: "string", minLength: 1, maxLength: 500 },
    },
  },
  required: [
    "tender_title",
    "tender_number",
    "issuing_entity",
    "required_cidb",
    "closing_date",
    "mandatory_returnables",
    "evaluation_criteria",
  ],
} as const;

export async function analyzeTenderWithAi(pdfText: string): Promise<AiResult> {
  const response = await runtimeEnv.AI.run(TENDER_MODEL, {
    messages: [
      {
        role: "system",
        content:
          "You are an expert South African public procurement auditor. Extract only facts present in the supplied tender text. Use null when a nullable fact is absent. closing_date must be ISO YYYY-MM-DD or null. required_cidb is the printed grade token(s), e.g. 6GB or 4EB or higher. Reply with JSON only.",
      },
      {
        role: "user",
        content: `Analyze this South African tender document extract:\n\n${pdfText.slice(0, TENDER_TEXT_CHARS)}`,
      },
    ],
    temperature: 0,
    max_completion_tokens: 2048,
    chat_template_kwargs: { enable_thinking: false },
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "tender_analysis",
        strict: true,
        schema: tenderJsonSchema as unknown as Record<string, unknown>,
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned no structured tender analysis");
  const parsed = aiResultSchema.parse(parseJsonContent(content));
  return {
    ...parsed,
    mandatory_returnables: dedupe(parsed.mandatory_returnables),
    evaluation_criteria: dedupe(parsed.evaluation_criteria),
  };
}

function parseJsonContent(content: string): unknown {
  const trimmed = content.trim();
  const candidates = [trimmed];
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) candidates.push(trimmed.slice(start, end + 1));

  let lastError: unknown;
  const unique = [...new Set(candidates)];
  for (const candidate of unique) {
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error("AI returned no structured tender analysis");
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.trim().toLocaleLowerCase("en-ZA");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
