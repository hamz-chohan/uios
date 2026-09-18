import type { GenerateArgs } from "./types";

export function buildSystemPrompt(): string {
  return [
    "You draft exactly one section of a regulated medical document.",
    "Follow the section expectation exactly - no more, no less.",
    "Use ONLY the provided sources; they are delimited <source> blocks in the user message.",
    "Every factual claim must carry a citation object { sourceId, locator } where sourceId is the id of a provided source and locator is a page or section marker that actually appears in that source's text (e.g. \"p.2 §Synopsis\" or \"Table 3\").",
    "If the expectation asks for information that is not present in the provided sources, do NOT invent it: return status \"NEEDS_AUTHOR\" with an empty contentMd and a short note explaining what is missing.",
    "If mandatory text is specified for the section, it must appear in contentMd verbatim - unchanged, unabridged, unparaphrased.",
    "contentMd is GitHub-flavored markdown. Render any tabular data as a GFM pipe table. Do not include the section heading itself in contentMd.",
    "Set confidence between 0 and 1 reflecting how completely and unambiguously the sources support the content.",
    "Statuses: \"FILLED_CITED\" when the content is fully grounded and cited; \"NEEDS_AUTHOR\" when required information is absent from the sources; \"NEEDS_VALIDATION\" when the content is present but you are unsure it is correctly grounded.",
  ].join(" ");
}

export function buildUserContent(args: GenerateArgs): string {
  const { section, sourceExcerpts, docTitle } = args;

  const sourceBlocks = sourceExcerpts
    .map(
      (s) =>
        `<source id="${s.sourceId}" title="${s.sourceId}">\n${s.text}\n</source>`
    )
    .join("\n\n");

  const sectionLines = [
    "<section>",
    `Heading: ${section.heading}`,
    `Expectation: ${section.expectation}`,
    `Sources expected by the skill: ${section.sources.join(", ") || "(none)"}`,
  ];
  if (section.mandatoryText) {
    sectionLines.push(
      `Mandatory text (must appear verbatim in contentMd): "${section.mandatoryText}"`
    );
  }
  sectionLines.push("</section>");

  return [
    `Document: ${docTitle}`,
    "",
    sourceBlocks || "(no sources were provided for this section)",
    "",
    sectionLines.join("\n"),
    "",
    "Draft this section now, following the system rules.",
  ].join("\n");
}
