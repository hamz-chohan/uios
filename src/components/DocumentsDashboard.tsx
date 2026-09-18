"use client";

// /docgen landing - the document registry. Documents are listed newest-first
// from the in-memory store, or start the generate path.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type DocumentSummary } from "@/lib/client/api";
import { StatusChip } from "@/components/StatusChip";
import { modelLabel } from "@/lib/adapters/models";
import type { UnitStatus } from "@/lib/types";

// Statuses worth calling out in the roll-up, in display order.
const ROLLUP: UnitStatus[] = [
  "NEEDS_AUTHOR",
  "NEEDS_VALIDATION",
  "PENDING",
  "OVERRIDDEN",
  "APPROVED",
];

export function DocumentsDashboard() {
  const [docs, setDocs] = useState<DocumentSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .listDocuments()
      .then((d) => {
        if (alive) setDocs(d);
      })
      .catch((err) => {
        if (alive) {
          setError(err instanceof Error ? err.message : String(err));
          setDocs([]);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  async function handleDelete(id: string) {
    if (
      !window.confirm(
        `Delete ${id}? The document and its sections are removed; its correction history stays in the audit trail.`
      )
    ) {
      return;
    }
    setError(null);
    try {
      await api.deleteDocument(id);
      setDocs((prev) => prev?.filter((d) => d.doc.id !== id) ?? prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto bg-[#f6f7f9]">
        <div className="mx-auto max-w-[880px] px-8 pb-16 pt-7">
          <div className="mb-[22px] flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow mb-1.5">DocGen</p>
              <h1 className="title-mark mb-2 text-[28px] font-bold tracking-[-0.03em]">
                Documents
              </h1>
              <p className="max-w-[480px] text-[13.5px] leading-[1.55] text-muted">
                Every generated document persists with its skill revision,
                statuses, and correction trail. Open one to continue review,
                or draft a new one.
              </p>
            </div>
            <Link href="/docgen/new" className="btn btn-primary h-8 shrink-0">
              New document
            </Link>
          </div>

          {error && (
            <p className="mb-4 text-[12.5px] text-status-author" role="alert">
              {error}
            </p>
          )}

          {docs === null ? (
            <div className="space-y-2">
              <div className="skeleton h-16 w-full" />
              <div className="skeleton h-16 w-full" />
            </div>
          ) : docs.length === 0 ? (
            <div className="surface-card p-10 text-center">
              <p className="font-semibold text-[17px]">No documents yet.</p>
              <p className="mx-auto mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
                Pick a skill published from Skill Creator, attach sources, and
                generate - the .md file defines the sections.
              </p>
              <Link href="/docgen/new" className="btn btn-primary mt-6 inline-flex">
                Generate your first document
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-hairline overflow-hidden rounded-lg border border-hairline bg-surface">
              {docs.map(({ doc, skillTitle, unitCount, statusCounts }) => {
                const attention = ROLLUP.filter((s) => statusCounts[s]);
                const filled =
                  (statusCounts["FILLED_CITED"] ?? 0) +
                  (statusCounts["APPROVED"] ?? 0);
                return (
                  <li key={doc.id} className="group relative">
                    <Link
                      href={`/docgen/${encodeURIComponent(doc.id)}`}
                      className="flex items-center gap-4 py-4 pl-5 pr-12 transition-colors hover:bg-chrome"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15.5px] font-semibold tracking-[-0.01em]">
                          {skillTitle}
                        </p>
                        <p className="mt-[3px] font-mono text-[11px] text-muted">
                          {doc.id} · skill v{doc.skillRev} ·{" "}
                          {modelLabel(doc.modelId)} ·{" "}
                          {new Date(doc.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="font-mono text-[11px] text-muted">
                          {filled}/{unitCount} filled
                        </span>
                        {attention.map((s) => (
                          <StatusChip key={s} status={s} count={statusCounts[s]} />
                        ))}
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-[13px] font-medium text-accent">
                        Open →
                      </span>
                    </Link>
                    <button
                      type="button"
                      aria-label={`Delete ${doc.id}`}
                      title={`Delete ${doc.id}`}
                      onClick={() => void handleDelete(doc.id)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[4px] p-1.5 text-muted opacity-0 transition-all hover:bg-status-author/10 hover:text-status-author focus-visible:opacity-100 group-hover:opacity-100"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        <line x1="10" y1="11" x2="10" y2="17" />
                        <line x1="14" y1="11" x2="14" y2="17" />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}
