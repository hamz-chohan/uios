import type { Evidence, SourceAsset } from "@/lib/types";
import { ASSETS, chunksFor, getAsset } from "./assets";

const STOP = new Set(
  "the a an and or of to in for on with as by is are be at from this that these those which section product information should must may include its their been has have was were will can not no".split(
    " "
  )
);

function terms(q: string): string[] {
  return [
    ...new Set(
      q
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !STOP.has(w))
    ),
  ];
}

function scoreChunk(text: string, qTerms: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const t of qTerms) {
    // Whole-word-ish match; count presence, lightly reward repeats.
    const n = lower.split(t).length - 1;
    if (n > 0) hits += 1 + Math.min(n - 1, 2) * 0.25;
  }
  if (qTerms.length === 0) return 0;
  // Normalize by query breadth; a chunk covering more distinct terms wins.
  return hits / (qTerms.length + 2);
}

// Sentence-aligned excerpts. "Use this" in the drawer pastes excerpts verbatim
// into the document, so they must read as prose: whole sentences, never a
// mid-word cut, no ellipsis litter. Fixed-length lookbehind keeps "U.S." and
// "e.g." intact (the char before the terminator must be lowercase/digit).
const SENTENCE_BOUNDARY = /(?<=[a-z0-9)"'%][.!?])\s+(?=["(]?[A-Z0-9])/;

function sentencesOf(text: string): string[] {
  return text
    .replace(/\s*\n\s*/g, " ")
    .split(SENTENCE_BOUNDARY)
    .map((s) => s.trim())
    .filter(Boolean);
}

// A lone sentence longer than the cap still needs a word-safe trim.
function hardCap(s: string, cap: number): string {
  if (s.length <= cap) return s;
  const cut = s.slice(0, cap);
  const sp = cut.lastIndexOf(" ");
  return (sp > 0 ? cut.slice(0, sp) : cut) + " …";
}

function snippet(text: string, qTerms: string[], max = 360): string {
  const parts = sentencesOf(text);
  if (parts.length === 0) return "";
  const joined = parts.join(" ");
  const lower = joined.toLowerCase();
  let at = -1;
  for (const t of qTerms) {
    const i = lower.indexOf(t);
    if (i >= 0 && (at === -1 || i < at)) at = i;
  }
  // Start at the sentence containing the earliest hit (0 when none).
  let start = 0;
  if (at >= 0) {
    let off = 0;
    for (let i = 0; i < parts.length; i++) {
      off += parts[i].length + 1; // " " joiner
      if (at < off) {
        start = i;
        break;
      }
    }
  }
  const out: string[] = [];
  let len = 0;
  for (let i = start; i < parts.length; i++) {
    if (len > 0 && len + 1 + parts[i].length > max) break;
    out.push(parts[i]);
    len += parts[i].length + (len > 0 ? 1 : 0);
  }
  return hardCap(out.join(" "), 600);
}

function localRetrieve(query: string, k: number, assetIds?: string[]): Evidence[] {
  const qTerms = terms(query);
  const assets: SourceAsset[] = assetIds?.length
    ? (assetIds.map(getAsset).filter(Boolean) as SourceAsset[])
    : ASSETS;

  const scored: Evidence[] = [];
  for (const asset of assets) {
    for (const c of chunksFor(asset)) {
      const s = scoreChunk(c.text, qTerms);
      if (s <= 0) continue;
      scored.push({
        assetId: asset.id,
        title: asset.shortTitle,
        kind: asset.kind,
        page: c.page,
        locator: `${asset.shortTitle} p.${c.page}`,
        excerpt: snippet(c.text, qTerms),
        score: Math.min(1, s),
        retriever: "local",
      });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  // De-dupe near-identical excerpts from adjacent chunks.
  const seen = new Set<string>();
  const out: Evidence[] = [];
  for (const e of scored) {
    const key = `${e.assetId}:${e.page}:${e.excerpt.slice(0, 40)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= k) break;
  }
  return out;
}

// RAG path - only used when RAG_CORPUS is configured. Kept import-free of the
// Vertex SDK at module load so the app boots without it; the real call lands
// when the corpus is stood up (see scripts/setup-corpus.sh).
async function ragRetrieve(
  query: string,
  k: number
): Promise<Evidence[] | null> {
  const corpus = process.env.RAG_CORPUS;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!corpus || !project || process.env.LIBRARY_RETRIEVER !== "rag") return null;
  try {
    // Lazy import so a missing dep never breaks the default local path.
    const { GoogleAuth } = await import("google-auth-library");
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"],
    });
    const client = await auth.getClient();
    const location = process.env.VERTEX_LOCATION || "us-central1";
    const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}:retrieveContexts`;
    const res = await client.request<{
      contexts?: {
        contexts?: {
          sourceUri?: string;
          text?: string;
          sourceDisplayName?: string;
          pageNumber?: number;
          score?: number;
        }[];
      };
    }>({
      url,
      method: "POST",
      data: {
        vertexRagStore: { ragResources: [{ ragCorpus: corpus }] },
        query: { text: query, similarityTopK: k },
      },
    });
    const ctx = res.data.contexts?.contexts ?? [];
    return ctx.map((c) => {
      const name = c.sourceDisplayName ?? c.sourceUri ?? "corpus";
      const page = c.pageNumber ?? 0;
      return {
        assetId: name,
        title: name,
        kind: "evidence" as const,
        page,
        locator: page ? `${name} p.${page}` : name,
        excerpt: snippet(c.text ?? "", [], 360),
        score: c.score ?? 0,
        retriever: "rag" as const,
      };
    });
  } catch {
    return null; // any failure → caller falls back to local
  }
}

export interface RetrieveOptions {
  k?: number;
  assetIds?: string[];
}

// Public entry: try RAG when configured, always fall back to local so a corpus
// hiccup can never break the demo.
export async function retrieveEvidence(
  query: string,
  opts: RetrieveOptions = {}
): Promise<Evidence[]> {
  const k = opts.k ?? 5;
  const rag = await ragRetrieve(query, k);
  if (rag && rag.length > 0) return rag;
  return localRetrieve(query, k, opts.assetIds);
}
