export interface RawSkillSection {
  id: string;
  heading: string;
  expectation: string;
  sources: string[];
  mandatoryText?: string;
}

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export function extractSections(raw: string): RawSkillSection[] {
  const content = raw.replace(FRONTMATTER_RE, "");
  const sections: RawSkillSection[] = [];

  const blocks = content.split(/\n(?=## )/g);
  for (const block of blocks) {
    const headingMatch = block.match(/^##\s+(.*?)(?:\s*\{#([\w-]+)\})?\s*$/m);
    if (!headingMatch) continue;
    const heading = headingMatch[1].trim();
    const id = headingMatch[2] ?? slug(heading);

    const expectation = field(block, "Expectation") ?? "";
    const sources = (field(block, "Sources") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const mandatoryText = field(block, "Mandatory text")?.replace(
      /^["']|["']$/g,
      ""
    );

    sections.push({ id, heading, expectation, sources, mandatoryText });
  }
  return sections;
}

// Preview-only diff: which section ids changed in generation-relevant fields.
export function diffRawSkills(oldRaw: string, newRaw: string): string[] {
  const prev = new Map(
    extractSections(oldRaw).map((s) => [s.id, signature(s)])
  );
  const affected: string[] = [];
  for (const s of extractSections(newRaw)) {
    if (prev.get(s.id) !== signature(s)) affected.push(s.id);
  }
  return affected;
}

function signature(s: RawSkillSection): string {
  return JSON.stringify({
    heading: s.heading,
    expectation: s.expectation,
    sources: [...s.sources].sort(),
    mandatoryText: s.mandatoryText ?? "",
  });
}

export const KNOWN_SOURCE_IDS = [
  "protocol",
  "inquiry",
  "csr",
  "ib",
  "pi",
  "quality-review",
  "biosimilar-guidance",
];

export interface SkillCheck {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export function validateSkillRaw(raw: string): SkillCheck[] {
  const sections = extractSections(raw);

  const parses: SkillCheck = {
    id: "parses",
    label: "Parses into sections",
    pass: sections.length > 0,
    detail:
      sections.length > 0
        ? `${sections.length} section${sections.length === 1 ? "" : "s"} recognized.`
        : "No '## heading' sections found - the skill cannot define a document.",
  };

  const thin = sections.filter((s) => s.expectation.trim().length < 20);
  const expectations: SkillCheck = {
    id: "expectations",
    label: "Every section has an expectation",
    pass: sections.length > 0 && thin.length === 0,
    detail:
      thin.length === 0
        ? "Each section states what belongs in it."
        : `Missing or too thin: ${thin.map((s) => s.heading).join(", ")}`,
  };

  const unknown = sections.flatMap((s) =>
    s.sources.filter((src) => !KNOWN_SOURCE_IDS.includes(src))
  );
  const sourcesKnown: SkillCheck = {
    id: "sources",
    label: "Sources reference known ids",
    pass: unknown.length === 0,
    detail:
      unknown.length === 0
        ? "All declared sources are known to the knowledge layer."
        : `Unknown source id${unknown.length === 1 ? "" : "s"}: ${[...new Set(unknown)].join(", ")}`,
  };

  const ids = sections.map((s) => s.id);
  const dupes = [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))];
  const unique: SkillCheck = {
    id: "unique-ids",
    label: "Section ids are unique",
    pass: dupes.length === 0,
    detail:
      dupes.length === 0
        ? "Every section has a distinct identity."
        : `Duplicate id${dupes.length === 1 ? "" : "s"}: ${dupes.join(", ")}`,
  };

  return [parses, expectations, sourcesKnown, unique];
}

function field(block: string, label: string): string | undefined {
  const re = new RegExp(
    `\\*\\*${escapeRe(label)}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*[A-Z][\\w ]*:\\*\\*|\\n##\\s|$)`,
    "i"
  );
  const m = block.match(re);
  return m ? m[1].trim().replace(/\s*\n\s*/g, " ") : undefined;
}

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/^[\d.\s]+/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
