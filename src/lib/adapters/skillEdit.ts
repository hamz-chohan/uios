import { AnthropicVertex } from "@anthropic-ai/vertex-sdk";
import { GoogleGenAI, ThinkingLevel } from "@google/genai";

const MODEL = () => process.env.SKILL_EDIT_MODEL ?? "gemini-3.1-flash-lite";

let anthropicClient: AnthropicVertex | null = null;
function getAnthropicClient(): AnthropicVertex {
  if (!anthropicClient) {
    anthropicClient = new AnthropicVertex({
      projectId: process.env.GOOGLE_CLOUD_PROJECT,
      region: process.env.VERTEX_LOCATION ?? "global",
    });
  }
  return anthropicClient;
}

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({
      vertexai: true,
      project: process.env.GOOGLE_CLOUD_PROJECT,
      location: process.env.VERTEX_LOCATION ?? "global",
    });
  }
  return geminiClient;
}

const SYSTEM = [
  "You revise a skill file: a markdown document with YAML frontmatter and '## heading {#id}' sections containing **Expectation:** / **Sources:** / **Mandatory text:** fields.",
  "Apply the user's instruction to the skill and return ONLY the full revised skill markdown - no commentary, no code fences, no explanation.",
  "Keep the frontmatter intact (do not change id, version, or title unless the instruction explicitly says so).",
  "Change only what the instruction requires; leave every other section byte-for-byte identical.",
].join(" ");

export function skillModelLive(): boolean {
  return (
    process.env.MODEL_MODE === "live" && !!process.env.GOOGLE_CLOUD_PROJECT
  );
}

export async function rewriteSkill(
  raw: string,
  instruction: string
): Promise<string> {
  if (!skillModelLive()) return mockRewrite(raw, instruction);

  const text = await completeSkillModel(
    SYSTEM,
    `<skill>\n${raw}\n</skill>\n\nInstruction: ${instruction}`
  );
  const cleaned = stripCodeFences(text).trim();
  if (!cleaned) throw new Error("Skill rewrite returned an empty response");
  return cleaned + "\n";
}

