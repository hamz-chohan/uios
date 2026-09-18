import { NextResponse } from "next/server";
import type {
  Citation,
  CorrectionEvent,
  CorrectionType,
  Unit,
} from "@/lib/types";
import { ensureReady } from "@/lib/seed";
import { recordEvent, store, upsertUnit } from "@/lib/store";

export const runtime = "nodejs";

const TYPES: CorrectionType[] = [
  "FILL_PLACEHOLDER",
  "OVERRIDE_WRONG",
  "ACCEPT",
  "FLAG",
];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  await ensureReady();
  const { unitId: rawUnitId } = await params;
  const unitId = decodeURIComponent(rawUnitId); // ids contain ":"
  const existing = store.units.get(unitId);
  if (!existing) {
    return NextResponse.json(
      { error: `Unknown unit: ${unitId}` },
      { status: 404 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    type?: CorrectionType;
    after?: string;
    reason?: string;
    actor?: string;
    assistNotes?: string; // raw notes when the fill was AI-expanded
    citations?: Citation[]; // attach on fill (used by Ground → cited fill)
    ground?: { query: string; assetIds: string[]; locators: string[] };
  } | null;
  if (!body?.type || !TYPES.includes(body.type)) {
    return NextResponse.json(
      { error: `Field "type" must be one of: ${TYPES.join(", ")}` },
      { status: 400 }
    );
  }
  if (
    (body.type === "FILL_PLACEHOLDER" || body.type === "OVERRIDE_WRONG") &&
    typeof body.after !== "string"
  ) {
    return NextResponse.json(
      { error: `Field "after" (string) is required for ${body.type}` },
      { status: 400 }
    );
  }

  const before = existing.contentMd;
  const unit: Unit = { ...existing };

  // Citations attached to a fill (e.g. from Ground) replace the unit's
  // citations; the grounding provenance also lands on the event below.
  const groundCitations =
    Array.isArray(body.citations) && body.citations.length > 0
      ? body.citations
      : null;

  switch (body.type) {
    case "FILL_PLACEHOLDER":
      unit.contentMd = body.after as string;
      unit.status = "FILLED_CITED";
      unit.confidence = 1;
      if (groundCitations) unit.citations = groundCitations;
      break;
    case "OVERRIDE_WRONG":
      unit.contentMd = body.after as string;
      unit.status = "OVERRIDDEN";
      if (groundCitations) unit.citations = groundCitations;
      break;
    case "ACCEPT":
      unit.status = "APPROVED";
      delete unit.previousContentMd;
      delete unit.previousSkillRev;
      break;
    case "FLAG":
      unit.status = "NEEDS_VALIDATION";
      break;
  }

  unit.version = existing.version + 1;
  unit.updatedAt = new Date().toISOString();
  upsertUnit(unit);

  // Assist provenance (fill only): the server stamps which model expanded the
  // notes - the doc's model, same one generation uses - never the client.
  const assistNotes =
    body.type === "FILL_PLACEHOLDER" && typeof body.assistNotes === "string"
      ? body.assistNotes.trim()
      : "";
  const doc = store.docs.get(existing.docId);

  const event: CorrectionEvent = {
    unitId: unit.id,
    actor: body.actor ?? "demo",
    ts: unit.updatedAt,
    type: body.type,
    before,
    after:
      body.type === "FILL_PLACEHOLDER" || body.type === "OVERRIDE_WRONG"
        ? unit.contentMd
        : "",
    reason: body.reason,
    ...(assistNotes
      ? {
          assist: {
            notes: assistNotes,
            modelId: doc?.modelId ?? existing.modelId,
          },
        }
      : {}),
    ...(body.ground &&
    typeof body.ground.query === "string" &&
    Array.isArray(body.ground.assetIds)
      ? {
          ground: {
            query: body.ground.query,
            assetIds: body.ground.assetIds,
            locators: Array.isArray(body.ground.locators)
              ? body.ground.locators
              : [],
          },
        }
      : {}),
  };
  recordEvent(event);

  return NextResponse.json({ unit, event });
}
