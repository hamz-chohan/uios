import { NextResponse } from "next/server";
import type { DocumentMeta, ModelId, Unit } from "@/lib/types";
import { ensureReady } from "@/lib/seed";
import { putDoc, store, unitsForDoc, upsertUnit } from "@/lib/store";

export const runtime = "nodejs";

const MODEL_IDS: ModelId[] = [
  "gemini-3.1-flash-lite",
  "claude-opus-4-8",
  "claude-fable-5", // picker-disabled placeholder until Model Garden enablement
  "claude-sonnet-5", // picker-disabled placeholder until Model Garden enablement
  "claude-opus-4-7", // picker-disabled placeholder until Model Garden enablement
  "gemini-3-pro-preview", // legacy: pre-3.1 clients/persisted docs
  "mock",
];

// Create a document from a skill: one PENDING unit per skill section.
export async function POST(req: Request) {
  await ensureReady();
  const body = (await req.json().catch(() => null)) as {
    skillId?: string;
    sourceIds?: string[];
    modelId?: string;
  } | null;

  if (!body?.skillId || !Array.isArray(body.sourceIds) || !body.modelId) {
    return NextResponse.json(
      { error: "Required fields: skillId, sourceIds[], modelId" },
      { status: 400 }
    );
  }
  if (!MODEL_IDS.includes(body.modelId as ModelId)) {
    return NextResponse.json(
      { error: `Unknown modelId: ${body.modelId}` },
      { status: 400 }
    );
  }

  const skill = store.skills.get(body.skillId);
  if (!skill) {
    return NextResponse.json(
      { error: `Unknown skill: ${body.skillId}` },
      { status: 404 }
    );
  }
  if ((skill.status ?? "published") !== "published") {
    return NextResponse.json(
      { error: "Publish the skill before generating a document." },
      { status: 400 }
    );
  }

  // doc-<n> counter; scan to survive any earlier out-of-order ids.
  let n = store.docs.size + 1;
  while (store.docs.has(`doc-${n}`)) n++;
  const docId = `doc-${n}`;
  const now = new Date().toISOString();

  const doc: DocumentMeta = {
    id: docId,
    skillId: skill.id,
    skillRev: skill.version,
    sourceIds: body.sourceIds.map(String),
    modelId: body.modelId as ModelId,
    createdAt: now,
  };
  putDoc(doc);

  const units: Unit[] = skill.sections.map((s) => ({
    id: `${docId}:${s.id}`,
    docId,
    sectionId: s.id,
    heading: s.heading,
    contentMd: "",
    citations: [],
    confidence: 0,
    status: "PENDING",
    modelId: doc.modelId,
    skillRev: skill.version,
    version: 0,
    updatedAt: now,
  }));
  for (const u of units) upsertUnit(u);

  return NextResponse.json({ doc, units }, { status: 201 });
}

// List documents for the dashboard - newest first, with a status roll-up.
export async function GET() {
  await ensureReady();
  const docs = [...store.docs.values()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt)
  );
  const documents = docs.map((doc) => {
    const units = unitsForDoc(doc.id);
    const statusCounts: Record<string, number> = {};
    for (const u of units) {
      statusCounts[u.status] = (statusCounts[u.status] ?? 0) + 1;
    }
    return {
      doc,
      skillTitle: store.skills.get(doc.skillId)?.title ?? doc.skillId,
      unitCount: units.length,
      statusCounts,
    };
  });
  return NextResponse.json({ documents });
}
