import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { R13_FEATURE_NAMES, R13_FOLDS } from "@/lib/research/m3-r13-round-013-protocol";
import { R23_BASE_BRANCH, R23_BASE_SHA, R23_BRANCH, R23_CANDIDATE_CONFIGURATIONS, R23_DEVELOPMENT_GATES, R23_DEVELOPMENT_DATA_END_ISO, R23_DEVELOPMENT_DATA_START_ISO, R23_EXISTING_DATA_MANIFEST_PATH, R23_EXISTING_DATA_PATH, R23_FOLDS, R23_FOLD_IDS, R23_FROZEN_COST_MODEL, R23_GOVERNANCE, R23_MODEL_FAMILIES, R23_NO_FORWARD_CANDIDATE, R23_PROTOCOL_OBJECT, R23_PROTOCOL_SCHEMA_VERSION, R23_R15_FIRST_SPEC_COMMIT, R23_R15_RESULT_PUBLICATION_COMMIT, R23_R15_REJECTION_REASON, R23_SELECTION_ALGORITHM, R23_SYMBOLS, R23_THRESHOLD_VALUES, calculateR23CandidateConfigurationCount, isR23ExistingFeatureName, r23FoldDefinitionsEqualFrozenSource } from "@/lib/research/round-023-development-protocol";
import { runR23HistoricalDevelopment } from "@/lib/research/round-023-development-runner";

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected JSON object");
  return value as JsonRecord;
}

function protocolDocument(): JsonRecord {
  return JSON.parse(readFileSync(path.join(process.cwd(), "docs/research/round-023-development-protocol.json"), "utf8")) as JsonRecord;
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
    expect(R23_PROTOCOL_OBJECT.phase).toBe("A0_DEVELOPMENT_PROTOCOL_FREEZE");
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

  it("freezes the historical boundary and existing-cache-only policy", () => {
    const data = record(R23_PROTOCOL_OBJECT.developmentData);
    expect(data.start).toBe(R23_DEVELOPMENT_DATA_START_ISO);
    expect(data.end).toBe(R23_DEVELOPMENT_DATA_END_ISO);
    expect(data.manifestPath).toBe(R23_EXISTING_DATA_MANIFEST_PATH);
    expect(data.observationDataPath).toBe(R23_EXISTING_DATA_PATH);
    expect(data.sourcePolicy).toBe("EXISTING_HISTORICAL_CACHE_ONLY_NO_NETWORK");
    expect(data.networkAcquired).toBe(false);
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
    expect(record(document.developmentData).observationDataPath).toBe(R23_EXISTING_DATA_PATH);
    expect(record(document.searchSpace).candidateConfigurationCount).toBe(4);
    expect(record(document.folds).definitions).toEqual(R23_FOLDS);
    expect(record(document.costModel).implementation).toEqual(R23_FROZEN_COST_MODEL.implementation);
    expect(record(document.governance)).toMatchObject({ performanceExecutionCount: 0, performanceLedgerPresent: false, economicValuesRead: false, newMarketDataFetched: false, automaticTrading: false });
  });

  it("fails closed without existing historical data and does not read economics", () => {
    const result = runR23HistoricalDevelopment({ root: path.join(process.cwd(), ".tmp-r23-missing-data") });
    expect(result.classification).toBe(R23_NO_FORWARD_CANDIDATE);
    expect(result.developmentExecutionCount).toBe(1);
    expect(result.candidateConfigurationsEvaluated).toBe(4);
    expect(result.eligibleCandidates).toEqual([]);
    expect(result.selectedCandidateId).toBeNull();
    expect(result.historicalDevelopmentEconomicValuesRead).toBe(false);
    expect(result.forwardEconomicValuesRead).toBe(false);
    expect(result.forwardReturnRead).toBe(false);
    expect(result.newMarketDataFetched).toBe(false);
    expect(result.performanceExecutionCount).toBe(0);
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
    expect(existsSync(path.join(process.cwd(), ".cache/tradepulse/round-023"))).toBe(false);
  });
});
