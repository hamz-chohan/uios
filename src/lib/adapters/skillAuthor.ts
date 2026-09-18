import {
  completeSkillModel,
  skillModelLive,
} from "@/lib/adapters/skillEdit";

const ALLOWED_SOURCES = [
  "protocol",
  "inquiry",
  "csr",
  "ib",
  "quality-review",
  "biosimilar-guidance",
  "pi",
] as const;

const AUTHOR_SYSTEM = [
  "You write a skill file that a document generator will execute.",
  "Return ONLY markdown - no commentary, no code fences.",
  "Shape:",
  "---",
  'id: <given id>',
  'version: "1"',
  "title: <given title or a better title from the prompt>",
  "---",
  "",
  "## 1. Heading {#kebab-id}",
  "**Expectation:** instructions for the generator. Be specific to the user's prompt.",
  "**Sources:** comma-separated ids from this list only: protocol, inquiry, csr, ib, quality-review, biosimilar-guidance, pi",
  '**Mandatory text:** "verbatim sentence"  (optional)',
  "",
  "Write 3-6 sections that implement THIS prompt - not a generic template.",
  "If the prompt names a section, that section must exist.",
  "If the prompt says do not invent data, every section must say: if the fact is not in the sources, defer to the author.",
  "Do not invent product claims inside the skill. The skill is instructions, not the document.",
].join(" ");

export async function authorSkillMarkdown(
  prompt: string,
  id: string,
  title: string
): Promise<string> {
  if (skillModelLive()) {
    try {
      return await liveAuthor(prompt, id, title);
    } catch {
      // Same as DocGen: if live is misconfigured, mock still produces a file.
    }
  }
  return mockAuthor(prompt, id, title);
}

async function liveAuthor(
  prompt: string,
  id: string,
  title: string
): Promise<string> {
  const user = [
    `Skill id (keep this id): ${id}`,
    `Suggested title: ${title}`,
    `User prompt:\n${prompt}`,
  ].join("\n\n");
  const text = await completeSkillModel(AUTHOR_SYSTEM, user);
  const cleaned = stripCodeFences(text).trim();
  if (!cleaned.includes("**Expectation:**")) {
    throw new Error("Skill author returned no sections");
  }
  return cleaned.endsWith("\n") ? cleaned : `${cleaned}\n`;
}

function stripCodeFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```[\w-]*\s*\n([\s\S]*?)\n?```\s*$/);
  return fenced ? fenced[1] : trimmed;
}

interface DraftSection {
  heading: string;
  id: string;
  expectation: string;
  sources: string[];
  mandatoryText?: string;
}

function mockAuthor(prompt: string, id: string, title: string): string {
  const noInvent = /do not invent|don't invent|no invent/i.test(prompt);
  const guard = noInvent
    ? " If a required fact is not in the provided sources, defer to the author - do not invent data."
    : " Use only the provided sources; if a required fact is missing, defer to the author.";
  const sources = sourcesFromPrompt(prompt);
  const topics = topicsFromPrompt(prompt);
  const sections = topics.map((topic, i) =>
    sectionForTopic(topic, i, prompt, sources, guard)
  );

  if (/unsolicited|inquiry|scientific response|\bsrd\b/i.test(prompt)) {
    const first = sections[0];
    if (first && !first.mandatoryText) {
      first.mandatoryText =
        "This response is provided in answer to an unsolicited medical inquiry and is not intended to promote the product.";
    }
  }

  const body = sections
    .map((s, i) => {
      const lines = [
        `## ${i + 1}. ${s.heading} {#${s.id}}`,
        `**Expectation:** ${s.expectation}`,
        `**Sources:** ${s.sources.join(", ")}`,
      ];
      if (s.mandatoryText) {
        lines.push(`**Mandatory text:** "${s.mandatoryText}"`);
      }
      return lines.join("\n");
    })
    .join("\n\n");

  return `---
id: ${id}
version: "1"
title: ${title}
---

${body}
`;
}

