import { createHash } from "node:crypto";

import { R15_GATE_THRESHOLDS, R15_RIDGE_LAMBDA, R15_SPEC_SHA256 } from "./m3-r15-round-015-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R15_GATE_SCHEMA_VERSION = "m3-r15-round-015-gates-001" as const;

export const R15_GATE_MACHINE_RECORD = Object.freeze({
  schemaVersion: R15_GATE_SCHEMA_VERSION,
  semantics: "ALL_CONJUNCTIVE_NO_BEST_AVAILABLE_CANDIDATE",
  thresholds: R15_GATE_THRESHOLDS,
  modelLambda: R15_RIDGE_LAMBDA,
  specSha256: R15_SPEC_SHA256,
  gates: [
    "G1_SELECTED_AGGREGATE_MINIMUM",
    "G2_SELECTED_EVERY_FOLD_MINIMUM",
    "G3_MEAN_REALIZED_NET_FORWARD_ATR",
    "G4_ATR_PROFIT_FACTOR",
    "G5_POSITIVE_REALIZED_EDGE_FOLDS",
    "G6_CATASTROPHIC_FOLDS",
    "G7_BETA_POOLED_CORRELATION",
    "G8_BETA_POSITIVE_CORRELATION_FOLDS",
    "G9_ALPHA_POSITIVE_CORRELATION_FOLDS",
    "G10_ALPHA_POOLED_SPEARMAN",
    "G11_ALPHA_TOP_BOTTOM_SPREAD",
    "G12_ALPHA_POSITIVE_SPREAD_FOLDS",
    "G13_COST_STRESS",
    "G14_LATENCY_STRESS",
    "G15_POSITIVE_SYMBOL_CONTRIBUTION",
    "G16_SINGLE_POSITIVE_OBSERVATION_CONTRIBUTION",
    "G17_EVIDENCE_INTEGRITY",
    "G18_MODEL_PROVENANCE",
  ] as const,
});

export const R15_GATE_SHA256 = createHash("sha256").update(stableStringify(R15_GATE_MACHINE_RECORD), "utf8").digest("hex");

export type R15GateResult = Readonly<{
  gateId: string;
  passed: boolean;
  observed: unknown;
  requirement: string;
}>;

export type R15GateInput = Readonly<{
  selectedCount: number;
  selectedByFold: Readonly<Record<string, number>>;
  meanNetForwardAtr: number | null;
  profitFactor: number | null;
  positiveFolds: number;
  catastrophicFolds: number;
  betaPooledPearson: number | null;
  betaPositiveCorrelationFolds: number;
  alphaPositiveCorrelationFolds: number;
  alphaPooledSpearman: number | null;
  alphaTopBottomSpread: number | null;
  alphaPositiveSpreadFolds: number;
  costStressMean: number | null;
  costStressProfitFactor: number | null;
  latencyStressMean: number | null;
  maximumPositiveSymbolContributionShare: number | null;
  maximumSinglePositiveObservationContribution: number | null;
  evidenceIntegrity: boolean;
  modelProvenanceComplete: boolean;
}>;

function result(gateId: string, passed: boolean, observed: unknown, requirement: string): R15GateResult {
  return Object.freeze({ gateId, passed, observed, requirement });
}

