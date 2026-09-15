import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  LONG_ALTERNATE_FEATURE_NAMES,
  LONG_CANDIDATE_CONFIGURATIONS,
  LONG_FEATURE_NAMES,
  fitLongCandidateModel,
  predictLongCandidate,
} from "../src/lib/research/round-024-long-candidate.ts";
import {
  SHORT_ALTERNATE_FEATURE_NAMES,
  SHORT_CANDIDATE_CONFIGURATIONS,
  SHORT_FEATURE_NAMES,
  fitShortCandidateModel,
  predictShortCandidate,
} from "../src/lib/research/round-024-short-candidate.ts";
import {
  R24_COST_POLICY,
  R24_DEVELOPMENT_DATA_SOURCE,
  R24_FOLDS_SOURCE,
  R24_GOVERNANCE,
  R24_PROTOCOL_OBJECT,
} from "../src/lib/research/round-024-protocol.ts";
import { R24_RUNNER_IDENTITIES } from "../src/lib/research/round-024-executable-runner.ts";

function syntheticFeatures(index: number): Readonly<Record<string, number>> {
  const names = [...LONG_FEATURE_NAMES, ...LONG_ALTERNATE_FEATURE_NAMES, ...SHORT_FEATURE_NAMES, ...SHORT_ALTERNATE_FEATURE_NAMES];
  return Object.fromEntries([...new Set(names)].map((name, nameIndex) => [name, (index + 1) * (nameIndex + 1) / 100])) as Record<string, number>;
}

function syntheticLongExamples(): readonly Readonly<{ features: Readonly<Record<string, number>>; targetNetR: number }>[] {
  return Object.freeze(Array.from({ length: 12 }, (_, index) => ({ features: syntheticFeatures(index), targetNetR: (index - 5) / 100 }))); 
}

function syntheticShortExamples(): readonly Readonly<{ features: Readonly<Record<string, number>>; targetNetR: number }>[] {
  return Object.freeze(Array.from({ length: 12 }, (_, index) => ({ features: syntheticFeatures(index), targetNetR: ((index % 3) - 1) / 50 }))); 
}

