import type { GeneratedUnitPayload } from "../types";
import type { GenerateArgs, ModelAdapter } from "./types";
import { MOCK_UNITS } from "../mock";

const AUTHOR_SECTIONS = new Set(["dosing"]); // pi source intentionally absent in demo data

// Sentinel id the expand route injects for AI-assisted fill: the reviewer's
// notes ride in as a source excerpt. Never a persisted citation.
const AUTHOR_NOTES_ID = "author-notes";

const STOPWORDS = new Set(
  "a an and are as at be by for from has have if in include includes including is it its of on or per that the this to was were with".split(
    " "
  )
);

function lastSentence(text: string): string {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return sentences[sentences.length - 1] ?? "";
}

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOPWORDS.has(w));
}

function expectationTail(expectation: string, body: string): string {
  const tail = lastSentence(expectation);
  if (!tail) return "";
  const missing = significantWords(tail).filter(
    (w) => !body.toLowerCase().includes(w)
  );
  if (missing.length < 2) return "";
  return `\n\n*Skill addendum - ${tail}*`;
}

function fallbackBody(args: GenerateArgs): string {
  const { section } = args;
  const mandatory = section.mandatoryText ? `_${section.mandatoryText}_\n\n` : "";
  // Word-boundary cut - never a mid-word "Cite the source f".
  const scope =
    section.expectation.length > 220
      ? `${section.expectation.slice(0, 220).replace(/\s+\S*$/, "")}…`
      : section.expectation;
  const grounded = args.sourceExcerpts.map((s) => s.sourceId).join(", ");
  return `${mandatory}${scope}\n\n*Drafted from ${grounded} (mock model).*`;
}

function sentence(text: string): string {
  const s = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?:]$/.test(s) ? s : `${s}.`;
}

function shapeNotes(notes: string): string {
  const lines = notes
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const blocks: string[] = [];
  let prose: string[] = [];
  let list: string[] = [];
  const flushProse = () => {
    if (prose.length) blocks.push(prose.join(" "));
    prose = [];
  };
  const flushList = () => {
    if (list.length) blocks.push(list.join("\n"));
    list = [];
  };
  for (const line of lines) {
    if (/^[-*]\s+/.test(line)) {
      flushProse();
      list.push(`- ${sentence(line.replace(/^[-*]\s+/, ""))}`);
    } else {
      flushList();
      prose.push(sentence(line));
    }
  }
  flushProse();
  flushList();
  return blocks.join("\n\n");
}

function expandAuthorNotes(
  args: GenerateArgs,
  notes: string
): GeneratedUnitPayload {
  const mandatory = args.section.mandatoryText
    ? `_${args.section.mandatoryText}_\n\n`
    : "";
  return {
    contentMd: `${mandatory}${shapeNotes(notes)}\n\n*Expanded from author notes (mock model).*`,
    citations: [{ sourceId: AUTHOR_NOTES_ID, locator: "reviewer input" }],
    confidence: 0.9,
    status: "FILLED_CITED",
  };
}

async function build(args: GenerateArgs): Promise<GeneratedUnitPayload> {
  const { section } = args;
  const authorNotes = args.sourceExcerpts.find(
    (s) => s.sourceId === AUTHOR_NOTES_ID
  );
  if (authorNotes) return expandAuthorNotes(args, authorNotes.text);

  const curated = MOCK_UNITS[section.id];
  const hasSource =
    args.sourceExcerpts.length > 0 && !AUTHOR_SECTIONS.has(section.id);

  if (!hasSource) {
    if (curated?.status === "NEEDS_AUTHOR") return { ...curated };
    const plainHeading = section.heading.replace(/^\d+[.)]\s*/, "");
    return {
      contentMd: "",
      citations: [],
      confidence: 0.2,
      status: "NEEDS_AUTHOR",
      note: `No source provides the ${plainHeading.toLowerCase()} this section requires. Author to provide.`,
    };
  }

  if (curated) {
    return {
      ...curated,
      contentMd:
        curated.contentMd +
        expectationTail(section.expectation, curated.contentMd),
    };
  }

  // Unknown section (added after the fixtures were written) - generative fallback.
  return {
    contentMd: fallbackBody(args),
    citations: args.sourceExcerpts.map((s) => ({
      sourceId: s.sourceId,
      locator: `${s.sourceId} §${section.heading.replace(/^\d+[.)]\s*/, "")}`,
    })),
    confidence: 0.74,
    status: "NEEDS_VALIDATION",
  };
}

export const mockAdapter: ModelAdapter = {
  id: "mock",
  label: "Mock (offline)",
  async generate(args) {
    return build(args);
  },
  async generateStream(args, onDelta) {
    const payload = await build(args);
    // Simulate token streaming for the live-section effect.
    const words = payload.contentMd.split(" ");
    for (const w of words) {
      onDelta(w + " ");
      await new Promise((r) => setTimeout(r, 15));
    }
    return payload;
  },
};
