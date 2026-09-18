"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api, type DocumentSummary, type SkillSummary } from "@/lib/client/api";
import { canAccess, loginHref } from "@/lib/rbac";

type Hit = {
  href: string;
  title: string;
  meta: string;
  kind: "skill" | "document";
};

export function WorkspaceSearch() {
  const { persona } = useAuth();
  const router = useRouter();
  const boxRef = useRef<HTMLFormElement>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [docs, setDocs] = useState<DocumentSummary[]>([]);

  const canSkills = persona ? canAccess("skills", persona.id) : false;
  const canDocs = persona ? canAccess("docgen", persona.id) : false;

  useEffect(() => {
    if (canSkills) {
      api.listSkills({ all: true }).then(setSkills).catch(() => undefined);
    }
    if (canDocs) {
      api.listDocuments().then(setDocs).catch(() => undefined);
    }
  }, [canSkills, canDocs]);

  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, []);

  const hits = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 1) return [];
    const rows: Hit[] = [];
    if (canSkills) {
      for (const s of skills) {
        const hay = `${s.title} ${s.id} ${s.status ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) continue;
        rows.push({
          href: `/skills/${s.id}`,
          title: s.title,
          meta: `${s.id}.md · ${s.status ?? "published"}`,
          kind: "skill",
        });
      }
    }
    if (canDocs) {
      for (const d of docs) {
        const hay = `${d.skillTitle} ${d.doc.id} ${d.doc.skillId}`.toLowerCase();
        if (!hay.includes(needle)) continue;
        rows.push({
          href: `/docgen/${d.doc.id}`,
          title: d.skillTitle,
          meta: `${d.doc.id} · ${d.doc.skillId}`,
          kind: "document",
        });
      }
    }
    return rows.slice(0, 8);
  }, [q, skills, docs, canSkills, canDocs]);

  function go(href: string) {
    setOpen(false);
    router.push(href);
  }

  function fallbackHref(query: string): string {
    const n = query.toLowerCase();
    if (n.includes("skill")) {
      return canSkills ? "/skills" : loginHref("/skills");
    }
    if (
      n.includes("doc") ||
      n.includes("srd") ||
      n.includes("quality") ||
      n.includes("library")
    ) {
      if (n.includes("library")) {
        return canDocs ? "/library" : loginHref("/library");
      }
      return canDocs ? "/docgen" : loginHref("/docgen");
    }
    return canDocs ? "/docgen" : canSkills ? "/skills" : "/";
  }

  function submit() {
    const trimmed = q.trim();
    if (!trimmed) return;
    if (hits[active]) {
      go(hits[active].href);
      return;
    }
    go(fallbackHref(trimmed));
  }

  return (
    <form
      ref={boxRef}
      className="search-box"
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <label className="sr-only" htmlFor="uios-search">
        Search UIOS
      </label>
      <input
        id="uios-search"
        value={q}
        autoComplete="off"
        placeholder="Search DocGen and skills"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQ(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(hits.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && q.trim() && (
        <div className="search-menu" role="listbox" aria-label="Search results">
          {hits.length === 0 ? (
            <p className="search-empty">
              No matches. Press Enter to open{" "}
              {fallbackHref(q).startsWith("/login")
                ? "the sign-in screen for that area"
                : fallbackHref(q).startsWith("/skills")
                  ? "Skill Creator"
                  : "DocGen"}
              .
            </p>
          ) : (
            hits.map((hit, i) => (
              <button
                key={hit.href}
                type="button"
                role="option"
                aria-selected={i === active}
                className={`search-hit${i === active ? " is-active" : ""}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(hit.href)}
              >
                <span className="search-kind">{hit.kind}</span>
                <span>
                  <strong>{hit.title}</strong>
                  <span>{hit.meta}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </form>
  );
}
