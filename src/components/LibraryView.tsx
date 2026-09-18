"use client";

import { useEffect, useState } from "react";
import { api, type AssetSummary } from "@/lib/client/api";
import { EvidenceCard } from "@/components/EvidenceCard";
import { PdfPanel } from "@/components/PdfPanel";
import type { Evidence } from "@/lib/types";

const EXAMPLE_QUERIES = [
  "leachables assessment storage conditions",
  "mandatory biosimilarity footnote",
  "retest period extension",
];

export function LibraryView() {
  const [assets, setAssets] = useState<AssetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Evidence[] | null>(null);

  // The sliding document viewer.
  const [viewer, setViewer] = useState<{
    assetId: string;
    title: string;
    page: number;
    query?: string;
  } | null>(null);

  const titleFor = (id: string) =>
    assets?.find((a) => a.id === id)?.shortTitle ?? "Document";

  function openAsset(id: string) {
    setViewer({ assetId: id, title: titleFor(id), page: 1 });
  }
  function openEvidence(ev: Evidence) {
    setViewer({
      assetId: ev.assetId,
      title: ev.title,
      page: ev.page,
      query: query.trim() || undefined,
    });
  }

  useEffect(() => {
    let alive = true;
    api
      .listAssets()
      .then((a) => alive && setAssets(a))
      .catch((e) => {
        if (alive) {
          setError(e instanceof Error ? e.message : String(e));
          setAssets([]);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  async function runSearch(q: string) {
    const text = q.trim();
    if (!text || searching) return;
    setSearching(true);
    setError(null);
    try {
      const { evidence } = await api.searchLibrary(text);
      setResults(evidence);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto bg-[#f6f7f9]">
        <div className="mx-auto max-w-[860px] px-8 pt-7 pb-16">
          <p className="eyebrow mb-1.5">Library</p>
          <h1 className="title-mark mb-6 text-[28px] font-bold tracking-[-0.03em]">
            Content Library
          </h1>
          <p className="eyebrow mb-2">Ask the library</p>
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
              placeholder="Search the governed sources - e.g. leachables storage conditions"
              aria-label="Search the library"
            />
            <button
              type="submit"
              className="btn btn-primary h-9"
              disabled={searching || !query.trim()}
            >
              {searching ? "Searching…" : "Search"}
            </button>
          </form>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {EXAMPLE_QUERIES.map((q) => (
              <button
                key={q}
                type="button"
                className="inline-flex h-6 cursor-pointer items-center rounded-[2px] bg-[color-mix(in_srgb,var(--color-status-pending)_12%,transparent)] px-[9px] font-mono text-[11px] text-status-pending transition-colors hover:bg-[color-mix(in_srgb,var(--color-status-pending)_18%,transparent)]"
                onClick={() => {
                  setQuery(q);
                  void runSearch(q);
                }}
              >
                {q}
              </button>
            ))}
          </div>

          {error && (
            <p className="mt-4 text-[12.5px] text-status-author" role="alert">
              {error}
            </p>
          )}

          {results && (
            <div className="mt-6">
              <p className="eyebrow mb-2">
                {results.length} passage{results.length === 1 ? "" : "s"} · page-cited
              </p>
              <div className="space-y-2">
                {results.length === 0 ? (
                  <p className="text-[13px] text-muted">
                    No passages matched. Try different terms.
                  </p>
                ) : (
                  results.map((ev, i) => (
                    <EvidenceCard
                      key={`${ev.assetId}-${ev.page}-${i}`}
                      evidence={ev}
                      onOpen={() => openEvidence(ev)}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* Registry */}
          <div className="mt-9 mb-3 flex items-baseline justify-between">
            <p className="eyebrow">Assets</p>
            <span className="font-mono text-[11px] text-muted">
              parsed with Document AI layout parser
            </span>
          </div>

          {assets === null ? (
            <div className="space-y-2">
              <div className="skeleton h-24 w-full" />
              <div className="skeleton h-24 w-full" />
            </div>
          ) : (
            <ul className="space-y-3">
              {assets.map((a) => {
                const isRules = a.kind === "rules";
                return (
                  <li
                    key={a.id}
                    className="rounded-md border border-hairline bg-surface p-[16px_18px]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1.5 flex items-center gap-2">
                          <span
                            className="rounded-[2px] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
                            style={{
                              color: isRules
                                ? "var(--color-accent)"
                                : "var(--color-status-filled)",
                              background: isRules
                                ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                                : "color-mix(in srgb, var(--color-status-filled) 10%, transparent)",
                            }}
                          >
                            {isRules ? "Rules" : "Evidence"}
                          </span>
                          <span className="font-mono text-[10.5px] text-muted">
                            {a.org} · {a.date} · {a.pages} pp
                          </span>
                        </div>
                        <p className="text-[15.5px] font-semibold tracking-[-0.01em]">
                          {a.title}
                        </p>
                        <p className="mt-1 max-w-[560px] text-[12.5px] leading-[1.55] text-muted">
                          {a.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {a.tags.map((t) => (
                            <span
                              key={t}
                              className="rounded-[2px] bg-chrome px-1.5 py-0.5 font-mono text-[10px] text-muted"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm shrink-0"
                        onClick={() => openAsset(a.id)}
                      >
                        Open
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-8 font-mono text-[11px] leading-relaxed text-muted">
            The lightweight asset repository scoped in the POC. A vendor CCMS
            slots in behind this same interface; retrieval runs on Vertex RAG
            Engine at scale.
          </p>
        </div>
      </main>

      {viewer && (
        <PdfPanel
          assetId={viewer.assetId}
          title={viewer.title}
          initialPage={viewer.page}
          initialQuery={viewer.query}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}
