"use client";

import type { Evidence } from "@/lib/types";

// One retrieval hit: kind badge, page-accurate locator, excerpt, and (optional)
// actions. Shared by the Library search view and the Ground flow in the drawer.
export function EvidenceCard({
  evidence,
  selected,
  onSelect,
  onOpen,
}: {
  evidence: Evidence;
  selected?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
}) {
  const isRules = evidence.kind === "rules";
  return (
    <div
      className={`rounded-[6px] border p-3 transition-colors ${
        selected
          ? "border-accent bg-accent/5"
          : "border-hairline bg-surface hover:border-accent/40"
      }`}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 min-w-0">
          <span
            className="shrink-0 rounded-[2px] px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.06em]"
            style={{
              color: isRules ? "var(--color-accent)" : "var(--color-status-filled)",
              background: isRules
                ? "color-mix(in srgb, var(--color-accent) 10%, transparent)"
                : "color-mix(in srgb, var(--color-status-filled) 10%, transparent)",
            }}
          >
            {isRules ? "Rules" : "Evidence"}
          </span>
          <span className="truncate font-mono text-[12.5px] font-medium text-muted">
            {evidence.locator}
          </span>
        </span>
        <span className="shrink-0 font-mono text-[11px] uppercase tracking-[0.04em] text-muted">
          {evidence.score >= 0.55 ? "strong match" : "partial match"}
        </span>
      </div>

      <p className="text-[13.5px] leading-relaxed text-ink">{evidence.excerpt}</p>

      {(onSelect || onOpen) && (
        <div className="mt-2.5 flex gap-2">
          {onSelect && (
            <button
              type="button"
              className={selected ? "btn btn-primary btn-sm" : "btn btn-secondary btn-sm"}
              onClick={onSelect}
            >
              {selected ? "Selected ✓" : "Use this"}
            </button>
          )}
          {onOpen && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onOpen}
            >
              Open document
            </button>
          )}
        </div>
      )}
    </div>
  );
}
