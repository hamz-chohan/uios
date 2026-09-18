import { authorSkillMarkdown } from "@/lib/adapters/skillAuthor";
import { parseSkill } from "@/lib/skill";
import { store } from "@/lib/store";
import type { Skill } from "@/lib/types";

function slugify(name: string): string {
  return (
    (name || "new-skill")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "new-skill"
  );
}

function uniqueId(desired: string): string {
  const base = slugify(desired);
  if (!store.skills.has(base)) return base;
  let n = 2;
  while (store.skills.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function titleFromPrompt(prompt: string): string {
  const named = prompt.match(
    /(?:skill\s+)?(?:named|called|titled)\s+["']?(.+?)["']?(?=,|\.|$|\s+it\s+should|\s+that\s+|\s+with\s+|\s+having\s+|\s+including\s+)/i
  );
  if (named?.[1]) {
    const name = named[1].replace(/\s+/g, " ").trim();
    if (name.length >= 2 && name.length <= 72) return titleCase(name);
  }

  const section = prompt.match(
    /\b(?:the|a|an)\s+([A-Z][A-Za-z0-9 /&-]{1,40})\s+section\b/
  );
  if (section) {
    const heading = section[1].trim();
    if (/scientific response|\bsrd\b/i.test(prompt)) {
      return `${heading} - Scientific Response Document`;
    }
    return heading;
  }

  const t = String(prompt || "").trim();
  const first = t
    .split(/[.!\n]/)[0]
    .trim()
    .replace(
      /^(i\s+want\s+to\s+|please\s+)?(write|create|build|draft|make)\s+(a|an|the)\s+(skill\s+(that|to|for|named|called)\s+)?/i,
      ""
    )
    .trim();
  const words = first.split(/\s+/).filter(Boolean);
  if (words.length && words.length <= 8 && first.length <= 64) {
    return titleCase(first);
  }
  return words.slice(0, 6).map(titleWord).join(" ") || "New skill";
}

function titleWord(w: string): string {
  return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

function titleCase(s: string): string {
  return s.split(/\s+/).map(titleWord).join(" ");
}

export async function skillFromPrompt(
  prompt: string,
  existingId?: string
): Promise<Skill> {
  const title = titleFromPrompt(prompt);
  const id =
    existingId && store.skills.has(existingId)
      ? existingId
      : uniqueId(title);
  const raw = await authorSkillMarkdown(prompt, id, title);
  const parsed = parseSkill(raw);
  if (parsed.sections.length === 0) {
    throw new Error("The skill prompt did not produce any sections.");
  }
  return {
    ...parsed,
    id,
    title: parsed.title || title,
    raw,
    status: "draft",
  };
}
