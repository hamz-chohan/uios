"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Skill } from "@/lib/types";
import { api } from "@/lib/client/api";
import { diffRawSkills } from "@/lib/client/skillText";
import { DiffModal } from "./DiffModal";

interface Props {
  skill: Skill;
  disabled: boolean; // e.g. while a generation stream is active
  hasDoc: boolean;
  onSaved: (skill: Skill, affectedSectionIds: string[]) => void;
}

export function SkillTab({ skill, disabled, hasDoc, onSaved }: Props) {
  const [raw, setRaw] = useState(skill.raw);
  const [instruction, setInstruction] = useState("");
  const [editBusy, setEditBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    newRaw: string;
    affectedSectionIds: string[];
  } | null>(null);

  // Resync the editor when a new revision is saved.
  useEffect(() => {
    setRaw(skill.raw);
  }, [skill.raw]);

  const dirty = raw !== skill.raw;

  async function runChatEdit(e: FormEvent) {
    e.preventDefault();
    const text = instruction.trim();
    if (!text || editBusy) return;
    setEditBusy(true);
    setError(null);
    try {
      setPending(await api.editSkill(skill.id, text));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setEditBusy(false);
    }
  }

  function reviewManualEdit() {
    setPending({
      newRaw: raw,
      affectedSectionIds: diffRawSkills(skill.raw, raw),
    });
  }

  async function confirmSave() {
    if (!pending || saveBusy) return;
    setSaveBusy(true);
    setError(null);
    try {
      const { skill: saved, affectedSectionIds } = await api.saveSkill(
        skill.id,
        pending.newRaw
      );
      setPending(null);
      setInstruction("");
      onSaved(saved, affectedSectionIds);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaveBusy(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="border-b border-hairline px-4 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className="eyebrow">Skill source</span>
          <span className="id-chip">
            {skill.id} · v{skill.version}
          </span>
        </div>
        <p className="mt-1 font-mono text-[10.5px] leading-relaxed text-muted">
          seeded from historical documents - SMEs validate, they don&apos;t map
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-2 p-4">
        <textarea
          className="field field-mono min-h-0 flex-1 resize-none"
          value={raw}
          spellCheck={false}
          disabled={disabled}
          onChange={(e) => setRaw(e.target.value)}
          aria-label="Skill markdown source"
        />
        {dirty && (
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={disabled}
              onClick={reviewManualEdit}
            >
              Review changes
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setRaw(skill.raw)}
            >
              Discard
            </button>
          </div>
        )}
      </div>

      <div className="border-t border-hairline p-4">
        <p className="eyebrow mb-1.5">Edit via instruction</p>
        <form className="flex gap-2" onSubmit={(e) => void runChatEdit(e)}>
          <input
            className="field flex-1"
            value={instruction}
            disabled={disabled || editBusy}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder='e.g. "add the shelf-life statement requirement to 3.2"'
            aria-label="Skill edit instruction"
          />
          <button
            type="submit"
            className="btn btn-primary"
            disabled={disabled || editBusy || !instruction.trim()}
          >
            {editBusy ? "Editing…" : "Edit"}
          </button>
        </form>
        {error && (
          <p className="mt-2 text-[12px] text-status-author" role="alert">
            {error}
          </p>
        )}
      </div>

      {pending && (
        <DiffModal
          skill={skill}
          newRaw={pending.newRaw}
          affectedSectionIds={pending.affectedSectionIds}
          busy={saveBusy}
          hasDoc={hasDoc}
          onConfirm={() => void confirmSave()}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
