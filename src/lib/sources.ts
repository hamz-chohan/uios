import { readFileSync } from "node:fs";
import path from "node:path";

export interface LoadedSource {
  id: string;
  title: string;
  text: string;
}

const SOURCE_ORDER = [
  "protocol",
  "inquiry",
  "csr",
  "ib",
  "quality-review",
  "biosimilar-guidance",
] as const;

const TITLES: Record<string, string> = {
  protocol: "Protocol Synopsis - ONC-401-202",
  inquiry: "Unsolicited Medical Inquiry - MI-2026-04417",
  csr: "Clinical Study Report Excerpt - ONC-401-202",
  ib: "Investigator's Brochure Excerpt - Oncorafenib (ONC-401)",
  "quality-review":
    "FDA Multi-Discipline Review (excerpt) - NDA 213895, Vancomycin Injection",
  "biosimilar-guidance":
    "FDA Guidance for Industry - Labeling for Biosimilar Products (2018)",
};

const SOURCE_DIR = path.join(process.cwd(), "src", "data", "sources");

let cache: LoadedSource[] | null = null;

function load(): LoadedSource[] {
  if (cache) return cache;
  cache = SOURCE_ORDER.map((id) => ({
    id,
    title: TITLES[id] ?? id,
    text: readFileSync(path.join(SOURCE_DIR, `${id}.md`), "utf8"),
  }));
  return cache;
}

export function listSources(): LoadedSource[] {
  return load();
}

export function sourcesFor(ids: string[]): LoadedSource[] {
  const byId = new Map(load().map((s) => [s.id, s]));
  // Preserve the requested order; silently drop ids with no source doc (e.g. `pi`).
  return ids
    .map((id) => byId.get(id))
    .filter((s): s is LoadedSource => s !== undefined);
}
