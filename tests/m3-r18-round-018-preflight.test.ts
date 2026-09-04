import { describe, expect, it } from "vitest";

import {
  ROUND_018_FOLDS,
  ROUND_018_REGIMES,
  ROUND_018_UNIVERSE,
} from "@/lib/research/m3-r18-round-018-protocol";
import {
  buildR18PreflightReport,
  evaluateR18StructuralGates,
  R18_G01_FAILURE,
  R18_G07_FAILURE,
  R18_NON_AUTHORITATIVE_AFTER_G01_FAILURE,
  type R18PreflightFacts,
} from "@/lib/research/m3-r18-round-018-preflight";

const FOLDS_WITH_OUTSIDE = [...ROUND_018_FOLDS, "OUTSIDE_VALIDATION"] as const;

type CountOptions = Readonly<{
  candidateFor?: (fold: string, symbol: string, regime: string) => number;
  candidateH4For?: (fold: string, symbol: string, regime: string) => number;
}>;

function makeCounts(options: CountOptions = {}) {
  return Object.fromEntries(FOLDS_WITH_OUTSIDE.map((fold) => [
    fold,
    Object.fromEntries(ROUND_018_UNIVERSE.map((symbol) => [
      symbol,
      Object.fromEntries(ROUND_018_REGIMES.map((regime) => [
        regime,
        {
          control: 100,
          candidate: options.candidateFor?.(fold, symbol, regime) ?? 2,
          controlH4Executed: 100,
          candidateH4Executed: options.candidateH4For?.(fold, symbol, regime) ?? 10,
        },
      ])),
    ])),
  ]));
}

function makeSingleSymbolTotalCounts(symbol: string, total: number) {
  let assigned = false;
  return makeCounts({
    candidateFor: (_fold, currentSymbol) => {
      if (currentSymbol !== symbol) return 2;
      if (assigned) return 0;
      assigned = true;
      return total;
    },
  });
}

function makeAllSymbolTotalCounts(total: number) {
  const assigned = new Set<string>();
  return makeCounts({
    candidateFor: (_fold, symbol) => {
      if (assigned.has(symbol)) return 0;
      assigned.add(symbol);
      return total;
    },
  });
}

function makeSingleRegimeTotalCounts(regime: string, total: number) {
  let assigned = false;
  return makeCounts({
    candidateFor: (_fold, _symbol, currentRegime) => {
      if (currentRegime !== regime) return 2;
      if (assigned) return 0;
      assigned = true;
      return total;
    },
  });
}

function makeAllRegimeTotalCounts(total: number) {
  const assigned = new Set<string>();
  return makeCounts({
    candidateFor: (_fold, _symbol, regime) => {
      if (assigned.has(regime)) return 0;
      assigned.add(regime);
      return total;
    },
  });
}

const baseCounts = makeCounts();
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
  candidateH4ExecutedCount: 1050,
  validationCandidateH4ExecutedCount: 900,
  outsideValidationCandidateH4ExecutedCount: 150,
  totalStructuralCandidateH4ExecutedCount: 1050,
  candidateSymbols: [...ROUND_018_UNIVERSE],
  candidateRegimes: [...ROUND_018_REGIMES],
  countsByFoldSymbolRegime: baseCounts,
  compactRecordCount: 7500,
  compactIntegrityValid: true,
  labelDataIncompleteCount: 0,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  selectionExecuted: false,
};

