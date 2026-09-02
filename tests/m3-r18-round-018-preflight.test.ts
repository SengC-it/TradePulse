import { describe, expect, it } from "vitest";

import { buildR18PreflightReport, evaluateR18StructuralGates, type R18PreflightFacts } from "@/lib/research/m3-r18-round-018-preflight";

const foldCounts = Object.fromEntries(["F1", "F2", "F3", "F4", "F5", "F6"].map((fold) => [fold, { BTCUSDT: { BTC_STRONG_BULL: { control: 100, candidate: 100, controlH4Executed: 100, candidateH4Executed: 100 } } }]));
const baseFacts: R18PreflightFacts = {
  acceptedSourceProvenanceValid: true,
  observationSourcePresent: true,
  observationCount: 244810,
  observationBytes: 1893811055,
  observationSha256: "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359",
  sourceStatus: "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE",
  statusCounts: { NO_BASELINE_CANDIDATE: 237310, BASELINE_CANDIDATE_NON_FORMAL: 0, BASELINE_FORMAL: 7500, PROVENANCE_INCOMPLETE: 0 },
  labelStatusCounts: { EXECUTED: 7500, NO_ENTRY: 0, DATA_INCOMPLETE: 0, PERIOD_END_CENSORED: 0, MISSING: 0 },
  allPopulationPartitioned: true,
  duplicateCanonicalCount: 0,
  invalidMetadataCount: 0,
  provenanceIncompleteCount: 0,
  pointInTimeViolationCount: 0,
  replaySourceErrors: 0,
  formalCount: 7500,
  controlCount: 7500,
  candidateCount: 600,
  candidateH4ExecutedCount: 600,
  candidateSymbols: ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"],
  candidateRegimes: ["BTC_STRONG_BULL", "BTC_NEUTRAL", "BTC_STRONG_BEAR"],
  countsByFoldSymbolRegime: foldCounts,
  compactRecordCount: 7500,
  compactIntegrityValid: true,
  labelDataIncompleteCount: 0,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  selectionExecuted: false,
};

describe("Round-018 G01-G07 structural preflight", () => {
  it("passes all structural gates with complete synthetic facts", () => {
    expect(evaluateR18StructuralGates(baseFacts).every((gate) => gate.status === "PASS")).toBe(true);
    const report = buildR18PreflightReport(baseFacts);
    expect(report.finalClassification).toBe("ROUND-018 PREFLIGHT PASS — PERFORMANCE NOT AUTHORIZED");
    expect(report.performanceExecutionCount).toBe(0);
    expect(report.integrity.economicValuesCalculated).toBe(false);
  });

  it("fails G01 closed on unresolved replay provenance while retaining diagnostics", () => {
    const facts = { ...baseFacts, provenanceIncompleteCount: 1, statusCounts: { ...baseFacts.statusCounts, PROVENANCE_INCOMPLETE: 1, NO_BASELINE_CANDIDATE: 237309 } };
    const gates = evaluateR18StructuralGates(facts);
    expect(gates.find((gate) => gate.id === "G01_DATA_PROVENANCE")?.status).toBe("FAIL");
    expect(buildR18PreflightReport(facts).g01Failure).toBe("ROUND-018 PERFORMANCE INELIGIBLE — SCORE PROVENANCE");
  });

  it("requires exact partition, breadth, and strict discrimination", () => {
    expect(evaluateR18StructuralGates({ ...baseFacts, allPopulationPartitioned: false })[0]!.status).toBe("FAIL");
    expect(evaluateR18StructuralGates({ ...baseFacts, candidateH4ExecutedCount: 499 })[2]!.status).toBe("FAIL");
    expect(evaluateR18StructuralGates({ ...baseFacts, candidateCount: 7500 })[6]!.status).toBe("FAIL");
  });

  it("uses H4 EXECUTED candidate breadth for aggregate and fold gates", () => {
    expect(evaluateR18StructuralGates({ ...baseFacts, candidateCount: 600, candidateH4ExecutedCount: 499 })[2]!.status).toBe("FAIL");
    const sparseFoldCounts = Object.fromEntries(["F1", "F2", "F3", "F4", "F5", "F6"].map((fold) => [fold, { BTCUSDT: { BTC_STRONG_BULL: { control: 100, candidate: 100, controlH4Executed: 100, candidateH4Executed: 49 } } }]));
    expect(evaluateR18StructuralGates({ ...baseFacts, candidateH4ExecutedCount: 600, countsByFoldSymbolRegime: sparseFoldCounts })[3]!.status).toBe("FAIL");
  });
});
