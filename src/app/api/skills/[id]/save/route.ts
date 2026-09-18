import { NextResponse } from "next/server";
import type { Skill } from "@/lib/types";
import { ensureReady } from "@/lib/seed";
import { putSkill, store } from "@/lib/store";
import { parseSkill, diffSkills } from "@/lib/skill";

export const runtime = "nodejs";

// Persist an edited skill: diff vs. the current version, bump the version
// (String(int + 1)), store. Returns the affected section ids so the client can
// fire the regenerate call.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureReady();
  const { id } = await params;
  const current = store.skills.get(id);
  if (!current) {
    return NextResponse.json({ error: `Unknown skill: ${id}` }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    newRaw?: string;
  } | null;
  if (!body?.newRaw || typeof body.newRaw !== "string") {
    return NextResponse.json(
      { error: "Missing required field: newRaw" },
      { status: 400 }
    );
  }

  const parsed = parseSkill(body.newRaw);
  if (parsed.sections.length === 0) {
    return NextResponse.json(
      { error: "Skill markdown parsed to zero sections - not saving." },
      { status: 400 }
    );
  }

  const affectedSectionIds = diffSkills(current, parsed);

  const currentInt = Number.parseInt(current.version, 10);
  const version = String((Number.isNaN(currentInt) ? 0 : currentInt) + 1);
  // Keep the raw frontmatter in step with the bumped version so the Skill tab
  // shows a consistent revision.
  const raw = bumpRawVersion(body.newRaw, version);

  const skill: Skill = {
    ...parsed,
    id: current.id, // route id is canonical even if the raw was hand-edited
    version,
    raw,
    status: current.status ?? "published",
  };
  putSkill(skill);

  return NextResponse.json({ skill, affectedSectionIds });
}

function bumpRawVersion(raw: string, version: string): string {
  const m = raw.match(/^---\n[\s\S]*?\n---/);
  if (!m) return raw;
  const updated = m[0].replace(/^version:.*$/m, `version: "${version}"`);
  return updated === m[0] ? raw : raw.replace(m[0], updated);
}