describe("Round-018 G01-G07 structural preflight", () => {
  it("passes all structural gates with complete synthetic facts", () => {
    expect(evaluateR18StructuralGates(baseFacts).every((current) => current.status === "PASS")).toBe(true);
    const report = buildR18PreflightReport(baseFacts);
    expect(report.finalClassification).toBe("ROUND-018 PREFLIGHT PASS — PERFORMANCE NOT AUTHORIZED");
    expect(report.performanceExecutionCount).toBe(0);
    expect(report.integrity.economicValuesCalculated).toBe(false);
    expect(report.counts.validationCandidateH4ExecutedCount).toBe(900);
    expect(report.counts.outsideValidationCandidateH4ExecutedCount).toBe(150);
    expect(report.counts.totalStructuralCandidateH4ExecutedCount).toBe(1050);
  });

  it("fails G01 closed and makes G02-G07 non-authoritative", () => {
    const facts = { ...baseFacts, provenanceIncompleteCount: 1, statusCounts: { ...baseFacts.statusCounts, PROVENANCE_INCOMPLETE: 1, NO_BASELINE_CANDIDATE: 237309 } };
    const gates = evaluateR18StructuralGates(facts);
    expect(gates[0]!.status).toBe("FAIL");
    expect(gates.slice(1).every((current) => current.status === R18_NON_AUTHORITATIVE_AFTER_G01_FAILURE)).toBe(true);
    const report = buildR18PreflightReport(facts);
    expect(report.g01Failure).toBe(R18_G01_FAILURE);
    expect(report.g07Failure).toBeNull();
    expect(report.finalClassification).toBe(R18_G01_FAILURE);
  });

  it("derives G05 from per-symbol candidate counts, not symbol presence", () => {
    const oneSymbolBelowMinimum = makeSingleSymbolTotalCounts("BTCUSDT", 19);
    expect(evaluateR18StructuralGates({ ...baseFacts, candidateSymbols: [...ROUND_018_UNIVERSE], countsByFoldSymbolRegime: oneSymbolBelowMinimum })[4]!.status).toBe("FAIL");

    const everySymbolAtMinimum = makeAllSymbolTotalCounts(20);
    expect(evaluateR18StructuralGates({ ...baseFacts, candidateSymbols: [], countsByFoldSymbolRegime: everySymbolAtMinimum })[4]!.status).toBe("PASS");
  });

  it("derives G06 from per-regime candidate counts, not regime presence", () => {
    const oneRegimeBelowMinimum = makeSingleRegimeTotalCounts("BTC_NEUTRAL", 49);
    expect(evaluateR18StructuralGates({ ...baseFacts, candidateRegimes: [...ROUND_018_REGIMES], countsByFoldSymbolRegime: oneRegimeBelowMinimum })[5]!.status).toBe("FAIL");

    const everyRegimeAtMinimum = makeAllRegimeTotalCounts(50);
    expect(evaluateR18StructuralGates({ ...baseFacts, candidateRegimes: [], countsByFoldSymbolRegime: everyRegimeAtMinimum })[5]!.status).toBe("PASS");
  });

  it("uses only F1-F6 for G03 and excludes OUTSIDE_VALIDATION", () => {
    const belowValidationMinimum = makeCounts({
      candidateH4For: (fold, symbol, regime) => fold === "F1" && symbol === "BTCUSDT" && regime === "BTC_STRONG_BULL"
        ? 499
        : fold === "OUTSIDE_VALIDATION" && symbol === "BTCUSDT" && regime === "BTC_STRONG_BULL" ? 5000 : 0,
    });
    expect(evaluateR18StructuralGates({ ...baseFacts, candidateH4ExecutedCount: 5499, countsByFoldSymbolRegime: belowValidationMinimum })[2]!.status).toBe("FAIL");

    const atValidationMinimum = makeCounts({
      candidateH4For: (fold, symbol, regime) => fold === "F1" && symbol === "BTCUSDT" && regime === "BTC_STRONG_BULL"
        ? 500
        : fold === "OUTSIDE_VALIDATION" && symbol === "BTCUSDT" && regime === "BTC_STRONG_BULL" ? 5000 : 0,
    });
    expect(evaluateR18StructuralGates({ ...baseFacts, candidateH4ExecutedCount: 5500, countsByFoldSymbolRegime: atValidationMinimum })[2]!.status).toBe("PASS");
  });

  it("uses H4 EXECUTED validation breadth for the fold gate", () => {
    const sparseFoldCounts = makeCounts({
      candidateH4For: (fold, symbol, regime) => fold !== "OUTSIDE_VALIDATION" && symbol === "BTCUSDT" && regime === "BTC_STRONG_BULL" ? 49 : 0,
    });
    expect(evaluateR18StructuralGates({ ...baseFacts, countsByFoldSymbolRegime: sparseFoldCounts })[3]!.status).toBe("FAIL");
  });

  it("returns the exact non-discriminative termination reason for empty or equal candidates", () => {
    const empty = buildR18PreflightReport({ ...baseFacts, candidateCount: 0 });
    expect(empty.gates[6]!.status).toBe("FAIL");
    expect(empty.g07Failure).toBe(R18_G07_FAILURE);
    expect(empty.finalClassification).toBe(R18_G07_FAILURE);

    const equalToControl = buildR18PreflightReport({ ...baseFacts, candidateCount: baseFacts.controlCount });
    expect(equalToControl.gates[6]!.status).toBe("FAIL");
    expect(equalToControl.g07Failure).toBe(R18_G07_FAILURE);
    expect(equalToControl.finalClassification).toBe(R18_G07_FAILURE);
  });
});
