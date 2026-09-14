import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { R13_FEATURE_NAMES, R13_FOLDS } from "@/lib/research/m3-r13-round-013-protocol";
import { R23_BASE_BRANCH, R23_BASE_SHA, R23_BRANCH, R23_CANDIDATE_CONFIGURATIONS, R23_DEVELOPMENT_GATES, R23_DEVELOPMENT_DATA_END_ISO, R23_DEVELOPMENT_DATA_MANIFEST_PATH, R23_DEVELOPMENT_DATA_PATH, R23_DEVELOPMENT_DATA_SHA256, R23_DEVELOPMENT_DATA_SOURCE_STATUS, R23_DEVELOPMENT_DATA_START_ISO, R23_FOLDS, R23_FOLD_IDS, R23_FROZEN_COST_MODEL, R23_GOVERNANCE, R23_HISTORICAL_RESULT_METHODOLOGY_ISSUE, R23_HISTORICAL_RESULT_NON_AUTHORITATIVE_CLASSIFICATION, R23_HISTORICAL_RESULT_NON_AUTHORITATIVE_DECISION, R23_HISTORICAL_RESULT_SEMANTIC_CLOSURE, R23_CANDIDATE_OPERATIONAL_DISPOSITION, R23_MODEL_FAMILIES, R23_NEW_CANDIDATE_NEXT_STAGE, R23_PROTOCOL_OBJECT, R23_PROTOCOL_SCHEMA_VERSION, R23_R15_FIRST_SPEC_COMMIT, R23_R15_RESULT_PUBLICATION_COMMIT, R23_R15_REJECTION_REASON, R23_SELECTION_ALGORITHM, R23_SYMBOLS, R23_THRESHOLD_VALUES, calculateR23CandidateConfigurationCount, isR23ExistingFeatureName, r23FoldDefinitionsEqualFrozenSource } from "@/lib/research/round-023-development-protocol";
import { R23_RUNNER_IDENTITIES, runR23HistoricalDevelopment } from "@/lib/research/round-023-development-runner";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected JSON object");
  return value as JsonRecord;
}

function protocolDocument(): JsonRecord {
  return JSON.parse(readFileSync(path.join(process.cwd(), "docs/research/round-023-development-protocol.json"), "utf8")) as JsonRecord;
}

function developmentResultDocument(): JsonRecord {
  return JSON.parse(readFileSync(path.join(process.cwd(), "docs/research/round-023-development-result.json"), "utf8")) as JsonRecord;
}

function acceptedBlobSha(sourcePath: string): string {
  return execFileSync("git", ["rev-parse", `${R23_BASE_SHA}:${sourcePath}`], { cwd: process.cwd(), encoding: "utf8" }).trim();
}

