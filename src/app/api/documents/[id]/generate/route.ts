import { NextResponse } from "next/server";
import type { GeneratedUnitPayload, Unit } from "@/lib/types";
import { ensureReady } from "@/lib/seed";
import { store, upsertUnit } from "@/lib/store";
import { getAdapter } from "@/lib/adapters";
import { sourcesFor } from "@/lib/sources";

export const runtime = "nodejs";

// SSE generation. Per requested section, in
// skill order with the live section LAST:
//   event: unit-start  {"sectionId"}
//   event: delta       {"sectionId","text"}   (live section only)
//   event: unit        {<full Unit JSON>}
// then a single:
//   event: done        {"docId"}
export async function POST(
  req: Request,
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

  const body = (await req.json().catch(() => null)) as {
    sectionIds?: string[];
    liveSectionId?: string;
    regenerate?: boolean;
  } | null;
  if (!body || !Array.isArray(body.sectionIds)) {
    return NextResponse.json(
      { error: "Required field: sectionIds[]" },
      { status: 400 }
    );
  }

  const sections = new Map(skill.sections.map((s) => [s.id, s]));
  const requested = new Set(body.sectionIds.filter((s) => sections.has(s)));
  const liveSectionId =
    body.liveSectionId && requested.has(body.liveSectionId)
      ? body.liveSectionId
      : undefined;
  const regenerate = body.regenerate === true;

  // Skill order, live section moved to the end so it streams as the finale.
  const ordered = skill.sections
    .map((s) => s.id)
    .filter((sid) => requested.has(sid) && sid !== liveSectionId);
  if (liveSectionId) ordered.push(liveSectionId);

  const adapter = getAdapter(doc.modelId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // A client disconnect closes the controller mid-run. Generation must
      // still complete and persist server-side - sends just become no-ops.
      // Without this, an enqueue throw propagates into the adapter's onDelta
      // and poisons the unit as NEEDS_VALIDATION ("Controller is already
      // closed") for nothing more than a dropped connection.
      let clientGone = false;
      const send = (event: string, data: unknown) => {
        if (clientGone) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          clientGone = true;
        }
      };

      try {
        for (const sectionId of ordered) {
          const section = sections.get(sectionId)!;
          send("unit-start", { sectionId });

          const isLive = sectionId === liveSectionId;
          let payload: GeneratedUnitPayload;
          try {
            const args = {
              section,
              sourceExcerpts: sourcesFor(section.sources).map((s) => ({
                sourceId: s.id,
                text: s.text,
              })),
              docTitle: skill.title,
            };
            payload = isLive
              ? await adapter.generateStream(args, (text) =>
                  send("delta", { sectionId, text })
                )
              : await adapter.generate(args);
          } catch (err) {
            // Hard-fail the unit on malformed content.
            payload = {
              contentMd: "",
              citations: [],
              confidence: 0,
              status: "NEEDS_VALIDATION",
              note: `Generation failed: ${
                err instanceof Error ? err.message : String(err)
              }`,
            };
          }

          const unitId = `${id}:${sectionId}`;
          const existing = store.units.get(unitId);
          const unit: Unit = {
            id: unitId,
            docId: id,
            sectionId,
            heading: section.heading,
            contentMd: payload.contentMd,
            citations: payload.citations,
            confidence: payload.confidence,
            status: payload.status,
            modelId: doc.modelId,
            skillRev: skill.version, // pinned to the rev that produced it
            version: (existing?.version ?? 0) + 1,
            updatedAt: new Date().toISOString(),
            note: payload.note,
            // Regenerate stashes the old content so the UI can show the
            // old/new diff pending ACCEPT (which clears it).
            previousContentMd:
              regenerate && existing?.contentMd
                ? existing.contentMd
                : undefined,
            previousSkillRev:
              regenerate && existing?.contentMd
                ? existing.skillRev
                : undefined,
          };
          upsertUnit(unit);
          send("unit", unit);
        }
        send("done", { docId: id });
      } finally {
        if (!clientGone) {
          try {
            controller.close();
          } catch {
            /* already closed by the client */
          }
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
