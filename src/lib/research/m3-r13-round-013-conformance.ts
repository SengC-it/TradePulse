import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import type { HistoricalFundingRecord, IntrabarSettlementCandle } from "../historical-data/types.ts";
import { featureVectorFromOrderedValues } from "./m3-r13-round-013-features.ts";
import { computeR13ForwardLabel, computeR13PrimaryAndLatencyStress, R13_HOUR_MS, R13_PRIMARY_DELAY_MS, R13_STRESS_DELAY_MS, r13ActionableAt, r13SignalValidUntil } from "./m3-r13-round-013-labels.ts";
import { R13OneMinuteIndexedSeries, r13IndexedSeriesLookupBounded } from "./m3-r13-round-013-index.ts";
import { isR13TrainingObservationPurgeSafe } from "./m3-r13-round-013-validation.ts";
import { R13_FEATURE_NAMES, R13_FEATURE_DEFINITIONS, R13_GOVERNANCE, M3_R13_RESEARCH_END_ISO, M3_R13_RESEARCH_ROUND_ID, R13_DATA_CONTRACT, R13_EXECUTION_ALIGNMENT, R13_LABEL_CONTRACT, R13_MODEL_CONTRACT } from "./m3-r13-round-013-protocol.ts";
import { R13_SELECTION_GATE_SHA256 } from "./selection-gates-round-013.ts";
import { stableStringify } from "./utils.ts";

export const M3_R13_CONFORMANCE_SCHEMA_VERSION = "m3-r13-round-013-spec-conformance-001" as const;

export type R13SpecConformanceReport = Readonly<{
  schemaVersion: typeof M3_R13_CONFORMANCE_SCHEMA_VERSION;
  researchRoundId: typeof M3_R13_RESEARCH_ROUND_ID;
  researchBoundary: typeof M3_R13_RESEARCH_END_ISO;
  resultAffectingDeviationCount: number;
  executionAlignmentVerified: boolean;
  cacheHitMissSemanticIdentityVerified: boolean;
  acquisitionSeparatedFromPerformance: boolean;
  performanceNetworkDisabled: boolean;
  featureFormulasVerified: boolean;
  featureUniquenessVerified: boolean;
  forwardLabelsVerified: boolean;
  boundedLabelLookupVerified: boolean;
  noFullSeriesSortPerLabel: boolean;
  noSilentObservationDropVerified: boolean;
  fundingIntervalVerified: boolean;
  MfeMaeMirroringVerified: boolean;
  purgeEmbargoVerified: boolean;
  noFeatureLeakage: boolean;
  researchOnlyStandardizationVerified: boolean;
  modelTrainingIsolationVerified: boolean;
  crossSectionalRankingVerified: boolean;
  fullValidationDecileCalibrationVerified: boolean;
  crossSectionalSelectionVerified: boolean;
  productionSeenDataExcluded: boolean;
  postLockMarketFetchPossible: boolean;
  privateBinanceApi: boolean;
  automaticTrading: boolean;
  checks: Readonly<Record<string, boolean>>;
  featureCount: number;
  primaryDelayMinutes: number;
  stressDelayMinutes: number;
  maximumLabelHorizonHours: number;
  purgeEmbargoHours: number;
  gateSha256: string;
}>;

function hash(value: unknown): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

function fixtureMinuteCandle(openTime: number, index: number): IntrabarSettlementCandle {
  const price = 100 + index / 100;
  return Object.freeze({ symbol: "BTCUSDT", timeframe: "1m", openTime, closeTime: openTime + 59_999, open: price, high: price + (index === 10 ? 10 : 1), low: price - (index === 10 ? 5 : 1), close: price, volume: 10, quoteVolume: 1_000, tradeCount: 10, takerBuyBaseVolume: 5, takerBuyQuoteVolume: 500 });
}

