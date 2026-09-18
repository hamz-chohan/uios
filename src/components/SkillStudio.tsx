"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { api } from "@/lib/client/api";
import { DocGenLink } from "@/components/DocGenLink";
import { useAuth } from "@/contexts/AuthContext";
import { canAccess } from "@/lib/rbac";
import type { Skill } from "@/lib/types";

const CHIPS = [
  {
    label: "Scientific response",
    prompt:
      "Write a skill that drafts a Scientific Response Document answering an unsolicited medical inquiry. Do not invent data.",
  },
  {
    label: "Quality summary",
    prompt:
      "Write a skill for a product quality summary covering control strategy and storage.",
  },
  {
    label: "Safety response",
    prompt:
      "Write a skill that drafts a safety response from the investigator brochure and approved sources.",
  },
];

export function SkillStudio({ skillId }: { skillId?: string }) {
  const router = useRouter();
  const { persona } = useAuth();
  const [skill, setSkill] = useState<Skill | null>(null);
  const [prompt, setPrompt] = useState("");
  const [log, setLog] = useState<{ role: "user" | "agent"; text: string }[]>([
    {
      role: "agent",
      text: "Describe the skill you want. I will write a portable .md file. Publish it when it is ready - Document Creators can then generate from it in DocGen.",
    },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const canEdit = persona ? canAccess("skills", persona.id) : false;
  const canPublish =
    persona?.id === "skills-creator" || persona?.id === "administrator";

  useEffect(() => {
    if (!skillId) return;
    api
      .getSkill(skillId)
      .then(setSkill)
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err))
      );
  }, [skillId]);

  async function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed || !canEdit || busy) return;
    setBusy(true);
    setError(null);
    setLog((rows) => [...rows, { role: "user", text: trimmed }]);
    setPrompt("");
    try {
      const next = await api.draftSkillFromPrompt(trimmed, skill?.id ?? skillId);
      setLog((rows) => [
        ...rows,
        {
          role: "agent",
          text: `Wrote ${next.title}.md with ${next.sections.length} section${
            next.sections.length === 1 ? "" : "s"
          } from your prompt. Review the file, rewrite with another prompt, or publish for DocGen.`,
        },
      ]);
      setSkill(next);
      if (!skillId || skillId === "new") {
        router.replace(`/skills/${next.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!skill || !canPublish || busy) return;
    setBusy(true);
    try {
      const next = await api.publishSkill(skill.id);
      setSkill(next);
      setLog((rows) => [
        ...rows,
        {
          role: "agent",
          text: "Published. This skill is now available in DocGen for Document Creators.",
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f6f7f9]">
      <div className="paper-wrap min-h-0 flex-1">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#f0f1f3] px-5 py-3.5">
          <strong className="title-mark text-[15px] font-bold tracking-[-0.01em]">
            {skill?.title ?? "New skill"}
          </strong>
          <span className="rounded-full bg-[#f3eeff] px-2 py-0.5 font-mono text-[10px] uppercase text-[#6b38fb]">
            {skill?.status ?? "empty"}
          </span>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-2 overflow-hidden">
          <section className="flex min-h-0 flex-col bg-white">
            <div className="min-h-0 flex-1 overflow-y-auto px-3.5 py-4">
              {log.map((m, i) => (
                <div
                  key={i}
                  className={`mb-3 max-w-[92%] rounded-xl px-3.5 py-3 text-[14px] leading-[1.5] ${
                    m.role === "user"
                      ? "ml-auto bg-[#6b38fb] text-white"
                      : "bg-[#f4f5f7] text-[#1f2937]"
                  }`}
                >
                  {i === 0 && m.role === "agent" ? (
                    <>
                      Describe the skill you want. I will write a portable .md
                      file. Publish it when it is ready - Document Creators can
                      then generate from it in{" "}
                      <DocGenLink className="font-semibold text-[#6b38fb] underline decoration-[#6b38fb]/40 underline-offset-2 hover:text-[#5529e0]">
                        DocGen
                      </DocGenLink>
                      .
                    </>
                  ) : (
                    m.text
                  )}
                </div>
              ))}
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {CHIPS.map((c) => (
                  <button
                    key={c.label}
                    type="button"
                    className="rounded-full border border-hairline px-3 py-1 text-[12px] font-semibold hover:bg-[#f6f7f9]"
                    disabled={!canEdit || busy}
                    onClick={() => submit(c.prompt)}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              <p className="mt-3 text-[12px] leading-[1.5] text-muted">
                Already published? Open{" "}
                <DocGenLink className="font-semibold text-[#6b38fb] underline decoration-[#6b38fb]/40 underline-offset-2 hover:text-[#5529e0]">
                  DocGen
                </DocGenLink>{" "}
                to generate a document - you will be asked to sign in as a
                Document Creator if this account cannot.
              </p>
            </div>
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void submit(prompt);
              }}
              className="border-t border-[#f0f1f3] px-3 pb-3.5 pt-2"
            >
              <label className="sr-only" htmlFor="skillPrompt">
                Describe the skill
              </label>
              <textarea
                id="skillPrompt"
                rows={2}
                className="field w-full resize-none"
                placeholder="Describe the skill you want…"
                value={prompt}
                disabled={!canEdit || busy}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void submit(prompt);
                  }
                }}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={!canEdit || busy || !prompt.trim()}
                >
                  Write skill
                </button>
              </div>
            </form>
          </section>

          <section className="flex min-h-0 flex-col border-l border-[#f0f1f3] bg-white">
            <div className="flex items-center justify-between border-b border-[#f0f1f3] px-5 py-2.5">
              <strong className="font-mono text-[12px]">
                {(skill?.id ?? "untitled")}.md
              </strong>
            </div>
            {skill?.raw ? (
              <pre className="min-h-0 flex-1 overflow-auto px-5 py-4 font-mono text-[12px] leading-[1.55] whitespace-pre-wrap text-ink">
                {skill.raw}
              </pre>
            ) : (
              <div className="grid min-h-0 flex-1 place-content-center px-6 py-8 text-center text-[13px] leading-[1.6] text-muted">
                <strong className="mb-1.5 block text-[14px] text-ink">
                  No file yet
                </strong>
                The .md file appears here after you describe the skill. Publish
                it to make it selectable in DocGen.
              </div>
            )}
          </section>
        </div>
      </div>

      {error && (
        <p className="mx-8 bg-[#fdecea] px-5 py-2 text-[13px] text-status-author">
          {error}
        </p>
      )}

      <footer className="studio-dock">
        <span className="min-w-0 truncate text-[12px] text-muted">
          {skill?.status === "published"
            ? "Published - Document Creators can select this skill in DocGen."
            : "A published skill is the only input DocGen will generate from."}
        </span>
        <div className="flex shrink-0 gap-2">
          <Link href="/skills" className="btn btn-secondary">
            Studio home
          </Link>
          <DocGenLink
            href={skill?.status === "published" ? "/docgen/new" : "/docgen"}
            className="btn btn-secondary"
          >
            Open DocGen
          </DocGenLink>
          {canPublish && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={!skill || busy || skill.status === "published"}
              onClick={() => void publish()}
            >
              {skill?.status === "published" ? "Published" : "Publish"}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
