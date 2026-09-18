import { marked } from "marked";
import type { Citation, DocumentMeta, Skill, Unit } from "@/lib/types";

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/** Order units by their section's position in the skill (the skill IS the document definition). */
export function orderUnits(units: Unit[], skill: Skill): Unit[] {
  const pos = new Map(skill.sections.map((s, i) => [s.id, i]));
  return [...units].sort((a, b) => {
    const ia = pos.get(a.sectionId) ?? Number.MAX_SAFE_INTEGER;
    const ib = pos.get(b.sectionId) ?? Number.MAX_SAFE_INTEGER;
    return ia === ib ? a.sectionId.localeCompare(b.sectionId) : ia - ib;
  });
}

// ---------------------------------------------------------------------------
// Markdown → HTML (GFM tables must survive)
// ---------------------------------------------------------------------------

export function renderUnitBodyHtml(u: Unit): string {
  if (!u.contentMd) return "";
  return marked.parse(u.contentMd, { gfm: true, async: false, breaks: false }) as string;
}

// ---------------------------------------------------------------------------
// Section renderer (shared by pane and PDF)
// ---------------------------------------------------------------------------

export interface SectionRenderOptions {
  /** Live SSE text for this section; when set it replaces the body and shows a caret. */
  streamingText?: string;
}

/**
 * Inner HTML of one document section: numbered heading, status-aware body,
 * previous/new diff block, citation markers and the mono "Sources:" line.
 * The caller owns the enclosing <section id=... data-section-id=...> element.
 */
export function renderSectionInnerHtml(u: Unit, opts: SectionRenderOptions = {}): string {
  const parts: string[] = [];
  parts.push(`<h2 class="unit-heading">${esc(u.heading)}</h2>`);

  // Live streaming takes over the body while tokens arrive.
  if (typeof opts.streamingText === "string") {
    parts.push(
      `<div class="unit-streaming">${esc(opts.streamingText)}<span class="stream-caret" aria-hidden="true"></span></div>`
    );
    return parts.join("\n");
  }

  if (u.status === "PENDING") {
    parts.push(
      `<div class="unit-skeleton" aria-label="Pending generation">` +
        `<div class="bar" style="width:100%"></div>` +
        `<div class="bar" style="width:94%"></div>` +
        `<div class="bar" style="width:62%"></div>` +
        `</div>`
    );
    return parts.join("\n");
  }

  if (u.status === "NEEDS_AUTHOR") {
    const note = u.note ?? "Content not derivable from the provided sources.";
    parts.push(
      `<div class="needs-author" data-status="NEEDS_AUTHOR">` +
        `<span class="na-label">Needs author</span>` +
        `<span class="na-sep">-</span> ${esc(note)}` +
        `</div>`
    );
    return parts.join("\n");
  }

  // Previous/new diff block (regenerate pending accept).
  if (u.previousContentMd) {
    const prevHtml = marked.parse(u.previousContentMd, {
      gfm: true,
      async: false,
      breaks: false,
    }) as string;
    parts.push(
      `<div class="prev-block">` +
        `<div class="prev-caption">Previous · rev ${esc(u.previousSkillRev ?? u.skillRev)} superseded</div>` +
        `<div class="prev-body">${prevHtml}</div>` +
        `</div>`
    );
  }

  const contentClasses = ["unit-content"];
  if (u.status === "NEEDS_VALIDATION") contentClasses.push("unit-content--validation");
  if (u.previousContentMd) contentClasses.push("unit-content--new");

  const body = renderUnitBodyHtml(u);
  const markers =
    u.citations.length > 0
      ? `<span class="cite-markers">${u.citations
          .map((_, i) => `<sup>[${i + 1}]</sup>`)
          .join("")}</span>`
      : "";

  parts.push(`<div class="${contentClasses.join(" ")}" data-status="${esc(u.status)}">${body}${markers}</div>`);

  if (u.status === "NEEDS_VALIDATION" && u.note) {
    parts.push(`<div class="validation-note">Needs validation - ${esc(u.note)}</div>`);
  }

  if (u.citations.length > 0) {
    parts.push(
      `<div class="unit-sources">Sources: ${u.citations
        .map((c, i) => `<span class="src">[${i + 1}] ${esc(fmtCitation(c))}</span>`)
        .join(", ")}</div>`
    );
  }

  return parts.join("\n");
}

function fmtCitation(c: Citation): string {
  // Some adapters prefix the locator with the source id already ("csr §5.1").
  return c.locator.startsWith(c.sourceId) ? c.locator : `${c.sourceId} ${c.locator}`;
}