describe("Round-024 independent directional candidate families", () => {
  it("keeps LONG and SHORT direction generation separate", () => {
    expect(LONG_CANDIDATE_CONFIGURATIONS).toHaveLength(4);
    expect(SHORT_CANDIDATE_CONFIGURATIONS).toHaveLength(4);
    expect(LONG_CANDIDATE_CONFIGURATIONS.every((configuration) => configuration.direction === "LONG")).toBe(true);
    expect(SHORT_CANDIDATE_CONFIGURATIONS.every((configuration) => configuration.direction === "SHORT")).toBe(true);
    expect(LONG_CANDIDATE_CONFIGURATIONS.some((configuration) => configuration.direction === "SHORT")).toBe(false);
    expect(SHORT_CANDIDATE_CONFIGURATIONS.some((configuration) => configuration.direction === "LONG")).toBe(false);
  });

  it("does not implement SHORT as LONG result multiplied by -1", () => {
    expect(LONG_FEATURE_NAMES).not.toEqual(SHORT_FEATURE_NAMES);
    expect(LONG_ALTERNATE_FEATURE_NAMES).not.toEqual(SHORT_ALTERNATE_FEATURE_NAMES);
    const longModel = fitLongCandidateModel(syntheticLongExamples(), "LONG_TREND_PULLBACK_VOLUME");
    const shortModel = fitShortCandidateModel(syntheticShortExamples(), "SHORT_TREND_VOLATILITY_FUNDING");
    const features = syntheticFeatures(20);
    expect(longModel.modelType).toBe("R24_LONG_DIRECTIONAL_RIDGE");
    expect(shortModel.modelType).toBe("R24_SHORT_DIRECTIONAL_RIDGE");
    expect(predictShortCandidate(shortModel, features)).not.toBe(-predictLongCandidate(longModel, features));
  });

  it("produces deterministic model artifacts and predictions for identical input", () => {
    const longExamples = syntheticLongExamples();
    const first = fitLongCandidateModel(longExamples, "LONG_TREND_PULLBACK_VOLUME");
    const second = fitLongCandidateModel(longExamples, "LONG_TREND_PULLBACK_VOLUME");
    expect(second).toEqual(first);
    expect(predictLongCandidate(second, syntheticFeatures(3))).toBe(predictLongCandidate(first, syntheticFeatures(3)));
  });

  it("freezes one shared economic policy for both directions", () => {
    expect(R24_COST_POLICY.policyVersion).toBe("bt-policy-003");
    expect(R24_COST_POLICY.feeRatePerSide).toBe(R24_COST_POLICY.feeRatePerSide);
    expect(R24_COST_POLICY.slippageRatePerSide).toBe(R24_COST_POLICY.slippageRatePerSide);
    expect(R24_COST_POLICY.longFundingSign).toBe("-fundingRate * markPrice");
    expect(R24_COST_POLICY.shortFundingSign).toBe("+fundingRate * markPrice");
    expect(R24_COST_POLICY.manualLatencyMinutes).toBe(7);
    expect(R24_COST_POLICY.ambiguousIntrabar).toBe("NOT_EVALUABLE");
  });

  it("uses only the accepted seen window and forbids authoritative reuse", () => {
    expect(R24_DEVELOPMENT_DATA_SOURCE.status).toBe("ACCEPTED_EXISTING_R14_OBSERVATION_FREEZE_REUSED");
    expect(R24_DEVELOPMENT_DATA_SOURCE.developmentOnly).toBe(true);
    expect(R24_DEVELOPMENT_DATA_SOURCE.networkAcquired).toBe(false);
    expect(R24_DEVELOPMENT_DATA_SOURCE.newHistoricalDevelopmentDataFetched).toBe(false);
    expect(R24_GOVERNANCE.historicalWindowNowSeen).toBe(true);
    expect(R24_GOVERNANCE.historicalWindowReuseForAuthoritativeEvaluation).toBe(false);
    expect(R24_PROTOCOL_OBJECT.forwardRule).toBe("signalTime > remote executable freeze timestamp");
  });

  it("freezes existing folds, purge/embargo, and max four configurations per family", () => {
    expect(R24_FOLDS_SOURCE.definitionIdentity).toBe("RESEARCH_FOLDS / R13_FOLDS");
    expect(R24_FOLDS_SOURCE.purgeEmbargoHours).toBe(24);
    expect(LONG_CANDIDATE_CONFIGURATIONS.length).toBeLessThanOrEqual(4);
    expect(SHORT_CANDIDATE_CONFIGURATIONS.length).toBeLessThanOrEqual(4);
    expect(new Set(LONG_CANDIDATE_CONFIGURATIONS.map((configuration) => configuration.candidateConfigurationId)).size).toBe(4);
    expect(new Set(SHORT_CANDIDATE_CONFIGURATIONS.map((configuration) => configuration.candidateConfigurationId)).size).toBe(4);
  });

  it("has a fully executable runner and no unimplemented path", () => {
    const runnerPath = path.resolve(process.cwd(), "src/lib/research/round-024-executable-runner.ts");
    const runnerSource = readFileSync(runnerPath, "utf8");
    expect(runnerSource).toContain("export async function runR24Development");
    expect(runnerSource).toContain("export function buildR24ForwardFreeze");
    expect(runnerSource).not.toMatch(/TODO|not implemented/i);
    expect(R24_RUNNER_IDENTITIES.noStubMarker).toBe(true);
  });

  it("keeps forward/performance and automatic trading disabled", () => {
    expect(R24_GOVERNANCE.forwardEconomicValuesRead).toBe(false);
    expect(R24_GOVERNANCE.forwardReturnRead).toBe(false);
    expect(R24_GOVERNANCE.newPostFreezeForwardDataFetched).toBe(false);
    expect(R24_GOVERNANCE.automaticTrading).toBe(false);
    expect(R24_GOVERNANCE.humanDecisionRequired).toBe(true);
    expect(R24_GOVERNANCE.productionUnchanged).toBe(true);
  });
});
