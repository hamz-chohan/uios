"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, type SkillSummary } from "@/lib/client/api";
import { useAuth } from "@/contexts/AuthContext";

export default function SkillsPage() {
  const { persona } = useAuth();
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const canCreate =
    persona?.id === "skills-creator" || persona?.id === "administrator";

  useEffect(() => {
    api
      .listSkills({ all: true })
      .then(setSkills)
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err))
      );
  }, []);

  const published = skills.filter(
    (s) => (s.status ?? "published") === "published"
  );
  const drafts = skills.filter((s) => s.status === "draft");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto bg-[#f6f7f9] px-8 py-7">
        <div className="mx-auto max-w-[960px]">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow mb-1.5">Skill Creator</p>
              <h1 className="title-mark text-[28px] font-bold tracking-[-0.03em]">
                Skill Creator
              </h1>
              <p className="mt-2 max-w-[560px] text-[14px] leading-[1.55] text-muted">
                Write a portable <code className="text-[12px]">.md</code> skill
                from a prompt. Publish it, and Document Creators can generate
                from it in DocGen.
              </p>
            </div>
            {canCreate && (
              <Link
                href="/skills/new"
                className="btn btn-primary"
              >
                New skill
              </Link>
            )}
          </div>

          {error && (
            <p className="mb-4 rounded-lg bg-[#fdecea] px-3 py-2 text-[13px] text-status-author">
              {error}
            </p>
          )}

          <div className="mb-6 grid grid-cols-3 gap-3">
            <Stat n={published.length} label="Published for DocGen" />
            <Stat n={drafts.length} label="In progress" />
            <Stat n={skills.length} label="In registry" />
          </div>

          <SkillTable
            title="Published - available in DocGen"
            rows={published}
            empty="Nothing published yet. Write a skill and publish it; Document Creators will see it in the new-document picker."
          />
          <div className="mt-8">
            <SkillTable
              title="In progress"
              rows={drafts}
              empty="No drafts. Start a new skill from a prompt."
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="surface-card px-4 py-3">
      <div className="stat-n">{n}</div>
      <div className="mt-1 text-[13px] text-muted">{label}</div>
    </div>
  );
}

function SkillTable({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: SkillSummary[];
  empty: string;
}) {
  return (
    <section className="surface-card">
      <h2 className="card-title border-b border-hairline px-5 py-3">
        {title}
      </h2>
      {rows.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-muted">{empty}</p>
      ) : (
        <table className="w-full text-left text-[13px]">
          <thead className="text-[11px] uppercase tracking-[0.08em] text-faint">
            <tr>
              <th className="px-5 py-2 font-medium">Skill</th>
              <th className="px-5 py-2 font-medium">Version</th>
              <th className="px-5 py-2 font-medium">Sections</th>
              <th className="px-5 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.id}
                className="border-t border-hairline hover:bg-[#f6f7f9]"
              >
                <td className="px-5 py-3">
                  <Link
                    href={`/skills/${s.id}`}
                    className="font-medium text-ink hover:underline"
                  >
                    {s.title}
                  </Link>
                  <div className="font-mono text-[11px] text-faint">
                    {s.id}.md
                  </div>
                </td>
                <td className="px-5 py-3 text-muted">v{s.version}</td>
                <td className="px-5 py-3 text-muted">
                  {s.sectionCount ?? "-"}
                </td>
                <td className="px-5 py-3">
                  <span className="rounded-full bg-[#f3eeff] px-2 py-0.5 font-mono text-[10px] uppercase text-[#6b38fb]">
                    {s.status ?? "published"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
