import matter from "gray-matter";
import { createHash } from "node:crypto";
import type { Skill, SkillSection } from "./types";

// Deterministic section hash - the basis of the "N sections affected" modal.
// Only the fields that change generation output feed the hash.
export function sectionHash(s: Omit<SkillSection, "contentHash">): string {
  const basis = JSON.stringify({
    heading: s.heading,
    expectation: s.expectation,
    sources: [...s.sources].sort(),
    mandatoryText: s.mandatoryText ?? "",
  });
  return createHash("sha256").update(basis).digest("hex").slice(0, 12);
}

// A section block looks like:
// ## 1. Background {#background}
// **Expectation:** ...
// **Sources:** protocol, ib
// **Mandatory text:** "..."
export function parseSkill(raw: string): Skill {
  const { data, content } = matter(raw);
  const sections: SkillSection[] = [];

  // Split on H2 headings, keep the heading line with its block.
  const blocks = content.split(/\n(?=## )/g);
  for (const block of blocks) {
    const headingMatch = block.match(/^##\s+(.*?)(?:\s*\{#([\w-]+)\})?\s*$/m);
    if (!headingMatch) continue;
    const headingRaw = headingMatch[1].trim();
    const explicitId = headingMatch[2];
    const id = explicitId ?? slug(headingRaw);

    const expectation = field(block, "Expectation") ?? "";
    const sourcesRaw = field(block, "Sources") ?? "";
    const sources = sourcesRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const mandatoryText = field(block, "Mandatory text")?.replace(/^["']|["']$/g, "");

    const partial = { id, heading: headingRaw, expectation, sources, mandatoryText };
    sections.push({ ...partial, contentHash: sectionHash(partial) });
  }

  return {
    id: String(data.id ?? "untitled"),
    version: String(data.version ?? "1"),
    title: String(data.title ?? headingFallback(sections)),
    sections,
    raw,
  };
}

// Extract "**Label:** value" possibly spanning multiple lines until the next bold label.
function field(block: string, label: string): string | undefined {
  const re = new RegExp(
    `\\*\\*${escapeRe(label)}:\\*\\*\\s*([\\s\\S]*?)(?=\\n\\*\\*[A-Z][\\w ]*:\\*\\*|\\n##\\s|$)`,
    "i"
  );
  const m = block.match(re);
  return m ? m[1].trim().replace(/\s*\n\s*/g, " ") : undefined;
}

// Compare two skills → the section ids whose generation-relevant content changed.
export function diffSkills(prev: Skill, next: Skill): string[] {
  const prevMap = new Map(prev.sections.map((s) => [s.id, s.contentHash]));
  const affected: string[] = [];
  for (const s of next.sections) {
    if (prevMap.get(s.id) !== s.contentHash) affected.push(s.id);
  }
  return affected;
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
function headingFallback(sections: SkillSection[]): string {
  return sections[0]?.heading ?? "Untitled document";
}
