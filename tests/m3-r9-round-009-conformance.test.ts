import { describe, expect, it } from "vitest";

import { readR9SpecConformance } from "../src/lib/research/m3-r9-round-009-conformance.ts";
import { M3_R9_CANDIDATE_IDS, M3_R9_RESEARCH_END_ISO } from "../src/lib/research/m3-r9-round-009-protocol.ts";

describe("M3-R9 machine-readable conformance record", () => {
  it("parses the committed UTF-8 record and validates the frozen identities", () => {
    const report = readR9SpecConformance();
    expect(report.authorizedCandidateCount).toBe(5);
    expect(report.candidateIds).toEqual(M3_R9_CANDIDATE_IDS);
    expect(report.validation.boundary).toBe(M3_R9_RESEARCH_END_ISO);
    expect(report.resultAffectingDeviationCount).toBe(0);
    expect(report.postLockMarketFetchPossible).toBe(false);
    expect(report.privateBinanceApi).toBe(false);
    expect(report.automaticTrading).toBe(false);
  });
});
