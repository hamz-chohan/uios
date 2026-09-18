"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import type { Evidence } from "@/lib/types";

export interface GroundContext {
  heading: string; // the section being grounded
  excerpt: string; // the passage chosen / matched
  locator: string; // where it sits, e.g. "FDA Review p.4"
}

export interface PdfPanelProps {
  assetId: string;
  title: string;
  initialPage?: number;
  initialQuery?: string; // pre-run this search (e.g. the grounding query)
  context?: GroundContext; // when present, the left rail leads with the relationship
  onClose: () => void;
}

export function PdfPanel({
  assetId,
  title,
  initialPage = 1,
  initialQuery,
  context,
  onClose,
}: PdfPanelProps) {
  const [page, setPage] = useState(initialPage);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [hits, setHits] = useState<Evidence[] | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function runSearch(q: string) {
    const text = q.trim();
    if (!text || searching) return;
    setSearching(true);
    try {
      const { evidence } = await api.searchLibrary(text, [assetId]);
      setHits(evidence);
      if (evidence[0]) setPage(evidence[0].page);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (initialQuery) void runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assetId]);

  const src = `/api/library/${encodeURIComponent(assetId)}/pdf?p=${page}#page=${page}&view=FitH`;

  return (
    <div className="fixed inset-0 z-50 flex bg-chrome" role="dialog" aria-label={`${title} viewer`}>
      {/* Left rail - the relationship + search. ~26rem, capped so the PDF gets the room. */}
      <aside className="flex h-full w-[26rem] shrink-0 flex-col border-r border-hairline bg-surface">
        <div className="flex items-center justify-between gap-2 border-b border-hairline px-4 py-2.5">
          <p className="eyebrow">
            {context ? "Grounding" : "Content Library"}
          </p>
          <button
            type="button"
            className="btn btn-ghost btn-sm -mr-1"
            onClick={onClose}
            aria-label="Close viewer"
          >
            ← Back
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {context && (
            <section>
              <p className="eyebrow mb-1.5">Section</p>
              <p className="text-[14px] font-semibold text-ink">{context.heading}</p>
              <p className="eyebrow mb-1.5 mt-3">Matched passage</p>
              <blockquote className="border-l-2 border-accent/50 pl-3 text-[13.5px] leading-relaxed text-ink">
                {context.excerpt}
              </blockquote>
              <p className="mt-2 font-mono text-[12px] font-medium text-accent">
                {context.locator}
              </p>
            </section>
          )}

          <section>
            <p className="eyebrow mb-1.5">Search this document</p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void runSearch(query);
              }}
            >
              <input
                className="field flex-1"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a passage…"
                aria-label="Search within document"
              />
              <button
                type="submit"
                className="btn btn-primary btn-sm"
                disabled={searching || !query.trim()}
              >
                {searching ? "…" : "Find"}
              </button>
            </form>
            {hits && (
              <div className="mt-2 space-y-1">
                {hits.length === 0 ? (
                  <p className="text-[13px] text-muted">No matches in this document.</p>
                ) : (
                  hits.map((h, i) => (
                    <button
                      key={`${h.page}-${i}`}
                      type="button"
                      className={`block w-full rounded-[4px] border px-2.5 py-2 text-left transition-colors ${
                        h.page === page
                          ? "border-accent bg-accent/5"
                          : "border-hairline bg-surface hover:border-accent/40"
                      }`}
                      onClick={() => setPage(h.page)}
                    >
                      <span className="font-mono text-[12px] font-medium text-accent">
                        p.{h.page}
                      </span>{" "}
                      <span className="text-[13px] text-ink">
                        {h.excerpt.slice(0, 130)}
                        {h.excerpt.length > 130 ? "…" : ""}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
          </section>
        </div>
      </aside>

      {/* Right pane - the source document. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-hairline bg-surface px-4 py-2.5">
          <h2 className="truncate text-[14px] font-semibold">{title}</h2>
          <div className="flex shrink-0 items-center gap-2">
            <span className="id-chip">page {page}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              ←
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPage((p) => p + 1)}
              aria-label="Next page"
            >
              →
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => window.open(`/api/library/${assetId}/pdf`, "_blank")}
              title="Open in a new tab"
            >
              ↗
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 bg-[#525659]">
          <iframe
            key={`${assetId}:${page}`}
            src={src}
            title={title}
            className="h-full w-full border-0"
          />
        </div>
      </div>
    </div>
  );
}
