import { readFileSync } from "node:fs";
import path from "node:path";
import { parseSkill } from "@/lib/skill";
import { store } from "@/lib/store";

const SKILL_FILES = [
  "srd-icc-oncology.md",
  "product-quality-summary.md",
] as const;

const SKILLS_DIR = path.join(process.cwd(), "src", "data", "skills");

let ready = false;

export function ensureSeeded(): void {
  // Seeds once per process only - a deleted starter skill must stay deleted.
  if (ready) return;
  ready = true;
  for (const file of SKILL_FILES) {
    try {
      const raw = readFileSync(path.join(SKILLS_DIR, file), "utf8");
      const skill = parseSkill(raw);
      if (skill.sections.length === 0) continue;
      store.skills.set(skill.id, { ...skill, status: "published" });
    } catch {
      // A missing starter file is not fatal; the registry just starts smaller.
    }
  }
}

export async function ensureReady(): Promise<void> {
  ensureSeeded();
}
