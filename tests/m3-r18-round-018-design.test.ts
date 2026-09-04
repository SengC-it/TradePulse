import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ROUND_018_ACCEPTED_SOURCE,
  ROUND_018_ACTIVE_HYPOTHESIS_ID,
  ROUND_018_BACKTEST_POLICY_VERSION,
  ROUND_018_BOUNDARY_END,
  ROUND_018_CANDIDATE_RULE,
  ROUND_018_CANDIDATE_RULE_ID,
  ROUND_018_CONTROL_ID,
  ROUND_018_DIRECTIONS,
  ROUND_018_ESTIMAND_POPULATION,
  ROUND_018_FOLDS,
  ROUND_018_FORMAL_PREDICATE,
  ROUND_018_GRADE_C_THRESHOLD,
  ROUND_018_MAX_AUTHORITATIVE_PERFORMANCE_EXECUTIONS,
  ROUND_018_OBSERVATION_COUNT,
  ROUND_018_OBSERVATION_SHA256,
  ROUND_018_OBSERVATION_SOURCE,
  ROUND_018_POPULATION_TRANSFORMATION_ORDER,
  ROUND_018_PERFORMANCE_GATES,
  ROUND_018_PERFORMANCE_LEDGER_PATH,
  ROUND_018_PRIMARY_HORIZON_HOURS,
  ROUND_018_REPLAY_STATUSES,
  ROUND_018_RESEARCH_ROUND_ID,
  ROUND_018_REGIMES,
  ROUND_018_SCORE_COMPONENT_WEIGHTS,
  ROUND_018_SCORE_COMPONENTS,
  ROUND_018_STRUCTURAL_GATES,
  ROUND_018_UNIVERSE,
  isRound018DesignOnlyStatus,
} from "@/lib/research/m3-r18-round-018-protocol";

const DESIGN_PATH = path.join(process.cwd(), "docs/research/round-018-design.json");

type Design = {
  researchRoundId: string;
  phase: string;
  dataClassification: string;
  studyClassification: string;
  freshOosClaim: boolean;
  promotionAuthority: boolean;
  estimandPopulation: string;
  estimandScope: {
    population: string;
    limitation: string;
    r17MissingEvents: Record<string, boolean>;
  };
  acceptedResearchSource: { branch: string; commit: string; requiredBaseHead: string };
  researchBoundary: { start: string; end: string; classification: string; timezoneArithmetic: string };
  productBoundary: Record<string, unknown>;
  priorRoundEvidenceHandling: Record<string, Record<string, unknown>>;
  hypothesisInventory: Array<{ id: string; status: string; mechanismFamily: string; rejectReason?: string }>;
  activeHypothesis: { id: string; mechanismFamily: string; exactlyOneActive: boolean; candidateRuleId: string; researchQuestion: string };
  sourceUniverse: Record<string, unknown>;
  candidateDefinition: {
    id: string;
    definition: string;
    allConditions: string[];
    variantCount: number;
    combinations: boolean;
    parameterSweep: boolean;
    optimizer: boolean;
    forbiddenAlternatives: string[];
  };
  baselineScoreProvenance: {
    acceptedSourceCommit: string;
    componentNames: string[];
    componentMapping: Array<{ name: string; constantKey: string; maximumWeight: number }>;
    gradeThresholds: { A: number; B: number; C: number };
    formalPredicate: { expression: string; sourcePaths: string[]; changeAfterFreeze: string };
    authoritativeSourceBlobs: Array<{ path: string; gitBlobSha: string; sha256: string; anchors: string[] }>;
    workingTreeSubstitution: boolean;
    requiredProvenanceCheck: string;
  };
  canonicalDataSource: {
    identity: string;
    observationDataPath: string;
    acceptedObservationCount: number;
    observationDataSha256: string;
    manifestPath: string;
    manifestSha256: string;
    notR17Universe: boolean;
    prohibited: string[];
  };
  scoreReconstructionContract: Record<string, unknown>;
  frozenFolds: {
    sourceCommit: string;
    sourcePath: string;
    export: string;
    sourceSha256: string;
    foldIds: string[];
    boundaries: Record<string, unknown>;
    validationMethod: string;
    purgeHours: number;
    embargoHours: number;
    trainingRequired: boolean;
    foldBoundaryRedefinition: boolean;
    futureBoundaryChange: string;
  };
  frozenRegimes: {
    sourceCommit: string;
    sourcePath: string;
    function: string;
    sourceSha256: string;
    labels: string[];
    role: string;
    candidateClassificationInfluence: boolean;
    thresholdAdjustment: string;
  };
  economicLabelContract: Record<string, unknown>;
  structuralPrelightGates: { frozenBeforePrelight: boolean; evaluationMode: string; definitions: Array<{ id: string; hardGate: boolean; requirement: string }> };
  frozenPerformanceGates: { frozenBeforePerformance: boolean; evaluatedDuringDesign: boolean; resultsMayNotChangeDefinitions: boolean; definitions: Array<{ id: string; hardGate: boolean; requirement: string }> };
  metrics: Record<string, unknown>;
  authoritativeExecutionGovernance: Record<string, unknown>;
  evidenceOutputs: Record<string, unknown>;
  designOnlyProhibitions: string[];
  status: Record<string, unknown>;
};