export const DOC_BODY_CSS = `
.doc-body {
  font-family: Inter, system-ui, -apple-system, sans-serif;
  color: #111111;
  font-size: 11pt;
  line-height: 1.6;
}
.doc-body section { margin: 0 0 18pt; }
.doc-body .unit-heading {
  font-family: Inter, system-ui, -apple-system, sans-serif;
  font-size: 10pt;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.3;
  margin: 0 0 7pt;
  color: #111111;
}
.doc-body p { margin: 0 0 8pt; }
.doc-body p:last-child { margin-bottom: 0; }
.doc-body em { color: inherit; }
.doc-body table {
  border-collapse: collapse;
  width: 100%;
  font-size: 10pt;
  margin: 8pt 0;
}
.doc-body th, .doc-body td {
  border: 1px solid #D8DEE4;
  padding: 4pt 7pt;
  text-align: left;
  vertical-align: top;
}
.doc-body th {
  font-weight: 700;
  border-bottom: 1.5px solid #D8DEE4;
}
.doc-body .cite-markers { margin-left: 2pt; }
.doc-body .cite-markers sup {
  font-size: 7.5pt;
  color: #6b38fb;
  letter-spacing: 0.02em;
}
.doc-body .unit-sources {
  font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8.5pt;
  color: #5C6B7A;
  margin-top: 5pt;
}
.doc-body .needs-author {
  border: 1px solid #A43830;
  background: rgba(164, 56, 48, 0.07);
  color: #7C2A24;
  border-radius: 2px;
  padding: 8pt 10pt;
  font-size: 10pt;
}
.doc-body .needs-author .na-label {
  font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8.5pt;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #A43830;
}
.doc-body .needs-author .na-sep { margin: 0 3pt; color: #A43830; }
.doc-body .unit-content--validation {
  border-left: 2px solid #A16207;
  padding-left: 9pt;
}
.doc-body .validation-note {
  font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8.5pt;
  color: #A16207;
  margin-top: 4pt;
}
.doc-body .prev-block {
  background: #F3F5F7;
  border-left: 2px solid #D8DEE4;
  color: #5C6B7A;
  padding: 7pt 9pt;
  margin: 0 0 7pt;
  font-size: 10pt;
}
.doc-body .prev-block .prev-caption {
  font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8pt;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5C6B7A;
  margin-bottom: 3pt;
}
.doc-body .prev-block .prev-body p { margin-bottom: 5pt; }
.doc-body .unit-content--new {
  background: rgba(107, 56, 251, 0.045);
  border-radius: 2px;
  padding: 6pt 8pt;
}
.doc-body .unit-content--new.unit-content--validation { padding-left: 9pt; }
.doc-body .unit-skeleton .bar {
  height: 9pt;
  background: #E4E9EE;
  border-radius: 2px;
  margin: 0 0 6pt;
}
.doc-body .unit-streaming { white-space: pre-wrap; }
.doc-body .stream-caret {
  display: inline-block;
  width: 2px;
  height: 0.95em;
  margin-left: 1px;
  vertical-align: -0.12em;
  background: #6b38fb;
  animation: docgen-caret-blink 1s steps(1) infinite;
}
@keyframes docgen-caret-blink { 50% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) {
  .doc-body .stream-caret { animation: none; }
}
.doc-running-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 12pt;
  font-size: 9pt;
  color: #5C6B7A;
  border-bottom: 1px solid #D8DEE4;
  padding-bottom: 4pt;
}
.doc-running-header .rh-left {
  font-family: Inter, system-ui, -apple-system, sans-serif;
  font-weight: 600;
  min-width: 0;
}
.doc-running-header .rh-right {
  font-family: "IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 8pt;
  letter-spacing: 0.03em;
  white-space: nowrap;
}
`;

export function renderDocumentHtml(args: {
  doc: DocumentMeta;
  skill: Skill;
  units: Unit[];
}): string {
  const { doc, skill } = args;
  const units = orderUnits(args.units, skill);

  const sections = units
    .map(
      (u) =>
        `<section id="${esc(u.sectionId)}" data-section-id="${esc(u.sectionId)}" data-status="${esc(u.status)}">\n${renderSectionInnerHtml(u)}\n</section>`
    )
    .join("\n");

  const headerRight = `${doc.id} · skill rev ${doc.skillRev}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(skill.title)} - ${esc(doc.id)}</title>
<style>
@page { size: A4; margin: 18mm 16mm 18mm; }
html, body { margin: 0; padding: 0; background: #FFFFFF; }
${DOC_BODY_CSS}
/* Print frame: thead repeats the running header on every page. */
.doc-frame { width: 100%; border-collapse: collapse; }
.doc-frame > thead > tr > td { padding: 0 0 10pt; }
.doc-frame > tbody > tr > td { padding: 0; }
.doc-body .unit-heading { break-after: avoid; page-break-after: avoid; }
.doc-body table { break-inside: avoid; page-break-inside: avoid; }
.doc-body .needs-author, .doc-body .prev-block { break-inside: avoid; page-break-inside: avoid; }
</style>
</head>
<body>
<div class="doc-body">
<table class="doc-frame">
<thead><tr><td>
  <div class="doc-running-header">
    <span class="rh-left">${esc(skill.title)}</span>
    <span class="rh-right">${esc(headerRight)}</span>
  </div>
</td></tr></thead>
<tbody><tr><td>
${sections}
</td></tr></tbody>
</table>
</div>
</body>
</html>`;
}

// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