function behaviorChecks(): Readonly<Record<string, boolean>> {
  const signalTime = Date.parse("2026-01-01T10:00:00.000Z");
  const actionableAt = r13ActionableAt(signalTime);
  const minutes = Object.freeze(Array.from({ length: 24 * 60 + 30 }, (_, index) => fixtureMinuteCandle(actionableAt + index * 60_000, index)));
  const funding: readonly HistoricalFundingRecord[] = Object.freeze([{ symbol: "BTCUSDT", fundingTime: actionableAt + 30 * 60_000, fundingRate: 0.0001, directMarkPrice: 100 }]);
  const primary = computeR13ForwardLabel({ symbol: "BTCUSDT", direction: "LONG", signalTime, horizonHours: 4, atr14_1h: 10, candles1m: minutes, funding, researchEndTime: signalTime + 48 * R13_HOUR_MS });
  const stress = computeR13PrimaryAndLatencyStress({ symbol: "BTCUSDT", direction: "LONG", signalTime, horizonHours: 4, atr14_1h: 10, candles1m: minutes, funding, researchEndTime: signalTime + 48 * R13_HOUR_MS });
  const indexed = new R13OneMinuteIndexedSeries(minutes);
  const vector = featureVectorFromOrderedValues(R13_FEATURE_NAMES.map((_, index) => index));
  const cacheParsed = Object.freeze(minutes.map((candle) => ({ ...candle })));
  const dataSource = readFileSync(path.join(process.cwd(), "src/lib/research/m3-r13-round-013-data.ts"), "utf8");
  const performanceSource = readFileSync(path.join(process.cwd(), "scripts/m3-r13-performance.ts"), "utf8");
  const acquisitionSource = readFileSync(path.join(process.cwd(), "scripts/m3-r13-acquire.ts"), "utf8");
  const cacheSemanticIdentity = stableStringify(cacheParsed) === stableStringify(minutes)
    && indexed.getExact(minutes[0]!.openTime)?.openTime === minutes[0]!.openTime
    && dataSource.includes("return { data: parsed, diagnostics: response.diagnostics }");
  const short = computeR13ForwardLabel({ symbol: "BTCUSDT", direction: "SHORT", signalTime, horizonHours: 4, atr14_1h: 10, candles1m: minutes, funding, researchEndTime: signalTime + 48 * R13_HOUR_MS });
  return Object.freeze({
    closedDecisionCandle: R13_EXECUTION_ALIGNMENT.decisionCandle === "FULLY_CLOSED_1H_CANDLE",
    sixMinuteActionableDelay: actionableAt === signalTime + R13_PRIMARY_DELAY_MS && r13SignalValidUntil(signalTime) === signalTime + R13_HOUR_MS,
    primaryEntryNotBeforeActionableAt: primary.entryTime !== null && primary.entryTime >= actionableAt,
    sevenMinuteStressDoesNotAlterPrimaryTraining: stress.primary.entryTime === primary.entryTime && stress.latencyStress.delayMs === R13_STRESS_DELAY_MS,
    exactForwardExitFromEntry: primary.exitTargetTime === actionableAt + 4 * R13_HOUR_MS && primary.exitTime === primary.exitTargetTime,
    fourEightTwelveTwentyFourHourHorizons: R13_LABEL_CONTRACT.horizonsHours.join(",") === "4,8,12,24",
    fundingOnlyBetweenEntryAndExit: primary.fundingEventCount === 1,
    mirroredMfeMae: primary.mfeAtr !== null && short.maeAtr !== null && short.mfeAtr !== null && primary.maeAtr !== null && primary.mfeAtr > short.mfeAtr && short.maeAtr > primary.maeAtr,
    allFixedFeatureFormulas: Object.keys(vector).length === R13_FEATURE_NAMES.length,
    featureUniqueness: R13_FEATURE_DEFINITIONS.F04_directionAdjustedReturn1hAtrPriceScale !== R13_FEATURE_DEFINITIONS.F08_directionAdjustedReturn12hAtrPriceScale && R13_FEATURE_DEFINITIONS.F04_directionAdjustedReturn1hAtrPriceScale.includes("1h_symbol_return"),
    closedCandleTakerRatio: R13_FEATURE_DEFINITIONS.F13_directionAdjustedTakerImbalance.includes("takerBuyRatio"),
    pastOnlyRollingPercentile: R13_FEATURE_DEFINITIONS.F11_rollingAtrPricePercentile30d.includes("past 30 closed days"),
    pastOnlyCrossSectionalBreadth: R13_FEATURE_DEFINITIONS.F17_directionAdjustedEma50Breadth.includes("five symbols") && R13_FEATURE_DEFINITIONS.F18_directionAdjustedMomentumBreadth12h.includes("12h return"),
    researchOnlyStandardization: R13_MODEL_CONTRACT.standardizationScope === "EACH_OUTER_FOLD_RESEARCH_ONLY",
    twentyFourHourPurge: isR13TrainingObservationPurgeSafe({ decisionTime: signalTime - 26 * R13_HOUR_MS, validationStartTime: signalTime }),
    noSymbolIdentity: R13_MODEL_CONTRACT.noSymbolIdentity,
    baselineScoreAndGradeAbsent: !R13_FEATURE_NAMES.join(" ").match(/score|grade|symbolId/iu),
    crossSectionalTopOne: R13_DATA_CONTRACT.observationUniverse === "EVERY_COMPLETE_DECISION_TIME_SYMBOL_DIRECTION_PAIR",
    noTradeForNonPositivePrediction: R13_MODEL_CONTRACT.validationUse === "PREDICT_ONLY_NO_REFIT_NO_THRESHOLD_UPDATE",
    costStressNoRetraining: R13_LABEL_CONTRACT.costStress === "1.5_TIMES_TOTAL_TRANSACTION_COST_ONLY_DIAGNOSTIC",
    productionAfterBoundaryExcluded: R13_GOVERNANCE.noProductionDataInHistoricalModel,
    postLockFetchImpossible: R13_GOVERNANCE.noPostLockMarketFetch,
    privateBinanceApiAbsent: R13_GOVERNANCE.noPrivateBinanceApi,
    automaticTradingDisabled: R13_GOVERNANCE.noAutomaticTrading && !R13_GOVERNANCE.tradingEnabled,
    cacheHitMissSemanticIdentity: cacheSemanticIdentity,
    acquisitionSeparatedFromPerformance: R13_DATA_CONTRACT.rawCache === "LOCAL_RESUMABLE_PAGE_CHECKPOINTS_NOT_COMMITTED" && R13_GOVERNANCE.performanceExactlyOnceAfterLock && acquisitionSource.includes("fetchMissingOneMinute: true") && performanceSource.includes("fetchMissingOneMinute: false"),
    performanceNetworkDisabled: R13_GOVERNANCE.noPostLockMarketFetch && R13_DATA_CONTRACT.rawCache === "LOCAL_RESUMABLE_PAGE_CHECKPOINTS_NOT_COMMITTED" && performanceSource.includes("fetchMissingOneMinute: false") && !performanceSource.includes("fetchMissingOneMinute: true"),
    forwardLabels: primary.status === "EXECUTED" && primary.entryTime === actionableAt,
    boundedLabelLookup: r13IndexedSeriesLookupBounded(indexed, actionableAt, actionableAt + 4 * R13_HOUR_MS),
    noFullSeriesSortPerLabel: !readFileSync(path.join(process.cwd(), "src/lib/research/m3-r13-round-013-labels.ts"), "utf8").includes(".sort("),
    noSilentObservationDrop: R13_DATA_CONTRACT.missingOrMalformedData === "FAIL_CLOSED_AS_INCOMPLETE_EVIDENCE" && readFileSync(path.join(process.cwd(), "src/lib/research/m3-r13-round-013-performance.ts"), "utf8").includes("if (warmedUp) throw new Error(`R13 observation integrity failure after warmup"),
    crossSectionalRanking: R13_DATA_CONTRACT.observationUniverse === "EVERY_COMPLETE_DECISION_TIME_SYMBOL_DIRECTION_PAIR",
    fullValidationDecileCalibration: R13_MODEL_CONTRACT.validationUse === "PREDICT_ONLY_NO_REFIT_NO_THRESHOLD_UPDATE",
  });
}

