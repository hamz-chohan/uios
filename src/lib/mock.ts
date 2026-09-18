import type { GeneratedUnitPayload } from "./types";

export const MOCK_UNITS: Record<string, GeneratedUnitPayload> = {
  background: {
    contentMd:
      '_This response is provided in answer to an unsolicited medical inquiry and is not intended to promote the product._\n\nOncorafenib (ONC-401) is an oral, selective FGFR2-fusion kinase inhibitor under evaluation for locally advanced or metastatic intrahepatic cholangiocarcinoma (ICC) in adults who have progressed on at least one prior line of systemic therapy. The evidence in this response is drawn from the pivotal Phase 2 study ONC-401-202.',
    citations: [{ sourceId: "protocol", locator: "protocol p.1 §2" }],
    confidence: 0.93,
    status: "FILLED_CITED",
  },
  "clinical-question": {
    contentMd:
      "The requesting physician asks what efficacy has been reported for Oncorafenib in previously treated, FGFR2-fusion-positive intrahepatic cholangiocarcinoma - specifically the objective response rate and the durability of response - together with the progression-free and overall survival results from the pivotal study and the principal safety considerations relevant to patient counseling.",
    citations: [{ sourceId: "inquiry", locator: "inquiry p.1 §Verbatim" }],
    confidence: 0.9,
    status: "FILLED_CITED",
  },
  "evidence-summary": {
    contentMd:
      "In the pivotal Phase 2 study ONC-401-202, Oncorafenib produced a confirmed objective response rate of 42% (95% CI 32-52) by independent central review, with a median duration of response of 9.7 months (95% CI 7.6-17.0). Median progression-free survival was 8.9 months (95% CI 6.7-11.4) and median overall survival was 21.3 months (95% CI 15.8-not estimable). The most common adverse event was hyperphosphatemia (78%), an expected on-target class effect that is monitorable and manageable; serous retinal detachment, a recognized FGFR-inhibitor class risk, occurred in 8% of patients and was reversible.",
    citations: [
      { sourceId: "csr", locator: "csr p.19 §11.2" },
      { sourceId: "csr", locator: "csr p.20 §11.3" },
      { sourceId: "ib", locator: "ib p.13 §6.1" },
    ],
    confidence: 0.88,
    status: "FILLED_CITED",
  },
  "efficacy-table": {
    contentMd: [
      "| Endpoint | Arm | Result | 95% CI | p-value |",
      "| --- | --- | --- | --- | --- |",
      "| Objective response rate (primary) | Oncorafenib | 42% | 32-52 | <0.001 |",
      "| Median duration of response | Oncorafenib | 9.7 months | 7.6-17.0 | - |",
      "| Median progression-free survival | Oncorafenib | 8.9 months | 6.7-11.4 | - |",
      "| Median overall survival | Oncorafenib | 21.3 months | 15.8-NE | - |",
      "| Disease control rate | Oncorafenib | 82% | 73-89 | - |",
    ].join("\n"),
    citations: [{ sourceId: "csr", locator: "csr p.20 §11.3 Table 11-3" }],
    confidence: 0.92,
    status: "FILLED_CITED",
  },
  "safety-profile": {
    contentMd:
      "Across the 108 treated patients, the most common any-grade treatment-emergent adverse events were hyperphosphatemia (78%), alopecia (45%), stomatitis (42%), diarrhea (38%), fatigue (35%), and dry mouth (32%). Grade ≥3 events in at least 5% of patients were hyperphosphatemia (12%), stomatitis (6%), and palmar-plantar erythrodysesthesia (5%). Serous retinal detachment, an adverse event of special interest, occurred in 8% of patients and was reversible. Permanent discontinuation due to a treatment-emergent adverse event occurred in 9%, with no treatment-related deaths.",
    citations: [
      { sourceId: "csr", locator: "csr p.24 §12.1" },
      { sourceId: "csr", locator: "csr p.25 §12.2" },
      { sourceId: "ib", locator: "ib p.14 §6.2" },
    ],
    confidence: 0.58,
    status: "NEEDS_VALIDATION",
    note: "Adverse-event frequencies drawn from the pivotal cohort only; confirm against the pooled safety population and the current label before release.",
  },
  dosing: {
    contentMd: "",
    citations: [],
    confidence: 0.2,
    status: "NEEDS_AUTHOR",
    note: "The prescribing information is not among the provided sources, so the approved dosing and administration cannot be grounded. Author to provide from the current label.",
  },
};