export async function completeSkillModel(
  system: string,
  user: string
): Promise<string> {
  const model = MODEL();

  if (model.startsWith("claude")) {
    const message = await getAnthropicClient().messages.create({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: "user", content: user }],
    });
    return message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
  }

  const response = await getGeminiClient().models.generateContent({
    model,
    contents: user,
    config: {
      systemInstruction: system,
      maxOutputTokens: 8192,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });
  const text = response.text ?? "";
  if (!text) {
    const reason = response.candidates?.[0]?.finishReason ?? "unknown";
    throw new Error(`Skill model returned no text (finishReason: ${reason})`);
  }
  return text;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[\w-]*\s*\n([\s\S]*?)\n?```\s*$/);
  return fenced ? fenced[1] : trimmed;
}

// ---------------------------------------------------------------------------
// Deterministic mock path
// ---------------------------------------------------------------------------

interface RawSection {
  start: number; // offset of the "## " heading line in raw
  end: number; // offset one past the section block
  heading: string; // heading text without {#id}
  id: string;
  number?: string; // leading "3" / "3.2" if the heading carries one
}

function splitSections(raw: string): RawSection[] {
  const sections: RawSection[] = [];
  const re = /^##\s+(.*?)(?:\s*\{#([\w-]+)\})?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    const headingRaw = m[1].trim();
    const num = headingRaw.match(/^(\d+(?:\.\d+)*)[.)]?\s/);
    sections.push({
      start: m.index,
      end: raw.length, // fixed up below
      heading: headingRaw,
      id: m[2] ?? slugify(headingRaw),
      number: num?.[1],
    });
  }
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i].end = sections[i + 1].start;
  }
  return sections;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/^[\d.\s]+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const STOPWORDS = new Set([
  "section",
  "sections",
  "with",
  "from",
  "this",
  "that",
  "into",
  "under",
  "requirement",
  "statement",
]);

function scoreSection(section: RawSection, instruction: string): number {
  const instr = instruction.toLowerCase();
  let score = 0;

  // Number reference: exact "3.2" beats prefix "3.x" → section 3.
  const numbers = instr.match(/\b\d+(?:\.\d+)*\b/g) ?? [];
  if (section.number) {
    for (const n of numbers) {
      if (n === section.number) score += 100;
      else if (n.startsWith(section.number + ".")) score += 60;
    }
  }

  // Id slug, as-is or with hyphens spelled as spaces.
  if (section.id) {
    if (instr.includes(section.id)) score += 80;
    else if (instr.includes(section.id.replace(/-/g, " "))) score += 80;
  }

  // Heading word overlap.
  const words = section.heading
    .toLowerCase()
    .replace(/^[\d.\s]+/, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
  for (const w of words) {
    if (instr.includes(w)) score += 10;
  }

  return score;
}

// Turn the instruction into the sentence we append: strip the trailing
// section reference ("... to 3.2", "... in the dosing section"), capitalize,
// terminate with a period.
function deriveSentence(instruction: string, target: RawSection): string {
  let s = instruction.trim().replace(/^please\s+/i, "");

  // Leading section reference: "In section 3, …" / "For the dosing section: …"
  s = s.replace(
    /^(?:in|for|under|within)\s+(?:the\s+)?section\s+\d+(?:\.\d+)*[,:]?\s*/i,
    ""
  );
  s = s.replace(
    new RegExp(
      `^(?:in|for|under|within)\\s+(?:the\\s+)?(?:${escapeRe(target.id).replace(
        /\\-/g,
        "[\\s-]"
      )}|${escapeRe(
        target.heading.replace(/^[\d.\s]+/, "")
      )})(?:\\s+section)?[,:]?\\s*`,
      "i"
    ),
    ""
  );
  // Instruction wrappers → requirement voice:
  // "add a requirement to state X" → "state X"; "ensure that X" → "X".
  s = s.replace(
    /^(?:add|include)\s+(?:a\s+)?(?:new\s+)?(?:requirement|statement|sentence|line|note)\s+(?:to|that|on|about|for)\s+/i,
    ""
  );
  s = s.replace(/^(?:require|ensure|make sure)\s+(?:that\s+|to\s+)?/i, "");

  const patterns: RegExp[] = [
    // "... to/in/for (section) 3.2"
    /\s+(?:to|in|into|under|for|of)\s+(?:section\s+)?\d+(?:\.\d+)*\.?\s*$/i,
    // "... to/in the dosing section" / "... to evidence-summary"
    new RegExp(
      `\\s+(?:to|in|into|under|for)\\s+(?:the\\s+)?(?:section\\s+)?${escapeRe(
        target.id
      ).replace(/\\-/g, "[\\s-]")}(?:\\s+section)?\\s*$`,
      "i"
    ),
    // "... to the Dosing and Administration section"
    new RegExp(
      `\\s+(?:to|in|into|under|for)\\s+(?:the\\s+)?(?:section\\s+)?${escapeRe(
        target.heading.replace(/^[\d.\s]+/, "")
      )}(?:\\s+section)?\\s*$`,
      "i"
    ),
  ];
  for (const re of patterns) s = s.replace(re, "");

  s = s.trim().replace(/[.\s]+$/, "");
  if (!s) s = instruction.trim().replace(/[.\s]+$/, "");
  return s.charAt(0).toUpperCase() + s.slice(1) + ".";
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appendToExpectation(block: string, sentence: string): string {
  // Mirror the parser's field regex: expectation runs until the next bold
  // label, so appending at its end keeps every other field untouched.
  const re = /(\*\*Expectation:\*\*\s*[\s\S]*?)(?=\n\*\*[A-Z][\w ]*:\*\*|$)/;
  const m = block.match(re);
  if (!m) {
    // No Expectation field - insert one right after the heading line.
    return block.replace(/^(##[^\n]*\n?)/, (h) =>
      h.endsWith("\n")
        ? `${h}**Expectation:** ${sentence}\n`
        : `${h}\n**Expectation:** ${sentence}\n`
    );
  }
  const captured = m[1];
  const body = captured.replace(/\s+$/, "");
  const trailing = captured.slice(body.length);
  const index = block.indexOf(captured);
  return (
    block.slice(0, index) +
    body +
    " " +
    sentence +
    trailing +
    block.slice(index + captured.length)
  );
}

function mockRewrite(raw: string, instruction: string): string {
  const sections = splitSections(raw);
  if (sections.length === 0) return raw; // nothing to edit against

  let target = sections[0];
  let best = 0;
  for (const s of sections) {
    const score = scoreSection(s, instruction);
    if (score > best) {
      best = score;
      target = s;
    }
  }

  const sentence = deriveSentence(instruction, target);
  const block = raw.slice(target.start, target.end);
  const revised = appendToExpectation(block, sentence);
  return raw.slice(0, target.start) + revised + raw.slice(target.end);
}
