"use client";

export interface SourceOption {
  id: string;
  title: string;
}

// Pre-loaded demo sources with working checkboxes (upload is an MVP topic).
export function SourceList({
  sources,
  checked,
  onToggle,
  disabled,
}: {
  sources: SourceOption[];
  checked: string[];
  onToggle: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <ul className="space-y-0.5">
      {sources.map((s) => (
        <li key={s.id}>
          <label className="flex cursor-pointer items-center gap-2.5 rounded-[6px] px-2 py-1.5 hover:bg-accent/5 has-[:disabled]:cursor-not-allowed">
            <input
              type="checkbox"
              className="size-3.5 accent-accent"
              checked={checked.includes(s.id)}
              disabled={disabled}
              onChange={() => onToggle(s.id)}
            />
            <span className="min-w-0 flex-1 truncate text-[13px]">
              {s.title}
            </span>
            <span className="font-mono text-[10.5px] uppercase tracking-[0.04em] text-muted">
              {s.id}
            </span>
          </label>
        </li>
      ))}
    </ul>
  );
}
