import type { GeneratedUnitPayload, ModelId, SkillSection } from "../types";

export interface GenerateArgs {
  section: SkillSection;
  sourceExcerpts: { sourceId: string; text: string }[];
  docTitle: string;
}

export interface ModelAdapter {
  id: ModelId;
  label: string;
  // Non-streamed: used for batch pre-generation.
  generate(args: GenerateArgs): Promise<GeneratedUnitPayload>;
  // Streamed: used for the one live section on stage. Yields content deltas,
  // then resolves the final validated payload.
  generateStream(
    args: GenerateArgs,
    onDelta: (text: string) => void
  ): Promise<GeneratedUnitPayload>;
}
