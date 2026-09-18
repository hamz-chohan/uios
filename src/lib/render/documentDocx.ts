import { marked, type Token, type Tokens } from "marked";
import { modelLabel } from "../adapters/models";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TabStopPosition,
  TabStopType,
  TextRun,
  WidthType,
} from "docx";
import type { DocumentMeta, Skill, Unit } from "@/lib/types";
import { orderUnits } from "./documentHtml";

const INK = "16232E";
const MUTED = "5C6B7A";
const ACCENT = "0070BF";
const AUTHOR_RED = "A43830";
const VALIDATION_AMBER = "A16207";
const HAIRLINE = "D8DEE4";

const A4_CONTENT_DXA = 11906 - 2 * 1134; // A4 width minus 2cm margins

// ---------------------------------------------------------------------------
// Inline tokens → TextRuns
// ---------------------------------------------------------------------------

interface InlineStyle {
  bold?: boolean;
  italics?: boolean;
  code?: boolean;
}

function inlineRuns(tokens: Token[] | undefined, style: InlineStyle = {}): TextRun[] {
  if (!tokens) return [];
  const runs: TextRun[] = [];
  for (const t of tokens) {
    switch (t.type) {
      case "strong":
        runs.push(...inlineRuns((t as Tokens.Strong).tokens, { ...style, bold: true }));
        break;
      case "em":
        runs.push(...inlineRuns((t as Tokens.Em).tokens, { ...style, italics: true }));
        break;
      case "codespan":
        runs.push(run((t as Tokens.Codespan).text, { ...style, code: true }));
        break;
      case "link": {
        const l = t as Tokens.Link;
        runs.push(...inlineRuns(l.tokens, style));
        break;
      }
      case "br":
        runs.push(new TextRun({ break: 1 }));
        break;
      case "escape":
      case "text": {
        const tt = t as Tokens.Text;
        if (tt.tokens && tt.tokens.length > 0) {
          runs.push(...inlineRuns(tt.tokens, style));
        } else {
          runs.push(run(tt.text, style));
        }
        break;
      }
      default: {
        const raw = (t as { raw?: string }).raw ?? "";
        if (raw.trim()) runs.push(run(raw, style));
      }
    }
  }
  return runs;
}