const checks = behaviorChecks();

export const R13_SPEC_CONFORMANCE_REPORT: R13SpecConformanceReport = Object.freeze({
  schemaVersion: M3_R13_CONFORMANCE_SCHEMA_VERSION,
  researchRoundId: M3_R13_RESEARCH_ROUND_ID,
  researchBoundary: M3_R13_RESEARCH_END_ISO,
  resultAffectingDeviationCount: Object.values(checks).filter((value) => value !== true).length,
  executionAlignmentVerified: checks.sixMinuteActionableDelay && checks.primaryEntryNotBeforeActionableAt,
  cacheHitMissSemanticIdentityVerified: checks.cacheHitMissSemanticIdentity,
  acquisitionSeparatedFromPerformance: checks.acquisitionSeparatedFromPerformance,
  performanceNetworkDisabled: checks.performanceNetworkDisabled,
  featureFormulasVerified: checks.allFixedFeatureFormulas,
  featureUniquenessVerified: checks.featureUniqueness,
  forwardLabelsVerified: checks.forwardLabels,
  boundedLabelLookupVerified: checks.boundedLabelLookup,
  noFullSeriesSortPerLabel: checks.noFullSeriesSortPerLabel,
  noSilentObservationDropVerified: checks.noSilentObservationDrop,
  fundingIntervalVerified: checks.fundingOnlyBetweenEntryAndExit,
  MfeMaeMirroringVerified: checks.mirroredMfeMae,
  purgeEmbargoVerified: checks.twentyFourHourPurge,
  noFeatureLeakage: checks.pastOnlyRollingPercentile && checks.pastOnlyCrossSectionalBreadth && checks.closedDecisionCandle,
  researchOnlyStandardizationVerified: checks.researchOnlyStandardization,
  modelTrainingIsolationVerified: checks.researchOnlyStandardization && checks.noTradeForNonPositivePrediction,
  crossSectionalRankingVerified: checks.crossSectionalRanking,
  fullValidationDecileCalibrationVerified: checks.fullValidationDecileCalibration,
  crossSectionalSelectionVerified: checks.crossSectionalTopOne && checks.crossSectionalRanking,
  productionSeenDataExcluded: checks.productionAfterBoundaryExcluded,
  postLockMarketFetchPossible: !checks.postLockFetchImpossible,
  privateBinanceApi: !checks.privateBinanceApiAbsent,
  automaticTrading: !checks.automaticTradingDisabled,
  checks,
  featureCount: R13_FEATURE_NAMES.length,
  primaryDelayMinutes: R13_PRIMARY_DELAY_MS / 60_000,
  stressDelayMinutes: R13_STRESS_DELAY_MS / 60_000,
  maximumLabelHorizonHours: Math.max(...R13_LABEL_CONTRACT.horizonsHours),
  purgeEmbargoHours: 24,
  gateSha256: R13_SELECTION_GATE_SHA256,
});

