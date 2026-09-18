import { NextResponse } from "next/server";
import { ensureReady } from "@/lib/seed";
import { store } from "@/lib/store";
import { parseSkill, diffSkills } from "@/lib/skill";
import { rewriteSkill } from "@/lib/adapters/skillEdit";

export const runtime = "nodejs";

// Chat-edit the skill markdown. Returns the proposed raw + affected section ids
// for the "N sections affected - regenerate?" modal. Does NOT persist - the
// client confirms via /save.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureReady();
  const { id } = await params;
  const skill = store.skills.get(id);
  if (!skill) {
    return NextResponse.json({ error: `Unknown skill: ${id}` }, { status: 404 });
  }

  const body = (await req.json().catch(() => null)) as {
    instruction?: string;
  } | null;
  const instruction = body?.instruction?.trim();
  if (!instruction) {
    return NextResponse.json(
      { error: "Missing required field: instruction" },
      { status: 400 }
    );
  }

  try {
    const newRaw = await rewriteSkill(skill.raw, instruction);
    const next = parseSkill(newRaw);
    const affectedSectionIds = diffSkills(skill, next);
    return NextResponse.json({ newRaw, affectedSectionIds });
  } catch (err) {
    return NextResponse.json(
      { error: `Skill rewrite failed: ${errorMessage(err)}` },
      { status: 502 }
    );
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
