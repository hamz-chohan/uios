import { readFileSync } from "node:fs";
import path from "node:path";
import type { SourceAsset } from "@/lib/types";

const DIR = path.join(process.cwd(), "src", "data", "library");

export const ASSETS: SourceAsset[] = [
  {
    id: "fda-biosimilar-guidance",
    title: "Labeling for Biosimilar Products - Guidance for Industry",
    shortTitle: "FDA Biosimilar Labeling Guidance",
    kind: "rules",
    sourceId: "biosimilar-guidance",
    org: "FDA · CDER / CBER",
    date: "July 2018",
    pages: 15,
    tags: ["labeling", "biosimilar", "normative", "mandatory text"],
    description:
      "Normative guidance defining required labeling content for biosimilar products, including proprietary-vs-proper-name rules and the mandatory biosimilarity footnote.",
    pdfPath: "fda-biosimilar-labeling-guidance.pdf",
    textPath: "fda-biosimilar-labeling-guidance.txt",
  },
  {
    id: "fda-nda-213895-review",
    title: "Multi-Discipline Review - NDA 213895, Vancomycin Injection USP",
    shortTitle: "FDA Review · NDA 213895",
    kind: "evidence",
    sourceId: "quality-review",
    org: "FDA · CDER",
    date: "2021",
    pages: 85,
    tags: ["CMC", "quality", "leachables", "stability", "vancomycin"],
    description:
      "The FDA review record for Vancomycin Injection: the Complete Response over container-closure leachables, the resubmitted assessment, stability and retest-period data, and the OPQ approval recommendation.",
    pdfPath: "fda-nda-213895-quality-review.pdf",
    textPath: "fda-nda-213895-quality-review.txt",
  },
];

export function listAssets(): SourceAsset[] {
  return ASSETS;
}

export function getAsset(id: string): SourceAsset | undefined {
  return ASSETS.find((a) => a.id === id);
}

export function getAssetBySourceId(sourceId: string): SourceAsset | undefined {
  return ASSETS.find((a) => a.sourceId === sourceId);
}

export interface PageChunk {
  assetId: string;
  page: number; // 1-based
  text: string;
}

// Cache the page split per asset (module lifetime).
const pageCache = new Map<string, string[]>();

function pagesFor(asset: SourceAsset): string[] {
  const cached = pageCache.get(asset.id);
  if (cached) return cached;
  const raw = readFileSync(path.join(DIR, asset.textPath), "utf8");
  // pdftotext delimits pages with the form-feed character.
  const pages = raw.split("\f").map((p) => p.replace(/\s+\n/g, "\n").trim());
  pageCache.set(asset.id, pages);
  return pages;
}

// Running headers/footers repeat across pages and pdftotext keeps them inline,
// so they glue onto real paragraphs ("Contains Nonbinding Recommendations For
// example, …"). Detect short lines that recur on ≥25% of pages and strip them,
// along with bare page-number lines - noise for scoring, garbage in excerpts.
function furnitureFor(pages: string[]): Set<string> {
  const counts = new Map<string, number>();
  for (const p of pages) {
    const seen = new Set<string>();
    for (const line of p.split("\n")) {
      const t = line.trim();
      if (t.length === 0 || t.length >= 60 || seen.has(t)) continue;
      seen.add(t);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
  }
  const threshold = Math.max(3, Math.ceil(pages.length * 0.25));
  return new Set(
    [...counts].filter(([, n]) => n >= threshold).map(([t]) => t)
  );
}

// Paragraph-level chunks with their page number, for retrieval scoring.
export function chunksFor(asset: SourceAsset): PageChunk[] {
  const pages = pagesFor(asset);
  const furniture = furnitureFor(pages);
  const chunks: PageChunk[] = [];
  pages.forEach((pageText, i) => {
    const cleaned = pageText
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !furniture.has(t) && !/^\d{1,3}$/.test(t);
      })
      .join("\n");
    // Split a page into paragraph blocks; keep blocks with real substance.
    const blocks = cleaned
      .split(/\n{2,}/)
      .map((b) => b.replace(/[ \t]{2,}/g, " ").trim())
      .filter((b) => b.length >= 60);
    for (const b of blocks) {
      chunks.push({ assetId: asset.id, page: i + 1, text: b });
    }
  });
  return chunks;
}

export function readAssetPdf(asset: SourceAsset): Buffer {
  return readFileSync(path.join(DIR, asset.pdfPath));
}