function run(text: string, style: InlineStyle): TextRun {
  return new TextRun({
    text: decodeEntities(text),
    bold: style.bold,
    italics: style.italics,
    font: style.code ? "IBM Plex Mono" : undefined,
    size: style.code ? 18 : undefined,
    color: INK,
  });
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

// ---------------------------------------------------------------------------
// Block tokens → docx children
// ---------------------------------------------------------------------------

type DocxBlock = Paragraph | Table;

function blocksFromMarkdown(md: string): DocxBlock[] {
  const out: DocxBlock[] = [];
  let tokens: Token[];
  try {
    tokens = marked.lexer(md, { gfm: true });
  } catch {
    return [new Paragraph({ children: [run(md, {})] })];
  }

  for (const t of tokens) {
    switch (t.type) {
      case "paragraph":
        out.push(
          new Paragraph({
            children: inlineRuns((t as Tokens.Paragraph).tokens),
            spacing: { after: 140 },
          })
        );
        break;

      case "table": {
        const tbl = t as Tokens.Table;
        const cols = tbl.header.length || 1;
        const colWidth = Math.floor(A4_CONTENT_DXA / cols);
        const border = { style: BorderStyle.SINGLE, size: 2, color: HAIRLINE };
        const borders = { top: border, bottom: border, left: border, right: border };
        const cell = (tokens: Token[] | undefined, header: boolean) =>
          new TableCell({
            borders,
            width: { size: colWidth, type: WidthType.DXA },
            shading: header
              ? { fill: "EEF3F7", type: ShadingType.CLEAR }
              : undefined,
            margins: { top: 60, bottom: 60, left: 100, right: 100 },
            children: [
              new Paragraph({
                children: inlineRuns(tokens, header ? { bold: true } : {}),
              }),
            ],
          });
        out.push(
          new Table({
            width: { size: A4_CONTENT_DXA, type: WidthType.DXA },
            columnWidths: new Array(cols).fill(colWidth),
            rows: [
              new TableRow({
                tableHeader: true,
                children: tbl.header.map((h) => cell(h.tokens, true)),
              }),
              ...tbl.rows.map(
                (row) =>
                  new TableRow({ children: row.map((c) => cell(c.tokens, false)) })
              ),
            ],
          })
        );
        // Breathing room after a table (tables ignore paragraph spacing).
        out.push(new Paragraph({ children: [], spacing: { after: 60 } }));
        break;
      }

      case "list": {
        const list = t as Tokens.List;
        for (const item of list.items) {
          // List items wrap their content in text/paragraph sub-tokens.
          const sub = item.tokens.find(
            (x) => x.type === "text" || x.type === "paragraph"
          ) as Tokens.Text | Tokens.Paragraph | undefined;
          out.push(
            new Paragraph({
              numbering: {
                reference: list.ordered ? "docgen-numbers" : "docgen-bullets",
                level: 0,
              },
              children: inlineRuns(sub?.tokens ?? item.tokens),
              spacing: { after: 60 },
            })
          );
        }
        break;
      }

      case "blockquote": {
        const bq = t as Tokens.Blockquote;
        for (const inner of bq.tokens) {
          if (inner.type === "paragraph") {
            out.push(
              new Paragraph({
                children: inlineRuns((inner as Tokens.Paragraph).tokens, {
                  italics: true,
                }),
                indent: { left: 360 },
                spacing: { after: 120 },
              })
            );
          }
        }
        break;
      }

      case "heading":
        out.push(
          new Paragraph({
            children: inlineRuns((t as Tokens.Heading).tokens, { bold: true }),
            spacing: { before: 160, after: 100 },
          })
        );
        break;

      case "space":
        break;

      default: {
        const raw = (t as { raw?: string }).raw ?? "";
        if (raw.trim())
          out.push(
            new Paragraph({ children: [run(raw.trim(), {})], spacing: { after: 120 } })
          );
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Unit → docx children (heading, status-aware body, citations line)
// ---------------------------------------------------------------------------

function unitBlocks(u: Unit): DocxBlock[] {
  const blocks: DocxBlock[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      children: [new TextRun(u.heading)],
      spacing: { before: 280, after: 120 },
    }),
  ];

  if (u.status === "NEEDS_AUTHOR") {
    const note = u.note ?? "Content not derivable from the provided sources.";
    blocks.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "NEEDS AUTHOR - ",
            bold: true,
            color: AUTHOR_RED,
            font: "IBM Plex Mono",
            size: 18,
          }),
          new TextRun({ text: note, color: AUTHOR_RED }),
        ],
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: AUTHOR_RED, space: 4 },
          bottom: { style: BorderStyle.SINGLE, size: 4, color: AUTHOR_RED, space: 4 },
          left: { style: BorderStyle.SINGLE, size: 4, color: AUTHOR_RED, space: 4 },
          right: { style: BorderStyle.SINGLE, size: 4, color: AUTHOR_RED, space: 4 },
        },
        spacing: { after: 140 },
      })
    );
    return blocks;
  }

  if (u.status === "PENDING") {
    blocks.push(
      new Paragraph({
        children: [run("[Section not yet generated]", { italics: true })],
        spacing: { after: 140 },
      })
    );
    return blocks;
  }

  blocks.push(...blocksFromMarkdown(u.contentMd));

  if (u.status === "NEEDS_VALIDATION" && u.note) {
    blocks.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Needs validation - ${u.note}`,
            color: VALIDATION_AMBER,
            font: "IBM Plex Mono",
            size: 17,
          }),
        ],
        spacing: { after: 100 },
      })
    );
  }

  if (u.citations.length > 0) {
    blocks.push(
      new Paragraph({
        children: [
          new TextRun({
            text:
              "Sources: " +
              u.citations
                .map((c, i) => {
                  const loc = c.locator.startsWith(c.sourceId)
                    ? c.locator
                    : `${c.sourceId} ${c.locator}`;
                  return `[${i + 1}] ${loc}`;
                })
                .join(", "),
            color: MUTED,
            font: "IBM Plex Mono",
            size: 17,
          }),
        ],
        spacing: { after: 140 },
      })
    );
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Whole document
// ---------------------------------------------------------------------------

export async function renderDocumentDocx(args: {
  doc: DocumentMeta;
  skill: Skill;
  units: Unit[];
}): Promise<Buffer> {
  const { doc, skill } = args;
  const units = orderUnits(args.units, skill);

  const children: DocxBlock[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun(skill.title)],
      spacing: { after: 80 },
    }),
    new Paragraph({
      children: [
        new TextRun({
          text: `${doc.id} · skill rev ${doc.skillRev} · generated by ${modelLabel(doc.modelId)}`,
          color: MUTED,
          font: "IBM Plex Mono",
          size: 17,
        }),
      ],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 4, color: HAIRLINE, space: 6 },
      },
      spacing: { after: 240 },
    }),
    ...units.flatMap(unitBlocks),
  ];

  const docx = new Document({
    styles: {
      default: {
        document: { run: { font: "Arial", size: 22, color: INK } },
      },
      paragraphStyles: [
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 32, bold: true, font: "Arial", color: INK },
          paragraph: { spacing: { before: 0, after: 120 }, outlineLevel: 0 },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { size: 26, bold: true, font: "Arial", color: INK },
          paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1 },
        },
      ],
    },
    numbering: {
      config: [
        {
          reference: "docgen-bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 540, hanging: 270 } } },
            },
          ],
        },
        {
          reference: "docgen-numbers",
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 540, hanging: 270 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 }, // 2cm
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: skill.title,
                    italics: true,
                    color: MUTED,
                    size: 18,
                  }),
                  new TextRun({
                    text: `\t${doc.id} · skill rev ${doc.skillRev}`,
                    color: MUTED,
                    font: "IBM Plex Mono",
                    size: 16,
                  }),
                ],
                tabStops: [
                  { type: TabStopType.RIGHT, position: TabStopPosition.MAX },
                ],
                border: {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    size: 4,
                    color: HAIRLINE,
                    space: 2,
                  },
                },
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  new TextRun({ text: "Page ", color: MUTED, size: 16 }),
                  new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 16 }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(docx);
}
