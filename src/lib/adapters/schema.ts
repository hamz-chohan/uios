import { z } from "zod";
import type { GeneratedUnitPayload } from "../types";

export const generatedUnitPayloadSchema = z.object({
  status: z.enum(["FILLED_CITED", "NEEDS_AUTHOR", "NEEDS_VALIDATION"]),
  confidence: z.number().min(0).max(1),
  citations: z.array(
    z.object({
      sourceId: z.string(),
      locator: z.string(),
    })
  ),
  contentMd: z.string(),
  note: z.string().optional(),
});

// If the model returned a JSON string (Gemini responseMimeType path), parse it
// before schema validation; otherwise pass the value through untouched.
function coerceJson(raw: unknown): unknown {
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    // Leave as-is; zod will reject it and produce a useful error for the retry.
    return raw;
  }
}

function summarize(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
  }
  return err instanceof Error ? err.message : String(err);
}

/**
 * Run a model call and validate its output against the payload schema.
 * Attempt 1 runs clean; on parse/validation failure the call is retried ONCE
 * with the validation error text as feedback appended to the prompt; a second
 * failure hard-fails to a NEEDS_VALIDATION payload.
 */
export async function validateOrRetry(
  runOnce: (feedback?: string) => Promise<unknown>
): Promise<GeneratedUnitPayload> {
  let firstError: string;
  try {
    const raw = coerceJson(await runOnce());
    return generatedUnitPayloadSchema.parse(raw) as GeneratedUnitPayload;
  } catch (err) {
    firstError = summarize(err);
  }

  try {
    const feedback =
      `Your previous response failed schema validation: ${firstError}. ` +
      `Return a corrected response that satisfies the schema exactly.`;
    const raw = coerceJson(await runOnce(feedback));
    return generatedUnitPayloadSchema.parse(raw) as GeneratedUnitPayload;
  } catch (err) {
    return {
      status: "NEEDS_VALIDATION",
      confidence: 0,
      citations: [],
      contentMd: "",
      note: `Model output failed validation after one retry: ${summarize(err)}`,
    };
  }
}
