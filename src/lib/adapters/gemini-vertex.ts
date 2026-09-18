import { GoogleGenAI, Type, type Schema } from "@google/genai";
import type { GeneratedUnitPayload } from "../types";
import type { GenerateArgs, ModelAdapter } from "./types";
import { validateOrRetry } from "./schema";
import { buildSystemPrompt, buildUserContent } from "./prompt";

// Gemini via Vertex AI (ADC auth). Structured output is forced through
// responseMimeType: application/json + a responseSchema mirroring
// GeneratedUnitPayload; the response text IS the payload (JSON string -
// validateOrRetry parses it).

const MODEL = () => process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  // Lazy: never construct at module load so the app typechecks/boots with
  // zero env vars (mock mode).
  if (!client) {
    client = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.VERTEX_LOCATION ?? "global",
    });
  }
  return client;
}

const RESPONSE_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    status: {
      type: Type.STRING,
      enum: ["FILLED_CITED", "NEEDS_AUTHOR", "NEEDS_VALIDATION"],
      description:
        "FILLED_CITED when fully grounded and cited; NEEDS_AUTHOR when required information is absent from the sources; NEEDS_VALIDATION when unsure.",
    },
    confidence: {
      type: Type.NUMBER,
      minimum: 0,
      maximum: 1,
      description: "How completely the sources support the content, 0..1.",
    },
    citations: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          sourceId: { type: Type.STRING, description: "Id of a provided source." },
          locator: {
            type: Type.STRING,
            description:
              'Page/section marker present in the source text, e.g. "p.2 §Synopsis".',
          },
        },
        required: ["sourceId", "locator"],
      },
    },
    contentMd: {
      type: Type.STRING,
      description:
        "GitHub-flavored markdown body of the section (empty when status is NEEDS_AUTHOR).",
    },
    note: {
      type: Type.STRING,
      description: "Short explanation when status is not FILLED_CITED.",
    },
  },
  required: ["status", "confidence", "citations", "contentMd"],
  propertyOrdering: ["status", "confidence", "citations", "contentMd", "note"],
};

function requestParams(args: GenerateArgs, feedback?: string) {
  const base = buildUserContent(args);
  return {
    model: MODEL(),
    contents: feedback ? `${base}\n\n${feedback}` : base,
    config: {
      systemInstruction: buildSystemPrompt(),
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      maxOutputTokens: 4096,
    },
  };
}

// Returns the raw JSON string; validateOrRetry parses + schema-checks it.
async function runOnce(args: GenerateArgs, feedback?: string): Promise<unknown> {
  const response = await getClient().models.generateContent(
    requestParams(args, feedback)
  );
  return response.text ?? "";
}

// Streaming: extracting a clean contentMd delta from partial JSON is
// unreliable, so we use the contract-sanctioned fallback - consume the real
// stream to completion, validate the accumulated JSON, then emit contentMd in
// small chunks.
async function runOnceStreaming(
  args: GenerateArgs,
  feedback?: string
): Promise<unknown> {
  const stream = await getClient().models.generateContentStream(
    requestParams(args, feedback)
  );
  let buffer = "";
  for await (const chunk of stream) {
    buffer += chunk.text ?? "";
  }
  return buffer;
}

async function emitInChunks(
  text: string,
  onDelta: (text: string) => void
): Promise<void> {
  const CHUNK = 40;
  for (let i = 0; i < text.length; i += CHUNK) {
    onDelta(text.slice(i, i + CHUNK));
    await new Promise((r) => setTimeout(r, 5));
  }
}

export const geminiVertexAdapter: ModelAdapter = {
  id: "gemini-3.1-flash-lite",
  label: "Gemini 3.1 Flash-Lite",

  async generate(args): Promise<GeneratedUnitPayload> {
    return validateOrRetry((feedback) => runOnce(args, feedback));
  },

  async generateStream(args, onDelta): Promise<GeneratedUnitPayload> {
    const payload = await validateOrRetry((feedback) =>
      runOnceStreaming(args, feedback)
    );
    await emitInChunks(payload.contentMd, onDelta);
    return payload;
  },
};
