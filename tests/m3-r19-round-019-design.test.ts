import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ROUND_019_ACCEPTED_SOURCE,
  ROUND_019_BACKTEST_POLICY_VERSION,
  ROUND_019_CONTROL_ID,
  ROUND_019_DESIGN_DECISION,
  ROUND_019_FORMAL_PREDICATE,
  ROUND_019_FORMAL_PROVENANCE,
  ROUND_019_MAX_AUTHORITATIVE_PERFORMANCE_EXECUTIONS,
  ROUND_019_MECHANISM_FAMILY,
  ROUND_019_PERFORMANCE_LEDGER_PATH,
  ROUND_019_PRIMARY_HORIZON_HOURS,
  ROUND_019_RESEARCH_END_ISO,
  ROUND_019_RESEARCH_ROUND_ID,
  R19_DIRECTIONS,
  R19_FOLD_IDS,
  R19_FROZEN_FOLD_BOUNDARIES,
  R19_REGIMES,
  R19_SYMBOLS,
  isRound019DesignOnlyStatus,
  r19HashBytes,
} from "@/lib/research/m3-r19-round-019-protocol";

type JsonRecord = Record<string, unknown>;

const DESIGN_PATH = path.join(process.cwd(), "docs/research/round-019-design.json");

function record(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected JSON object");
  return value as JsonRecord;
}

function records(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) throw new Error("Expected JSON array");
  return value.map(record);
}

function acceptedBlob(sourcePath: string): Buffer {
  return execFileSync("git", ["show", `${ROUND_019_ACCEPTED_SOURCE}:${sourcePath}`], {
    cwd: process.cwd(),
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"],
  }) as Buffer;
}