function loadDesign(): Design {
  return JSON.parse(readFileSync(DESIGN_PATH, "utf8")) as Design;
}

function readAcceptedSourceBlob(sourcePath: string): Buffer {
  return execFileSync("git", ["show", `${ROUND_018_ACCEPTED_SOURCE}:${sourcePath}`], {
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"],
  }) as Buffer;
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

describe("Round-018 design-only protocol", () => {
  it("freezes the accepted source, boundary, classification, and product safety state", () => {
    const design = loadDesign();

    expect(design.researchRoundId).toBe(ROUND_018_RESEARCH_ROUND_ID);
    expect(design.phase).toBe("DESIGN_ONLY");
    expect(design.dataClassification).toBe("RESEARCH_AVAILABLE_SEEN_DATA");
    expect(design.studyClassification).toBe("HISTORICAL_DEVELOPMENT_STUDY");
    expect(design.freshOosClaim).toBe(false);
    expect(design.promotionAuthority).toBe(false);
    expect(design.estimandPopulation).toBe(ROUND_018_ESTIMAND_POPULATION);
    expect(design.estimandScope.population).toBe(ROUND_018_ESTIMAND_POPULATION);
    expect(design.estimandScope.limitation).toContain("does not claim to estimate performance across the complete historical baseline-001 formal-advisory stream");
    expect(design.estimandScope.r17MissingEvents).toEqual({
      notFixed: true,
      notReconstructed: true,
      notBackfilled: true,
      notUsedForDateSelection: true,
      outsideR18Estimand: true,
      noPassExtrapolationToCompleteBaselineFormalStream: true,
    });
    expect(design.acceptedResearchSource).toEqual({
      branch: "research/round-015-beta-alpha-decomposition",
      commit: ROUND_018_ACCEPTED_SOURCE,
      requiredBaseHead: ROUND_018_ACCEPTED_SOURCE,
    });
    expect(design.researchBoundary).toEqual({
      start: "2023-01-01T00:00:00.000Z",
      end: ROUND_018_BOUNDARY_END,
      classification: "RESEARCH_AVAILABLE_SEEN_DATA",
      timezoneArithmetic: "UTC_EPOCH_MILLISECONDS_ONLY",
    });
    expect(design.productBoundary).toMatchObject({
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

  it("keeps exactly one active hypothesis and rejects the two inadmissible alternatives", () => {
    const design = loadDesign();

    expect(design.hypothesisInventory).toHaveLength(3);
    expect(design.activeHypothesis).toEqual({
      id: "R18-ALL-COMPONENT-CONSENSUS",
      mechanismFamily: "BASELINE_001_SCORE_COMPONENT_EVIDENCE_BREADTH",
      exactlyOneActive: true,
      candidateRuleId: ROUND_018_CANDIDATE_RULE_ID,
      researchQuestion: "Within the exact frozen R14 native observation universe, does requiring every existing baseline-001 score component to contribute positively improve H4 economics and robustness versus all R14-native baseline-001 formal controls?",
    });
    expect(design.hypothesisInventory.find((item) => item.id === "R18-CROSS-SYMBOL-FORMAL-CONSENSUS")).toMatchObject({
      status: "REJECTED_DEFERRED",
      mechanismFamily: "CROSS_SYMBOL_FORMAL_SIGNAL_CONCURRENCE",
    });
    expect(design.hypothesisInventory.find((item) => item.id === "R18-HIGH-GRADE-ONLY")).toMatchObject({
      status: "REJECTED_THRESHOLD_TUNING",
      mechanismFamily: "TOTAL_SCORE_THRESHOLD_FILTER",
    });
    expect(design.activeHypothesis.id).toBe(ROUND_018_ACTIVE_HYPOTHESIS_ID);
  });

  it("freezes the exact baseline universe, formal predicate, score components, and sole candidate rule", () => {
    const design = loadDesign();
    const sourceUniverse = design.sourceUniverse;

    expect(sourceUniverse.estimandPopulation).toBe(ROUND_018_ESTIMAND_POPULATION);
    expect(sourceUniverse.populationIdentity).toBe("EXACT_ACCEPTED_R14_OBSERVATION_FREEZE_NATIVE_UNIVERSE");
    expect(sourceUniverse.controlId).toBe(ROUND_018_CONTROL_ID);
    expect(sourceUniverse.controlFormalPredicate).toBe(ROUND_018_FORMAL_PREDICATE);
    expect(sourceUniverse.controlDefinition).toContain("Within the exact frozen R14 native observation universe");
    expect(sourceUniverse.controlDefinition).toContain(ROUND_018_FORMAL_PREDICATE);
    expect(sourceUniverse.populationCountSource).toBe("canonicalDataSource.acceptedObservationCount");
    expect(sourceUniverse.formalFilterAfterPopulationBinding).toBe(true);
    expect(sourceUniverse.globalFormalStreamIsNotR18Universe).toBe(true);
    expect(sourceUniverse.forbiddenPopulationConstruction).toBe("global formal stream -> inner join R14 -> silently retain matched rows");
    expect(JSON.stringify(sourceUniverse)).not.toContain("5834");
    expect(JSON.stringify(sourceUniverse)).not.toContain("1666");
    expect(sourceUniverse.universe).toEqual([...ROUND_018_UNIVERSE]);
    expect(sourceUniverse.directions).toEqual([...ROUND_018_DIRECTIONS]);
    expect(sourceUniverse.strategyVersion).toBe("baseline-001");
    expect(sourceUniverse.noCustomStartBoundary).toBe(true);

    expect(design.baselineScoreProvenance.componentNames).toEqual([...ROUND_018_SCORE_COMPONENTS]);
    expect(design.baselineScoreProvenance.componentMapping).toEqual([
      { name: "trendStrength", constantKey: "trendStrength", maximumWeight: 40 },
      { name: "pullbackQuality", constantKey: "pullbackQuality", maximumWeight: 20 },
      { name: "breakoutStrength", constantKey: "breakoutStrength", maximumWeight: 20 },
      { name: "volumeScore", constantKey: "volume", maximumWeight: 10 },
      { name: "riskRewardScore", constantKey: "riskReward", maximumWeight: 10 },
    ]);
    expect(design.baselineScoreProvenance.gradeThresholds).toEqual({ A: 85, B: 75, C: ROUND_018_GRADE_C_THRESHOLD });

    expect(design.candidateDefinition.id).toBe(ROUND_018_CANDIDATE_RULE_ID);
    expect(design.candidateDefinition.definition).toContain("R14-native formal CONTROL");
    expect(design.candidateDefinition.allConditions).toEqual([
      "trendStrength > 0",
      "pullbackQuality > 0",
      "breakoutStrength > 0",
      "volumeScore > 0",
      "riskRewardScore > 0",
    ]);
    expect(design.candidateDefinition.variantCount).toBe(1);
    expect(design.candidateDefinition.combinations).toBe(false);
    expect(design.candidateDefinition.parameterSweep).toBe(false);
    expect(design.candidateDefinition.optimizer).toBe(false);
    expect(design.candidateDefinition.forbiddenAlternatives).toEqual(
      expect.arrayContaining([">=4/5", ">=3/5", "component_count_sweep", "total_score_threshold_change", "grade_filtering"]),
    );
    expect(ROUND_018_CANDIDATE_RULE).toEqual({
      trendStrength: "> 0",
      pullbackQuality: "> 0",
      breakoutStrength: "> 0",
      volumeScore: "> 0",
      riskRewardScore: "> 0",
    });
    expect(ROUND_018_SCORE_COMPONENT_WEIGHTS).toEqual({
      trendStrength: 40,
      pullbackQuality: 20,
      breakoutStrength: 20,
      volumeScore: 10,
      riskRewardScore: 10,
    });
  });

  it("binds baseline scoring and formal-predicate provenance to accepted-source blobs", () => {
    const design = loadDesign();
    const provenance = design.baselineScoreProvenance;

    expect(provenance.acceptedSourceCommit).toBe(ROUND_018_ACCEPTED_SOURCE);
    expect(provenance.workingTreeSubstitution).toBe(false);
    expect(provenance.requiredProvenanceCheck).toContain("git show/cat-file");
    expect(provenance.formalPredicate).toEqual({
      expression: ROUND_018_FORMAL_PREDICATE,
      sourcePaths: ["src/lib/strategy/engine.ts", "src/lib/backtest/runner.ts"],
      changeAfterFreeze: "FORBIDDEN",
    });

    for (const source of provenance.authoritativeSourceBlobs) {
      const blob = readAcceptedSourceBlob(source.path);
      expect(sha256(blob)).toBe(source.sha256);
      expect(execFileSync("git", ["rev-parse", `${ROUND_018_ACCEPTED_SOURCE}:${source.path}`], { encoding: "utf8" }).trim()).toBe(source.gitBlobSha);
      for (const anchor of source.anchors) expect(blob.toString("utf8")).toContain(anchor);
    }
  });

  it("freezes the native R14 observation universe without scanning or replacing it with R17", () => {
    const design = loadDesign();
    const source = design.canonicalDataSource;
    const manifestBlob = readAcceptedSourceBlob(source.manifestPath);
    const manifest = manifestBlob.toString("utf8");

    expect(source.identity).toBe("EXACT_ACCEPTED_R14_OBSERVATION_FREEZE_NATIVE_UNIVERSE");
    expect(source.observationDataPath).toBe(ROUND_018_OBSERVATION_SOURCE);
    expect(source.acceptedObservationCount).toBe(ROUND_018_OBSERVATION_COUNT);
    expect(source.observationDataSha256).toBe(ROUND_018_OBSERVATION_SHA256);
    expect(sha256(manifestBlob)).toBe(source.manifestSha256);
    expect(manifest).toContain('"observationCount":244810');
    expect(manifest).toContain(`"observationDataPath":"${ROUND_018_OBSERVATION_SOURCE}"`);
    expect(manifest).toContain(`"observationDataSha256":"${ROUND_018_OBSERVATION_SHA256}"`);
    expect(source.notR17Universe).toBe(true);
    expect(source.prohibited).toEqual(
      expect.arrayContaining(["R17 7500 formal stream as R18 universe", "custom R18 start date", "network backfill", "nearest timestamp matching"]),
    );
  });

  it("keeps R16 negative evidence and R17 termination out of the R18 selector", () => {
    const design = loadDesign();
    const r16 = design.priorRoundEvidenceHandling.r16;
    const r17 = design.priorRoundEvidenceHandling.r17;
    const featureNames = ((design.scoreReconstructionContract.pipeline as string[]) ?? []).join(" ");

    expect(r16.role).toBe("NEGATIVE_EVIDENCE_ONLY");
    expect(r16.round016DesignInput).toBe(false);
    expect(r16.automaticFeatureCarryForward).toBe(false);
    expect(r16.forbiddenFeatureFamilies).toEqual(["OPEN_INTEREST", "MARK_INDEX_BASIS", "TAKER_FLOW_PERSISTENCE"]);
    expect(r17.role).toBe("PERFORMANCE_INELIGIBLE_DATA_COMPLETENESS");
    expect(r17.economicOutcome).toBe("NONE");
    expect(r17.authoritativePerformance).toBe(false);
    expect(design.activeHypothesis.id).not.toContain("R17");
    expect(featureNames).not.toContain("OPEN_INTEREST");
    expect(featureNames).not.toContain("FIRST");
    expect(featureNames).not.toContain("FOLLOW_UP");
  });

  it("freezes exact score replay and canonical join requirements", () => {
    const contract = loadDesign().scoreReconstructionContract;
    const pipeline = contract.pipeline as string[];
    const replayStatusRules = contract.replayStatusRules as Record<string, string>;

    expect(contract.populationBinding).toBe(ROUND_018_ESTIMAND_POPULATION);
    expect(contract.populationFirst).toBe(true);
    expect(contract.globalFormalStreamAsPopulation).toBe(false);
    expect(contract.globalFormalToR14InnerJoin).toBe(false);
    expect(contract.decisionTimeOnly).toBe(true);
    expect(contract.labelIndependent).toBe(true);
    expect(contract.exactCanonicalJoinRequired).toBe(true);
    expect(contract.fuzzyJoin).toBe(false);
    expect(contract.nearestTimestampJoin).toBe(false);
    expect(contract.syntheticScoreBreakdown).toBe(false);
    expect(contract.featureApproximationFromR13F01F18).toBe(false);
    expect(contract.labelBasedRepair).toBe(false);
    expect(contract.designReplayExecuted).toBe(false);
    expect(contract.designDataScanExecuted).toBe(false);
    expect(pipeline).toEqual([
      ...ROUND_018_POPULATION_TRANSFORMATION_ORDER,
    ]);
    expect(contract.replayStatuses).toEqual([...ROUND_018_REPLAY_STATUSES]);
    expect(contract.r14NativeFormalRowsRequire).toEqual([
      "exact canonical identity",
      "complete five-component score breakdown",
      "finite component values",
      "exact accepted-source provenance",
    ]);
    expect(contract.unresolvedReplayProvenanceDecision).toBe("ROUND-018 PERFORMANCE INELIGIBLE — SCORE PROVENANCE");
    expect(replayStatusRules).toMatchObject({
      NO_BASELINE_CANDIDATE: expect.stringContaining("no baseline candidate"),
      BASELINE_CANDIDATE_NON_FORMAL: expect.stringContaining("fails the exact frozen formal predicate"),
      BASELINE_FORMAL: expect.stringContaining("complete finite five-component breakdown"),
      PROVENANCE_INCOMPLETE: expect.stringContaining("fails G01 closed"),
    });
  });

  it("binds the population before formal filtering and rejects the old global-stream estimand", () => {
    const design = loadDesign();
    const sourceUniverse = design.sourceUniverse;
    const contract = design.scoreReconstructionContract;
    const pipeline = contract.pipeline as string[];

    expect(sourceUniverse.populationIdentity).toBe("EXACT_ACCEPTED_R14_OBSERVATION_FREEZE_NATIVE_UNIVERSE");
    expect(sourceUniverse.formalFilterAfterPopulationBinding).toBe(true);
    expect(pipeline[0]).toBe("R14 native frozen observation identity");
    expect(pipeline[1]).toBe("exact accepted-source baseline-001 decision-time replay");
    expect(pipeline[2]).toBe("deterministic replay status");
    expect(pipeline.indexOf("exact formal predicate")).toBeGreaterThan(2);
    expect(contract.globalFormalStreamAsPopulation).toBe(false);
    expect(contract.globalFormalToR14InnerJoin).toBe(false);
    expect(sourceUniverse.forbiddenPopulationConstruction).toContain("global formal stream");
    expect(sourceUniverse.forbiddenPopulationConstruction).toContain("silently retain matched rows");
  });

  it("defines deterministic replay completeness and fails closed on unresolved provenance", () => {
    const design = loadDesign();
    const contract = design.scoreReconstructionContract;
    const replayStatusRules = contract.replayStatusRules as Record<string, string>;
    const g01 = design.structuralPrelightGates.definitions.find((gate) => gate.id === "G01_DATA_PROVENANCE");

    expect(contract.replayStatuses).toEqual(expect.arrayContaining([
      "NO_BASELINE_CANDIDATE",
      "BASELINE_CANDIDATE_NON_FORMAL",
      "BASELINE_FORMAL",
      "PROVENANCE_INCOMPLETE",
    ]));
    expect(replayStatusRules.PROVENANCE_INCOMPLETE).toContain("cannot be determined exactly");
    expect(replayStatusRules.PROVENANCE_INCOMPLETE).toContain("fails G01 closed");
    expect(replayStatusRules.PROVENANCE_INCOMPLETE).not.toContain("NO_BASELINE_CANDIDATE");
    expect(g01?.requirement).toContain("every R14-native identity receives a deterministic replay status");
    expect(g01?.requirement).toContain("PROVENANCE_INCOMPLETE");
    expect(g01?.requirement).toContain("unresolved integrity errors = 0");
  });

  it("keeps future preflight metadata-only and disallows R17 subset or new-data repair", () => {
    const design = loadDesign();
    const source = design.canonicalDataSource;
    const contract = design.scoreReconstructionContract;

    expect(design.metrics.structuralPreflightOutputs).toEqual(expect.arrayContaining([
      "r14NativeObservationCount",
      "deterministicReplayCount",
      "replayProvenanceIncompleteCount",
      "r14NativeFormalControlCount",
      "G01-G07",
    ]));
    expect(JSON.stringify({ sourceUniverse: design.sourceUniverse, contract })).not.toContain("5834");
    expect(JSON.stringify({ sourceUniverse: design.sourceUniverse, contract })).not.toContain("1666");
    expect(source.prohibited).toEqual(expect.arrayContaining([
      "new historical market data",
      "network backfill",
      "truncation based on R17 missing data",
    ]));
    expect(design.designOnlyProhibitions).toEqual(expect.arrayContaining([
      "GLOBAL_FORMAL_7500_RECONCILIATION",
      "R17_5834_SELECTOR_RECONCILIATION",
      "INNER_JOIN_GLOBAL_FORMAL_TO_R14",
      "R17_MISSING_EVENT_RECONSTRUCTION",
      "CUSTOM_START_BOUNDARY",
    ]));
    expect(contract.designReplayExecuted).toBe(false);
    expect(contract.designDataScanExecuted).toBe(false);
  });

  it("binds folds and regimes to accepted-source definitions without retuning", () => {
    const design = loadDesign();

    expect(design.frozenFolds).toMatchObject({
      sourceCommit: ROUND_018_ACCEPTED_SOURCE,
      sourcePath: "src/lib/research/folds.ts",
      export: "RESEARCH_FOLDS",
      sourceSha256: "f9017ab7b9326353535366465861f4ccd4e276ffd6fb49e61afed75e44e62b2a",
      foldIds: [...ROUND_018_FOLDS],
      validationMethod: "PURGED_WALK_FORWARD_FIXED_SELECTOR",
      purgeHours: 24,
      embargoHours: 24,
      trainingRequired: false,
      foldBoundaryRedefinition: false,
      futureBoundaryChange: "FORBIDDEN",
    });
    expect(sha256(readAcceptedSourceBlob("src/lib/research/folds.ts"))).toBe(design.frozenFolds.sourceSha256);
    expect(design.frozenRegimes).toMatchObject({
      sourceCommit: ROUND_018_ACCEPTED_SOURCE,
      sourcePath: "src/lib/strategy/regimes.ts",
      function: "calculateBTCRegime",
      sourceSha256: "6d5b17c7035c39f65b64cdc70153e0d9f576f587aa20d9f9c31199c5a655709e",
      labels: [...ROUND_018_REGIMES],
      role: "REPORTING_AND_BREADTH_STRATIFICATION_ONLY",
      candidateClassificationInfluence: false,
      thresholdAdjustment: "FORBIDDEN_AFTER_FREEZE",
    });
    const regimeSource = readAcceptedSourceBlob("src/lib/strategy/regimes.ts").toString("utf8");
    expect(regimeSource).toContain("export function calculateBTCRegime");
    expect(regimeSource).toContain("bullCloseDistance >= 1");
    expect(regimeSource).toContain("bullEmaSpread >= 0.5");
    expect(regimeSource).toContain("bullEmaSlope >= 0.1");
    expect(regimeSource).toContain("bearCloseDistance >= 1");
    expect(regimeSource).toContain("bearEmaSpread >= 0.5");
    expect(regimeSource).toContain("bearEmaSlope >= 0.1");
  });

  it("freezes H4 native labels and status eligibility without reading economic values", () => {
    const contract = loadDesign().economicLabelContract;

    expect(contract.primaryTarget).toBe("R14_NATIVE_H4_NET_FORWARD_ATR");
    expect(contract.primaryHorizonHours).toBe(ROUND_018_PRIMARY_HORIZON_HOURS);
    expect(contract.primaryField).toBe("labels[4].netForwardAtr");
    expect(contract.costStressField).toBe("labels[4].netForwardAtrCostStress");
    expect(contract.latencyStressField).toBe("latencyStressLabels[4].netForwardAtr");
    expect(contract.noNewEconomicLabel).toBe(true);
    expect(contract.noSettlementReconstruction).toBe(true);
    expect(contract.noBtPolicyReplacement).toBe(true);
    expect(contract.designMayReadValues).toBe(false);
    expect(contract.prelightMayReadOnly).toEqual(["label identity", "label source", "label status"]);
    expect(contract.statusEligibility).toEqual({
      EXECUTED: "eligible",
      NO_ENTRY: "not economically evaluated",
      PERIOD_END_CENSORED: "not economically evaluated",
      DATA_INCOMPLETE: "integrity failure",
    });
    expect(ROUND_018_BACKTEST_POLICY_VERSION).toBe("bt-policy-003");
  });

  it("freezes G01-G07 structural gates before prelight", () => {
    const gates = loadDesign().structuralPrelightGates;

    expect(gates.frozenBeforePrelight).toBe(true);
    expect(gates.evaluationMode).toBe("FAIL_CLOSED");
    expect(gates.definitions.map((gate) => gate.id)).toEqual([...ROUND_018_STRUCTURAL_GATES]);
    expect(gates.definitions.every((gate) => gate.hardGate)).toBe(true);
    expect(gates.definitions.find((gate) => gate.id === "G01_DATA_PROVENANCE")?.requirement).toContain("Exact R14 manifest/hash");
    expect(gates.definitions.find((gate) => gate.id === "G03_AGGREGATE_BREADTH")?.requirement).toContain(">= 500");
    expect(gates.definitions.find((gate) => gate.id === "G04_FOLD_BREADTH")?.requirement).toContain(">= 50");
    expect(gates.definitions.find((gate) => gate.id === "G05_SYMBOL_BREADTH")?.requirement).toContain("BNBUSDT");
    expect(gates.definitions.find((gate) => gate.id === "G06_REGIME_BREADTH")?.requirement).toContain("BTC_STRONG_BEAR");
    expect(gates.definitions.find((gate) => gate.id === "G07_STRUCTURAL_DISCRIMINATION")?.requirement).toContain("candidateCount < controlCount");
  });

  it("freezes G08-G15 performance gates before any performance result exists", () => {
    const gates = loadDesign().frozenPerformanceGates;

    expect(gates.frozenBeforePerformance).toBe(true);
    expect(gates.evaluatedDuringDesign).toBe(false);
    expect(gates.resultsMayNotChangeDefinitions).toBe(true);
    expect(gates.definitions.map((gate) => gate.id)).toEqual([...ROUND_018_PERFORMANCE_GATES]);
    expect(gates.definitions.every((gate) => gate.hardGate)).toBe(true);
    expect(gates.definitions.find((gate) => gate.id === "G08_ABSOLUTE_H4_EDGE")?.requirement).toContain("> 0");
    expect(gates.definitions.find((gate) => gate.id === "G09_H4_PROFIT_FACTOR")?.requirement).toContain("1.10");
    expect(gates.definitions.find((gate) => gate.id === "G10_INCREMENTAL_H4_EDGE")?.requirement).toContain("0.05");
    expect(gates.definitions.find((gate) => gate.id === "G11_FOLD_INCREMENTAL_ROBUSTNESS")?.requirement).toContain("4 of 6");
    expect(gates.definitions.find((gate) => gate.id === "G12_FOLD_ABSOLUTE_ROBUSTNESS")?.requirement).toContain("4 of 6");
    expect(gates.definitions.find((gate) => gate.id === "G13_COST_STRESS")?.requirement).toContain("1.05");
    expect(gates.definitions.find((gate) => gate.id === "G14_LATENCY_STRESS")?.requirement).toContain("1.05");
    expect(gates.definitions.find((gate) => gate.id === "G15_DRAWDOWN_NON_DEGRADATION")?.requirement).toContain("5%");
  });

  it("keeps H8/H12/H24 reporting-only and does not calculate economic metrics in design", () => {
    const metrics = loadDesign().metrics;

    expect(metrics.designCalculation).toBe(false);
    expect(metrics.primaryH4).toEqual(expect.arrayContaining(["meanNetForwardAtr", "profitFactor", "cumulativeNetForwardAtr", "maximumDrawdownNetAtr"]));
    expect(metrics.stress).toEqual(expect.arrayContaining(["meanNetForwardAtrCostStress", "costStressProfitFactor", "latencyStressMeanNetForwardAtr", "latencyStressProfitFactor"]));
    expect(metrics.crossHorizonReportingOnly).toEqual(["H8", "H12", "H24"]);
    expect(metrics.horizonSelection).toBe(false);
    expect(metrics.economicValuesCalculated).toBe(false);
    expect(metrics.economicValuesViewed).toBe(false);
  });

  it("freezes round-global one-shot governance while keeping the ledger absent", () => {
    const design = loadDesign();
    const execution = design.authoritativeExecutionGovernance;

    expect(execution.maxAuthoritativePerformanceExecutions).toBe(ROUND_018_MAX_AUTHORITATIVE_PERFORMANCE_EXECUTIONS);
    expect(execution.performanceExecutionCountSource).toBe("ROUND_GLOBAL_LEDGER_ONLY");
    expect(execution.performanceLock).toBe("ROUND_GLOBAL_FIRST_RESULT_LOCK");
    expect(execution.ledgerPath).toBe(ROUND_018_PERFORMANCE_LEDGER_PATH);
    expect(execution.ledgerMustBeAbsentDuringDesign).toBe(true);
    expect(execution.rules).toEqual(
      expect.arrayContaining(["first executionId only", "second executionId forbidden", "completed fold never recomputed", "missing or corrupt completed checkpoint aborts", "final summary marker written last"]),
    );
    expect(execution.executionDirectoryTemplate).toContain("{firstLedgerExecutionId}");
    expect(existsSync(path.join(process.cwd(), ROUND_018_PERFORMANCE_LEDGER_PATH))).toBe(false);
  });

  it("leaves all R18 performance and selection paths absent", () => {
    const design = loadDesign();
    const outputs = [
      "docs/M3_R18_ROUND_018_RESULTS.md",
      "docs/evidence/M3_R18_ROUND_018_SUMMARY.json",
      "docs/evidence/M3_R18_ROUND_018_AUDIT.json",
      "docs/evidence/M3_R18_ROUND_018_SELECTION.json",
      "docs/evidence/M3_R18_ROUND_018_SELECTION.md",
    ];

    expect(design.evidenceOutputs.generatedDuringDesign).toEqual([]);
    expect(design.evidenceOutputs.reservedObservationOutputs).toEqual([]);
    expect(outputs.every((filePath) => !existsSync(path.join(process.cwd(), filePath)))).toBe(true);
    const packageJson = JSON.parse(readFileSync(path.join(process.cwd(), "package.json"), "utf8")) as { scripts?: Record<string, string> };
    expect(Object.keys(packageJson.scripts ?? {}).some((name) => name.includes("round018") && name.includes("performance"))).toBe(false);
  });

  it("enforces design-only status with zero performance execution and no side effects", () => {
    const design = loadDesign();
    const status = design.status;

    expect(status).toMatchObject({
      performance: "NOT_AUTHORIZED / NOT_GENERATED",
      performanceExecutionCount: 0,
      performanceExecuted: false,
      performanceLedgerPresent: false,
      selection: "NOT_EXECUTED",
      selectionExecuted: false,
      economicValuesCalculated: false,
      economicValuesViewed: false,
      newMarketDataFetched: false,
      production: "UNCHANGED",
      baseline001: "UNCHANGED",
      baseline002: "NOT_FROZEN",
      m3J: "BLOCKED",
      m4: "NOT_STARTED",
      automaticTrading: false,
    });
    expect(isRound018DesignOnlyStatus({
      phase: "DESIGN_ONLY",
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      performanceExecuted: false,
      selectionExecuted: false,
      economicValuesCalculated: false,
      economicValuesViewed: false,
      newMarketDataFetched: false,
      productionUnchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      automaticTrading: false,
    })).toBe(true);
    expect(design.designOnlyProhibitions).toEqual(expect.arrayContaining([
      "R18_PREFLIGHT",
      "R18_PERFORMANCE",
      "R18_SELECTION",
      "R18_PERFORMANCE_LEDGER_CLAIM",
      "NEW_MARKET_DATA_ACQUISITION",
      "AUTOMATIC_TRADING",
    ]));
  });
});
