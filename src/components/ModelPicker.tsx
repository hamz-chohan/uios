"use client";

import type { ModelId } from "@/lib/types";
import { availableModels } from "@/lib/adapters/models";

// Registry models plus the offline mock (credential-free walkthrough).
type Option = { id: ModelId; label: string; disabled?: boolean; group?: string };

const OPTIONS: Option[] = [
  ...availableModels,
  { id: "mock", label: "Mock (offline)" },
];

// Contiguous entries sharing a `group` render under one <optgroup> header
// (e.g. the not-yet-enabled Claude lineup under "Available upon request").
const CHUNKS = OPTIONS.reduce<{ group?: string; items: Option[] }[]>(
  (acc, o) => {
    const last = acc[acc.length - 1];
    if (last && last.group === o.group) last.items.push(o);
    else acc.push({ group: o.group, items: [o] });
    return acc;
  },
  []
);

export function ModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: ModelId;
  onChange: (id: ModelId) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="eyebrow">Model</span>
      <select
        className="field mt-1.5"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as ModelId)}
      >
        {CHUNKS.map((c) =>
          c.group ? (
            <optgroup key={c.group} label={c.group}>
              {c.items.map((o) => (
                <option key={o.id} value={o.id} disabled={o.disabled}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          ) : (
            c.items.map((o) => (
              <option key={o.id} value={o.id} disabled={o.disabled}>
                {o.label}
              </option>
            ))
          )
        )}
      </select>
    </label>
  );
}
