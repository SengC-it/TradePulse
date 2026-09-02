import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DESIGN_PATH = path.join(process.cwd(), "docs", "research", "round-017-design.json");
const DESIGN_DOC_PATH = path.join(process.cwd(), "docs", "research", "round-017-design.md");

type Hypothesis = {
  id: string;
  status: string;
};

type FeatureFamily = {
  name: string;
  fields: string[];
};

type Design = {
  phase: string;
  designDecision: string;
  acceptedResearchSource: {
    sha: string;
    requiredBaseHead: string;
  };
  researchBoundary: {
    end: string;
    classification: string;
  };
  productBoundary: Record<string, unknown>;
  historicalEvidenceReview: Array<{
    round: string;
    finalDecision: string;
    executionCount: number;
    round017DesignInput?: boolean;
    dataCoverage?: { integrity: string };
  }>;
  priorRound016Use: {
    round017DesignInput: boolean;
    automaticFeatureCarryForward: boolean;
  };
  hypothesisAssessment: Hypothesis[];
  activeDesign: {
    universe: string[];
    directions: string[];
    strategyVersion: string;
    horizonHours: number;
    variantCount: number;
    combinations: boolean;
    parameterSweep: boolean;
    optimizer: boolean;
    featureFamilies: FeatureFamily[];
    controlModel: { id: string };
    candidateModel: {
      id: string;
      noR16FeatureUse: boolean;
      noNewSignalPredicate: boolean;
    };
    thesisStateMachine: {
      key: string[];
      activeLifetimeHours: number;
      activeUntilRule: string;
      oppositeDirectionRule: string;
      futureOutcomeDependency: boolean;
      eventOrder: string[];
    };
  };
  protocol: {
    folds: string[];
    purgeHours: number;
    embargoHours: number;
    symbolBreadthRequirement: {
      allSymbolsRequired: boolean;
      minimumCandidateObservationsPerSymbol: number;
    };
    regimeBreadthRequirement: {
      allBucketsRequired: boolean;
      minimumCandidateObservationsPerBucket: number;
    };
    regimeBuckets: string[];
    metrics: {
      primary: string[];
      efficiency: string[];
    };
    gates: {
      frozenBeforePerformance: boolean;
      evaluationMode: string;
      resultsMayNotChangeDefinitions: boolean;
      definitions: Array<{ id: string; requirement: string }>;
    };
  };
  authoritativeExecution: {
    performanceExecutionCount: string;
    maxAuthoritativeExecutions: number;
    performanceLock: string;
    ledgerSchema: {
      roundGlobalKey: string;
      alternateExecutionDirectory: string;
      continuation: string;
      completedCheckpointPolicy: string;
      missingOrCorruptCheckpoint: string;
      secondExecutionId: string;
    };
    noPerformanceExecutionInThisTask: boolean;
    noSelectionExecutionInThisTask: boolean;
  };
  evidenceOutputs: {
    generatedDuringDesign: unknown[];
  };
  status: {
    performance: string;
    selection: string;
    production: string;
    automaticTrading: boolean;
  };
};

function loadDesign(): Design {
  return JSON.parse(readFileSync(DESIGN_PATH, "utf8")) as Design;
}

