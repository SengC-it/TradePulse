import { createHash } from "node:crypto";

import { R16_GATE_THRESHOLDS, R16_ARTIFACT_HASH_METHOD } from "./m3-r16-round-016-protocol.ts";
import { stableStringify } from "./utils.ts";

export type R16GateResult = Readonly<{ gateId: `D${number}`; passed: boolean; observed: unknown; requirement: string }>;
export type R16GateInput = Readonly<{
  pooledCoverage: number;
  validationFoldCoverages: readonly number[];
  trainingFoldCoverages: readonly number[];
  microBetaPooledPearson: number | null;
  deltaBetaPooledPearson: number | null;
  microBetaPositivePearsonFolds: number;
  betaImprovementFolds: number;
  microBetaFoldPearsons: readonly (number | null)[];
  microAlphaMeanTimestampSpearman: number | null;
  deltaAlphaMeanTimestampSpearman: number | null;
  microAlphaPositiveSpearmanFolds: number;
  alphaImprovementFolds: number;
  microAlphaFoldSpearmans: readonly (number | null)[];
  microAlphaTopBottomSpread: number | null;
  deltaAlphaTopBottomSpread: number | null;
  microAlphaPositiveSpreadFolds: number;
  evidenceComplete: boolean;
  provenanceComplete: boolean;
}>;

function atLeast(value: number | null, threshold: number): boolean { return value !== null && Number.isFinite(value) && value >= threshold; }
function gate(gateId: `D${number}`, passed: boolean, observed: unknown, requirement: string): R16GateResult { return Object.freeze({ gateId, passed, observed, requirement }); }

export function evaluateR16Gates(input: R16GateInput): Readonly<{ eligibility: "ELIGIBLE" | "INELIGIBLE"; gateResults: readonly R16GateResult[]; failedGateIds: readonly string[] }> {
  const gates = [
    gate("D1", input.pooledCoverage >= R16_GATE_THRESHOLDS.minimumCommonMaskCoverage && input.validationFoldCoverages.every((value) => value >= R16_GATE_THRESHOLDS.minimumValidationFoldCoverage) && input.trainingFoldCoverages.every((value) => value >= R16_GATE_THRESHOLDS.minimumTrainingFoldCoverage), { pooledCoverage: input.pooledCoverage, validationFoldCoverages: input.validationFoldCoverages, trainingFoldCoverages: input.trainingFoldCoverages }, "pooled >=90%; every validation fold >=85%; every training fold >=85%"),
    gate("D2", atLeast(input.microBetaPooledPearson, R16_GATE_THRESHOLDS.minimumMicroBetaPooledPearson), input.microBetaPooledPearson, "MICRO pooled Beta Pearson >= +0.08"),
    gate("D3", atLeast(input.deltaBetaPooledPearson, R16_GATE_THRESHOLDS.minimumMicroMinusControlBetaPooledPearson), input.deltaBetaPooledPearson, "MICRO - CONTROL pooled Beta Pearson >= +0.02"),
    gate("D4", input.microBetaPositivePearsonFolds >= 5, input.microBetaPositivePearsonFolds, "MICRO Beta Pearson >0 in >=5/6 folds"),
    gate("D5", input.betaImprovementFolds >= 4, input.betaImprovementFolds, "MICRO Pearson - CONTROL Pearson >= +0.01 in >=4/6 folds"),
    gate("D6", input.microBetaFoldPearsons.every((value) => value === null || value > -0.02), input.microBetaFoldPearsons, "no MICRO fold Pearson <= -0.02"),
    gate("D7", atLeast(input.microAlphaMeanTimestampSpearman, R16_GATE_THRESHOLDS.minimumMicroAlphaMeanTimestampSpearman), input.microAlphaMeanTimestampSpearman, "MICRO mean timestamp Spearman >= +0.05"),
    gate("D8", atLeast(input.deltaAlphaMeanTimestampSpearman, R16_GATE_THRESHOLDS.minimumMicroMinusControlAlphaMeanTimestampSpearman), input.deltaAlphaMeanTimestampSpearman, "MICRO - CONTROL mean timestamp Spearman >= +0.015"),
    gate("D9", input.microAlphaPositiveSpearmanFolds >= 5, input.microAlphaPositiveSpearmanFolds, "MICRO mean timestamp Spearman >0 in >=5/6 folds"),
    gate("D10", input.alphaImprovementFolds >= 4, input.alphaImprovementFolds, "MICRO - CONTROL fold mean timestamp Spearman >= +0.01 in >=4/6 folds"),
    gate("D11", atLeast(input.microAlphaTopBottomSpread, R16_GATE_THRESHOLDS.minimumMicroAlphaTopBottomSpread), input.microAlphaTopBottomSpread, "MICRO top-bottom realized relativeAlpha spread >= +0.15 ATR"),
    gate("D12", atLeast(input.deltaAlphaTopBottomSpread, R16_GATE_THRESHOLDS.minimumMicroMinusControlAlphaSpread), input.deltaAlphaTopBottomSpread, "MICRO spread - CONTROL spread >= +0.04 ATR"),
    gate("D13", input.microAlphaPositiveSpreadFolds >= 5, input.microAlphaPositiveSpreadFolds, "MICRO spread >0 in >=5/6 folds"),
    gate("D14", input.microAlphaFoldSpearmans.every((value) => value === null || value > -0.02), input.microAlphaFoldSpearmans, "no MICRO fold mean timestamp Spearman <= -0.02"),
    gate("D15", input.evidenceComplete, input.evidenceComplete, "evidence COMPLETE"),
    gate("D16", input.provenanceComplete, input.provenanceComplete, "model provenance COMPLETE"),
  ] as const;
  const failedGateIds = gates.filter((value) => !value.passed).map((value) => value.gateId);
  return Object.freeze({ eligibility: failedGateIds.length === 0 ? "ELIGIBLE" : "INELIGIBLE", gateResults: Object.freeze(gates), failedGateIds: Object.freeze(failedGateIds) });
}

export const R16_GATE_CANONICAL_JSON = stableStringify({ hashMethod: R16_ARTIFACT_HASH_METHOD, thresholds: R16_GATE_THRESHOLDS, gates: ["D1", "D2", "D3", "D4", "D5", "D6", "D7", "D8", "D9", "D10", "D11", "D12", "D13", "D14", "D15", "D16"] });
export const R16_GATE_SHA256 = createHash("sha256").update(R16_GATE_CANONICAL_JSON, "utf8").digest("hex");
