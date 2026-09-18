import { NextResponse } from "next/server";
import type { Skill, Unit } from "@/lib/types";
import { ensureReady } from "@/lib/seed";
import { removeDoc, store, unitsForDoc } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureReady();
  const { id } = await params;
  const doc = store.docs.get(id);
  if (!doc) {
    return NextResponse.json(
      { error: `Unknown document: ${id}` },
      { status: 404 }
    );
  }
  const skill = store.skills.get(doc.skillId);
  if (!skill) {
    return NextResponse.json(
      { error: `Skill ${doc.skillId} missing for document ${id}` },
      { status: 500 }
    );
  }
  return NextResponse.json({
    doc,
    units: inSkillOrder(unitsForDoc(id), skill),
    skill,
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureReady();
  const { id } = await params;
  if (!store.docs.has(id)) {
    return NextResponse.json(
      { error: `Unknown document: ${id}` },
      { status: 404 }
    );
  }
  removeDoc(id);
  return NextResponse.json({ ok: true });
}

// Contract: units come back in skill-section order (the store sorts
// lexicographically, which is not document order).
function inSkillOrder(units: Unit[], skill: Skill): Unit[] {
  const order = new Map(skill.sections.map((s, i) => [s.id, i]));
  return [...units].sort(
    (a, b) =>
      (order.get(a.sectionId) ?? Number.MAX_SAFE_INTEGER) -
      (order.get(b.sectionId) ?? Number.MAX_SAFE_INTEGER)
  );
}
