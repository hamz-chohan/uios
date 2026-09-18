import { NextResponse } from "next/server";
import { ensureReady } from "@/lib/seed";
import { store } from "@/lib/store";
import { getAdapter } from "@/lib/adapters";
import { sourcesFor } from "@/lib/sources";

export const runtime = "nodejs";

// AI-assisted fill. Expands the reviewer's rough notes into section-ready markdown by injecting
// them as an authoritative `author-notes` source excerpt and re-running the
// document's own model (doc.modelId) over the section. SSE frames:
//   event: delta      data: {"text":"..."}
//   event: expanded   data: {"contentMd":"...","note"?:"..."}
//   event: error      data: {"message":"..."}
// Pure draft endpoint - never writes to the store; only Save fill mutates the
// unit. The payload's citations/status/confidence are discarded: provenance
// lands on the correction event when the fill is saved.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ unitId: string }> }
) {
  await ensureReady();
  const { unitId: rawUnitId } = await params;
  const unitId = decodeURIComponent(rawUnitId); // ids contain ":"
  const unit = store.units.get(unitId);
  if (!unit) {
    return NextResponse.json(
      { error: `Unknown unit: ${unitId}` },
      { status: 404 }
    );
  }
  const doc = store.docs.get(unit.docId);
  const skill = doc && store.skills.get(doc.skillId);
  if (!doc || !skill) {
    return NextResponse.json(
      { error: `Document or skill missing for unit ${unitId}` },
      { status: 500 }
    );
  }
  const section = skill.sections.find((s) => s.id === unit.sectionId);
  if (!section) {
    return NextResponse.json(
      { error: "Section no longer present in the current skill revision" },
      { status: 409 }
    );
  }

  const body = (await req.json().catch(() => null)) as {
    notes?: string;
  } | null;
  const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
  if (!notes) {
    return NextResponse.json(
      { error: 'Field "notes" (non-empty string) is required' },
      { status: 400 }
    );
  }

  const adapter = getAdapter(doc.modelId);
  const args = {
    section,
    // Reviewer notes lead as the authoritative excerpt; the section's normal
    // sources follow so the model can still ground surrounding context.
    sourceExcerpts: [
      { sourceId: "author-notes", text: notes },
      ...sourcesFor(section.sources).map((s) => ({
        sourceId: s.id,
        text: s.text,
      })),
    ],
    docTitle: skill.title,
  };

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // Same disconnect discipline as the generate route: a closed controller
      // must not poison the adapter's onDelta.
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
        const payload = await adapter.generateStream(args, (text) =>
          send("delta", { text })
        );
        send("expanded", {
          contentMd: payload.contentMd,
          ...(payload.note ? { note: payload.note } : {}),
        });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : String(err),
        });
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
