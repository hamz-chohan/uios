"use client";

import { useEffect, useMemo } from "react";
import type { Skill } from "@/lib/types";
import { extractSections, validateSkillRaw } from "@/lib/client/skillText";

interface Props {
  skill: Skill; // current (old) skill
  newRaw: string; // proposed markdown
  affectedSectionIds: string[];
  busy: boolean;
  hasDoc: boolean; // whether confirming triggers regeneration
  onConfirm: () => void;
  onCancel: () => void;
}

export function DiffModal({
  skill,
  newRaw,
  affectedSectionIds,
  busy,
  hasDoc,
  onConfirm,
  onCancel,
}: Props) {
  const newSections = useMemo(() => {
    const map = new Map(extractSections(newRaw).map((s) => [s.id, s]));
    return map;
  }, [newRaw]);

  const oldSections = useMemo(
    () => new Map(skill.sections.map((s) => [s.id, s])),
    [skill]
  );

  const gate = useMemo(() => validateSkillRaw(newRaw), [newRaw]);
  const gateFailed = gate.some((c) => !c.pass);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel]);

  const n = affectedSectionIds.length;
  const confirmLabel = busy
    ? "Working…"
    : n === 0
      ? "Save skill"
      : hasDoc
        ? `Regenerate ${n} section${n === 1 ? "" : "s"}`
        : `Save skill (${n} affected)`;

  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Skill change review">
        <div className="border-b border-hairline px-5 py-4">
          <p className="eyebrow mb-1">Skill change</p>
          <h2 className="text-[15px] font-semibold">
            {n === 0
              ? "No sections affected"
              : `${n} section${n === 1 ? "" : "s"} affected`}
          </h2>
          <p className="mt-0.5 font-mono text-[11px] text-muted">
            {skill.id} · v{skill.version} →{" "}
            v{String(parseInt(skill.version, 10) + 1 || "next")}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div>
            <div className="mb-1.5 flex items-baseline justify-between">
              <p className="eyebrow">Validation gate</p>
              <span className="font-mono text-[10px] text-muted">
                v2: critic loop + blinded A/B
              </span>
            </div>
            <ul className="space-y-1">
              {gate.map((c) => (
                <li
                  key={c.id}
                  className="flex items-start gap-2 text-[12.5px] leading-relaxed"
                >
                  <span
                    className={
                      c.pass
                        ? "mt-0.5 font-mono text-[11px] text-status-filled"
                        : "mt-0.5 font-mono text-[11px] text-status-author"
                    }
                    aria-hidden
                  >
                    {c.pass ? "✓" : "✕"}
                  </span>
                  <span className="min-w-0">
                    <span className={c.pass ? "" : "text-status-author"}>
                      {c.label}
                    </span>
                    {!c.pass && (
                      <span className="block text-[11.5px] text-muted">
                        {c.detail}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {n === 0 && (
            <p className="text-[13px] text-muted">
              The edit does not change any generation-relevant section content.
              Saving bumps the skill version without regenerating.
            </p>
          )}
          {affectedSectionIds.map((id) => {
            const oldS = oldSections.get(id);
            const newS = newSections.get(id);
            return (
              <div key={id}>
                <p className="mb-1.5 text-[13px] font-semibold">
                  {newS?.heading ?? oldS?.heading ?? id}
                </p>
                <div className="space-y-1.5">
                  <div className="rounded-[2px] border-l-2 border-status-author/60 bg-status-author/6 px-3 py-2">
                    <p className="eyebrow mb-0.5">Old expectation</p>
                    <p className="text-[12.5px] leading-relaxed text-muted">
                      {oldS?.expectation ?? "- (new section)"}
                    </p>
                  </div>
                  <div className="rounded-[2px] border-l-2 border-status-filled/60 bg-status-filled/6 px-3 py-2">
                    <p className="eyebrow mb-0.5">New expectation</p>
                    <p className="text-[12.5px] leading-relaxed">
                      {newS?.expectation ?? "- (section removed)"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hairline px-5 py-3">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || gateFailed}
            title={gateFailed ? "Fix the validation gate failures first" : undefined}
            onClick={onConfirm}
          >
            {gateFailed ? "Gate failed" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
