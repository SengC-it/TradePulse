import { createHash } from "node:crypto";

import type { ResearchFoldId } from "./constants.ts";
import { R13_FOLD_IDS, R13_GATE_THRESHOLDS, R13_HORIZON_HOURS, M3_R13_NO_EDGE_OUTCOME, type R13HorizonHours } from "./m3-r13-round-013-protocol.ts";
import { deepFreeze, stableStringify } from "./utils.ts";

export const R13_HARD_GATE_IDENTITIES = Object.freeze([
  "minimumSelectedValidationObservationsAggregate",
  "minimumSelectedValidationObservationsPerFold",
  "minimumMeanNetForwardAtr",
  "minimumAtrProfitFactor",
  "minimumPositiveMeanEdgeFolds",
  "maximumCatastrophicFolds",
  "minimumPositiveSpearmanFolds",
  "minimumPooledSpearman",
  "minimumTopBottomDecileSpread",
  "minimumPositiveSpreadFolds",
  "costStressMeanAndProfitFactor",
  "latencyStressMean",
  "maximumPositiveSymbolContributionShare",
  "maximumSinglePositiveObservationContribution",
  "evidenceIntegrity",
  "modelProvenance",
] as const);
export type R13GateId = (typeof R13_HARD_GATE_IDENTITIES)[number];

export type R13HorizonGateInput = Readonly<{
  horizonHours: R13HorizonHours;
  selectedValidationObservationsAggregate: number;
  selectedValidationObservationsByFold: Readonly<Record<ResearchFoldId, number>>;
  meanNetForwardAtr: number;
  atrProfitFactor: number | null;
  positiveMeanEdgeFolds: number;
  catastrophicFolds: number;
  positiveSpearmanFolds: number;
  pooledSpearman: number | null;
  topBottomDecileSpread: number | null;
  positiveSpreadFolds: number;
  costStressMean: number;
  costStressProfitFactor: number | null;
  latencyStressMean: number;
  maximumPositiveSymbolContributionShare: number | null;
  maximumSinglePositiveObservationContribution: number | null;
  evidenceIntegrity: boolean;
  modelProvenance: boolean;
}>;

export type R13GateResult = Readonly<{
  gateId: R13GateId;
  passed: boolean;
  actualValue: number | boolean | null;
  requirement: string;
}>;

export type R13HorizonGateEvaluation = Readonly<{
  horizonHours: R13HorizonHours;
  gateResults: readonly R13GateResult[];
  failedGateIds: readonly R13GateId[];
  eligibility: "ELIGIBLE" | "INELIGIBLE";
}>;

export const R13_GATE_MACHINE_RECORD = deepFreeze({
  schemaVersion: "m3-r13-round-013-discovery-gates-001",
  researchRoundId: "baseline-002-research-round-013",
  sourceBoundary: "2026-08-15T23:59:59.999Z",
  gateIdentities: R13_HARD_GATE_IDENTITIES,
  thresholds: R13_GATE_THRESHOLDS,
  semantics: "ALL_SIXTEEN_GATES_CONJUNCTIVE;NO_BEST_AVAILABLE_PROMOTION",
  definitions: {
    catastrophicFold: "fold mean netForwardAtr <= -0.10",
    positiveFold: "fold mean netForwardAtr > 0",
    positiveSpearmanFold: "fold Spearman rank correlation > 0",
    positiveSpreadFold: "fold top-decile-minus-bottom-decile spread > 0",
    maximumSinglePositiveContribution: "largest positive observation netForwardAtr / total positive netForwardAtr",
  },
});

export const R13_SELECTION_GATE_SHA256 = createHash("sha256").update(stableStringify(R13_GATE_MACHINE_RECORD), "utf8").digest("hex");