function topicsFromPrompt(prompt: string): string[] {
  const listed = prompt.match(
    /(?:(?:\d+|one|two|three|four|five|six|seven|eight)\s+)?(?:sections?|headings?)\s+(?:including|with|are|:)\s+(.+?)(?:\s+headings?)?(?:[.!]|$)/i
  ) ?? prompt.match(
    /including(?:\s+the)?(?:\s+headings?)?[:\s]+(.+?)(?:\s+headings?)?(?:[.!]|$)/i
  );
  if (listed) {
    const parts = splitList(listed[1]);
    if (parts.length >= 2) return parts.slice(0, 8);
  }

  const covering = prompt.match(
    /covering\s+(.+?)(?:[.!]|grounded|from\s+the|using|$)/i
  );
  if (covering) {
    const parts = splitList(covering[1]);
    if (parts.length >= 2) return parts.slice(0, 6);
  }

  const named: string[] = [];
  const namedRe =
    /\b(?:the|a|an)\s+([A-Z][A-Za-z0-9 /&-]{1,40})\s+section\b/g;
  let m: RegExpExecArray | null;
  while ((m = namedRe.exec(prompt)) !== null) {
    const name = tidyTopic(m[1]);
    const words = name.split(/\s+/);
    if (
      name &&
      words.length <= 6 &&
      !/^(this|that|each|document|skill)$/i.test(name)
    ) {
      named.push(name);
    }
  }
  if (named.length) return unique(named).slice(0, 6);

  if (/quality|cmc|module 3/i.test(prompt)) {
    return ["Scope", "Control Strategy", "Storage and Handling", "Residual Risk"];
  }
  if (/safety|adverse|ib\b|investigator brochure/i.test(prompt)) {
    return ["Safety Question", "Adverse Event Profile", "Clinical Context"];
  }
  if (/scientific response|\bsrd\b|unsolicited|inquiry/i.test(prompt)) {
    return [
      "Background",
      "Clinical Question",
      "Evidence Summary",
      "Safety Profile",
    ];
  }

  return ["Purpose", "Evidence", "Response"];
}

function sectionForTopic(
  topic: string,
  index: number,
  prompt: string,
  defaultSources: string[],
  guard: string
): DraftSection {
  const id = slug(topic) || `section-${index + 1}`;
  const sources = sourcesForTopic(topic, defaultSources);
  const brief = prompt.replace(/\s+/g, " ").trim();
  const lead =
    index === 0
      ? `The skill request: "${brief.slice(0, 220)}${brief.length > 220 ? "…" : ""}". `
      : "";
  return {
    heading: titleCase(topic),
    id,
    expectation: `${lead}Draft the ${topic.toLowerCase()} using only the listed sources. Follow the author's request exactly.${guard}`,
    sources,
  };
}

function sourcesFromPrompt(prompt: string): string[] {
  const found = new Set<string>();
  const p = prompt.toLowerCase();
  const map: [string, string[]][] = [
    ["protocol", ["protocol"]],
    ["inquiry", ["inquiry", "unsolicited", "hcp", "question"]],
    ["csr", ["csr", "clinical study", "publication", "abstract", "trial", "efficacy"]],
    ["ib", ["ib", "brochure", "investigator"]],
    ["quality-review", ["quality", "cmc", "control strategy", "module 3"]],
    ["biosimilar-guidance", ["biosimilar", "guidance", "labeling"]],
    ["pi", ["prescribing", "pi", "storage", "dosing", "administration"]],
  ];
  for (const [id, keys] of map) {
    if (keys.some((k) => p.includes(k))) found.add(id);
  }
  if (found.size === 0) {
    found.add("protocol");
    found.add("csr");
  }
  return [...found].filter((id) =>
    (ALLOWED_SOURCES as readonly string[]).includes(id)
  );
}

function sourcesForTopic(topic: string, fallback: string[]): string[] {
  const t = topic.toLowerCase();
  if (/stor|dosing|administrat|prescription|precaution/.test(t)) return ["pi"];
  if (/control|quality|cmc/.test(t)) return ["quality-review"];
  if (/safety|adverse/.test(t)) return ["csr", "ib"];
  if (/question|inquiry/.test(t)) return ["inquiry"];
  if (/background|purpose|scope|introduction|history/.test(t)) return ["protocol"];
  if (/evidence|clinical|efficac|data/.test(t)) return ["csr", "ib"];
  return fallback;
}

function splitList(raw: string): string[] {
  return raw
    .split(/\s*(?:,|;|\band\b|\+|\/)\s*/i)
    .map(tidyTopic)
    .map((s) => s.replace(/\bheadings?\b/i, "").trim())
    .filter((s) => s.length >= 3 && s.length <= 48);
}

function tidyTopic(s: string): string {
  return s
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function titleCase(s: string): string {
  return s
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "section"
  );
}
