import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ROUND_019_ACCEPTED_SOURCE,
  ROUND_019_ACTIVE_HYPOTHESIS_ID,
  ROUND_019_BACKTEST_POLICY_VERSION,
  ROUND_019_CANDIDATE_RULE,
  ROUND_019_CANDIDATE_RULE_ID,
  ROUND_019_CONTROL_ID,
  R19_FOLD_IDS,
  R19_FROZEN_FOLD_BOUNDARIES,
  ROUND_019_FORMAL_PREDICATE,
  ROUND_019_HOUR_MS,
  ROUND_019_MAX_AUTHORITATIVE_PERFORMANCE_EXECUTIONS,
  ROUND_019_MECHANISM_FAMILY,
  ROUND_019_PERFORMANCE_LEDGER_PATH,
  ROUND_019_PRIMARY_HORIZON_HOURS,
  ROUND_019_RESEARCH_END_ISO,
  ROUND_019_RESEARCH_ROUND_ID,
  R19_DIRECTIONS,
  R19_REGIMES,
  R19_SYMBOLS,
  hasExactR19PriorCandleIdentity,
  isR19CounterMoveEntryContext,
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

  it("freezes exactly one active, structurally distinct hypothesis", () => {
    const design = loadDesign();
    const inventory = records(design.hypothesisInventory);
    const active = inventory.filter((item) => item.status === "ACTIVE");

    expect(inventory).toHaveLength(5);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      id: ROUND_019_ACTIVE_HYPOTHESIS_ID,
      mechanismFamily: ROUND_019_MECHANISM_FAMILY,
      status: "ACTIVE",
    });
    expect(inventory.map((item) => item.id)).toEqual([
      "R19-DIRECTIONAL-CONFLICT-COUNTER-MOVE",
      "R19-STATE-TRANSITION-UPDATE",
      "R19-MARKET-RELATIVE-CONFIRMATION",
      "R19-SESSION-BOUNDARY-STATE",
      "R19-RANGE-EXPANSION-CONTEXT",
    ]);
    expect(inventory.map((item) => item.status)).toEqual([
      "ACTIVE",
      "REJECTED_R17_OVERLAP",
      "REJECTED_R14_R15_OVERLAP",
      "REJECTED_R17_BREADTH_RISK",
      "REJECTED_R13_R14_R18_OVERLAP",
    ]);

    const activeHypothesis = record(design.activeHypothesis);
    expect(activeHypothesis).toMatchObject({
      id: ROUND_019_ACTIVE_HYPOTHESIS_ID,
      mechanismFamily: ROUND_019_MECHANISM_FAMILY,
      exactlyOneActive: true,
      candidateRuleId: ROUND_019_CANDIDATE_RULE_ID,
    });
  });

  it("implements only the frozen opposing prior closed-candle body rule", () => {
    expect(ROUND_019_CANDIDATE_RULE.expression).toContain("priorClosed1h.close < priorClosed1h.open");
    expect(ROUND_019_CANDIDATE_RULE.expression).toContain("priorClosed1h.close > priorClosed1h.open");
    expect(ROUND_019_CANDIDATE_RULE.doji).toContain("NOT_CANDIDATE");
    expect(isR19CounterMoveEntryContext({ direction: "LONG", priorOpen: 101, priorClose: 100 })).toBe(true);
    expect(isR19CounterMoveEntryContext({ direction: "SHORT", priorOpen: 100, priorClose: 101 })).toBe(true);
    expect(isR19CounterMoveEntryContext({ direction: "LONG", priorOpen: 100, priorClose: 101 })).toBe(false);
    expect(isR19CounterMoveEntryContext({ direction: "SHORT", priorOpen: 101, priorClose: 100 })).toBe(false);
    expect(isR19CounterMoveEntryContext({ direction: "LONG", priorOpen: 100, priorClose: 100 })).toBe(false);
    expect(isR19CounterMoveEntryContext({ direction: "LONG", priorOpen: Number.NaN, priorClose: 100 })).toBe(false);

    const signalTime = Date.parse("2026-01-01T10:00:00.000Z");
    const priorCloseTime = signalTime - ROUND_019_HOUR_MS;
    const priorOpenTime = priorCloseTime - ROUND_019_HOUR_MS + 1;
    expect(hasExactR19PriorCandleIdentity({ signalTime, priorOpenTime, priorCloseTime })).toBe(true);
    expect(hasExactR19PriorCandleIdentity({ signalTime, priorOpenTime: priorOpenTime - 1, priorCloseTime })).toBe(false);
    expect(hasExactR19PriorCandleIdentity({ signalTime, priorOpenTime, priorCloseTime: priorCloseTime + 1 })).toBe(false);
    expect(hasExactR19PriorCandleIdentity({ signalTime, priorOpenTime, priorCloseTime: signalTime })).toBe(false);
  });

  it("binds every historical evidence path and source blob to the accepted repository state", () => {
    const design = loadDesign();
    const priorRounds = record(design.priorRoundEvidenceHandling);

    for (const [round, value] of Object.entries(priorRounds)) {
      const review = record(value);
      const reviewArtifacts = record(review.artifactReview);
      const availableArtifacts = reviewArtifacts.availableAcceptedArtifacts;
      const artifacts = availableArtifacts === undefined ? reviewArtifacts : record({ availableAcceptedArtifacts: availableArtifacts });
      for (const [artifactName, artifactPath] of Object.entries(artifacts)) {
        const paths = Array.isArray(artifactPath) ? artifactPath : [artifactPath];
        for (const candidatePath of paths) {
          if (typeof candidatePath !== "string" || !candidatePath.startsWith("docs/")) continue;
          expect(() => acceptedBlob(candidatePath), `${round} ${artifactName} ${candidatePath}`).not.toThrow();
        }
      }
    }

    const sourceBlobs = records(record(design.baselineFormalProvenance).sourceBlobs);
    for (const source of sourceBlobs) {
      const sourcePath = String(source.path);
      const blob = acceptedBlob(sourcePath);
      expect(r19HashBytes(blob)).toBe(source.sha256);
      expect(acceptedBlobSha(sourcePath)).toBe(source.gitBlobSha);
      expect(readFileSync(path.join(process.cwd(), sourcePath)).equals(blob)).toBe(true);
      if (!Array.isArray(source.anchors)) throw new Error("Expected source anchors");
      for (const anchor of source.anchors) expect(blob.toString("utf8")).toContain(String(anchor));
    }

    const source = record(design.sourceUniverse);
    const manifestPath = String(source.manifestPath);
    const manifestBlob = acceptedBlob(manifestPath);
    expect(r19HashBytes(manifestBlob)).toBe(source.manifestSha256);
    expect(manifestBlob.toString("utf8")).toContain("observationDataPath");
  });

  it("binds the frozen folds, regimes, and unchanged baseline protocol", () => {
    const design = loadDesign();
    const folds = record(design.frozenFolds);
    expect(folds).toMatchObject({
      sourceCommit: ROUND_019_ACCEPTED_SOURCE,
      sourcePath: "src/lib/research/folds.ts",
      export: "RESEARCH_FOLDS",
      sourceSha256: "f9017ab7b9326353535366465861f4ccd4e276ffd6fb49e61afed75e44e62b2a",
      foldIds: [...R19_FOLD_IDS],
      validationMethod: "PURGED_WALK_FORWARD_FIXED_SELECTOR",
      purgeHours: 24,
      embargoHours: 24,
      trainingRequired: false,
      foldBoundaryRedefinition: false,
      futureBoundaryChange: "FORBIDDEN",
    });
    expect(folds.boundaries).toEqual(R19_FROZEN_FOLD_BOUNDARIES);
    expect(r19HashBytes(acceptedBlob("src/lib/research/folds.ts"))).toBe(folds.sourceSha256);

    const regimes = record(design.frozenRegimes);
    expect(regimes).toMatchObject({
      sourceCommit: ROUND_019_ACCEPTED_SOURCE,
      sourcePath: "src/lib/strategy/regimes.ts",
      function: "calculateBTCRegime",
      sourceSha256: "6d5b17c7035c39f65b64cdc70153e0d9f576f587aa20d9f9c31199c5a655709e",
      labels: [...R19_REGIMES],
      role: "REPORTING_AND_BREADTH_STRATIFICATION_ONLY",
      candidateClassificationInfluence: false,
      thresholdAdjustment: "FORBIDDEN_AFTER_FREEZE",
    });
    expect(r19HashBytes(acceptedBlob("src/lib/strategy/regimes.ts"))).toBe(regimes.sourceSha256);
    expect(acceptedBlob("src/lib/strategy/regimes.ts").toString("utf8")).toContain("export function calculateBTCRegime");

    const source = record(design.sourceUniverse);
    expect(source.controlId).toBe(ROUND_019_CONTROL_ID);
    expect(source.controlFormalPredicate).toBe(ROUND_019_FORMAL_PREDICATE);
    expect(source.universe).toEqual([...R19_SYMBOLS]);
    expect(source.directions).toEqual([...R19_DIRECTIONS]);
    expect(source.strategyVersion).toBe("baseline-001");
    expect(source.noR17UniverseSubstitution).toBe(true);
    expect(source.noNewMarketData).toBe(true);
    expect(ROUND_019_BACKTEST_POLICY_VERSION).toBe("bt-policy-003");
    expect(ROUND_019_PRIMARY_HORIZON_HOURS).toBe(4);
  });

  it("freezes economic-label identity without reading or calculating economic values", () => {
    const design = loadDesign();
    const labels = record(design.economicLabelContract);
    const metrics = record(design.metrics);
    const candidate = record(design.candidateDefinition);

    expect(labels).toMatchObject({
      primaryTarget: "R14_NATIVE_H4_NET_FORWARD_ATR",
      primaryHorizonHours: 4,
      primaryField: "labels[4].netForwardAtr",
      settlementPolicy: "UNCHANGED_BT_POLICY_003",
      noNewEconomicLabel: true,
      noSettlementReconstruction: true,
      designMayReadValues: false,
      candidateClassificationReadsLabels: false,
    });
    expect(labels.designMayReadOnly).toEqual(["label identity", "label source", "label status"]);
    expect(metrics).toMatchObject({ evaluated: false, designCalculation: false, economicValuesObserved: false, economicValuesCalculated: false });
    expect(candidate).toMatchObject({
      variantCount: 1,
      combinations: false,
      parameterSweep: false,
      optimizer: false,
      usesScoreComponents: false,
      usesTotalScoreThresholdAsCandidateRule: false,
      usesGrade: false,
      usesFutureOutcome: false,
      usesR17LifecycleState: false,
      usesR16Microstructure: false,
      usesCompressionOrExpansionState: false,
      usesEconomicFilter: false,
    });
  });

  it("freezes the one-shot governance and design-only status with zero execution", () => {
    const design = loadDesign();
    const execution = record(design.authoritativeExecutionGovernance);
    const outputs = record(design.evidenceOutputs);
    const status = record(design.status);

    expect(execution).toMatchObject({
      maxAuthoritativePerformanceExecutions: ROUND_019_MAX_AUTHORITATIVE_PERFORMANCE_EXECUTIONS,
      performanceExecutionCountSource: "ROUND_GLOBAL_LEDGER_ONLY",
      performanceLock: "ROUND_GLOBAL_FIRST_RESULT_LOCK",
      ledgerPath: ROUND_019_PERFORMANCE_LEDGER_PATH,
      ledgerMustBeAbsentDuringDesign: true,
      performanceExecutionCount: 0,
      performanceExecuted: false,
      selectionExecuted: false,
      noPerformanceExecutionInThisTask: true,
      noSelectionExecutionInThisTask: true,
    });
    expect(execution.rules).toEqual(expect.arrayContaining([
      "one round-global first-result lock",
      "performanceExecutionCount is derived from the round-global ledger and cannot be supplied by a caller",
      "completed checkpoints are reused and never recomputed",
      "missing or corrupt completed checkpoint aborts",
    ]));
    expect(existsSync(path.join(process.cwd(), ROUND_019_PERFORMANCE_LEDGER_PATH))).toBe(false);
    expect(outputs.generatedDuringDesign).toEqual([]);
    expect(outputs.ledgerPresent).toBe(false);
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
    expect(design.designOnlyProhibitions).toEqual(expect.arrayContaining([
      "R19_PERFORMANCE",
      "R19_SELECTION",
      "R19_PERFORMANCE_LEDGER_CLAIM",
      "R19_ECONOMIC_EVALUATION",
      "NEW_MARKET_DATA_ACQUISITION",
      "AUTOMATIC_TRADING",
    ]));
  });
});
