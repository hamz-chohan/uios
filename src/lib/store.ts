// In-memory store for the studio. A module-level singleton survives across
// route handlers within one server process; a cold start resets demo state.
// This is why the service must run at max-instances 1 (see Makefile).
import type {
  CorrectionEvent,
  DocumentMeta,
  Skill,
  Unit,
} from "./types";

interface Store {
  skills: Map<string, Skill>;
  docs: Map<string, DocumentMeta>;
  units: Map<string, Unit>; // key = unit.id
  events: CorrectionEvent[];
}

// Preserve across hot-reload in dev.
const g = globalThis as unknown as { __docgenStore?: Store };
export const store: Store =
  g.__docgenStore ??
  (g.__docgenStore = {
    skills: new Map(),
    docs: new Map(),
    units: new Map(),
    events: [],
  });

export function unitsForDoc(docId: string): Unit[] {
  return [...store.units.values()]
    .filter((u) => u.docId === docId)
    .sort((a, b) => a.sectionId.localeCompare(b.sectionId));
}

export function upsertUnit(u: Unit): void {
  store.units.set(u.id, u);
}

export function recordEvent(e: CorrectionEvent): void {
  store.events.push(e);
}

export function putDoc(d: DocumentMeta): void {
  store.docs.set(d.id, d);
}

export function putSkill(s: Skill): void {
  store.skills.set(s.id, s);
}

// Removes a document and its units; correction events stay (audit trail).
export function removeDoc(docId: string): boolean {
  const existed = store.docs.delete(docId);
  for (const u of [...store.units.values()]) {
    if (u.docId === docId) store.units.delete(u.id);
  }
  return existed;
}