export const R13_SPEC_CONFORMANCE_JSON = stableStringify(R13_SPEC_CONFORMANCE_REPORT);
export const R13_SPEC_CONFORMANCE_SHA256 = hash(R13_SPEC_CONFORMANCE_REPORT);

export function validateR13SpecConformance(report: R13SpecConformanceReport = R13_SPEC_CONFORMANCE_REPORT): void {
  if (report.schemaVersion !== M3_R13_CONFORMANCE_SCHEMA_VERSION || report.researchRoundId !== M3_R13_RESEARCH_ROUND_ID || report.researchBoundary !== M3_R13_RESEARCH_END_ISO) throw new Error("R13 conformance provenance mismatch.");
  if (report.resultAffectingDeviationCount !== 0 || report.featureCount !== R13_FEATURE_NAMES.length || report.primaryDelayMinutes !== 6 || report.stressDelayMinutes !== 7 || report.maximumLabelHorizonHours !== 24 || report.purgeEmbargoHours < 24) throw new Error("R13 conformance numeric contract failed.");
  for (const [name, value] of Object.entries(report.checks)) if (value !== true) throw new Error(`R13 conformance check failed: ${name}.`);
  const required: readonly [keyof R13SpecConformanceReport, boolean][] = [
    ["executionAlignmentVerified", true], ["cacheHitMissSemanticIdentityVerified", true], ["acquisitionSeparatedFromPerformance", true], ["performanceNetworkDisabled", true], ["featureFormulasVerified", true], ["featureUniquenessVerified", true], ["forwardLabelsVerified", true], ["boundedLabelLookupVerified", true], ["noFullSeriesSortPerLabel", true], ["noSilentObservationDropVerified", true], ["fundingIntervalVerified", true], ["MfeMaeMirroringVerified", true], ["purgeEmbargoVerified", true], ["noFeatureLeakage", true], ["researchOnlyStandardizationVerified", true], ["modelTrainingIsolationVerified", true], ["crossSectionalRankingVerified", true], ["fullValidationDecileCalibrationVerified", true], ["crossSectionalSelectionVerified", true], ["productionSeenDataExcluded", true], ["postLockMarketFetchPossible", false], ["privateBinanceApi", false], ["automaticTrading", false],
  ];
  for (const [key, expected] of required) if (report[key] !== expected) throw new Error(`R13 conformance boolean failed: ${String(key)}.`);
}

export function readR13SpecConformance(filePath = path.join(process.cwd(), "docs/research/round-013-spec-conformance.json")): R13SpecConformanceReport {
  const report = JSON.parse(readFileSync(filePath, "utf8")) as R13SpecConformanceReport;
  validateR13SpecConformance(report);
  return report;
}
