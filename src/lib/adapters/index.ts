import type { ModelId } from "../types";
import type { ModelAdapter } from "./types";
import { mockAdapter } from "./mock";
import { claudeVertexAdapter } from "./claude-vertex";
import { geminiVertexAdapter } from "./gemini-vertex";

// Registry the model picker resolves against.
const adapters: Partial<Record<ModelId, ModelAdapter>> = {
  mock: mockAdapter,
  "gemini-3.1-flash-lite": geminiVertexAdapter,
  "claude-opus-4-8": claudeVertexAdapter,
  // Legacy alias: documents persisted before the 3.1 switch carry this id.
  "gemini-3-pro-preview": geminiVertexAdapter,
};

export function getAdapter(id: ModelId): ModelAdapter {
  // MODEL_MODE=mock (the default) short-circuits every id to the mock so the
  // app runs credential-free; MODEL_MODE=live resolves the real adapters.
  if (process.env.MODEL_MODE !== "live") return mockAdapter;
  return adapters[id] ?? mockAdapter;
}

export function registerAdapter(a: ModelAdapter): void {
  adapters[a.id] = a;
}

// Client components import this from "./models" directly (no SDK deps);
// re-exported here for server-side convenience.
export { availableModels } from "./models";
