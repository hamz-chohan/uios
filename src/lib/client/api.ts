// Typed fetch helpers for the DocGen API. All workspace state lives
// client-side; these helpers are the only way the UI talks to the route
// handlers.

import type {
  AssetKind,
  Citation,
  CorrectionEvent,
  CorrectionType,
  DocumentMeta,
  Evidence,
  ModelId,
  Skill,
  Telemetry,
  Unit,
} from "@/lib/types";

export interface AssetSummary {
  id: string;
  title: string;
  shortTitle: string;
  kind: AssetKind;
  org: string;
  date: string;
  pages: number;
  tags: string[];
  description: string;
}

export interface SkillSummary {
  id: string;
  version: string;
  title: string;
  status?: "draft" | "published";
  sectionCount?: number;
}

export interface Check {
  id: string;
  label: string;
  pass: boolean;
  detail: string;
}

export interface DocumentSummary {
  doc: DocumentMeta;
  skillTitle: string;
  unitCount: number;
  statusCounts: Record<string, number>;
}

export interface UnitActionArgs {
  type: CorrectionType;
  after?: string;
  reason?: string;
  actor?: string;
  assistNotes?: string; // raw notes when a fill was AI-expanded
  citations?: Citation[]; // attach on a Ground-sourced fill
  ground?: { query: string; assetIds: string[]; locators: string[] };
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // non-JSON error body - keep the status message
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function post<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export const api = {
  listSkills(opts?: { all?: boolean }): Promise<SkillSummary[]> {
    const q = opts?.all ? "?all=1" : "";
    return request<{ skills: SkillSummary[] }>(`/api/skills${q}`).then(
      (r) => r.skills
    );
  },

  draftSkillFromPrompt(prompt: string, id?: string): Promise<Skill> {
    return post<{ skill: Skill }>("/api/skills", { prompt, id }).then(
      (r) => r.skill
    );
  },

  publishSkill(id: string): Promise<Skill> {
    return post<{ skill: Skill }>("/api/skills", { id, publish: true }).then(
      (r) => r.skill
    );
  },

  unpublishSkill(id: string): Promise<Skill> {
    return post<{ skill: Skill }>("/api/skills", { id, publish: false }).then(
      (r) => r.skill
    );
  },

  deleteSkill(id: string): Promise<{ ok: boolean }> {
    return request(`/api/skills/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  getSkill(id: string): Promise<Skill> {
    return request<{ skill: Skill }>(
      `/api/skills/${encodeURIComponent(id)}`
    ).then((r) => r.skill);
  },

  editSkill(
    id: string,
    instruction: string
  ): Promise<{ newRaw: string; affectedSectionIds: string[] }> {
    return post(`/api/skills/${encodeURIComponent(id)}/edit`, { instruction });
  },

  saveSkill(
    id: string,
    newRaw: string
  ): Promise<{ skill: Skill; affectedSectionIds: string[] }> {
    return post(`/api/skills/${encodeURIComponent(id)}/save`, { newRaw });
  },

  createDocument(args: {
    skillId: string;
    sourceIds: string[];
    modelId: ModelId;
  }): Promise<{ doc: DocumentMeta; units: Unit[] }> {
    return post("/api/documents", args);
  },

  getDocument(
    id: string
  ): Promise<{ doc: DocumentMeta; units: Unit[]; skill: Skill }> {
    return request(`/api/documents/${encodeURIComponent(id)}`);
  },

  listDocuments(): Promise<DocumentSummary[]> {
    return request<{ documents: DocumentSummary[] }>("/api/documents").then(
      (r) => r.documents
    );
  },

  deleteDocument(id: string): Promise<{ ok: boolean }> {
    return request(`/api/documents/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  },

  getChecks(docId: string): Promise<Check[]> {
    return request<{ checks: Check[] }>(
      `/api/documents/${encodeURIComponent(docId)}/checks`
    ).then((r) => r.checks);
  },

  // Unit ids contain ":" - always URL-encode (the handler decodes).
  unitAction(
    unitId: string,
    action: UnitActionArgs
  ): Promise<{ unit: Unit; event: CorrectionEvent }> {
    return post(`/api/units/${encodeURIComponent(unitId)}/action`, action);
  },

  telemetry(): Promise<Telemetry> {
    return request<Telemetry>("/api/telemetry");
  },

  // --- Content Library (CCMS) -----------------------------------------------
  listAssets(): Promise<AssetSummary[]> {
    return request<{ assets: AssetSummary[] }>("/api/library").then(
      (r) => r.assets
    );
  },

  searchLibrary(
    query: string,
    assetIds?: string[]
  ): Promise<{ query: string; evidence: Evidence[] }> {
    return post("/api/library/search", { query, assetIds });
  },

  // Retrieve evidence for a unit from the library (Ground). Read-only.
  groundUnit(
    unitId: string,
    query?: string
  ): Promise<{ query: string; evidence: Evidence[] }> {
    return post(`/api/units/${encodeURIComponent(unitId)}/ground`, { query });
  },
};
