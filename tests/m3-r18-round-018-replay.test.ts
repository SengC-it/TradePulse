import { describe, expect, it } from "vitest";

import {
  ROUND_018_ACCEPTED_SOURCE,
  ROUND_018_CANDIDATE_RULE_ID,
  ROUND_018_FORMAL_PREDICATE,
} from "@/lib/research/m3-r18-round-018-protocol";
import {
  classifyR18ReplayEvaluation,
  isCompleteFiniteScoreBreakdown,
  isR18ConsensusCandidate,
  type R18ObservationMetadata,
} from "@/lib/research/m3-r18-round-018-replay";
import type { StrategyCandidate, StrategyEvaluation } from "@/lib/strategy/types";

const SOURCE_SHA = "a".repeat(64);
const metadata: R18ObservationMetadata = {
  observationId: "1704067200000|BTCUSDT|LONG",
  decisionTime: 1704067200000,
  symbol: "BTCUSDT",
  direction: "LONG",
  canonicalIdentityValid: true,
  formalSourceStatus: "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE",
  formalSourcePath: ".cache/tradepulse/round-014/observations.ndjson",
  formalSourceSha256: SOURCE_SHA,
  h4LabelIdentityPresent: true,
  h4LabelStatus: "EXECUTED",
  labelSourceStatus: "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE",
  labelSourcePath: "docs/research/round-014-observation-freeze.json",
  labelSourceSha256: SOURCE_SHA,
  metadataParseValid: true,
};
const context = {
  acceptedSourceProvenanceValid: true,
  acceptedSourceEngineSha256: SOURCE_SHA,
  r14ObservationDataSha256: SOURCE_SHA,
};

function candidate(overrides: Partial<StrategyCandidate> = {}): StrategyCandidate {
  return {
    strategyVersion: "baseline-001",
    symbol: "BTCUSDT",
    direction: "LONG",
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_NEUTRAL",
    entryReference: 100,
    stopReference: 99,
    takeProfitReference: 102,
    stopDistance: 1,
    stopAtr: 1,
    breakdown: {
      trendStrength: 20,
      pullbackQuality: 10,
      breakoutStrength: 10,
      volumeScore: 5,
      riskRewardScore: 5,
    },
    totalScore: 70,
    grade: "C",
    formalSignal: true,
    ...overrides,
  };
}

function evaluation(candidateValue: StrategyCandidate | null, status: StrategyEvaluation["status"] = "FORMAL_SIGNAL"): StrategyEvaluation {
  return {
    strategyVersion: "baseline-001",
    symbol: "BTCUSDT",
    direction: "LONG",
    status,
    reason: null,
    symbolRegime: candidateValue?.symbolRegime ?? null,
    btcRegime: candidateValue?.btcRegime ?? "BTC_NEUTRAL",
    candidate: candidateValue,
  };
}

describe("Round-018 exact baseline replay", () => {
  it("freezes the exact accepted formal predicate and source", () => {
    expect(ROUND_018_FORMAL_PREDICATE).toBe("candidate?.formalSignal && candidate.totalScore >= 70");
    expect(ROUND_018_ACCEPTED_SOURCE).toBe("feec11151b334a14754b1f720972c6e2b198960a");
    expect(ROUND_018_CANDIDATE_RULE_ID).toBe("ALL_FIVE_EXISTING_SCORE_COMPONENTS_STRICTLY_POSITIVE");
  });

  it("partitions no-candidate and non-formal evaluations before formal filtering", () => {
    expect(classifyR18ReplayEvaluation(metadata, evaluation(null, "NO_ELIGIBLE_CANDIDATE"), context).status).toBe("NO_BASELINE_CANDIDATE");
    expect(classifyR18ReplayEvaluation(metadata, evaluation(candidate({ formalSignal: false, totalScore: 60 }), "CANDIDATE_BELOW_THRESHOLD"), context).status).toBe("BASELINE_CANDIDATE_NON_FORMAL");
  });

  it("requires a complete finite five-component breakdown for formal rows", () => {
    const result = classifyR18ReplayEvaluation(metadata, evaluation(candidate()), context);
    expect(result.status).toBe("BASELINE_FORMAL");
    expect(result.formalPredicatePassed).toBe(true);
    expect(isCompleteFiniteScoreBreakdown(result.candidate?.breakdown)).toBe(true);

    const incomplete = candidate({ breakdown: { trendStrength: 20, pullbackQuality: Number.NaN, breakoutStrength: 10, volumeScore: 5, riskRewardScore: 5 } });
    expect(classifyR18ReplayEvaluation(metadata, evaluation(incomplete), context).status).toBe("PROVENANCE_INCOMPLETE");
  });

  it("uses the one frozen all-five-components strict-positive candidate rule", () => {
    expect(isR18ConsensusCandidate(candidate())).toBe(true);
    expect(isR18ConsensusCandidate(candidate({ breakdown: { trendStrength: 20, pullbackQuality: 0, breakoutStrength: 10, volumeScore: 5, riskRewardScore: 5 } }))).toBe(false);
    expect(isR18ConsensusCandidate(candidate({ breakdown: { trendStrength: 20, pullbackQuality: 10, breakoutStrength: 10, volumeScore: 5, riskRewardScore: -0.0001 } }))).toBe(false);
  });

  it("fails closed when accepted provenance or canonical identity is incomplete", () => {
    expect(classifyR18ReplayEvaluation(metadata, evaluation(candidate()), { ...context, acceptedSourceProvenanceValid: false }).status).toBe("PROVENANCE_INCOMPLETE");
    expect(classifyR18ReplayEvaluation({ ...metadata, canonicalIdentityValid: false }, evaluation(candidate()), context).status).toBe("PROVENANCE_INCOMPLETE");
    expect(classifyR18ReplayEvaluation({ ...metadata, h4LabelIdentityPresent: false }, evaluation(candidate()), context).status).toBe("PROVENANCE_INCOMPLETE");
  });
});
