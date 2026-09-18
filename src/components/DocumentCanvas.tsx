"use client";

import { useMemo } from "react";
import type { DocumentMeta, Skill, Unit } from "@/lib/types";
import {
  DOC_BODY_CSS,
  orderUnits,
  renderSectionInnerHtml,
} from "@/lib/render/documentHtml";

export interface DocumentCanvasProps {
  doc: DocumentMeta;
  skill: Skill;
  units: Unit[];
  activeSectionId?: string;
  /** sectionId → accumulated live text from the generate SSE stream. */
  streaming?: Record<string, string>;
  onSelectSection?: (sectionId: string) => void;
}

/* Screen-side skin over the shared DOC_BODY_CSS: paper chrome, review-state
   rules/chips and px type metrics live here so the PDF export keeps its own
   print (pt) metrics untouched. The caller's wrapper owns width + margins. */
const CANVAS_CSS = `
.docgen-canvas .paper {
  background: #FFFFFF;
  padding: 44px 52px 60px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(11, 37, 69, 0.06);
  font-size: 14px;
  line-height: 1.6;
}
.docgen-canvas .doc-running-header {
  padding-bottom: 16px;
  margin-bottom: 20px;
  border-bottom: 2px solid #111;
}
.docgen-canvas .doc-running-header .rh-right { font-size: 12px; color: #6b7280; }
.docgen-canvas .unit-heading {
  font-size: 13px;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  margin: 0 0 8px;
}
.docgen-canvas .cite-markers sup {
  font-family: var(--font-mono, "IBM Plex Mono", ui-monospace, monospace);
  font-size: 10px;
}
.docgen-canvas section {
  padding: 4px 8px;
  margin: 0 -8px 26px;
  border-radius: 2px;
  scroll-margin-top: 32px;
}
.docgen-canvas section.selectable { cursor: pointer; }
.docgen-canvas section.selectable:hover { background: rgba(107, 56, 251, 0.04); }
.docgen-canvas section.active {
  outline: 2px solid rgba(107, 56, 251, 0.28);
  outline-offset: 4px;
}
/* Review states - the whole section carries the 3px rule and the heading
   grows an inline status chip; the renderer's content-level markers are
   print affordances, so they stand down on screen. */
.docgen-canvas section[data-status="NEEDS_VALIDATION"],
.docgen-canvas section[data-status="NEEDS_AUTHOR"] {
  border-left: 3px solid var(--color-status-validation);
  border-radius: 0;
  padding-left: 16px;
  margin-left: -19px;
}
.docgen-canvas section[data-status="NEEDS_AUTHOR"] {
  border-left-color: var(--color-status-author);
}
.docgen-canvas section[data-status="NEEDS_VALIDATION"] .unit-heading::after,
.docgen-canvas section[data-status="NEEDS_AUTHOR"] .unit-heading::after {
  display: inline-block;
  vertical-align: 3px;
  margin-left: 8px;
  padding: 2px 6px;
  border-radius: 3px;
  font-family: var(--font-mono, "IBM Plex Mono", ui-monospace, monospace);
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.docgen-canvas section[data-status="NEEDS_VALIDATION"] .unit-heading::after {
  content: "● needs validation";
  color: var(--color-status-validation);
  background: color-mix(in srgb, var(--color-status-validation) 12%, transparent);
}
.docgen-canvas section[data-status="NEEDS_AUTHOR"] .unit-heading::after {
  content: "● needs author";
  color: var(--color-status-author);
  background: color-mix(in srgb, var(--color-status-author) 12%, transparent);
}
.docgen-canvas .unit-content--validation {
  border-left: none;
  padding-left: 0;
}
.docgen-canvas .needs-author {
  border: 1px dashed color-mix(in srgb, var(--color-status-author) 45%, var(--color-hairline));
  border-radius: 6px;
  background: color-mix(in srgb, var(--color-status-author) 4%, transparent);
  padding: 14px 16px;
  font-family: var(--font-sans, "IBM Plex Sans", ui-sans-serif, sans-serif);
  font-size: 13px;
  color: var(--color-muted);
}
.docgen-canvas .needs-author .na-label,
.docgen-canvas .needs-author .na-sep { display: none; }
@media (max-width: 900px) {
  .docgen-canvas .paper { padding: 40px 32px; }
}
`;

export default function DocumentCanvas({
  doc,
  skill,
  units,
  activeSectionId,
  streaming,
  onSelectSection,
}: DocumentCanvasProps) {
  const ordered = useMemo(() => orderUnits(units, skill), [units, skill]);

  return (
    <div className="docgen-canvas">
      <style>{DOC_BODY_CSS + CANVAS_CSS}</style>
      <div className="paper doc-body">
        <div className="doc-running-header">
          <span className="rh-left">{skill.title}</span>
          <span className="rh-right">{doc.id} · Confidential</span>
        </div>
        {ordered.map((u) => {
          const html = renderSectionInnerHtml(u, {
            streamingText: streaming?.[u.sectionId],
          });
          const classes = [
            onSelectSection ? "selectable" : "",
            u.sectionId === activeSectionId ? "active" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <section
              key={u.id}
              id={u.sectionId}
              data-section-id={u.sectionId}
              data-status={u.status}
              className={classes || undefined}
              onClick={onSelectSection ? () => onSelectSection(u.sectionId) : undefined}
              dangerouslySetInnerHTML={{ __html: html }}
            />
          );
        })}
      </div>
    </div>
  );
}
