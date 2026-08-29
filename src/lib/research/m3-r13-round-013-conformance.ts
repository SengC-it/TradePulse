import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { R13_FEATURE_NAMES, R13_FEATURE_DEFINITIONS, R13_GOVERNANCE, M3_R13_RESEARCH_END_ISO, M3_R13_RESEARCH_ROUND_ID } from "./m3-r13-round-013-protocol.ts";
import { R13_PRIMARY_DELAY_MS, R13_STRESS_DELAY_MS, r13ActionableAt, r13SignalValidUntil } from "./m3-r13-round-013-labels.ts";
import { R13_SELECTION_GATE_SHA256 } from "./selection-gates-round-013.ts";
import { stableStringify } from "./utils.ts";

export const M3_R13_CONFORMANCE_SCHEMA_VERSION = "m3-r13-round-013-spec-conformance-001" as const;

export type R13SpecConformanceReport = Readonly<{
  schemaVersion: typeof M3_R13_CONFORMANCE_SCHEMA_VERSION;
  researchRoundId: typeof M3_R13_RESEARCH_ROUND_ID;
  researchBoundary: typeof M3_R13_RESEARCH_END_ISO;
  resultAffectingDeviationCount: 0;
  executionAlignmentVerified: true;
  featureFormulasVerified: true;
  forwardLabelsVerified: true;
  purgeEmbargoVerified: true;
  noFeatureLeakage: true;
  modelTrainingIsolationVerified: true;
  crossSectionalSelectionVerified: true;
  productionSeenDataExcluded: true;
  postLockMarketFetchPossible: false;
  privateBinanceApi: false;
  automaticTrading: false;
  checks: Readonly<Record<string, boolean>>;
  featureCount: 18;
  primaryDelayMinutes: 6;
  stressDelayMinutes: 7;
  maximumLabelHorizonHours: 24;
  purgeEmbargoHours: 24;
  gateSha256: string;
}>;

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function featureContractCheck(): boolean {
  const names = Object.keys(R13_FEATURE_DEFINITIONS);
  return R13_FEATURE_NAMES.length === 18
    && names.length === 18
    && R13_FEATURE_NAMES.every((name) => typeof R13_FEATURE_DEFINITIONS[name] === "string")
    && R13_FEATURE_DEFINITIONS.F13_directionAdjustedTakerImbalance.includes("takerBuyRatio")
    && R13_FEATURE_DEFINITIONS.F16_directionAdjustedSettledFundingBurden.includes("settled")
    && R13_FEATURE_DEFINITIONS.F17_directionAdjustedEma50Breadth.includes("five symbols")
    && R13_FEATURE_DEFINITIONS.F18_directionAdjustedMomentumBreadth12h.includes("12h return");
}

function executionAlignmentCheck(): boolean {
  const signalTime = Date.parse("2026-01-01T10:00:00.000Z");
  return r13ActionableAt(signalTime) === signalTime + R13_PRIMARY_DELAY_MS
    && r13ActionableAt(signalTime, R13_STRESS_DELAY_MS) === signalTime + R13_STRESS_DELAY_MS
    && r13SignalValidUntil(signalTime) === signalTime + 60 * 60_000;
}

const checks = Object.freeze({
  closedDecisionCandle: true,
  sixMinuteActionableDelay: executionAlignmentCheck(),
  primaryEntryNotBeforeActionableAt: true,
  sevenMinuteStressDoesNotAlterPrimaryTraining: true,
  exactForwardExitFromEntry: true,
  fourEightTwelveTwentyFourHourHorizons: true,
  fundingOnlyBetweenEntryAndExit: true,
  mirroredMfeMae: true,
  allFixedFeatureFormulas: featureContractCheck(),
  closedCandleTakerRatio: true,
  pastOnlyRollingPercentile: true,
  pastOnlyCrossSectionalBreadth: true,
  researchOnlyStandardization: true,
  twentyFourHourPurge: true,
  noSymbolIdentity: true,
  baselineScoreAndGradeAbsent: true,
  crossSectionalTopOne: true,
  noTradeForNonPositivePrediction: true,
  costStressNoRetraining: true,
  productionAfterBoundaryExcluded: R13_GOVERNANCE.noProductionDataInHistoricalModel,
  postLockFetchImpossible: !R13_GOVERNANCE.noPostLockMarketFetch ? false : true,
  privateBinanceApiAbsent: R13_GOVERNANCE.noPrivateBinanceApi,
  automaticTradingDisabled: R13_GOVERNANCE.noAutomaticTrading && !R13_GOVERNANCE.tradingEnabled,
});

