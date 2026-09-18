"use client";

import type { SkillSection, Unit, UnitStatus } from "@/lib/types";
import { StatusChip } from "./StatusChip";

const FILTER_ORDER: UnitStatus[] = [
  "NEEDS_AUTHOR",
  "NEEDS_VALIDATION",
  "FILLED_CITED",
  "OVERRIDDEN",
  "APPROVED",
  "PENDING",
];

interface Props {
  sections: SkillSection[];
  units: Record<string, Unit>; // keyed by sectionId
  inFlight: ReadonlySet<string>; // sections currently generating
  activeSectionId: string | null;
  showStatus: boolean; // false during setup (skill preview mode)
  showFilters: boolean; // punch-list mode (review phase)
  filter: UnitStatus | null;
  onFilterChange: (f: UnitStatus | null) => void;
  onSelect: (id: string) => void;
}

export function SectionTree({
  sections,
  units,
  inFlight,
  activeSectionId,
  showStatus,
  showFilters,
  filter,
  onFilterChange,
  onSelect,
}: Props) {
  const counts: Partial<Record<UnitStatus, number>> = {};
  for (const s of sections) {
    const u = units[s.id];
    if (u) counts[u.status] = (counts[u.status] ?? 0) + 1;
  }

  const needsAuthor = counts.NEEDS_AUTHOR ?? 0;
  const needsValidation = counts.NEEDS_VALIDATION ?? 0;
  const punchline =
    needsAuthor + needsValidation === 0
      ? "no open items"
      : [
          needsAuthor > 0
            ? `${needsAuthor} need${needsAuthor === 1 ? "s" : ""} author`
            : null,
          needsValidation > 0
            ? `${needsValidation} need${needsValidation === 1 ? "s" : ""} validation`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");

  const visible = filter
    ? sections.filter((s) => units[s.id]?.status === filter)
    : sections;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showFilters && (
        <div className="border-b border-hairline px-4 py-2.5">
          <p className="font-mono text-[11px] text-muted">{punchline}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className="chip chip-filter"
              data-status="PENDING"
              aria-pressed={filter === null}
              onClick={() => onFilterChange(null)}
            >
              All · {sections.length}
            </button>
            {FILTER_ORDER.filter((st) => (counts[st] ?? 0) > 0).map((st) => (
              <button
                key={st}
                type="button"
                className="chip chip-filter"
                data-status={st}
                aria-pressed={filter === st}
                onClick={() => onFilterChange(filter === st ? null : st)}
              >
                {counts[st]}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="min-h-0 flex-1 overflow-y-auto py-1" role="list">
        {visible.length === 0 && (
          <li className="px-4 py-3 text-[12.5px] text-muted">
            No sections match this filter.
          </li>
        )}
        {visible.map((s) => {
          const unit = units[s.id];
          const busy = inFlight.has(s.id);
          return (
            <li key={s.id}>
              <button
                type="button"
                className="tree-row"
                data-active={activeSectionId === s.id}
                onClick={() => onSelect(s.id)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.heading}</span>
                  {!showStatus && (
                    <span className="block truncate font-mono text-[10.5px] text-muted">
                      sources: {s.sources.length ? s.sources.join(", ") : "-"}
                    </span>
                  )}
                </span>
                {showStatus &&
                  (busy ? (
                    <span
                      className="spinner"
                      role="status"
                      aria-label="Generating"
                    />
                  ) : unit ? (
                    <StatusChip status={unit.status} />
                  ) : null)}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
