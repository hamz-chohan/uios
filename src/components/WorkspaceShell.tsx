"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  CorrectionType,
  DocumentMeta,
  ModelId,
  Skill,
  Unit,
  UnitStatus,
} from "@/lib/types";
import { api, type DocumentSummary, type SkillSummary } from "@/lib/client/api";
import { useGenerateStream } from "@/lib/client/useGenerateStream";
import DocumentCanvas from "@/components/DocumentCanvas";
import { SectionTree } from "./SectionTree";
import { ReviewDrawer, type ActionExtras } from "./ReviewDrawer";
import { SkillTab } from "./SkillTab";
import { TelemetryStrip } from "./TelemetryStrip";
import { ChecksStrip } from "./ChecksStrip";
import { ModelPicker } from "./ModelPicker";
import { SourceList, type SourceOption } from "./SourceList";
import { modelLabel } from "@/lib/adapters/models";
import { useAuth } from "@/contexts/AuthContext";

type Phase = "setup" | "generating" | "review";

const DEMO_SOURCES: SourceOption[] = [
  { id: "protocol", title: "Protocol Synopsis - ONC-401-202" },
  { id: "inquiry", title: "Unsolicited HCP Inquiry" },
  { id: "csr", title: "Clinical Study Report (excerpt)" },
  { id: "ib", title: "Investigator Brochure (excerpt)" },
];

const LIVE_SECTION_ID = "evidence-summary";