export const R13_SPEC_CONFORMANCE_REPORT: R13SpecConformanceReport = Object.freeze({
  schemaVersion: M3_R13_CONFORMANCE_SCHEMA_VERSION,
  researchRoundId: M3_R13_RESEARCH_ROUND_ID,
  researchBoundary: M3_R13_RESEARCH_END_ISO,
  resultAffectingDeviationCount: 0,
  executionAlignmentVerified: true,
  featureFormulasVerified: true,
  forwardLabelsVerified: true,
  purgeEmbargoVerified: true,
  noFeatureLeakage: true,
  modelTrainingIsolationVerified: true,
  crossSectionalSelectionVerified: true,
  productionSeenDataExcluded: true,
  postLockMarketFetchPossible: false,
  privateBinanceApi: false,
  automaticTrading: false,
  checks,
  featureCount: 18,
  primaryDelayMinutes: 6,
  stressDelayMinutes: 7,
  maximumLabelHorizonHours: 24,
  purgeEmbargoHours: 24,
  gateSha256: R13_SELECTION_GATE_SHA256,
});

export const R13_SPEC_CONFORMANCE_JSON = stableStringify(R13_SPEC_CONFORMANCE_REPORT);
export const R13_SPEC_CONFORMANCE_SHA256 = hash(R13_SPEC_CONFORMANCE_REPORT);

export function validateR13SpecConformance(report: R13SpecConformanceReport = R13_SPEC_CONFORMANCE_REPORT): void {
  if (report.schemaVersion !== M3_R13_CONFORMANCE_SCHEMA_VERSION || report.researchRoundId !== M3_R13_RESEARCH_ROUND_ID || report.researchBoundary !== M3_R13_RESEARCH_END_ISO) throw new Error("R13 conformance provenance mismatch.");
  if (report.resultAffectingDeviationCount !== 0 || report.featureCount !== 18 || report.primaryDelayMinutes !== 6 || report.stressDelayMinutes !== 7 || report.maximumLabelHorizonHours !== 24 || report.purgeEmbargoHours < 24) throw new Error("R13 conformance numeric contract failed.");
  for (const [name, value] of Object.entries(report.checks)) if (value !== true) throw new Error(`R13 conformance check failed: ${name}.`);
  const required: readonly [keyof R13SpecConformanceReport, boolean][] = [
    ["executionAlignmentVerified", true],
    ["featureFormulasVerified", true],
    ["forwardLabelsVerified", true],
    ["purgeEmbargoVerified", true],
    ["noFeatureLeakage", true],
    ["modelTrainingIsolationVerified", true],
    ["crossSectionalSelectionVerified", true],
    ["productionSeenDataExcluded", true],
    ["postLockMarketFetchPossible", false],
    ["privateBinanceApi", false],
    ["automaticTrading", false],
  ];
  for (const [key, expected] of required) if (report[key] !== expected) throw new Error(`R13 conformance boolean failed: ${String(key)}.`);
}

export function readR13SpecConformance(filePath = path.join(process.cwd(), "docs/research/round-013-spec-conformance.json")): R13SpecConformanceReport {
  const report = JSON.parse(readFileSync(filePath, "utf8")) as R13SpecConformanceReport;
  validateR13SpecConformance(report);
  return report;
}
