import { describe, expect, it } from "vitest";

import { readR12SpecConformance, R12_SPEC_CONFORMANCE_REPORT, validateR12SpecConformance } from "../src/lib/research/m3-r12-round-012-conformance.ts";

describe("M3-R12 executable A-N conformance", () => {
  it("passes every frozen thesis, settlement, boundary, and safety check", () => {
    validateR12SpecConformance(R12_SPEC_CONFORMANCE_REPORT);
    expect(R12_SPEC_CONFORMANCE_REPORT.resultAffectingDeviationCount).toBe(0);
    expect(R12_SPEC_CONFORMANCE_REPORT.thesisStateMachineVerified).toBe(true);
    expect(R12_SPEC_CONFORMANCE_REPORT.noOutcomeLookahead).toBe(true);
    expect(R12_SPEC_CONFORMANCE_REPORT.candidateSettlementIdentityVerified).toBe(true);
    expect(R12_SPEC_CONFORMANCE_REPORT.productionSeenDataExcluded).toBe(true);
    expect(Object.values(R12_SPEC_CONFORMANCE_REPORT.checks).every(Boolean)).toBe(true);
  });

  it("reads the committed machine report without network or performance", () => {
    expect(readR12SpecConformance().checks).toEqual({ A: true, B: true, C: true, D: true, E: true, F: true, G: true, H: true, I: true, J: true, K: true, L: true, M: true, N: true });
  });
});