describe("Round-023 A0 development protocol", () => {
  it("binds the exact base, branch, and protocol phase", () => {
    expect(R23_BASE_BRANCH).toBe("research/round-015-beta-alpha-decomposition");
    expect(R23_BASE_SHA).toBe("6924783d26e377a543bfc0d438a2bf6e6c40ba8a");
    expect(R23_BRANCH).toBe("research/round-023-forward-net-expectancy-validation");
    expect(R23_PROTOCOL_OBJECT.schemaVersion).toBe(R23_PROTOCOL_SCHEMA_VERSION);
    expect(R23_PROTOCOL_OBJECT.phase).toBe("A1_DEVELOPMENT_DATASET_FREEZE");
    expect(acceptedBlobSha("docs/research/round-015-spec.json")).toMatch(/^[a-f0-9]{40}$/u);
  });

  it("rejects the R15-forward candidate without substituting an anchor", () => {
    const r15 = record(R23_PROTOCOL_OBJECT.r15ForwardCandidate);
    expect(r15.rejected).toBe(true);
    expect(r15.rejectionReasons).toContain(R23_R15_REJECTION_REASON);
    expect(record(r15.provenanceOnly)).toMatchObject({
      firstSpecCommit: R23_R15_FIRST_SPEC_COMMIT,
      resultPublicationCommit: R23_R15_RESULT_PUBLICATION_COMMIT,
      finalDecision: "NO BETA-ALPHA DEVELOPMENT CANDIDATE — ROUND-015",
      forwardShadowEligible: false,
      selectedCandidateId: null,
    });
    expect(JSON.stringify(R23_PROTOCOL_OBJECT)).not.toContain("739806139345efed09eee4e95ded7d5a281f8ab1");
  });

  it("keeps the development search finite and deterministic", () => {
    expect(R23_MODEL_FAMILIES.length).toBeLessThanOrEqual(3);
    expect(R23_THRESHOLD_VALUES.length).toBeLessThanOrEqual(3);
    expect(calculateR23CandidateConfigurationCount()).toBe(4);
    expect(R23_CANDIDATE_CONFIGURATIONS.length).toBe(4);
    expect(new Set(R23_CANDIDATE_CONFIGURATIONS.map((item) => item.candidateConfigurationId)).size).toBe(4);
    expect(R23_CANDIDATE_CONFIGURATIONS.every((item) => item.featureNames.every((name) => isR23ExistingFeatureName(name)))).toBe(true);
    expect(R23_CANDIDATE_CONFIGURATIONS.every((item) => item.model === "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION")).toBe(true);
  });

  it("uses only the five-symbol bilateral universe and frozen folds", () => {
    expect(R23_SYMBOLS).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]);
    expect(R23_PROTOCOL_OBJECT.universe.directions).toEqual(["LONG", "SHORT"]);
    expect(R23_FOLD_IDS).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(r23FoldDefinitionsEqualFrozenSource()).toBe(true);
    expect(R23_FOLDS).toEqual(R13_FOLDS);
    expect(R23_PROTOCOL_OBJECT.searchSpace.noNewIndicators).toBe(true);
    expect(R13_FEATURE_NAMES.length).toBe(18);
  });

  it("freezes the historical boundary and amended accepted-source policy", () => {
    const data = record(R23_PROTOCOL_OBJECT.developmentData);
    expect(data.start).toBe(R23_DEVELOPMENT_DATA_START_ISO);
    expect(data.end).toBe(R23_DEVELOPMENT_DATA_END_ISO);
    expect(data.manifestPath).toBe(R23_DEVELOPMENT_DATA_MANIFEST_PATH);
    expect(data.observationDataPath).toBe(R23_DEVELOPMENT_DATA_PATH);
    expect(data.observationDataSha256).toBe(R23_DEVELOPMENT_DATA_SHA256);
    expect(data.sourceStatusAtA0).toBe(R23_DEVELOPMENT_DATA_SOURCE_STATUS);
    expect(data.sourcePolicy).toBe("PUBLIC_HISTORICAL_SOURCE_ACQUISITION_ALLOWED");
    expect(data.networkAcquired).toBe(false);
    expect(data.newHistoricalDevelopmentDataFetched).toBe(false);
    expect(data.postBoundaryExcluded).toBe(true);
  });

  it("freezes cost, settlement, latency, and statistical gates before metrics", () => {
    const cost = record(R23_PROTOCOL_OBJECT.costModel);
    expect(cost.policyVersion).toBe("bt-policy-003");
    expect(record(cost.feeRule).ratePerSide).toBe(0.0005);
    expect(record(cost.slippageRule).ratePerSide).toBe(0.0005);
    expect(record(cost.settlementRule).optimisticTpSelection).toBe(false);
    expect(R23_PROTOCOL_OBJECT.statisticalContract.purgeEmbargoHours).toBe(24);
    expect(R23_DEVELOPMENT_GATES.minimumAggregateNetProfitFactor).toBe(1.1);
    expect(R23_DEVELOPMENT_GATES.minimumPositiveTemporalFolds).toBe(4);
    expect(R23_DEVELOPMENT_GATES.manualLatencyPrimary.minutes).toBe(7);
    expect(R23_SELECTION_ALGORITHM).toEqual([
      "PASS_ALL_HARD_GATES",
      "HIGHEST_WORST_FOLD_NET_EXPECTANCY",
      "HIGHEST_COST_STRESS_EXPECTANCY",
      "LOWEST_MAXIMUM_DRAWDOWN_R",
      "SIMPLER_MODEL_FEWER_PARAMETERS",
      "CANDIDATE_CONFIGURATION_ID_LEXICAL_ASCENDING",
    ]);
  });

  it("mirrors the machine-readable freeze artifact", () => {
    const document = protocolDocument();
    expect(document.schemaVersion).toBe(R23_PROTOCOL_SCHEMA_VERSION);
    expect(document.base).toEqual({ branch: R23_BASE_BRANCH, sha: R23_BASE_SHA });
    expect(record(document.developmentData).observationDataPath).toBe(R23_DEVELOPMENT_DATA_PATH);
    expect(record(document.developmentData).manifestPath).toBe(R23_DEVELOPMENT_DATA_MANIFEST_PATH);
    expect(record(document.searchSpace).candidateConfigurationCount).toBe(4);
    expect(record(document.folds).definitions).toEqual(R23_FOLDS);
    expect(record(document.costModel).implementation).toEqual(R23_FROZEN_COST_MODEL.implementation);
    expect(record(document.governance)).toMatchObject({ performanceExecutionCount: 0, performanceLedgerPresent: false, economicValuesRead: false, newMarketDataFetched: false, automaticTrading: false });
  });

  it("fails closed without a frozen source and does not evaluate economics", async () => {
    await expect(runR23HistoricalDevelopment({ root: path.join(process.cwd(), ".tmp-r23-missing-data") })).rejects.toThrow("source is unavailable");
  });

  it("publishes the observed four-configuration result as non-authoritative", () => {
    const result = developmentResultDocument();
    expect(result.protocolPhase).toBe("A1_DEVELOPMENT_DATASET_FREEZE");
    expect(result.resultPhase).toBe("B_HISTORICAL_DEVELOPMENT_EVALUATION_RESULT");
    expect(result.developmentExecutionId).toBe(`r23-development-${String(result.protocolSha256).slice(0, 16)}`);
    expect(result.developmentExecutionCount).toBe(1);
    expect(result.classification).toBe(R23_HISTORICAL_RESULT_NON_AUTHORITATIVE_CLASSIFICATION);
    expect(result.finalDecision).toBe(R23_HISTORICAL_RESULT_NON_AUTHORITATIVE_DECISION);
    expect(result.candidateOperationalDisposition).toBe(R23_CANDIDATE_OPERATIONAL_DISPOSITION);
    expect(result.economicRunnerFrozenBeforeOutcomeRead).toBe(false);
    expect(result.historicalResultsObserved).toBe(true);
    expect(result.historicalWindowNowSeen).toBe(true);
    expect(result.rerunSameWindowForbidden).toBe(true);
    expect(result.historicalWindowReuseForAuthoritativeEvaluation).toBe(false);
    expect(record(result.methodologyIssue)).toEqual(R23_HISTORICAL_RESULT_METHODOLOGY_ISSUE);
    expect(result.candidateConfigurationsDefined).toBe(4);
    expect(result.candidateConfigurationsEvaluated).toBe(4);
    expect(Array.isArray(result.candidateResults)).toBe(true);
    expect((result.candidateResults as unknown[]).length).toBe(4);
    expect((result.candidateResults as JsonRecord[]).every((candidate) => candidate.evaluated === true)).toBe(true);
    expect(result.eligibleCandidates).toEqual([]);
    expect(result.selectedCandidateId).toBeNull();
    expect(result.selectionExecuted).toBe(false);
    expect(result.developmentEconomicEvaluationExecutionCount).toBe(1);
    expect(result.finalDecision).toBe(R23_HISTORICAL_RESULT_NON_AUTHORITATIVE_DECISION);
    expect(result.nextStage).toBe(R23_NEW_CANDIDATE_NEXT_STAGE);
    expect(record(result.modelFreeze)).toMatchObject({ finalModelArtifactCommitted: false, forwardContractCommitted: false, selectedCandidateId: null });
    expect(record(result.economicReadBoundary)).toMatchObject({ historicalDevelopmentEconomicValuesRead: true, performanceExecutionCount: 0, performanceLedgerPresent: false, forwardEconomicValuesRead: false, forwardReturnRead: false });
    expect(record(result.sourceCheck)).toMatchObject({ sourceStatus: R23_DEVELOPMENT_DATA_SOURCE_STATUS, newMarketDataFetched: false, newHistoricalDevelopmentDataFetched: false, networkAcquired: false, pitCompatible: true });
    expect(record(result.sourceAudit)).toMatchObject({ requiredPath: R23_DEVELOPMENT_DATA_PATH, validPreExistingSourceFound: true, compatibleExistingCacheFound: true, economicPayloadRead: true, pitCompatible: true });
    expect(record(result.economicReadBoundary)).toMatchObject({ economicValuesCalculated: true, economicValuesInspected: true });
    expect(record(result.governance)).toMatchObject({ automaticTrading: false, productionUnchanged: true });
  });

  it("preserves every observed historical candidate metric exactly", () => {
    const result = developmentResultDocument();
    const expected = [
      ["R23_RIDGE_R13_ALL_EXISTING_FEATURES_THRESHOLD_0.05", 2370, -0.0964743202769956, 0.7937227280691866, -0.14492170462574794, 0.7071264883228993, -0.0957560819759816, 0.7959015886594664, 0, 4, -250.8901549284351, 16],
      ["R23_RIDGE_R13_ALL_EXISTING_FEATURES_THRESHOLD_0.10", 1585, -0.035123049287018406, 0.9190568928562055, -0.077883423533116, 0.8295632891818023, -0.03280812931572318, 0.9244900060672316, 2, 2, -97.51184572315789, 13],
      ["R23_RIDGE_R13_TREND_CONTEXT_SUBSET_THRESHOLD_0.05", 1239, -0.017349564588412136, 0.957259500570848, -0.048714517205888846, 0.8846956457651155, -0.016044351771110826, 0.9608061237450429, 3, 3, -114.83566158931244, 22],
      ["R23_RIDGE_R13_TREND_CONTEXT_SUBSET_THRESHOLD_0.10", 772, -0.009771032670228014, 0.9754573953140632, -0.03676481177846848, 0.9107248516707187, -0.005877564836617925, 0.9852433704352954, 1, 3, -61.895862086923515, 20],
    ] as const;
    for (const [candidateId, selectedAlerts, meanNetExpectancy, netProfitFactor, costStressMeanNetExpectancy, costStressProfitFactor, latencyStressMeanNetExpectancy, latencyStressProfitFactor, positiveTemporalFolds, catastrophicFolds, maximumDrawdownR, maximumLosingStreak] of expected) {
      const candidate = (result.candidateResults as JsonRecord[]).find((item) => item.candidateConfigurationId === candidateId);
      expect(candidate).toBeDefined();
      const metrics = record(candidate?.metrics);
      expect(metrics).toMatchObject({ selectedAlerts, meanNetExpectancy, netProfitFactor, costStressMeanNetExpectancy, costStressProfitFactor, latencyStressMeanNetExpectancy, latencyStressProfitFactor, positiveTemporalFolds, catastrophicFolds, maximumDrawdownR, maximumLosingStreak });
    }
  });

  it("binds the result document to the post-outcome semantic closure", () => {
    const result = developmentResultDocument();
    expect({
      classification: result.classification,
      finalDecision: result.finalDecision,
      candidateOperationalDisposition: result.candidateOperationalDisposition,
      nextStage: result.nextStage,
      historicalResultsObserved: result.historicalResultsObserved,
      historicalWindowNowSeen: result.historicalWindowNowSeen,
      rerunSameWindowForbidden: result.rerunSameWindowForbidden,
      historicalWindowReuseForAuthoritativeEvaluation: result.historicalWindowReuseForAuthoritativeEvaluation,
      methodologyIssue: result.methodologyIssue,
    }).toEqual(R23_HISTORICAL_RESULT_SEMANTIC_CLOSURE);
  });

  it("freezes the accepted source identities before the single evaluation", () => {
    expect(R23_RUNNER_IDENTITIES).toMatchObject({
      r14ObservationPath: ".cache/tradepulse/round-014/observations.ndjson",
      r14ObservationSha256: R23_DEVELOPMENT_DATA_SHA256,
      r14ObservationBytes: 1893811055,
      r14FreezeCommit: "44d630dd387e75ed9a46713a94f38221fa48ab0f",
    });
  });

  it("keeps governance closed for Production and automated trading", () => {
    expect(R23_GOVERNANCE).toMatchObject({
      performanceAuthorized: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      observationExecuted: false,
      economicValuesRead: false,
      automaticTrading: false,
      humanDecisionRequired: true,
      productionUnchanged: true,
      mainUnchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
    });
  });
});