// With initialDocId the shell deep-loads a persisted document straight into
// review (/docgen/[docId]); without it, it starts at setup (/docgen/new).
export default function WorkspaceShell({
  initialDocId,
}: {
  initialDocId?: string;
}) {
  const { persona } = useAuth();
  // --- setup state -----------------------------------------------------------
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [skillLoading, setSkillLoading] = useState(false);
  const [checkedSources, setCheckedSources] = useState<string[]>(
    DEMO_SOURCES.map((s) => s.id)
  );
  const [modelId, setModelId] = useState<ModelId>("gemini-3.1-flash-lite");
  const [recentDocs, setRecentDocs] = useState<DocumentSummary[]>([]);

  // --- document state --------------------------------------------------------
  const [phase, setPhase] = useState<Phase>("setup");
  const [creating, setCreating] = useState(false);
  const [doc, setDoc] = useState<DocumentMeta | null>(null);
  const [units, setUnits] = useState<Record<string, Unit>>({}); // by sectionId
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set());

  // --- review state ----------------------------------------------------------
  const [tab, setTab] = useState<"sections" | "skill">("sections");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<UnitStatus | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [checksKey, setChecksKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { start, streaming, active: streamActive } = useGenerateStream({
    onUnit: (u) => {
      setUnits((prev) => ({ ...prev, [u.sectionId]: u }));
      setInFlight((prev) => {
        const next = new Set(prev);
        next.delete(u.sectionId);
        return next;
      });
    },
    onDone: () => {
      setPhase("review");
      setInFlight(new Set());
      setChecksKey((k) => k + 1);
    },
    onError: (message) => {
      setError(message);
      setInFlight(new Set());
      setPhase((p) => (p === "generating" ? "review" : p));
    },
  });

  // --- data loading ----------------------------------------------------------
  useEffect(() => {
    let alive = true;
    api
      .listSkills()
      .then((list) => {
        if (alive) setSkills(list);
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      alive = false;
    };
  }, []);

  // Setup only: know what already exists so we can offer "Continue" instead
  // of silently minting another document record per Generate click.
  useEffect(() => {
    if (initialDocId) return;
    let alive = true;
    api
      .listDocuments()
      .then((d) => {
        if (alive) setRecentDocs(d);
      })
      .catch(() => {
        // non-fatal: the setup panel just won't offer Continue
      });
    return () => {
      alive = false;
    };
  }, [initialDocId]);

  // Newest existing document for the selected skill (list is newest-first).
  const resumable = useMemo(() => {
    if (!skill) return null;
    return recentDocs.find((d) => d.doc.skillId === skill.id) ?? null;
  }, [recentDocs, skill]);

  // Deep link: load the persisted document straight into review.
  useEffect(() => {
    if (!initialDocId) return;
    let alive = true;
    api
      .getDocument(initialDocId)
      .then(({ doc: d, units: u, skill: s }) => {
        if (!alive) return;
        setDoc(d);
        setSkill(s);
        setModelId(d.modelId);
        setUnits(Object.fromEntries(u.map((x) => [x.sectionId, x])));
        setPhase("review");
      })
      .catch((err) => {
        if (alive)
          setError(
            err instanceof Error
              ? `${err.message} - it may not have been persisted; start a new document.`
              : String(err)
          );
      });
    return () => {
      alive = false;
    };
  }, [initialDocId]);

  async function selectSkill(id: string) {
    if (!id) return;
    setSkillLoading(true);
    setError(null);
    try {
      setSkill(await api.getSkill(id));
      setCheckedSources(DEMO_SOURCES.map((s) => s.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSkillLoading(false);
    }
  }

  // --- generate --------------------------------------------------------------
  async function generate() {
    if (!skill || creating) return;
    setCreating(true);
    setError(null);
    try {
      const { doc: created, units: seeded } = await api.createDocument({
        skillId: skill.id,
        sourceIds: checkedSources,
        modelId,
      });
      setDoc(created);
      setUnits(Object.fromEntries(seeded.map((u) => [u.sectionId, u])));
      setPhase("generating");
      setTab("sections");
      // Make the document linkable/refreshable without remounting the shell.
      window.history.replaceState(null, "", `/docgen/${created.id}`);

      const sectionIds = skill.sections.map((s) => s.id);
      setInFlight(new Set(sectionIds));
      const hasLive = skill.sections.some((s) => s.id === LIVE_SECTION_ID);
      void start({
        docId: created.id,
        sectionIds,
        ...(hasLive ? { liveSectionId: LIVE_SECTION_ID } : {}),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  }

  // --- section selection: scroll the canvas + open the drawer -----------------
  const selectSection = useCallback((id: string) => {
    setActiveSectionId(id);
    // The canvas anchors sections by id + data-section-id (renderer contract).
    const scrollTo = (behavior: ScrollBehavior) => {
      const el =
        document.getElementById(id) ??
        document.querySelector(`[data-section-id="${CSS.escape(id)}"]`);
      el?.scrollIntoView({ behavior, block: "start" });
    };
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => scrollTo(reduced ? "auto" : "smooth"));
    // Opening the drawer narrows the canvas column and reflows the text -
    // re-anchor once the layout settles so the section stays in view.
    window.setTimeout(() => scrollTo("auto"), 220);
  }, []);

  // --- review actions ----------------------------------------------------------
  const activeUnit = activeSectionId ? (units[activeSectionId] ?? null) : null;
  const activeSection = skill?.sections.find((s) => s.id === activeSectionId);

  async function handleAction(
    type: CorrectionType,
    after?: string,
    reason?: string,
    assistNotes?: string,
    extras?: ActionExtras
  ) {
    if (!activeUnit || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      const { unit } = await api.unitAction(activeUnit.id, {
        type,
        after,
        reason,
        actor: persona?.email ?? "studio@uios.studio",
        assistNotes,
        citations: extras?.citations,
        ground: extras?.ground,
      });
      setUnits((prev) => ({ ...prev, [unit.sectionId]: unit }));
      setChecksKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setActionBusy(false);
    }
  }

  // --- skill saved → regenerate affected sections -----------------------------
  function handleSkillSaved(saved: Skill, affectedSectionIds: string[]) {
    setSkill(saved);
    if (doc && affectedSectionIds.length > 0) {
      setTab("sections");
      setFilter(null);
      setInFlight(new Set(affectedSectionIds));
      void start({
        docId: doc.id,
        sectionIds: affectedSectionIds,
        regenerate: true,
      });
    }
  }

  const orderedUnits = useMemo(() => {
    if (!skill) return [];
    return skill.sections
      .map((s) => units[s.id])
      .filter((u): u is Unit => Boolean(u));
  }, [skill, units]);

  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* top bar */}
      <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-hairline bg-white px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/docgen"
            className="text-[17px] font-semibold tracking-tight hover:text-accent"
          >
            DocGen
          </Link>
          <span className="h-4 w-px bg-hairline" aria-hidden />
          {skill && (
            <span className="truncate text-[13px] text-muted">
              {skill.title}
            </span>
          )}
          {doc && (
            <span className="id-chip">
              {doc.id} · skill v{doc.skillRev}
            </span>
          )}
          {doc && (
            <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-full bg-[#f3eeff] px-2 py-[2px] font-mono text-[10.5px] font-medium text-[#6b38fb]">
              <span
                className="h-1.5 w-1.5 rounded-full bg-cerulean animate-[pulse_1.2s_ease-in-out_infinite_alternate]"
                aria-hidden
              />
              {modelLabel(modelId)}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {doc && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() =>
                  window.open(`/api/documents/${doc.id}/export?format=docx`)
                }
              >
                Export Word
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() =>
                  window.open(`/api/documents/${doc.id}/export`)
                }
              >
                Export PDF
              </button>
            </>
          )}
        </div>
      </header>

      {phase === "setup" ? (
        <div className="create-shell">
          <div className="surface-card create-card">
            <p className="eyebrow">DocGen · New document</p>
            <h1 className="title-mark">Create document</h1>
            <p className="create-lede">
              Select a published skill from Skill Creator to start a new
              document. The skill file defines the sections, sources, and any
              mandatory language.
            </p>

            {error && (
              <p
                className="mb-4 rounded-lg bg-[#fdecea] px-3 py-2 text-[13px] text-status-author"
                role="alert"
              >
                {error}
              </p>
            )}

            <div>
              <label className="field-label" htmlFor="docSkillSelect">
                Document skill
              </label>
              <select
                id="docSkillSelect"
                className="field"
                value={skill?.id ?? ""}
                disabled={skillLoading || skills.length === 0}
                onChange={(e) => void selectSkill(e.target.value)}
              >
                <option value="" disabled>
                  {skills.length
                    ? "Choose a skill…"
                    : "No published skills - open Skill Creator"}
                </option>
                {skills.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            {skill ? (
              <div className="skill-summary">
                <strong>{skill.title}</strong>
                <div className="text-muted">
                  {skill.sections.length} section
                  {skill.sections.length === 1 ? "" : "s"} ·{" "}
                  {[...new Set(skill.sections.flatMap((s) => s.sources))].join(
                    ", "
                  ) || "no sources declared"}
                </div>
                <div className="meta font-mono text-[11px]">
                  {skill.id}.md · v{skill.version}
                </div>
              </div>
            ) : (
              skills.length === 0 && (
                <p className="mt-4 text-[13px] leading-relaxed text-muted">
                  DocGen only lists skills published from Skill Creator. Ask a
                  Skill Creator to write and publish a .md file, then return
                  here.
                </p>
              )
            )}

            {skill && (
              <>
                <div className="mt-5">
                  <span className="field-label">Sources</span>
                  <SourceList
                    sources={DEMO_SOURCES}
                    checked={checkedSources}
                    onToggle={(id) =>
                      setCheckedSources((prev) =>
                        prev.includes(id)
                          ? prev.filter((x) => x !== id)
                          : [...prev, id]
                      )
                    }
                  />
                </div>
                <div className="mt-4">
                  <ModelPicker
                    value={modelId}
                    onChange={setModelId}
                    disabled={!skill}
                  />
                </div>
              </>
            )}

            {resumable && (
              <p className="mt-4 text-[12px] leading-snug text-muted">
                Generate starts a new document record - it won’t touch{" "}
                {resumable.doc.id}.
              </p>
            )}

            <div className="create-actions">
              <Link href="/docgen" className="btn btn-secondary">
                Cancel
              </Link>
              {resumable && (
                <Link
                  href={`/docgen/${encodeURIComponent(resumable.doc.id)}`}
                  className="btn btn-secondary"
                >
                  Continue {resumable.doc.id}
                </Link>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={!skill || checkedSources.length === 0 || creating}
                onClick={() => void generate()}
              >
                {creating ? "Preparing…" : "Generate document"}
              </button>
            </div>
          </div>
        </div>
      ) : (
      /* workspace */
      <div className="flex min-h-0 flex-1">
        {/* left pane */}
        <aside className="flex w-[300px] shrink-0 flex-col border-r border-hairline bg-surface">
              <div className="border-b border-hairline px-4 py-2.5">
                <div className="seg" role="tablist" aria-label="Left pane view">
                  <button
                    type="button"
                    className="seg-btn"
                    role="tab"
                    aria-pressed={tab === "sections"}
                    aria-selected={tab === "sections"}
                    onClick={() => setTab("sections")}
                  >
                    Sections
                  </button>
                  <button
                    type="button"
                    className="seg-btn"
                    role="tab"
                    aria-pressed={tab === "skill"}
                    aria-selected={tab === "skill"}
                    onClick={() => setTab("skill")}
                  >
                    Skill
                  </button>
                </div>
              </div>

              {tab === "sections" && skill ? (
                <SectionTree
                  sections={skill.sections}
                  units={units}
                  inFlight={inFlight}
                  activeSectionId={activeSectionId}
                  showStatus
                  showFilters={phase === "review"}
                  filter={filter}
                  onFilterChange={setFilter}
                  onSelect={selectSection}
                />
              ) : skill ? (
                <SkillTab
                  skill={skill}
                  disabled={streamActive}
                  hasDoc={Boolean(doc)}
                  onSaved={handleSkillSaved}
                />
              ) : null}

              <div className="mt-auto flex shrink-0 items-center gap-1.5 overflow-hidden border-t border-hairline px-3 py-[9px] font-mono text-[10.5px] whitespace-nowrap text-muted">
                <TelemetryStrip />
                {doc && phase === "review" && (
                  <ChecksStrip docId={doc.id} refreshKey={checksKey} />
                )}
              </div>
        </aside>

        <main className="relative flex min-w-0 flex-1">
          <div className="flex min-w-0 flex-1 flex-col">
            {error && (
              <div
                className="flex items-center justify-between gap-3 border-b border-status-author/30 bg-status-author/8 px-4 py-2 text-[12.5px] text-status-author"
                role="alert"
              >
                <span className="truncate">{error}</span>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm shrink-0"
                  onClick={() => setError(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto bg-canvas">
              <div className="mx-auto max-w-[820px] px-7 pb-[72px] pt-9">
                {doc && skill ? (
                  <DocumentCanvas
                    doc={doc}
                    skill={skill}
                    units={orderedUnits}
                    activeSectionId={activeSectionId ?? undefined}
                    streaming={streaming}
                    onSelectSection={selectSection}
                  />
                ) : (
                  <EmptyCanvas skill={skill} />
                )}
              </div>
            </div>
          </div>

          {activeUnit && (
            <ReviewDrawer
              key={activeUnit.id}
              unit={activeUnit}
              section={activeSection}
              busy={actionBusy || streamActive}
              onClose={() => setActiveSectionId(null)}
              onAction={handleAction}
            />
          )}
        </main>
      </div>
      )}
    </div>
  );
}

// White paper placeholder shown before a document exists. Once a skill is
// selected it previews the paper with the skill's section headings.
function EmptyCanvas({ skill }: { skill: Skill | null }) {
  return (
    <div className="mx-auto min-h-[70vh] max-w-[820px] rounded-xl border border-hairline bg-surface px-12 py-12 shadow-[0_2px_12px_rgba(11,37,69,0.06)]">
      {skill ? (
        <>
          <div className="mb-10 border-b border-hairline pb-3">
            <p className="eyebrow mb-1">Draft preview</p>
            <h1 className="text-[24px] font-semibold tracking-tight">
              {skill.title}
            </h1>
          </div>
          {skill.sections.map((s) => (
            <div key={s.id} className="mb-9">
              <h2 className="font-semibold text-[17px] text-muted">
                {s.heading}
              </h2>
              <div className="skeleton mt-3 h-3 w-full" />
              <div className="skeleton mt-2 h-3 w-4/5" />
            </div>
          ))}
        </>
      ) : (
        <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
          <p className="eyebrow mb-2">Canvas</p>
          <p className="max-w-xs text-[13.5px] leading-relaxed text-muted">
            Select a published skill to preview its structure, then generate
            to draft the document here.
          </p>
        </div>
      )}
    </div>
  );
}
