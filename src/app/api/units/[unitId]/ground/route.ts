import { NextResponse } from "next/server";
import { ensureReady } from "@/lib/seed";
import { store } from "@/lib/store";
import { retrieveEvidence } from "@/lib/library/retrieve";

export const runtime = "nodejs";

// Ground a unit against the Content Library: derive a query from the section's
// expectation + heading (+ current content), retrieve evidence, return it. Pure
// read - never mutates. The SME picks evidence, then Save fill (with citations
// + ground provenance) via /action.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  await ensureReady();
  const { unitId: rawUnitId } = await params;
  const unitId = decodeURIComponent(rawUnitId);
  const unit = store.units.get(unitId);
  if (!unit) {
    return NextResponse.json({ error: `Unknown unit: ${unitId}` }, { status: 404 });
  }
  const doc = store.docs.get(unit.docId);
  const skill = doc && store.skills.get(doc.skillId);
  const section = skill?.sections.find((s) => s.id === unit.sectionId);

  // An explicit query overrides the derived one (used by "refine" in the UI).
  const body = (await req.json().catch(() => null)) as { query?: string } | null;
  const derived = [
    section?.heading ?? unit.heading,
    section?.expectation ?? "",
    unit.contentMd,
  ]
    .join(" ")
    .trim();
  const query = body?.query?.trim() || derived;

  const evidence = await retrieveEvidence(query, { k: 5 });
  return NextResponse.json({ query, evidence });
}
