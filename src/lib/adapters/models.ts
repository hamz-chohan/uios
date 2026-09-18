import type { ModelId } from "../types";

// Isomorphic model list for the picker. Kept free of any SDK imports so
// client components can use it without dragging the Vertex SDKs (and their
// node-only deps) into the browser bundle. The server-only registry lives
// in ./index.ts.
// Dropdown section header for models gated behind an access-approval step.
const UPON_REQUEST = "Available upon request";

export const availableModels: {
  id: ModelId;
  label: string;
  disabled?: boolean;
  group?: string;
}[] = [
  { id: "gemini-3.1-flash-lite", label: "Gemini 3.1 Flash-Lite" },
  { id: "claude-fable-5", label: "Claude Fable 5", disabled: true, group: UPON_REQUEST },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", disabled: true, group: UPON_REQUEST },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", disabled: true, group: UPON_REQUEST },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", disabled: true, group: UPON_REQUEST },
];

// Display names for persisted model ids - includes retired/legacy ids that
// no longer appear in the picker but still exist on stored documents.
const MODEL_LABELS: Record<string, string> = {
  "gemini-3.1-flash-lite": "Gemini 3.1 Flash-Lite",
  "gemini-3-pro-preview": "Gemini 3 Pro",
  "claude-fable-5": "Claude Fable 5",
  "claude-opus-4-8": "Claude Opus 4.8",
  "claude-sonnet-5": "Claude Sonnet 5",
  "claude-opus-4-7": "Claude Opus 4.7",
  mock: "Mock (offline)",
};

export function modelLabel(id: string): string {
  return MODEL_LABELS[id] ?? id;
}