export function evaluateR15Gates(input: R15GateInput): Readonly<{ eligibility: "ELIGIBLE" | "INELIGIBLE"; gateResults: readonly R15GateResult[]; failedGateIds: readonly string[] }> {
  const everyFoldMinimum = Object.values(input.selectedByFold).every((count) => count >= R15_GATE_THRESHOLDS.minimumSelectedValidationObservationsPerFold);
  const gates = [
    result("G1_SELECTED_AGGREGATE_MINIMUM", input.selectedCount >= R15_GATE_THRESHOLDS.minimumSelectedValidationObservationsAggregate, input.selectedCount, `>= ${R15_GATE_THRESHOLDS.minimumSelectedValidationObservationsAggregate}`),
    result("G2_SELECTED_EVERY_FOLD_MINIMUM", everyFoldMinimum, input.selectedByFold, `every fold >= ${R15_GATE_THRESHOLDS.minimumSelectedValidationObservationsPerFold}`),
    result("G3_MEAN_REALIZED_NET_FORWARD_ATR", input.meanNetForwardAtr !== null && input.meanNetForwardAtr >= R15_GATE_THRESHOLDS.minimumMeanNetForwardAtr, input.meanNetForwardAtr, `>= ${R15_GATE_THRESHOLDS.minimumMeanNetForwardAtr}`),
    result("G4_ATR_PROFIT_FACTOR", input.profitFactor !== null && input.profitFactor >= R15_GATE_THRESHOLDS.minimumProfitFactor, input.profitFactor, `>= ${R15_GATE_THRESHOLDS.minimumProfitFactor}`),
    result("G5_POSITIVE_REALIZED_EDGE_FOLDS", input.positiveFolds >= R15_GATE_THRESHOLDS.minimumPositiveFolds, input.positiveFolds, `>= ${R15_GATE_THRESHOLDS.minimumPositiveFolds}/6`),
    result("G6_CATASTROPHIC_FOLDS", input.catastrophicFolds <= R15_GATE_THRESHOLDS.maximumCatastrophicFolds, input.catastrophicFolds, `<= ${R15_GATE_THRESHOLDS.maximumCatastrophicFolds}`),
    result("G7_BETA_POOLED_CORRELATION", input.betaPooledPearson !== null && input.betaPooledPearson > 0, input.betaPooledPearson, "> 0"),
    result("G8_BETA_POSITIVE_CORRELATION_FOLDS", input.betaPositiveCorrelationFolds >= R15_GATE_THRESHOLDS.minimumBetaPositiveCorrelationFolds, input.betaPositiveCorrelationFolds, `>= ${R15_GATE_THRESHOLDS.minimumBetaPositiveCorrelationFolds}/6`),
    result("G9_ALPHA_POSITIVE_CORRELATION_FOLDS", input.alphaPositiveCorrelationFolds >= R15_GATE_THRESHOLDS.minimumAlphaPositiveCorrelationFolds, input.alphaPositiveCorrelationFolds, `>= ${R15_GATE_THRESHOLDS.minimumAlphaPositiveCorrelationFolds}/6`),
    result("G10_ALPHA_POOLED_SPEARMAN", input.alphaPooledSpearman !== null && input.alphaPooledSpearman >= R15_GATE_THRESHOLDS.minimumPooledAlphaSpearman, input.alphaPooledSpearman, `>= ${R15_GATE_THRESHOLDS.minimumPooledAlphaSpearman}`),
    result("G11_ALPHA_TOP_BOTTOM_SPREAD", input.alphaTopBottomSpread !== null && input.alphaTopBottomSpread >= R15_GATE_THRESHOLDS.minimumAlphaTopBottomSpread, input.alphaTopBottomSpread, `>= ${R15_GATE_THRESHOLDS.minimumAlphaTopBottomSpread}`),
    result("G12_ALPHA_POSITIVE_SPREAD_FOLDS", input.alphaPositiveSpreadFolds >= R15_GATE_THRESHOLDS.minimumAlphaPositiveSpreadFolds, input.alphaPositiveSpreadFolds, `>= ${R15_GATE_THRESHOLDS.minimumAlphaPositiveSpreadFolds}/6`),
    result("G13_COST_STRESS", input.costStressMean !== null && input.costStressMean > R15_GATE_THRESHOLDS.minimumCostStressMean && input.costStressProfitFactor !== null && input.costStressProfitFactor > R15_GATE_THRESHOLDS.minimumCostStressProfitFactor, { mean: input.costStressMean, profitFactor: input.costStressProfitFactor }, `mean > ${R15_GATE_THRESHOLDS.minimumCostStressMean} and PF > ${R15_GATE_THRESHOLDS.minimumCostStressProfitFactor}`),
    result("G14_LATENCY_STRESS", input.latencyStressMean !== null && input.latencyStressMean > R15_GATE_THRESHOLDS.minimumLatencyStressMean, input.latencyStressMean, `> ${R15_GATE_THRESHOLDS.minimumLatencyStressMean}`),
    result("G15_POSITIVE_SYMBOL_CONTRIBUTION", input.maximumPositiveSymbolContributionShare !== null && input.maximumPositiveSymbolContributionShare <= R15_GATE_THRESHOLDS.maximumPositiveSymbolContributionShare, input.maximumPositiveSymbolContributionShare, `<= ${R15_GATE_THRESHOLDS.maximumPositiveSymbolContributionShare}`),
    result("G16_SINGLE_POSITIVE_OBSERVATION_CONTRIBUTION", input.maximumSinglePositiveObservationContribution !== null && input.maximumSinglePositiveObservationContribution <= R15_GATE_THRESHOLDS.maximumSinglePositiveObservationContribution, input.maximumSinglePositiveObservationContribution, `<= ${R15_GATE_THRESHOLDS.maximumSinglePositiveObservationContribution}`),
    result("G17_EVIDENCE_INTEGRITY", input.evidenceIntegrity, input.evidenceIntegrity, "COMPLETE"),
    result("G18_MODEL_PROVENANCE", input.modelProvenanceComplete, input.modelProvenanceComplete, "COMPLETE"),
  ] as const;
  const failedGateIds = gates.filter((gate) => !gate.passed).map((gate) => gate.gateId);
  return Object.freeze({ eligibility: failedGateIds.length === 0 ? "ELIGIBLE" : "INELIGIBLE", gateResults: Object.freeze(gates), failedGateIds: Object.freeze(failedGateIds) });
}
