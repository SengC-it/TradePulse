import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DESIGN_PATH = path.join(process.cwd(), "docs", "research", "round-017-design.json");
const DESIGN_DOC_PATH = path.join(process.cwd(), "docs", "research", "round-017-design.md");
const ACCEPTED_SOURCE_SHA = "0f5e24009f3301b8f2fb64d7e01161402a94f0b7";

type Hypothesis = {
  id: string;
  status: string;
};

type FeatureFamily = {
  name: string;
  fields: string[];
};

type FoldBoundary = {
  research: { start: string; end: string };
  validation: { start: string; end: string };
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
    artifacts: string[];
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
    foldIdentity: {
      sourceCommit: string;
      canonicalDefinition: {
        sourcePath: string;
        export: string;
        sourceSha256: string;
      };
      inheritedAliases: Array<{
        sourcePath: string;
        export: string;
        definition: string;
        sourceSha256: string;
      }>;
      foldIds: string[];
      boundaries: Record<string, FoldBoundary>;
      futureBoundaryRedefinition: string;
    };
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
    regimeIdentity: {
      sourceCommit: string;
      sourcePath: string;
      function: string;
      sourceSha256: string;
      labels: string[];
      rules: {
        input: string;
        strongBull: string;
        strongBear: string;
        otherwise: string;
      };
      thresholdAdjustment: string;
    };
    metrics: {
      primary: string[];
      efficiency: string[];
    };
    metricDefinitions: Record<string, {
      definition: string;
      denominator?: string;
      scope?: string;
      zeroDenominator?: string;
      aliasOf?: string;
      aliasOfWhenOneToOne?: string;
      deliveryMapping?: string;
      independentEconomicEvidence?: boolean;
    }>;
    followUpAudit: {
      fields: Record<string, string>;
      classificationSource: string;
      reportingOnly: boolean;
      candidateClassificationUnaffected: boolean;
      newTunableParameters: boolean;
    };
    gates: {
      frozenBeforePerformance: boolean;
      evaluationMode: string;
      resultsMayNotChangeDefinitions: boolean;
      definitions: Array<{ id: string; hardGate: boolean; role?: string; requirement: string }>;
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

function readAcceptedSourceBlob(sourcePath: string): Buffer {
  return execFileSync("git", ["cat-file", "blob", `${ACCEPTED_SOURCE_SHA}:${sourcePath}`], {
    cwd: process.cwd(),
  });
}

function acceptedSourcePathExists(sourcePath: string): boolean {
  try {
    execFileSync("git", ["cat-file", "-e", `${ACCEPTED_SOURCE_SHA}:${sourcePath}`], {
      cwd: process.cwd(),
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
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

    const expectedArtifacts = [
      [
        "docs/M3_R14_ROUND_014_RESULTS.md",
        "docs/evidence/M3_R14_ROUND_014_SUMMARY.json",
        "docs/evidence/M3_R14_ROUND_014_SELECTION.json",
        "docs/evidence/M3_R14_ROUND_014_AUDIT.json",
      ],
      [
        "docs/M3_R15_ROUND_015_RESULTS.md",
        "docs/evidence/M3_R15_ROUND_015_SUMMARY.json",
        "docs/evidence/M3_R15_ROUND_015_SELECTION.json",
        "docs/evidence/M3_R15_ROUND_015_AUDIT.json",
      ],
      [
        "docs/M3_R16_ROUND_016_RESULTS.md",
        "docs/evidence/M3_R16_ROUND_016_SUMMARY.json",
        "docs/evidence/M3_R16_ROUND_016_SELECTION.json",
        "docs/evidence/M3_R16_ROUND_016_AUDIT.json",
      ],
    ];

    rounds.forEach((round, index) => {
      expect(round.artifacts).toEqual(expectedArtifacts[index]);
      round.artifacts.forEach((artifact) => {
        expect(artifact.startsWith("docs/")).toBe(true);
        expect(artifact.includes("..")).toBe(false);
        expect(acceptedSourcePathExists(artifact)).toBe(true);
      });
    });
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

  it("binds R17 folds to the accepted source without redefining boundaries", () => {
    const design = loadDesign();
    const identity = design.protocol.foldIdentity;

    expect(identity.sourceCommit).toBe(ACCEPTED_SOURCE_SHA);
    expect(identity.canonicalDefinition).toEqual({
      sourcePath: "src/lib/research/folds.ts",
      export: "RESEARCH_FOLDS",
      sourceSha256: "f9017ab7b9326353535366465861f4ccd4e276ffd6fb49e61afed75e44e62b2a",
    });
    expect(identity.foldIds).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(identity.foldIds).toEqual(design.protocol.folds);
    expect(identity.futureBoundaryRedefinition).toContain("FORBIDDEN");

    const canonicalSource = readAcceptedSourceBlob(identity.canonicalDefinition.sourcePath);
    expect(sha256(canonicalSource)).toBe(identity.canonicalDefinition.sourceSha256);
    expect(canonicalSource.toString("utf8")).toContain("export const RESEARCH_FOLDS");

    const r13Alias = identity.inheritedAliases.find((alias) => alias.export === "R13_FOLDS");
    const r15Alias = identity.inheritedAliases.find((alias) => alias.export === "R15_FOLD_IDS");
    expect(r13Alias).toBeDefined();
    expect(r15Alias).toBeDefined();
    expect(r13Alias?.definition).toBe("R13_FOLDS = RESEARCH_FOLDS");
    expect(r15Alias?.definition).toBe("R15_FOLD_IDS = Object.keys(R13_FOLDS)");
    expect(sha256(readAcceptedSourceBlob(r13Alias?.sourcePath ?? ""))).toBe(r13Alias?.sourceSha256);
    expect(sha256(readAcceptedSourceBlob(r15Alias?.sourcePath ?? ""))).toBe(r15Alias?.sourceSha256);
    expect(readAcceptedSourceBlob(r13Alias?.sourcePath ?? "").toString("utf8")).toContain(
      "export const R13_FOLDS = RESEARCH_FOLDS;",
    );
    expect(readAcceptedSourceBlob(r15Alias?.sourcePath ?? "").toString("utf8")).toContain(
      "export const R15_FOLD_IDS = Object.freeze(Object.keys(R13_FOLDS)",
    );

    expect(identity.boundaries).toEqual({
      F1: {
        research: { start: "2023-01-01T00:00:00.000Z", end: "2023-12-31T23:59:59.999Z" },
        validation: { start: "2024-01-01T00:00:00.000Z", end: "2024-06-30T23:59:59.999Z" },
      },
      F2: {
        research: { start: "2023-01-01T00:00:00.000Z", end: "2024-06-30T23:59:59.999Z" },
        validation: { start: "2024-07-01T00:00:00.000Z", end: "2024-12-31T23:59:59.999Z" },
      },
      F3: {
        research: { start: "2023-01-01T00:00:00.000Z", end: "2024-12-31T23:59:59.999Z" },
        validation: { start: "2025-01-01T00:00:00.000Z", end: "2025-06-30T23:59:59.999Z" },
      },
      F4: {
        research: { start: "2023-01-01T00:00:00.000Z", end: "2025-06-30T23:59:59.999Z" },
        validation: { start: "2025-07-01T00:00:00.000Z", end: "2025-12-31T23:59:59.999Z" },
      },
      F5: {
        research: { start: "2023-01-01T00:00:00.000Z", end: "2025-12-31T23:59:59.999Z" },
        validation: { start: "2026-01-01T00:00:00.000Z", end: "2026-03-31T23:59:59.999Z" },
      },
      F6: {
        research: { start: "2023-01-01T00:00:00.000Z", end: "2026-03-31T23:59:59.999Z" },
        validation: { start: "2026-04-01T00:00:00.000Z", end: "2026-08-15T23:59:59.999Z" },
      },
    });
  });

  it("binds regime labels and thresholds to the accepted calculateBTCRegime definition", () => {
    const design = loadDesign();
    const identity = design.protocol.regimeIdentity;
    const sourceBlob = readAcceptedSourceBlob(identity.sourcePath);
    const source = sourceBlob.toString("utf8");

    expect(identity.sourceCommit).toBe(ACCEPTED_SOURCE_SHA);
    expect(identity.sourcePath).toBe("src/lib/strategy/regimes.ts");
    expect(identity.function).toBe("calculateBTCRegime");
    expect(sha256(sourceBlob)).toBe(
      "6d5b17c7035c39f65b64cdc70153e0d9f576f587aa20d9f9c31199c5a655709e",
    );
    expect(identity.labels).toEqual(["BTC_STRONG_BULL", "BTC_NEUTRAL", "BTC_STRONG_BEAR"]);
    expect(identity.labels).toEqual(design.protocol.regimeBuckets);
    expect(identity.thresholdAdjustment).toBe("FORBIDDEN_AFTER_FREEZE");
    expect(source).toContain("export function calculateBTCRegime");
    expect(source).toContain("bullCloseDistance >= 1");
    expect(source).toContain("bullEmaSpread >= 0.5");
    expect(source).toContain("bullEmaSlope >= 0.1");
    expect(source).toContain("bearCloseDistance >= 1");
    expect(source).toContain("bearEmaSpread >= 0.5");
    expect(source).toContain("bearEmaSlope >= 0.1");
    expect(identity.rules.input).toContain("atr14 <= 0 returns null");
    expect(identity.rules.strongBull).toContain(">= 1");
    expect(identity.rules.strongBear).toContain(">= 1");
    expect(identity.rules.otherwise).toBe("BTC_NEUTRAL");
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
      expect.arrayContaining([
        "suppressionRate",
        "advisoriesPerMonth",
        "netRPerEmail",
        "followUpCount",
        "followUpMeanNetR",
        "followUpCumulativeNetR",
      ]),
    );
  });

  it("defines non-duplicative economics and reporting-only follow-up diagnostics", () => {
    const protocol = loadDesign().protocol;
    const metricDefinitions = protocol.metricDefinitions;
    const gates = protocol.gates.definitions;
    const g07 = gates.find((gate) => gate.id === "G07_INCREMENTAL_MEAN_NET_R");
    const g15 = gates.find((gate) => gate.id === "G15_NET_R_PER_EMAIL");

    expect(metricDefinitions.meanNetR).toMatchObject({
      denominator: "retainedAdvisoryCount",
      scope: "CONTROL_AND_CANDIDATE",
      zeroDenominator: "DATA_NOT_AVAILABLE",
    });
    expect(metricDefinitions.meanNetR?.definition).toContain("Sum of settled netR");
    expect(metricDefinitions.meanNetRPerRetainedAdvisory).toMatchObject({
      aliasOf: "meanNetR",
      independentEconomicEvidence: false,
    });
    expect(metricDefinitions.netRPerEmail).toMatchObject({
      denominator: "deliveredEmailCount",
      aliasOfWhenOneToOne: "meanNetR",
      deliveryMapping: "ONE_RETAINED_ADVISORY_TO_ONE_DELIVERED_EMAIL_WITHOUT_DUPLICATES",
      independentEconomicEvidence: false,
    });
    expect(g07).toMatchObject({ hardGate: true });
    expect(g15).toMatchObject({ hardGate: false, role: "REPORTING_ALIAS" });
    expect(g15?.requirement).toContain("not treat it as an additional hard gate");

    expect(protocol.followUpAudit).toMatchObject({
      classificationSource: "FROZEN_POINT_IN_TIME_THESIS_STATE_MACHINE",
      reportingOnly: true,
      candidateClassificationUnaffected: true,
      newTunableParameters: false,
    });
    expect(Object.keys(protocol.followUpAudit.fields)).toEqual([
      "followUpCount",
      "followUpMeanNetR",
      "followUpCumulativeNetR",
    ]);
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
    expect(gates.definitions.slice(0, 14).every((gate) => gate.hardGate)).toBe(true);
    expect(gates.definitions[14]).toMatchObject({
      id: "G15_NET_R_PER_EMAIL",
      hardGate: false,
      role: "REPORTING_ALIAS",
    });
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
