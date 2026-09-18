"use client";

import { useEffect, useState } from "react";
import type {
  Citation,
  CorrectionType,
  Evidence,
  SkillSection,
  Unit,
} from "@/lib/types";
import { postSse, readSseStream } from "@/lib/client/sse";
import { api } from "@/lib/client/api";
import { modelLabel } from "@/lib/adapters/models";
import { StatusChip } from "./StatusChip";
import { EvidenceCard } from "./EvidenceCard";
import { PdfPanel } from "./PdfPanel";

type Mode = "fill" | "override" | "flag" | null;

export interface ActionExtras {
  citations?: Citation[];
  ground?: { query: string; assetIds: string[]; locators: string[] };
}

interface Props {
  unit: Unit;
  section?: SkillSection;
  busy: boolean;
  onClose: () => void;
  onAction: (
    type: CorrectionType,
    after?: string,
    reason?: string,
    assistNotes?: string,
    extras?: ActionExtras
  ) => Promise<void>;
}

export function ReviewDrawer({ unit, section, busy, onClose, onAction }: Props) {
  const [mode, setMode] = useState<Mode>(null);
  const [text, setText] = useState("");
  // AI-assisted fill: rawNotes stashes what the reviewer typed before the
  // expansion (doubles as the "was expanded" flag for event provenance).
  const [rawNotes, setRawNotes] = useState<string | null>(null);
  const [expanding, setExpanding] = useState(false);
  const [assistHint, setAssistHint] = useState<string | null>(null);
  // The sliding document viewer, opened from an evidence card.
  const [viewer, setViewer] = useState<Evidence | null>(null);
  // Ground: retrieve evidence from the Content Library, then fill from a pick.
  const [grounding, setGrounding] = useState(false);
  const [evidence, setEvidence] = useState<Evidence[] | null>(null);
  const [groundQuery, setGroundQuery] = useState("");
  const [chosen, setChosen] = useState<Set<number>>(new Set());

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Set when a fill is composed from Ground evidence, so submit carries the
  // citations + grounding provenance onto the correction event.
  const [pendingGround, setPendingGround] = useState<ActionExtras | null>(null);

  function enter(next: Exclude<Mode, null>) {
    setMode(next);
    setText(next === "override" ? unit.contentMd : "");
    setRawNotes(null);
    setAssistHint(null);
    setPendingGround(null);
  }

  function leave() {
    setMode(null);
    setText("");
    setRawNotes(null);
    setAssistHint(null);
    setPendingGround(null);
    setGrounding(false);
    setEvidence(null);
    setChosen(new Set());
  }

  async function submit() {
    if (mode === "fill")
      await onAction(
        "FILL_PLACEHOLDER",
        text,
        undefined,
        rawNotes ?? undefined,
        pendingGround ?? undefined
      );
    else if (mode === "override")
      await onAction("OVERRIDE_WRONG", text, undefined, undefined, pendingGround ?? undefined);
    else if (mode === "flag") await onAction("FLAG", undefined, text.trim() || undefined);
    leave();
  }

  // Ground: query the Content Library for evidence supporting this unit.
  async function ground() {
    if (grounding) return;
    setGrounding(true);
    setEvidence(null);
    setChosen(new Set());
    setAssistHint(null);
    try {
      const { query, evidence: ev } = await api.groundUnit(unit.id);
      setGroundQuery(query);
      setEvidence(ev);
    } catch (err) {
      setAssistHint(err instanceof Error ? err.message : String(err));
    } finally {
      setGrounding(false);
    }
  }

  // Compose the chosen evidence into a fill: excerpts become the content,
  // locators become citations, and the query + assets ride as provenance.
  function useChosenEvidence() {
    if (!evidence) return;
    const picks = [...chosen].sort((a, b) => a - b).map((i) => evidence[i]).filter(Boolean);
    if (picks.length === 0) return;
    const mandatory = section?.mandatoryText ? `_${section.mandatoryText}_\n\n` : "";
    const body = picks
      .map((p) => `${p.excerpt}\n\n*Source: ${p.locator}*`)
      .join("\n\n");
    setMode("fill");
    setText(mandatory + body);
    setRawNotes(null);
    setPendingGround({
      citations: picks.map((p) => ({ sourceId: p.assetId, locator: p.locator })),
      ground: {
        query: groundQuery,
        assetIds: [...new Set(picks.map((p) => p.assetId))],
        locators: picks.map((p) => p.locator),
      },
    });
    setEvidence(null);
    setChosen(new Set());
  }

  function toggleChosen(i: number) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  // Expand rough notes into section-ready markdown via the document's own
  // model. Streams into the textarea; never saves - Save fill stays human.
  async function expand() {
    const stash = text;
    const notes = stash.trim();
    if (!notes || expanding || busy) return;
    setExpanding(true);
    setAssistHint(null);
    setText("");
    try {
      const res = await postSse(
        `/api/units/${encodeURIComponent(unit.id)}/expand`,
        { notes }
      );
      // Holder object: TS doesn't track narrowing through the stream callback.
      const out: {
        final: { contentMd: string; note?: string } | null;
        failure: string | null;
      } = { final: null, failure: null };
      let streamed = "";
      await readSseStream(res, (event, data) => {
        if (event === "delta") {
          streamed += (data as { text: string }).text;
          setText(streamed);
        } else if (event === "expanded") {
          out.final = data as { contentMd: string; note?: string };
        } else if (event === "error") {
          out.failure = (data as { message: string }).message;
        }
      });
      if (out.failure) throw new Error(out.failure);
      if (out.final?.contentMd.trim()) {
        setText(out.final.contentMd);
        setRawNotes(stash);
      } else {
        // Model abstained - hand the notes back untouched.
        setText(stash);
        setAssistHint(
          out.final?.note ??
            "The model couldn't expand these notes - add more detail and retry."
        );
      }
    } catch (err) {
      setText(stash);
      setAssistHint(err instanceof Error ? err.message : String(err));
    } finally {
      setExpanding(false);
    }
  }

  const confidencePct = Math.round(
    Math.max(0, Math.min(1, unit.confidence)) * 100
  );

  return (
    <aside
      className="drawer"
      role="dialog"
      aria-label={`Review ${unit.heading}`}
    >
      {/* header */}
      <div className="flex items-start justify-between gap-3 border-b border-hairline px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow mb-1">Review unit</p>
          <h2 className="truncate text-[15px] font-semibold">{unit.heading}</h2>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm -mr-1.5"
          onClick={onClose}
          aria-label="Close review drawer"
        >
          ×
        </button>
      </div>

      {/* body */}
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
        <div className="space-y-1.5">
          <StatusChip status={unit.status} />
          <p className="font-mono text-[10.5px] leading-relaxed text-muted">
            {modelLabel(unit.modelId)} · skill rev {unit.skillRev} · unit v
            {unit.version}
          </p>
        </div>

        {unit.previousContentMd !== undefined && (
          <div className="rounded-[6px] border border-status-overridden/30 bg-status-overridden/8 px-3 py-2.5 text-[12.5px] text-status-overridden">
            Regenerated after a skill change - the canvas shows old vs. new.
            Accept to approve the new version.
          </div>
        )}

        {unit.note && (
          <div
            className="rounded-[6px] px-3 py-2.5 text-[12.5px]"
            style={{
              color:
                unit.status === "NEEDS_AUTHOR"
                  ? "var(--color-status-author)"
                  : "var(--color-status-validation)",
              background:
                unit.status === "NEEDS_AUTHOR"
                  ? "color-mix(in srgb, var(--color-status-author) 8%, transparent)"
                  : "color-mix(in srgb, var(--color-status-validation) 8%, transparent)",
            }}
          >
            {unit.note}
          </div>
        )}

        <section>
          <p className="eyebrow mb-1.5">Skill expectation</p>
          {section ? (
            <blockquote className="border-l-2 border-accent/40 pl-3 text-[13px] leading-[1.55] text-ink">
              {section.expectation || "-"}
              {section.mandatoryText && (
                <span className="mt-1.5 block font-mono text-[11px] text-muted">
                  mandatory: &ldquo;{section.mandatoryText}&rdquo;
                </span>
              )}
            </blockquote>
          ) : (
            <p className="text-[12.5px] text-muted">
              Section no longer present in the current skill revision.
            </p>
          )}
        </section>

        <section>
          <p className="eyebrow mb-1.5">
            Citations ({unit.citations.length})
          </p>
          {unit.citations.length ? (
            <ul className="space-y-1">
              {unit.citations.map((c, i) => (
                <li
                  key={`${c.sourceId}-${i}`}
                  className="font-mono text-[11.5px] leading-relaxed text-ink"
                >
                  <span className="text-accent">[{c.sourceId}]</span>{" "}
                  {c.locator}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12.5px] text-muted">
              {unit.status === "NEEDS_AUTHOR"
                ? "Nothing grounded - awaiting author input."
                : "No citations recorded for this section."}
            </p>
          )}
        </section>

        <section>
          <div className="mb-1.5 flex items-baseline justify-between">
            <p className="eyebrow text-[11px]">Confidence</p>
            <span className="font-mono text-[11.5px] text-muted">
              {unit.confidence.toFixed(2)}
            </span>
          </div>
          <div
            className="conf-track"
            role="meter"
            aria-valuemin={0}
            aria-valuemax={1}
            aria-valuenow={unit.confidence}
            aria-label="Model confidence"
          >
            <div className="conf-fill" style={{ width: `${confidencePct}%` }} />
          </div>
        </section>

        {(grounding || evidence) && (
          <section>
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="eyebrow">Grounding · Content Library</p>
              {evidence && (
                <span className="font-mono text-[10.5px] text-muted">
                  {evidence.length} passage{evidence.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {grounding && (
              <p className="text-[12.5px] text-muted">
                Searching the governed sources…
              </p>
            )}
            {evidence && evidence.length === 0 && (
              <p className="text-[12.5px] text-muted">
                No supporting passage found in the library.
              </p>
            )}
            {evidence && evidence.length > 0 && (
              <>
                <div className="space-y-2">
                  {evidence.map((ev, i) => (
                    <EvidenceCard
                      key={`${ev.assetId}-${ev.page}-${i}`}
                      evidence={ev}
                      selected={chosen.has(i)}
                      onSelect={() => toggleChosen(i)}
                      onOpen={() => setViewer(ev)}
                    />
                  ))}
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={chosen.size === 0}
                    onClick={useChosenEvidence}
                  >
                    Use {chosen.size || ""} into fill
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setEvidence(null);
                      setChosen(new Set());
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </section>
        )}

        {mode && (
          <section>
            <p className="eyebrow mb-1.5">
              {mode === "fill"
                ? "Fill placeholder"
                : mode === "override"
                  ? "Override content"
                  : "Flag - reason (optional)"}
            </p>
            <textarea
              className="field field-mono min-h-[140px] resize-y"
              value={text}
              autoFocus
              readOnly={expanding}
              onChange={(e) => setText(e.target.value)}
              placeholder={
                mode === "flag"
                  ? "Why does this need validation?"
                  : mode === "fill"
                    ? "Markdown - or rough notes, then Expand…"
                    : "Markdown content…"
              }
            />
            {assistHint && (
              <p className="mt-1.5 text-[12px] text-status-validation">
                {assistHint}
              </p>
            )}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy || expanding || (mode !== "flag" && !text.trim())}
                onClick={() => void submit()}
              >
                {mode === "fill"
                  ? "Save fill"
                  : mode === "override"
                    ? "Save override"
                    : "Flag for validation"}
              </button>
              {mode === "fill" && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={busy || expanding || !text.trim()}
                  onClick={() => void expand()}
                  title="Expand rough notes into section-ready markdown using the document's model"
                >
                  {expanding ? "Expanding…" : "✦ Expand notes"}
                </button>
              )}
              {mode === "fill" && rawNotes !== null && !expanding && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setText(rawNotes);
                    setRawNotes(null);
                  }}
                >
                  Restore notes
                </button>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={expanding}
                onClick={leave}
              >
                Cancel
              </button>
            </div>
          </section>
        )}
      </div>

      <div className="border-t border-hairline px-5 py-3">
        {(unit.status === "NEEDS_AUTHOR" ||
          unit.status === "NEEDS_VALIDATION") && (
          <button
            type="button"
            className="btn btn-primary mb-2 w-full"
            disabled={busy || grounding}
            onClick={() => void ground()}
            title="Search the Content Library for evidence supporting this section"
          >
            {grounding ? "Grounding…" : "◇ Ground from library"}
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          {(unit.status === "NEEDS_AUTHOR"
            ? (["fill", "override", "accept", "flag"] as const)
            : (["accept", "fill", "override", "flag"] as const)
          ).map((action) => {
            // Ground is the primary CTA when shown (author/validation); otherwise
            // Accept leads.
            const groundShown =
              unit.status === "NEEDS_AUTHOR" ||
              unit.status === "NEEDS_VALIDATION";
            const isPrimary = !groundShown && action === "accept";
            const cls = isPrimary
              ? "btn btn-primary btn-sm h-7"
              : action === "flag"
                ? "btn btn-ghost btn-sm h-7"
                : "btn btn-secondary btn-sm h-7";
            const label =
              action === "fill"
                ? "Fill"
                : action === "override"
                  ? "Override"
                  : action === "accept"
                    ? "Accept"
                    : "Flag";
            return (
              <button
                key={action}
                type="button"
                className={cls}
                disabled={busy}
                onClick={() =>
                  action === "accept" ? void onAction("ACCEPT") : enter(action)
                }
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 font-mono text-[10.5px] text-muted">
          every action is captured as a correction event
        </p>
      </div>

      {viewer && (
        <PdfPanel
          assetId={viewer.assetId}
          title={viewer.title}
          initialPage={viewer.page}
          initialQuery={groundQuery || undefined}
          context={{
            heading: section?.heading ?? unit.heading,
            excerpt: viewer.excerpt,
            locator: viewer.locator,
          }}
          onClose={() => setViewer(null)}
        />
      )}
    </aside>
  );
}
