// Core data model, shared by the route handlers and the client.

export type UnitStatus =
  | "PENDING"
  | "FILLED_CITED"
  | "NEEDS_AUTHOR"
  | "NEEDS_VALIDATION"
  | "OVERRIDDEN"
  | "APPROVED";

export interface Citation {
  sourceId: string;
  locator: string; // page/section locator, e.g. "protocol p.2 §Synopsis"
}

export interface Unit {
  id: string; // `${docId}:${sectionId}`
  docId: string;
  sectionId: string;
  heading: string;
  contentMd: string;
  citations: Citation[];
  confidence: number; // 0..1
  status: UnitStatus;
  modelId: string; // badge per unit: which model produced it
  skillRev: string; // pinned skill version that produced it
  version: number;
  updatedAt: string;
  note?: string; // e.g. needs_author explanation from the adapter
  previousContentMd?: string; // populated during regenerate for the diff view
  previousSkillRev?: string; // the rev the superseded content was produced under
}

export type CorrectionType =
  | "FILL_PLACEHOLDER"
  | "OVERRIDE_WRONG"
  | "ACCEPT"
  | "FLAG";

export interface CorrectionEvent {
  unitId: string;
  actor: string;
  ts: string;
  type: CorrectionType;
  before: string;
  after: string;
  reason?: string;
  // Present when a FILL_PLACEHOLDER was AI-expanded: the reviewer's raw notes
  // plus the model that expanded them. The human remains the actor.
  assist?: { notes: string; modelId: string };
  // Present when the fill/validation came from the Content Library (Ground):
  // the query run against the corpus and the assets + locators used.
  ground?: { query: string; assetIds: string[]; locators: string[] };
}

// ---------------------------------------------------------------------------
// Content Library (CCMS) - the asset repository DocGen grounds on.
// ---------------------------------------------------------------------------

export type AssetKind = "rules" | "evidence";

export interface SourceAsset {
  id: string;
  title: string;
  shortTitle: string; // used in citation locators, e.g. "FDA Biosimilar Guidance"
  kind: AssetKind; // rules = normative; evidence = factual
  sourceId: string; // the id this asset maps to in sources.ts (grounding link)
  org: string;
  date: string;
  pages: number;
  tags: string[];
  description: string; // agent-written one-liner shown on the card
  pdfPath: string; // under src/data/library/
  textPath: string; // page-delimited extract under src/data/library/
}

// One retrieval hit: an excerpt from an asset with a page-accurate locator.
export interface Evidence {
  assetId: string;
  title: string; // asset short title
  kind: AssetKind;
  page: number;
  locator: string; // e.g. "FDA Review p.7"
  excerpt: string;
  score: number; // 0..1 retrieval score
  retriever: "local" | "rag"; // which path produced it (honest provenance)
}

export interface SkillSection {
  id: string;
  heading: string;
  expectation: string;
  sources: string[];
  mandatoryText?: string;
  contentHash: string;
}

export type SkillStatus = "draft" | "published";

export interface Skill {
  id: string;
  version: string;
  title: string;
  sections: SkillSection[];
  raw: string;
  status?: SkillStatus;
}

export interface SourceDoc {
  id: string;
  title: string;
  kind: "pdf" | "docx" | "md";
  // Demo sources are bundled markdown/PDF excerpts; MVP swaps this for the knowledge layer.
  path: string;
}

export interface DocumentMeta {
  id: string;
  skillId: string;
  skillRev: string;
  sourceIds: string[];
  modelId: ModelId;
  createdAt: string;
}

export type ModelId =
  | "gemini-3.1-flash-lite"
  | "claude-opus-4-8"
  | "claude-fable-5"
  | "claude-sonnet-5"
  | "claude-opus-4-7"
  // Legacy id retained so documents persisted before the 3.1 switch still
  // resolve to the Gemini adapter.
  | "gemini-3-pro-preview"
  | "mock";

export interface Telemetry {
  eventsByType: Record<CorrectionType, number>;
  unitsByStatus: Record<UnitStatus, number>;
  totalEvents: number;
}

// The structured-output contract every adapter must satisfy.
export interface GeneratedUnitPayload {
  contentMd: string;
  citations: Citation[];
  confidence: number;
  status: Extract<UnitStatus, "FILLED_CITED" | "NEEDS_AUTHOR" | "NEEDS_VALIDATION">;
  note?: string;
}
