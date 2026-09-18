"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { api, type DocumentSummary, type SkillSummary } from "@/lib/client/api";
import { useAuth } from "@/contexts/AuthContext";
import { PERSONAS } from "@/lib/rbac";

export function AdminHome({
  skills,
  docs,
  onSkillsChange,
}: {
  skills: SkillSummary[];
  docs: DocumentSummary[];
  onSkillsChange: (next: SkillSummary[]) => void;
}) {
  const { persona } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const published = skills.filter((s) => (s.status ?? "published") === "published");
  const drafts = skills.filter((s) => s.status === "draft");
  const approvedDocs = docs.filter((d) =>
    d.unitCount > 0 && (d.statusCounts["APPROVED"] ?? 0) === d.unitCount
  );
  const reviewDocs = docs.filter(
    (d) =>
      (d.statusCounts["NEEDS_AUTHOR"] ?? 0) +
        (d.statusCounts["NEEDS_VALIDATION"] ?? 0) >
      0
  );
  const filledUnits = docs.reduce(
    (n, d) =>
      n +
      (d.statusCounts["FILLED_CITED"] ?? 0) +
      (d.statusCounts["APPROVED"] ?? 0),
    0
  );
  const totalUnits = docs.reduce((n, d) => n + d.unitCount, 0);

  const usage = published
    .map((s) => ({
      skill: s,
      count: docs.filter((d) => d.doc.skillId === s.id).length,
    }))
    .sort((a, b) => b.count - a.count);

  const roster = Object.values(PERSONAS);

  async function unpublish(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await api.unpublishSkill(id);
      onSkillsChange(
        skills.map((s) => (s.id === id ? { ...s, status: "draft" } : s))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(`Remove ${id}.md from the registry? Existing documents keep their copy.`)) {
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await api.deleteSkill(id);
      onSkillsChange(skills.filter((s) => s.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <p className="persona-scope">
        <strong>Your workspace</strong>
        Platform visibility: skill registry, DocGen usage, and people. You run
        the operating view. You do not author content.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-[#fdecea] px-3 py-2 text-[13px] text-status-author">
          {error}
        </p>
      )}

      <div className="mb-4 grid grid-cols-4 gap-3">
        <Stat n={published.length} label="Published skills" />
        <Stat n={docs.length} label="Documents in workspace" />
        <Stat n={approvedDocs.length} label="Documents fully approved" />
        <Stat n={roster.length} label="Registered users" />
      </div>
      <div className="mb-6 grid grid-cols-4 gap-3">
        <Stat n={drafts.length} label="Skills in progress" />
        <Stat n={published.length} label="Skills available in DocGen" />
        <Stat n={reviewDocs.length} label="Documents needing review" />
        <Stat
          n={totalUnits ? `${Math.round((filledUnits / totalUnits) * 100)}%` : "-"}
          label="Units filled"
        />
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4">
        <Card title="Top skills in DocGen" meta="Documents generated per published skill">
          {usage.length === 0 ? (
            <p className="text-[13px] text-muted">
              No documents linked to skills yet. Document Creators generate
              from published skills.
            </p>
          ) : (
            <ul>
              {usage.map(({ skill, count }) => (
                <li
                  key={skill.id}
                  className="flex items-center justify-between border-t border-hairline py-2.5 text-[13px] first:border-t-0"
                >
                  <div>
                    <Link href={`/skills/${skill.id}`} className="font-medium hover:underline">
                      {skill.title}
                    </Link>
                    <div className="font-mono text-[11px] text-faint">
                      {skill.id}.md
                    </div>
                  </div>
                  <span className="rounded-full bg-[#f3eeff] px-2 py-0.5 font-mono text-[11px] text-[#6b38fb]">
                    {count}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Users" meta="Workspace accounts · current session">
          <ul>
            {roster.map((u) => (
              <li
                key={u.id}
                className="flex items-center justify-between border-t border-hairline py-2.5 text-[13px] first:border-t-0"
              >
                <div>
                  <div className="font-medium">{u.name}</div>
                  <div className="text-[12px] text-muted">
                    {u.role} · {u.email}
                  </div>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 font-mono text-[10px] uppercase ${
                    u.id === persona?.id
                      ? "bg-[#e7f6ec] text-[#027a48]"
                      : "bg-[#f0f1f3] text-muted"
                  }`}
                >
                  {u.id === persona?.id ? "Signed in" : "Offline"}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card
        title="Skill registry"
        meta="Published skills are the only ones Document Creators can generate from. Unpublish or remove a skill here."
      >
        {skills.length === 0 ? (
          <p className="text-[13px] text-muted">
            Registry is empty. Skill Creator writes a .md file and publishes
            it - then it appears here and in DocGen.
          </p>
        ) : (
          <ul>
            {skills.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 border-t border-hairline py-3 first:border-t-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/skills/${s.id}`}
                    className="text-[13px] font-medium hover:underline"
                  >
                    {s.title}
                  </Link>
                  <div className="font-mono text-[11px] text-faint">
                    {s.id}.md · v{s.version} · {s.sectionCount ?? 0} sections
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-[#f3eeff] px-2 py-0.5 font-mono text-[10px] uppercase text-[#6b38fb]">
                    {s.status ?? "published"}
                  </span>
                  {(s.status ?? "published") === "published" && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={busyId === s.id}
                      onClick={() => void unpublish(s.id)}
                    >
                      Unpublish
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm border-[#fecdca] text-[#b42318] hover:bg-[#fef3f2]"
                    disabled={busyId === s.id}
                    onClick={() => void remove(s.id)}
                  >
                    Delete
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex gap-2">
          <Link
            href="/skills"
            className="btn btn-secondary"
          >
            Open Skill Creator
          </Link>
          <Link
            href="/docgen"
            className="btn btn-primary"
          >
            View documents
          </Link>
        </div>
      </Card>
    </>
  );
}

function Stat({ n, label }: { n: number | string; label: string }) {
  return (
    <div className="surface-card px-4 py-3">
      <div className="stat-n">{n}</div>
      <div className="mt-1 text-[13px] text-muted">{label}</div>
    </div>
  );
}

function Card({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: string;
  children: ReactNode;
}) {
  return (
    <section className="surface-card px-5 py-4">
      <h2 className="card-title">{title}</h2>
      {meta && <p className="mb-3 mt-1 text-[12px] text-muted">{meta}</p>}
      {children}
    </section>
  );
}
