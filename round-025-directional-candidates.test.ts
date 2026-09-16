import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  R25_DEVELOPMENT_GATES,
  R25_DEVELOPMENT_DATA_SOURCE,
  R25_BASE_SHA,
  R25_BRANCH,
  R25_FOLD_IDS,
  R25_PROTOCOL_OBJECT,
  R25_SYMBOLS,
} from "../src/lib/research/round-025-protocol.ts";
import {
  fitR25CandidateModel,
  predictR25Candidate,
  R25_LONG_CANDIDATE_CONFIGURATIONS,
  R25_SHORT_CANDIDATE_CONFIGURATIONS,
} from "../src/lib/research/round-025-candidate-model.ts";

const configurations = [...R25_LONG_CANDIDATE_CONFIGURATIONS, ...R25_SHORT_CANDIDATE_CONFIGURATIONS];

describe("Round-025 bounded directional redesign contract", () => {
  it("freezes the accepted base, bounded space, and DEVELOPMENT_ONLY window", () => {
    expect(R25_BASE_SHA).toBe("1b1bbb8de0fa38969865b62cee64b015a8b42027");
    expect(R25_BRANCH).toBe("research/round-025-targeted-directional-redesign");
    expect(R25_PROTOCOL_OBJECT.developmentWindow.classification).toBe("DEVELOPMENT_ONLY");
    expect(R25_PROTOCOL_OBJECT.searchSpace).toEqual({
      maximumLongConfigurations: 3,
      maximumShortConfigurations: 3,
      maximumTotalConfigurations: 6,
      completeEvaluationExecutionCount: 1,
    });
    expect(configurations).toHaveLength(6);
    expect(R25_LONG_CANDIDATE_CONFIGURATIONS).toHaveLength(3);
    expect(R25_SHORT_CANDIDATE_CONFIGURATIONS).toHaveLength(3);
  });

  it("uses only pre-frozen family-local configurations and deterministic PIT normalization", () => {
    expect(new Set(configurations.map((configuration) => configuration.candidateConfigurationId)).size).toBe(6);
    expect(configurations.every((configuration) => configuration.horizonHours === 4)).toBe(true);
    expect(configurations.every((configuration) => configuration.regimeGate === null)).toBe(true);
    expect(configurations.every((configuration) => configuration.selectionPolicy === "INDEPENDENT_TOP_ONE_PER_DECISION_TIME")).toBe(true);
    expect(configurations.every((configuration) => configuration.normalization === "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME")).toBe(true);
    expect(configurations.some((configuration) => configuration.candidateConfigurationId.includes("R24_"))).toBe(false);
    expect(R25_PROTOCOL_OBJECT.noForwardReuse).toBe(true);
  });

  it("freezes the shared folds, symbols, source identity, and gates", () => {
    expect(R25_FOLD_IDS).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(R25_SYMBOLS).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]);
    expect(R25_DEVELOPMENT_DATA_SOURCE).toMatchObject({
      status: "ACCEPTED_EXISTING_R14_OBSERVATION_FREEZE_REUSED",
      observationCount: 244810,
      networkAcquired: false,
      newHistoricalDevelopmentDataFetched: false,
      developmentOnly: true,
    });
    expect(R25_DEVELOPMENT_GATES).toEqual({
      minimumSelectedAlerts: 50,
      minimumDistinctUtcDecisionDates: 10,
      minimumMeanNetExpectancy: 0,
      minimumNetProfitFactor: 1,
      minimumPositiveTemporalFolds: 4,
      maximumCatastrophicFolds: 0,
      catastrophicFoldThreshold: -0.1,
      minimumCostStressMeanNetExpectancy: 0,
      minimumLatencyMeanNetExpectancy: 0,
      maximumPositiveSymbolContributionShare: 0.5,
    });
  });

  it("makes the ridge model deterministic and keeps regularization predeclared", () => {
    const config = R25_LONG_CANDIDATE_CONFIGURATIONS[0]!;
    const examples = Array.from({ length: 8 }, (_, index) => ({
      features: Object.fromEntries(config.featureNames.map((name, featureIndex) => [name, index * (featureIndex + 1) + (featureIndex % 2)])),
      targetNetR: index - 3.5,
    }));
    const first = fitR25CandidateModel(examples, config);
    const second = fitR25CandidateModel(examples, config);
    expect(first).toEqual(second);
    expect(predictR25Candidate(first, examples[3]!.features)).toBe(predictR25Candidate(second, examples[3]!.features));
    expect(new Set(configurations.map((configuration) => configuration.lambda))).toEqual(new Set([10, 30, 100]));
  });

  it("does not authorize forward proof or performance execution in the protocol", () => {
    expect(R25_PROTOCOL_OBJECT.governance.forwardEconomicValuesRead).toBe(false);
    expect(R25_PROTOCOL_OBJECT.governance.forwardReturnRead).toBe(false);
    expect(R25_PROTOCOL_OBJECT.governance.forwardValidationAuthorized).toBe(false);
    expect(R25_PROTOCOL_OBJECT.governance.performanceExecutionCount).toBe(0);
    expect(R25_PROTOCOL_OBJECT.governance.performanceLedgerPresent).toBe(false);
    expect(R25_PROTOCOL_OBJECT.governance.automaticTrading).toBe(false);
    expect(R25_PROTOCOL_OBJECT.governance.humanDecisionRequired).toBe(true);
  });

  it("records the single completed development evaluation without creating a forward candidate", () => {
    const result = JSON.parse(readFileSync("docs/research/round-025-directional-development-result.json", "utf8")) as {
      candidateConfigurationsDefined: number;
      candidateConfigurationsEvaluated: number;
      candidateResults: readonly unknown[];
      developmentEconomicEvaluationExecutionCount: number;
      developmentClassification: string;
      longChampionId: string | null;
      shortChampionId: string | null;
      candidateExecutableFrozen: boolean;
      forwardCandidateExists: boolean;
      forwardValidationAuthorized: boolean;
      executableFreezeSHA: string | null;
      forwardEconomicValuesRead: boolean;
      forwardReturnRead: boolean;
      performanceExecutionCount: number;
      performanceLedgerPresent: boolean;
      newHistoricalDevelopmentDataFetched: boolean;
      newPostFreezeForwardDataFetched: boolean;
      developmentDataSource: Readonly<{
        sourcePath: string;
        networkAcquired: boolean;
        observationCount: number;
      }>;
    };
    expect(result.candidateConfigurationsDefined).toBe(6);
    expect(result.candidateConfigurationsEvaluated).toBe(6);
    expect(result.candidateResults).toHaveLength(6);
    expect(result.developmentEconomicEvaluationExecutionCount).toBe(1);
    expect(result.developmentClassification).toBe("NO_DEVELOPMENT_CHAMPION");
    expect(result.longChampionId).toBeNull();
    expect(result.shortChampionId).toBeNull();
    expect(result.candidateExecutableFrozen).toBe(false);
    expect(result.forwardCandidateExists).toBe(false);
    expect(result.forwardValidationAuthorized).toBe(false);
    expect(result.executableFreezeSHA).toBeNull();
    expect(result.forwardEconomicValuesRead).toBe(false);
    expect(result.forwardReturnRead).toBe(false);
    expect(result.performanceExecutionCount).toBe(0);
    expect(result.performanceLedgerPresent).toBe(false);
    expect(result.newHistoricalDevelopmentDataFetched).toBe(false);
    expect(result.newPostFreezeForwardDataFetched).toBe(false);
    expect(result.developmentDataSource.sourcePath).toBe(".cache/tradepulse/round-014/observations.ndjson");
    expect(result.developmentDataSource.networkAcquired).toBe(false);
    expect(result.developmentDataSource.observationCount).toBe(244810);
  });
});
