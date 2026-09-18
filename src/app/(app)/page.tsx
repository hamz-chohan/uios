"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { AdminHome } from "@/components/AdminHome";
import { useAuth } from "@/contexts/AuthContext";
import { api, type DocumentSummary, type SkillSummary } from "@/lib/client/api";
import { canAccess } from "@/lib/rbac";

export default function HomePage() {
  const { persona } = useAuth();
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [docs, setDocs] = useState<DocumentSummary[]>([]);

  useEffect(() => {
    api.listSkills({ all: true }).then(setSkills).catch(() => undefined);
    api.listDocuments().then(setDocs).catch(() => undefined);
  }, []);

  if (!persona) return null;

  const published = skills.filter(
    (s) => (s.status ?? "published") === "published"
  );
  const drafts = skills.filter((s) => s.status === "draft");
  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <main className="min-h-0 flex-1 overflow-y-auto bg-[#f6f7f9]">
        <div className="mx-auto max-w-[1040px] px-8 pt-7 pb-16">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow mb-1.5">{persona.role} · Medical affairs</p>
              <h1 className="title-mark mb-2 text-[28px] font-bold tracking-[-0.03em]">
                {greeting}, {persona.name}
              </h1>
              <p className="max-w-[640px] text-[14px] leading-[1.6] text-muted">
                {persona.homeLede}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {canAccess("docgen", persona.id) && (
                <Link
                  href="/docgen"
                  className="btn btn-primary"
                >
                  Open DocGen
                </Link>
              )}
              {canAccess("skills", persona.id) && (
                <Link
                  href="/skills"
                  className="btn btn-secondary"
                >
                  Open Skill Creator
                </Link>
              )}
            </div>
          </div>

          {persona.id === "document-creator" && (
            <>
              <p className="persona-scope">
                <strong>Your workspace</strong>
                Generate,
                review, and approve documents from skills that Skill Creator
                has published.
              </p>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <Stat n={docs.length} label="Documents in workspace" />
                <Stat n={published.length} label="Published skills available" />
                <Stat
                  n={docs.filter((d) => (d.statusCounts["NEEDS_AUTHOR"] ?? 0) > 0).length}
                  label="Awaiting author input"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card title="Your documents">
                  {docs.length === 0 ? (
                    <p className="text-[13px] text-muted">
                      No documents yet. Pick a published skill in DocGen to
                      generate the first draft.
                    </p>
                  ) : (
                    <ul>
                      {docs.slice(0, 6).map((d) => (
                        <li
                          key={d.doc.id}
                          className="flex justify-between border-t border-hairline py-2 text-[13px] first:border-t-0"
                        >
                          <Link href={`/docgen/${d.doc.id}`} className="hover:underline">
                            {d.skillTitle}
                          </Link>
                          <span className="font-mono text-[11px] text-faint">
                            {d.doc.id}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title="Start here">
                  <p className="mb-3 text-[13px] text-muted">
                    Only published skills appear in the picker. If the list is
                    empty, a Skill Creator still needs to publish a .md file.
                  </p>
                  <Link
                    href="/docgen/new"
                    className="btn btn-primary"
                  >
                    Create a document
                  </Link>
                </Card>
              </div>
            </>
          )}

          {persona.id === "skills-creator" && (
            <>
              <p className="persona-scope">
                <strong>Your workspace</strong>
                Author skills as portable, versioned <code>.md</code> files.
                Publish when the draft is ready; Document Creators generate from
                that file only.
              </p>
              <div className="mb-4 grid grid-cols-3 gap-3">
                <Stat n={drafts.length} label="Skills in progress" />
                <Stat n={published.length} label="Published" />
                <Stat n={skills.length} label="In registry" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Card title="Your skills">
                  {skills.length === 0 ? (
                    <p className="text-[13px] text-muted">
                      No skills yet. Describe one in a prompt - the .md file is
                      the artifact DocGen executes.
                    </p>
                  ) : (
                    <ul>
                      {skills.slice(0, 6).map((s) => (
                        <li
                          key={s.id}
                          className="flex justify-between border-t border-hairline py-2 text-[13px] first:border-t-0"
                        >
                          <Link href={`/skills/${s.id}`} className="hover:underline">
                            {s.title}
                          </Link>
                          <span className="font-mono text-[10px] uppercase text-faint">
                            {s.status ?? "published"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
                <Card title="Authoring path">
                  <ol className="list-decimal pl-5 text-[13px] leading-[1.7] text-ink">
                    <li>Describe the skill in a prompt</li>
                    <li>Review the generated .md file</li>
                    <li>Publish - it appears in DocGen for Document Creators</li>
                  </ol>
                  <Link
                    href="/skills/new"
                    className="btn btn-primary mt-4"
                  >
                    New skill
                  </Link>
                </Card>
              </div>
            </>
          )}

          {persona.id === "administrator" && (
            <AdminHome
              skills={skills}
              docs={docs}
              onSkillsChange={setSkills}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="surface-card px-5 py-4">
      <h2 className="card-title mb-3">{title}</h2>
      {children}
    </section>
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
