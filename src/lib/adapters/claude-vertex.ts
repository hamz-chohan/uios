import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import type { GeneratedUnitPayload } from "../types";
import type { GenerateArgs, ModelAdapter } from "./types";
import { validateOrRetry } from "./schema";
import { buildSystemPrompt, buildUserContent } from "./prompt";

// Claude via Vertex AI (ADC auth - no token plumbing). Structured output is
// forced through a single tool call whose input_schema mirrors
// GeneratedUnitPayload; the tool input IS the payload.

const MODEL = () => process.env.CLAUDE_MODEL ?? "claude-opus-4-8";

let client: AnthropicVertex | null = null;
function getClient(): AnthropicVertex {
  // Lazy: never construct at module load so the app typechecks/boots with
  // zero env vars (mock mode).
  if (!client) {
    client = new AnthropicVertex({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      region: process.env.VERTEX_LOCATION ?? "global",
    });
  }
  return client;
}

const EMIT_SECTION_TOOL = {
  name: "emit_section",
  description:
    "Emit the drafted document section as a structured payload. Always call this tool exactly once.",
  input_schema: {
    type: "object" as const,
    properties: {
      status: {
        type: "string",
        enum: ["FILLED_CITED", "NEEDS_AUTHOR", "NEEDS_VALIDATION"],
        description:
          "FILLED_CITED when fully grounded and cited; NEEDS_AUTHOR when required information is absent from the sources; NEEDS_VALIDATION when unsure.",
      },
      confidence: {
        type: "number",
        minimum: 0,
        maximum: 1,
        description: "How completely the sources support the content, 0..1.",
      },
      citations: {
        type: "array",
        items: {
          type: "object",
          properties: {
            sourceId: { type: "string", description: "Id of a provided source." },
            locator: {
              type: "string",
              description:
                "Page/section marker present in the source text, e.g. \"p.2 §Synopsis\".",
            },
          },
          required: ["sourceId", "locator"],
        },
      },
      contentMd: {
        type: "string",
        description:
          "GitHub-flavored markdown body of the section (empty when status is NEEDS_AUTHOR).",
      },
      note: {
        type: "string",
        description: "Short explanation when status is not FILLED_CITED.",
      },
    },
    required: ["status", "confidence", "citations", "contentMd"],
  },
};

function userMessage(args: GenerateArgs, feedback?: string): string {
  const base = buildUserContent(args);
  return feedback ? `${base}\n\n${feedback}` : base;
}

function extractToolInput(message: {
  content: ReadonlyArray<{ type: string }>;
}): unknown {
  for (const b of message.content) {
    if (
      b.type === "tool_use" &&
      (b as { name?: string }).name === "emit_section"
    ) {
      return (b as { input?: unknown }).input;
    }
  }
  throw new Error("Model response contained no emit_section tool call");
}

async function runOnce(args: GenerateArgs, feedback?: string): Promise<unknown> {
  const message = await getClient().messages.create({
    model: MODEL(),
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: userMessage(args, feedback) }],
    tools: [EMIT_SECTION_TOOL],
    tool_choice: { type: "tool", name: "emit_section" },
  });
  return extractToolInput(message);
}

// Streaming: extracting a clean contentMd delta from partial tool-input JSON
// is unreliable across models, so we use the contract-sanctioned fallback -
// stream the request (keeps the connection warm and time-to-first-byte
// honest), await the validated payload, then emit contentMd in small chunks.
async function runOnceStreaming(
  args: GenerateArgs,
  feedback?: string
): Promise<unknown> {
  const stream = getClient().messages.stream({
    model: MODEL(),
    max_tokens: 4096,
    system: buildSystemPrompt(),
    messages: [{ role: "user", content: userMessage(args, feedback) }],
    tools: [EMIT_SECTION_TOOL],
    tool_choice: { type: "tool", name: "emit_section" },
  });
  const message = await stream.finalMessage();
  return extractToolInput(message);
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

export const claudeVertexAdapter: ModelAdapter = {
  id: "claude-opus-4-8",
  label: "Claude Opus 4.8",

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
