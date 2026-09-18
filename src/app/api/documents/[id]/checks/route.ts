import { NextResponse } from "next/server";
import { ensureReady } from "@/lib/seed";
import { store, unitsForDoc } from "@/lib/store";

export const runtime = "nodejs";

// Two deterministic v1 eval checks:
//  - placeholders:       no unit left PENDING, or NEEDS_AUTHOR with empty content
//  - required-sections:  every skill section has a unit
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

  const units = unitsForDoc(id);

  const unfilled = units.filter(
    (u) =>
      u.status === "PENDING" ||
      (u.status === "NEEDS_AUTHOR" && u.contentMd.trim() === "")
  );
  // Labels read as achieved states; on failure the detail is a compact,
  // human sentence the strip can show directly (no "…: FAIL" double negative).
  const placeholders = {
    id: "placeholders",
    label: "Placeholders resolved",
    pass: unfilled.length === 0,
    detail:
      unfilled.length === 0
        ? "Every section has content or an explicit disposition."
        : unfilled.length === 1
          ? `1 section awaits an author - ${unfilled[0].heading}`
          : `${unfilled.length} sections await content - ${unfilled
              .map((u) => u.heading)
              .join(", ")}`,
  };

  const unitSectionIds = new Set(units.map((u) => u.sectionId));
  const missing = skill.sections.filter((s) => !unitSectionIds.has(s.id));
  const requiredSections = {
    id: "required-sections",
    label: `All ${skill.sections.length} required sections present`,
    pass: missing.length === 0,
    detail:
      missing.length === 0
        ? `All ${skill.sections.length} skill sections have a unit.`
        : `Missing: ${missing.map((s) => s.heading).join(", ")}`,
  };

  return NextResponse.json({ checks: [placeholders, requiredSections] });
}