function atLeast(value: number | null, threshold: number): boolean {
  return value !== null && Number.isFinite(value) && value >= threshold;
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

export function evaluateR13HorizonGates(input: R13HorizonGateInput): R13HorizonGateEvaluation {
  if (!R13_HORIZON_HOURS.includes(input.horizonHours) || !R13_FOLD_IDS.every((foldId) => Number.isFinite(input.selectedValidationObservationsByFold[foldId]))) throw new Error("R13 gate input has an invalid horizon or fold counts.");
  const minimumPerFold = R13_FOLD_IDS.every((foldId) => input.selectedValidationObservationsByFold[foldId] >= R13_GATE_THRESHOLDS.minimumSelectedValidationObservationsPerFold);
  const gateResults: readonly R13GateResult[] = [
    { gateId: "minimumSelectedValidationObservationsAggregate", passed: input.selectedValidationObservationsAggregate >= R13_GATE_THRESHOLDS.minimumSelectedValidationObservationsAggregate, actualValue: input.selectedValidationObservationsAggregate, requirement: `>= ${R13_GATE_THRESHOLDS.minimumSelectedValidationObservationsAggregate}` },
    { gateId: "minimumSelectedValidationObservationsPerFold", passed: minimumPerFold, actualValue: Math.min(...R13_FOLD_IDS.map((foldId) => input.selectedValidationObservationsByFold[foldId])), requirement: `every fold >= ${R13_GATE_THRESHOLDS.minimumSelectedValidationObservationsPerFold}` },
    { gateId: "minimumMeanNetForwardAtr", passed: input.meanNetForwardAtr >= R13_GATE_THRESHOLDS.minimumMeanNetForwardAtr, actualValue: input.meanNetForwardAtr, requirement: `>= ${R13_GATE_THRESHOLDS.minimumMeanNetForwardAtr}` },
    { gateId: "minimumAtrProfitFactor", passed: atLeast(input.atrProfitFactor, R13_GATE_THRESHOLDS.minimumProfitFactor), actualValue: input.atrProfitFactor, requirement: `>= ${R13_GATE_THRESHOLDS.minimumProfitFactor}` },
    { gateId: "minimumPositiveMeanEdgeFolds", passed: input.positiveMeanEdgeFolds >= R13_GATE_THRESHOLDS.minimumPositiveFolds, actualValue: input.positiveMeanEdgeFolds, requirement: `>= ${R13_GATE_THRESHOLDS.minimumPositiveFolds}` },
    { gateId: "maximumCatastrophicFolds", passed: input.catastrophicFolds <= R13_GATE_THRESHOLDS.maximumCatastrophicFolds, actualValue: input.catastrophicFolds, requirement: `<= ${R13_GATE_THRESHOLDS.maximumCatastrophicFolds}` },
    { gateId: "minimumPositiveSpearmanFolds", passed: input.positiveSpearmanFolds >= R13_GATE_THRESHOLDS.minimumPositiveSpearmanFolds, actualValue: input.positiveSpearmanFolds, requirement: `>= ${R13_GATE_THRESHOLDS.minimumPositiveSpearmanFolds}` },
    { gateId: "minimumPooledSpearman", passed: atLeast(input.pooledSpearman, R13_GATE_THRESHOLDS.minimumPooledSpearman), actualValue: input.pooledSpearman, requirement: `>= ${R13_GATE_THRESHOLDS.minimumPooledSpearman}` },
    { gateId: "minimumTopBottomDecileSpread", passed: atLeast(input.topBottomDecileSpread, R13_GATE_THRESHOLDS.minimumTopBottomDecileSpread), actualValue: input.topBottomDecileSpread, requirement: `>= ${R13_GATE_THRESHOLDS.minimumTopBottomDecileSpread}` },
    { gateId: "minimumPositiveSpreadFolds", passed: input.positiveSpreadFolds >= R13_GATE_THRESHOLDS.minimumPositiveSpreadFolds, actualValue: input.positiveSpreadFolds, requirement: `>= ${R13_GATE_THRESHOLDS.minimumPositiveSpreadFolds}` },
    { gateId: "costStressMeanAndProfitFactor", passed: input.costStressMean > R13_GATE_THRESHOLDS.minimumCostStressMean && atLeast(input.costStressProfitFactor, R13_GATE_THRESHOLDS.minimumCostStressProfitFactor), actualValue: input.costStressProfitFactor, requirement: `mean > ${R13_GATE_THRESHOLDS.minimumCostStressMean} and PF >= ${R13_GATE_THRESHOLDS.minimumCostStressProfitFactor}` },
    { gateId: "latencyStressMean", passed: input.latencyStressMean > R13_GATE_THRESHOLDS.minimumLatencyStressMean, actualValue: input.latencyStressMean, requirement: `> ${R13_GATE_THRESHOLDS.minimumLatencyStressMean}` },
    { gateId: "maximumPositiveSymbolContributionShare", passed: input.maximumPositiveSymbolContributionShare !== null && input.maximumPositiveSymbolContributionShare <= R13_GATE_THRESHOLDS.maximumPositiveContributionSymbolShare, actualValue: input.maximumPositiveSymbolContributionShare, requirement: `<= ${R13_GATE_THRESHOLDS.maximumPositiveContributionSymbolShare}` },
    { gateId: "maximumSinglePositiveObservationContribution", passed: input.maximumSinglePositiveObservationContribution !== null && input.maximumSinglePositiveObservationContribution <= R13_GATE_THRESHOLDS.maximumSinglePositiveObservationContribution, actualValue: input.maximumSinglePositiveObservationContribution, requirement: `<= ${R13_GATE_THRESHOLDS.maximumSinglePositiveObservationContribution}` },
    { gateId: "evidenceIntegrity", passed: input.evidenceIntegrity === true, actualValue: input.evidenceIntegrity, requirement: "COMPLETE" },
    { gateId: "modelProvenance", passed: input.modelProvenance === true, actualValue: input.modelProvenance, requirement: "COMPLETE" },
  ];
  const failedGateIds = gateResults.filter((gate) => !gate.passed).map((gate) => gate.gateId);
  return Object.freeze({ horizonHours: input.horizonHours, gateResults: Object.freeze(gateResults), failedGateIds: Object.freeze(failedGateIds), eligibility: failedGateIds.length === 0 ? "ELIGIBLE" : "INELIGIBLE" });
}

export type R13HorizonSelectionCandidate = Readonly<{
  horizonHours: R13HorizonHours;
  eligible: boolean;
  meanNetForwardAtr: number;
  costStressMean: number;
  maximumDrawdownAtr: number;
  atrProfitFactor: number;
}>;

export type R13HorizonSelection = Readonly<{
  eligibleDiscoveryHorizons: readonly R13HorizonHours[];
  selectedDiscoveryHorizon: R13HorizonHours | null;
  selectionAlgorithmApplied: boolean;
  finalDecision: typeof M3_R13_NO_EDGE_OUTCOME | "FORWARD EDGE DISCOVERED — ROUND-013";
}>;

function compareCandidates(left: R13HorizonSelectionCandidate, right: R13HorizonSelectionCandidate): number {
  const meanDifference = left.meanNetForwardAtr - right.meanNetForwardAtr;
  if (Math.abs(meanDifference) > 0.02) return meanDifference > 0 ? -1 : 1;
  if (left.costStressMean !== right.costStressMean) return right.costStressMean - left.costStressMean;
  if (Math.abs(left.maximumDrawdownAtr) !== Math.abs(right.maximumDrawdownAtr)) return Math.abs(left.maximumDrawdownAtr) - Math.abs(right.maximumDrawdownAtr);
  if (left.atrProfitFactor !== right.atrProfitFactor) return right.atrProfitFactor - left.atrProfitFactor;
  if (left.horizonHours !== right.horizonHours) return left.horizonHours - right.horizonHours;
  return `R13-H${left.horizonHours}`.localeCompare(`R13-H${right.horizonHours}`);
}

export function selectR13Horizon(candidates: readonly R13HorizonSelectionCandidate[]): R13HorizonSelection {
  const eligible = candidates.filter((candidate) => candidate.eligible).map((candidate) => candidate.horizonHours).sort((left, right) => left - right);
  if (eligible.length === 0) return Object.freeze({ eligibleDiscoveryHorizons: Object.freeze([]), selectedDiscoveryHorizon: null, selectionAlgorithmApplied: false, finalDecision: M3_R13_NO_EDGE_OUTCOME });
  const winner = [...candidates].filter((candidate) => candidate.eligible).sort(compareCandidates)[0]!;
  return Object.freeze({ eligibleDiscoveryHorizons: Object.freeze(eligible), selectedDiscoveryHorizon: winner.horizonHours, selectionAlgorithmApplied: true, finalDecision: "FORWARD EDGE DISCOVERED — ROUND-013" });
}

export function validateR13GateInput(input: R13HorizonGateInput): void {
  const numericKeys: readonly (keyof R13HorizonGateInput)[] = ["selectedValidationObservationsAggregate", "meanNetForwardAtr", "positiveMeanEdgeFolds", "catastrophicFolds", "positiveSpearmanFolds", "positiveSpreadFolds", "costStressMean", "latencyStressMean"];
  for (const key of numericKeys) if (!finite(input[key] as number)) throw new Error(`R13 gate input ${String(key)} must be finite.`);
}