function acceptedBlobSha(sourcePath: string): string {
  return execFileSync("git", ["rev-parse", `${ROUND_019_ACCEPTED_SOURCE}:${sourcePath}`], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
}

function loadDesign(): Readonly<Record<string, unknown>> {
  return JSON.parse(readFileSync(DESIGN_PATH, "utf8")) as Readonly<Record<string, unknown>>;
}

describe("Round-019 design-only protocol", () => {
  it("freezes the accepted source, boundary, and product safety state", () => {
    const design = loadDesign();
    expect(design.researchRoundId).toBe(ROUND_019_RESEARCH_ROUND_ID);
    expect(design.phase).toBe("DESIGN_ONLY");
    expect(design.acceptedResearchSource).toEqual({
      branch: "research/round-015-beta-alpha-decomposition",
      commit: ROUND_019_ACCEPTED_SOURCE,
      requiredBaseHead: ROUND_019_ACCEPTED_SOURCE,
    });
    expect(design.researchBoundary).toEqual({
      start: "2023-01-01T00:00:00.000Z",
      end: ROUND_019_RESEARCH_END_ISO,
      classification: "RESEARCH_AVAILABLE_SEEN_DATA",
      timezoneArithmetic: "UTC_EPOCH_MILLISECONDS_ONLY",
    });
    expect(record(design.productBoundary)).toMatchObject({
      signalAdvisoryOnly: true,
      privateBinanceApi: false,
      automaticTrading: false,
      tradingEnabled: false,
      productionUnchanged: true,
      baseline001Unchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      shadowActivation: false,
      schedulerActivation: false,
      mainModified: false,
    });
  });

  it("rejects the prior-candle hypothesis at the R13 momentum-family level", () => {
    const design = loadDesign();
    const inventory = records(design.hypothesisInventory);
    const prior = inventory.find((item) => item.id === "R19-DIRECTIONAL-CONFLICT-COUNTER-MOVE");

    expect(prior).toMatchObject({
      id: "R19-DIRECTIONAL-CONFLICT-COUNTER-MOVE",
      status: "REJECTED_R13_MOMENTUM_FAMILY_OVERLAP",
      mechanismFamilyNoveltyReview: "REJECTED_AT_MECHANISM_FAMILY_LEVEL",
    });
    expect(String(prior?.rejectReason)).toContain("exact formula difference does not establish a new mechanism family");
    expect(String(prior?.rejectReason)).toContain("R13 direction-adjusted 1H return/trend/momentum family");
  });

  it("terminates without inventing a weak replacement hypothesis", () => {
    const design = loadDesign();
    const inventory = records(design.hypothesisInventory);
    const active = inventory.filter((item) => item.status === "ACTIVE");
    const decision = record(design.hypothesisDecision);

    expect(active).toHaveLength(0);
    expect(design.activeHypothesis).toBeNull();
    expect(decision).toMatchObject({
      status: ROUND_019_DESIGN_DECISION,
      activeHypothesisCount: 0,
      exactlyOneActive: false,
      performanceEligibility: "NOT_APPLICABLE_NO_ADMISSIBLE_NOVEL_HYPOTHESIS",
      candidateClassification: "NOT_CREATED",
      noWeakReplacement: true,
    });
    expect(design.hypothesisInventory).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "R19-STATE-TRANSITION-UPDATE", status: "REJECTED_R17_OVERLAP" }),
      expect.objectContaining({ id: "R19-MARKET-RELATIVE-CONFIRMATION", status: "REJECTED_R14_R15_OVERLAP" }),
      expect.objectContaining({ id: "R19-SESSION-BOUNDARY-STATE", status: "REJECTED_PRIOR_ROUND_INADMISSIBLE_CALENDAR" }),
      expect.objectContaining({ id: "R19-RANGE-EXPANSION-CONTEXT", status: "REJECTED_R13_R14_R18_OVERLAP" }),
    ]));
  });

  it("contains no ACTIVE mechanism from the R13-R18 forbidden families", () => {
    const design = loadDesign();
    const forbiddenFamilies = [
      "DIRECTIONAL_EVIDENCE_CONFLICT_AT_ENTRY",
      "R13_MOMENTUM",
      "R13_R14_PRICE_RETURN",
      "R13_R14_VOLATILITY",
      "R13_R14_VOLUME",
      "R13_R14_MARKET_RELATIVE",
      "R15_BETA_ALPHA",
      "R16_MICROSTRUCTURE",
      "R17_LIFECYCLE",
      "R18_COMPONENT_CONSENSUS",
    ];

    expect(records(design.hypothesisInventory).filter((item) => item.status === "ACTIVE")).toHaveLength(0);
    expect(forbiddenFamilies).not.toContain(ROUND_019_MECHANISM_FAMILY);
    expect(record(design.hypothesisDecision).status).toBe(ROUND_019_DESIGN_DECISION);
  });

  it("freezes the exact CONTROL predicate and the authoritative runner path", () => {
    const design = loadDesign();
    const source = record(design.sourceUniverse);
    const provenance = record(design.baselineFormalProvenance);
    const predicate = record(provenance.formalPredicate);
    const runtimePath = record(predicate.runtimeFilteringPath ?? provenance.runtimeFilteringPath);
    const sourcePaths = predicate.sourcePaths;

    expect(source.controlId).toBe(ROUND_019_CONTROL_ID);
    expect(source.controlFormalPredicate).toBe(ROUND_019_FORMAL_PREDICATE);
    expect(predicate.expression).toBe("candidate?.formalSignal && candidate.totalScore >= 70");
    expect(sourcePaths).toEqual(expect.arrayContaining([
      "src/lib/strategy/candidate.ts",
      "src/lib/strategy/scoring.ts",
      "src/lib/strategy/engine.ts",
      "src/lib/backtest/runner.ts",
    ]));
    expect(runtimePath).toMatchObject({
      path: "src/lib/backtest/runner.ts",
      scope: "runSinglePeriod",
      anchors: ["formalCandidates", "candidate?.formalSignal && candidate.totalScore >= 70"],
    });
    expect(ROUND_019_FORMAL_PREDICATE).toBe("candidate?.formalSignal && candidate.totalScore >= 70");
  });

  it("matches every frozen formal provenance blob, including runner.ts, to the accepted source", () => {
    const design = loadDesign();
    const provenance = record(design.baselineFormalProvenance);
    const sourceBlobs = records(provenance.sourceBlobs);

    for (const source of sourceBlobs) {
      const sourcePath = String(source.path);
      const blob = acceptedBlob(sourcePath);
      expect(r19HashBytes(blob), sourcePath).toBe(source.sha256);
      expect(acceptedBlobSha(sourcePath), sourcePath).toBe(source.gitBlobSha);
      expect(readFileSync(path.join(process.cwd(), sourcePath)).equals(blob), sourcePath).toBe(true);
      for (const anchor of source.anchors as string[]) {
        expect(blob.toString("utf8"), `${sourcePath} ${anchor}`).toContain(anchor);
      }
    }

    const runner = sourceBlobs.find((source) => source.path === ROUND_019_FORMAL_PROVENANCE.path);
    expect(runner).toEqual(ROUND_019_FORMAL_PROVENANCE);
  });

  it("requires concrete immutable input provenance before any active hypothesis can exist", () => {
    const design = loadDesign();
    const input = record(design.activeInputSourceProvenance);

    expect(input).toMatchObject({
      status: "NOT_APPLICABLE_NO_ACTIVE_HYPOTHESIS",
      source: null,
      networkAcquired: false,
      newMarketData: false,
      ambiguousCacheReference: false,
    });
    expect(JSON.stringify(input)).not.toContain("ACCEPTED_EXISTING_");
    expect(record(design.candidateDefinition)).toMatchObject({
      status: "NOT_APPLICABLE_NO_ADMISSIBLE_NOVEL_HYPOTHESIS",
      candidateClassification: "NOT_CREATED",
      noUnboundInputSource: true,
    });
  });

  it("binds the previously rejected R17 calendar hypothesis to the accepted source", () => {
    const design = loadDesign();
    const r17 = record(record(design.priorRoundEvidenceHandling).r17);
    const calendar = record(r17.calendarSessionReview);
    const blob = acceptedBlob(String(calendar.sourcePath));

    expect(calendar).toMatchObject({
      sourceCommit: ROUND_019_ACCEPTED_SOURCE,
      sourcePath: "docs/research/round-017-design.json",
      hypothesisId: "R17-SESSION-BOUNDARY-RETURN",
      mechanismFamily: "UTC_SESSION_BOUNDARY_STATE",
      status: "REJECTED_DESIGN",
    });
    expect(blob.toString("utf8")).toContain("R17-SESSION-BOUNDARY-RETURN");
    expect(blob.toString("utf8")).toContain("without an established breadth justification");
  });

  it("keeps frozen folds, regimes, and the unchanged research protocol", () => {
    const design = loadDesign();
    const folds = record(design.frozenFolds);
    const regimes = record(design.frozenRegimes);
    const source = record(design.sourceUniverse);

    expect(folds).toMatchObject({
      sourceCommit: ROUND_019_ACCEPTED_SOURCE,
      sourcePath: "src/lib/research/folds.ts",
      export: "RESEARCH_FOLDS",
      foldIds: [...R19_FOLD_IDS],
      validationMethod: "PURGED_WALK_FORWARD_FIXED_SELECTOR",
      purgeHours: 24,
      embargoHours: 24,
      trainingRequired: false,
      foldBoundaryRedefinition: false,
      futureBoundaryChange: "FORBIDDEN",
    });
    expect(folds.boundaries).toEqual(R19_FROZEN_FOLD_BOUNDARIES);
    expect(regimes).toMatchObject({
      sourceCommit: ROUND_019_ACCEPTED_SOURCE,
      sourcePath: "src/lib/strategy/regimes.ts",
      function: "calculateBTCRegime",
      labels: [...R19_REGIMES],
      role: "REPORTING_AND_BREADTH_STRATIFICATION_ONLY",
      candidateClassificationInfluence: false,
      thresholdAdjustment: "FORBIDDEN_AFTER_FREEZE",
    });
    expect(source).toMatchObject({
      candidateId: null,
      candidateStatus: "NOT_APPLICABLE_NO_ADMISSIBLE_NOVEL_HYPOTHESIS",
      universe: [...R19_SYMBOLS],
      directions: [...R19_DIRECTIONS],
      strategyVersion: "baseline-001",
      noR17UniverseSubstitution: true,
      noNewMarketData: true,
    });
    expect(ROUND_019_BACKTEST_POLICY_VERSION).toBe("bt-policy-003");
    expect(ROUND_019_PRIMARY_HORIZON_HOURS).toBe(4);
  });

  it("keeps G01-G07 and G08-G15 frozen but unevaluated", () => {
    const design = loadDesign();
    const structural = record(design.structuralPreflightGates);
    const performance = record(design.frozenPerformanceGates);
    const structuralDefinitions = records(structural.definitions);
    const performanceDefinitions = records(performance.definitions);

    expect(structural).toMatchObject({
      frozenBeforePreflight: true,
      evaluationMode: "FAIL_CLOSED",
      evaluationStatus: "NOT_EVALUATED_NO_ADMISSIBLE_NOVEL_HYPOTHESIS",
      performanceEligibility: "NOT_APPLICABLE_NO_ADMISSIBLE_NOVEL_HYPOTHESIS",
    });
    expect(structuralDefinitions.map((gate) => gate.id)).toEqual([
      "G01_DATA_PROVENANCE", "G02_POINT_IN_TIME", "G03_AGGREGATE_BREADTH", "G04_FOLD_BREADTH",
      "G05_SYMBOL_BREADTH", "G06_REGIME_BREADTH", "G07_STRUCTURAL_DISCRIMINATION",
    ]);
    expect(performance).toMatchObject({
      frozenBeforePerformance: true,
      evaluatedDuringDesign: false,
      resultsMayNotChangeDefinitions: true,
      evaluationStatus: "NOT_EVALUATED_NO_ADMISSIBLE_NOVEL_HYPOTHESIS",
    });
    expect(performanceDefinitions.map((gate) => gate.id)).toEqual([
      "G08_ABSOLUTE_H4_EDGE", "G09_H4_PROFIT_FACTOR", "G10_INCREMENTAL_H4_EDGE", "G11_FOLD_INCREMENTAL_ROBUSTNESS",
      "G12_FOLD_ABSOLUTE_ROBUSTNESS", "G13_COST_STRESS", "G14_LATENCY_STRESS", "G15_DRAWDOWN_NON_DEGRADATION",
    ]);
  });

  it("proves design-only governance: no ledger, no economics, no new data, and no execution command", () => {
    const design = loadDesign();
    const execution = record(design.authoritativeExecutionGovernance);
    const metrics = record(design.metrics);
    const status = record(design.status);
    const protocol = readFileSync(path.join(process.cwd(), "src/lib/research/m3-r19-round-019-protocol.ts"), "utf8");

    expect(execution).toMatchObject({
      maxAuthoritativePerformanceExecutions: ROUND_019_MAX_AUTHORITATIVE_PERFORMANCE_EXECUTIONS,
      performanceExecutionCountSource: "ROUND_GLOBAL_LEDGER_ONLY",
      ledgerPath: ROUND_019_PERFORMANCE_LEDGER_PATH,
      ledgerMustBeAbsentDuringDesign: true,
      performanceExecutionCount: 0,
      performanceExecuted: false,
      selectionExecuted: false,
      noPerformanceExecutionInThisTask: true,
      noSelectionExecutionInThisTask: true,
    });
    expect(existsSync(path.join(process.cwd(), ROUND_019_PERFORMANCE_LEDGER_PATH))).toBe(false);
    expect(metrics).toMatchObject({
      evaluated: false,
      designCalculation: false,
      economicValuesObserved: false,
      economicValuesCalculated: false,
    });
    expect(status).toMatchObject({
      performance: "NOT_AUTHORIZED / NOT_GENERATED",
      performanceExecutionCount: 0,
      performanceExecuted: false,
      performanceLedgerPresent: false,
      selection: "NOT_EXECUTED",
      selectionExecuted: false,
      economicValuesRead: false,
      economicValuesCalculated: false,
      economicValuesInspected: false,
      newMarketDataFetched: false,
      production: "UNCHANGED",
      baseline001: "UNCHANGED",
      baseline002: "NOT_FROZEN",
      m3J: "BLOCKED",
      m4: "NOT_STARTED",
      automaticTrading: false,
    });
    expect(isRound019DesignOnlyStatus({
      phase: "DESIGN_ONLY",
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      performanceExecuted: false,
      selectionExecuted: false,
      economicValuesRead: false,
      economicValuesCalculated: false,
      economicValuesInspected: false,
      newMarketDataFetched: false,
      productionUnchanged: true,
      baseline001Unchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      automaticTrading: false,
    })).toBe(true);
    expect(protocol).not.toMatch(/run.*(?:preflight|performance)/i);
    expect(design.designOnlyProhibitions).toEqual(expect.arrayContaining([
      "R19_PREFLIGHT",
      "R19_PERFORMANCE",
      "R19_SELECTION",
      "R19_PERFORMANCE_LEDGER_CLAIM",
      "R19_ECONOMIC_EVALUATION",
      "NEW_MARKET_DATA_ACQUISITION",
      "AUTOMATIC_TRADING",
    ]));
  });
});