describe("Round-017 design-only protocol", () => {
  it("pins the accepted source, boundary, and product safety state", () => {
    const design = loadDesign();

    expect(design.phase).toBe("DESIGN_ONLY");
    expect(design.acceptedResearchSource.sha).toBe("0f5e24009f3301b8f2fb64d7e01161402a94f0b7");
    expect(design.acceptedResearchSource.requiredBaseHead).toBe("0f5e24009f3301b8f2fb64d7e01161402a94f0b7");
    expect(design.researchBoundary.end).toBe("2026-08-15T23:59:59.999Z");
    expect(design.researchBoundary.classification).toBe("RESEARCH_AVAILABLE_SEEN_DATA");
    expect(design.productBoundary).toMatchObject({
      signalAdvisoryOnly: true,
      privateBinanceApi: false,
      automaticTrading: false,
      productionUnchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
    });
  });

  it("records all three prior rounds as evidence-backed negative review inputs", () => {
    const design = loadDesign();
    const rounds = design.historicalEvidenceReview;

    expect(rounds.map((round) => round.round)).toEqual(["ROUND-014", "ROUND-015", "ROUND-016"]);
    expect(rounds.map((round) => round.finalDecision)).toEqual([
      "NO ROBUST FORWARD EDGE — ROUND-014",
      "NO BETA-ALPHA DEVELOPMENT CANDIDATE — ROUND-015",
      "NO ROBUST MICROSTRUCTURE INFORMATION GAIN — ROUND-016",
    ]);
    expect(rounds.every((round) => round.executionCount === 1)).toBe(true);
    expect(rounds[2]?.round017DesignInput).toBe(false);
    expect(rounds[2]?.dataCoverage?.integrity).toBe("COMPLETE");
  });

  it("has exactly one active direction and rejects alternatives before performance", () => {
    const design = loadDesign();
    const hypotheses = design.hypothesisAssessment;

    expect(hypotheses).toHaveLength(3);
    expect(hypotheses.filter((hypothesis) => hypothesis.status === "ADMISSIBLE_ACTIVE")).toHaveLength(1);
    expect(hypotheses.find((hypothesis) => hypothesis.status === "ADMISSIBLE_ACTIVE")?.id).toBe(
      "R17-THESIS-LIFECYCLE-FIRST-ADVISORY",
    );
    expect(hypotheses.find((hypothesis) => hypothesis.id === "R17-DERIVATIVE-MICROSTRUCTURE-REWEIGHT")?.status).toBe(
      "REJECTED_R16_REUSE",
    );
    expect(design.designDecision).toBe("ONE_ACTIVE_RESEARCH_QUESTION");
    expect(design.priorRound016Use.round017DesignInput).toBe(false);
    expect(design.priorRound016Use.automaticFeatureCarryForward).toBe(false);
  });

  it("freezes the thesis lifecycle state machine without future-outcome classification", () => {
    const stateMachine = loadDesign().activeDesign.thesisStateMachine;

    expect(stateMachine.key).toEqual(["symbol", "direction"]);
    expect(stateMachine.activeLifetimeHours).toBe(4);
    expect(stateMachine.activeUntilRule).toContain("anchorSignalTime + 4 hours");
    expect(stateMachine.oppositeDirectionRule).toContain("closes both direction anchors");
    expect(stateMachine.futureOutcomeDependency).toBe(false);
    expect(stateMachine.eventOrder).toEqual([
      "signalTime ASC",
      "symbol ASC",
      "direction ASC with LONG before SHORT",
      "signalId ASC",
    ]);
  });

  it("freezes the exact universe, directions, folds, horizon, purge, and embargo", () => {
    const design = loadDesign();

    expect(design.activeDesign.universe).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]);
    expect(design.activeDesign.directions).toEqual(["LONG", "SHORT"]);
    expect(design.activeDesign.strategyVersion).toBe("baseline-001");
    expect(design.activeDesign.horizonHours).toBe(4);
    expect(design.protocol.folds).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(design.protocol.purgeHours).toBe(24);
    expect(design.protocol.embargoHours).toBe(24);
    expect(design.activeDesign.variantCount).toBe(1);
    expect(design.activeDesign.combinations).toBe(false);
    expect(design.activeDesign.parameterSweep).toBe(false);
    expect(design.activeDesign.optimizer).toBe(false);
  });

  it("keeps R16 microstructure fields out of the sole active feature family", () => {
    const design = loadDesign();
    const featureNames = design.activeDesign.featureFamilies.flatMap((family) => family.fields);

    expect(design.activeDesign.featureFamilies.map((family) => family.name)).toEqual([
      "FORMAL_SIGNAL_EVENT_SEQUENCE_STATE",
    ]);
    expect(featureNames).not.toEqual(expect.arrayContaining(["OPEN_INTEREST", "MARK_INDEX_BASIS", "TAKER_FLOW_PERSISTENCE"]));
    expect(design.activeDesign.candidateModel.noR16FeatureUse).toBe(true);
    expect(design.activeDesign.candidateModel.noNewSignalPredicate).toBe(true);
  });

  it("freezes a mechanical control/candidate comparison and breadth requirements", () => {
    const design = loadDesign();

    expect(design.activeDesign.controlModel.id).toBe("R17-CONTROL-ALL-BASELINE-001-FORMAL");
    expect(design.activeDesign.candidateModel.id).toBe("R17-THESIS-LIFECYCLE-FIRST-ADVISORY");
    expect(design.protocol.symbolBreadthRequirement).toMatchObject({
      allSymbolsRequired: true,
      minimumCandidateObservationsPerSymbol: 20,
    });
    expect(design.protocol.regimeBreadthRequirement).toMatchObject({
      allBucketsRequired: true,
      minimumCandidateObservationsPerBucket: 50,
    });
    expect(design.protocol.regimeBuckets).toEqual(["BTC_STRONG_BULL", "BTC_NEUTRAL", "BTC_STRONG_BEAR"]);
    expect(design.protocol.metrics.primary).toEqual(
      expect.arrayContaining(["meanNetR", "profitFactor", "cumulativeNetR", "maximumDrawdownR"]),
    );
    expect(design.protocol.metrics.efficiency).toEqual(
      expect.arrayContaining(["suppressionRate", "advisoriesPerMonth", "netRPerEmail"]),
    );
  });

  it("freezes all hard gates before any result exists", () => {
    const design = loadDesign();
    const gates = design.protocol.gates;
    const gateIds = gates.definitions.map((gate) => gate.id);

    expect(gates.frozenBeforePerformance).toBe(true);
    expect(gates.evaluationMode).toBe("ALL_HARD_GATES_REQUIRED");
    expect(gates.resultsMayNotChangeDefinitions).toBe(true);
    expect(gateIds).toEqual([
      "G01_DATA_COMPLETE",
      "G02_POINT_IN_TIME",
      "G03_CANDIDATE_AGGREGATE_MINIMUM",
      "G04_CANDIDATE_FOLD_MINIMUM",
      "G05_SYMBOL_BREADTH",
      "G06_REGIME_BREADTH",
      "G07_INCREMENTAL_MEAN_NET_R",
      "G08_CANDIDATE_PROFIT_FACTOR",
      "G09_INCREMENTAL_CUMULATIVE_NET_R",
      "G10_DRAWDOWN_NOT_WORSE",
      "G11_FOLD_STABILITY",
      "G12_COST_STRESS",
      "G13_FUNDING_STRESS",
      "G14_EMAIL_VOLUME_REDUCTION",
      "G15_NET_R_PER_EMAIL",
    ]);
    expect(gates.definitions.some((gate) => gate.requirement.includes("0.02"))).toBe(true);
  });

  it("freezes a round-global one-execution ledger contract with fail-closed continuation", () => {
    const execution = loadDesign().authoritativeExecution;
    const ledger = execution.ledgerSchema;

    expect(execution.performanceExecutionCount).toBe("DERIVE_FROM_ROUND_GLOBAL_LEDGER");
    expect(execution.maxAuthoritativeExecutions).toBe(1);
    expect(execution.performanceLock).toBe("ROUND_GLOBAL_FIRST_RESULT_LOCK");
    expect(ledger.roundGlobalKey).toBe("baseline-002-research-round-017");
    expect(ledger.alternateExecutionDirectory).toBe("FORBIDDEN");
    expect(ledger.continuation).toBe("SAME_EXECUTION_ID_AND_FROZEN_DIRECTORY_ONLY");
    expect(ledger.completedCheckpointPolicy).toContain("NEVER RECOMPUTED");
    expect(ledger.missingOrCorruptCheckpoint).toContain("NEVER_REBUILD_FROM_ZERO");
    expect(ledger.secondExecutionId).toContain("REJECT");
    expect(execution.noPerformanceExecutionInThisTask).toBe(true);
    expect(execution.noSelectionExecutionInThisTask).toBe(true);
  });

  it("keeps all Round-017 performance and selection outputs absent in design-only", () => {
    const design = loadDesign();
    const expectedAbsent = [
      "docs/evidence/M3_R17_ROUND_017_SUMMARY.json",
      "docs/evidence/M3_R17_ROUND_017_AUDIT.json",
      "docs/M3_R17_ROUND_017_RESULTS.md",
      "docs/evidence/M3_R17_ROUND_017_SELECTION.json",
      "docs/evidence/M3_R17_ROUND_017_SELECTION.md",
    ];

    expect(design.evidenceOutputs.generatedDuringDesign).toEqual([]);
    expect(expectedAbsent.every((filePath) => !existsSync(path.join(process.cwd(), filePath)))).toBe(true);
    expect(design.status).toMatchObject({
      performance: "NOT_AUTHORIZED / NOT_GENERATED",
      selection: "NOT_EXECUTED",
      production: "UNCHANGED",
      automaticTrading: false,
    });
    expect(readFileSync(DESIGN_DOC_PATH, "utf8")).toContain("Round-017 authoritative performance: **NOT EXECUTED**");
    expect(readFileSync(DESIGN_DOC_PATH, "utf8")).toContain("baseline-002: `NOT_FROZEN`");
  });

  it("does not add a Round-017 performance command to the package scripts", () => {
    const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as {
      scripts?: Record<string, string>;
    };

    expect(Object.keys(packageJson.scripts ?? {}).some((name) => name.includes("round017") && name.includes("performance"))).toBe(false);
  });
});
