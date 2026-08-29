import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";

import type { Candle } from "../src/lib/market-data/types.ts";
import type { HistoricalFundingRecord, IntrabarSettlementCandle } from "../src/lib/historical-data/types.ts";
import { R13_FEATURE_NAMES, R13_SYMBOLS, M3_R13_RESEARCH_END_ISO } from "../src/lib/research/m3-r13-round-013-protocol.ts";
import { buildR13FeatureVector, featureVectorFromOrderedValues } from "../src/lib/research/m3-r13-round-013-features.ts";
import { computeR13ForwardLabel, computeR13PrimaryAndLatencyStress, r13ActionableAt, r13SignalValidUntil } from "../src/lib/research/m3-r13-round-013-labels.ts";
import { fitR13RidgeModel, predictR13RidgeModel } from "../src/lib/research/m3-r13-round-013-model.ts";
import { evaluateR13HorizonGates, R13_HARD_GATE_IDENTITIES, R13_SELECTION_GATE_SHA256, selectR13Horizon } from "../src/lib/research/selection-gates-round-013.ts";
import { calculateR13Drawdown } from "../src/lib/research/r13-drawdown.ts";
import { isR13TrainingObservationPurgeSafe, r13PurgeTrainingObservations, r13SelectTopOne } from "../src/lib/research/m3-r13-round-013-validation.ts";
import { readR13SpecConformance, R13_SPEC_CONFORMANCE_REPORT } from "../src/lib/research/m3-r13-round-013-conformance.ts";
import { R13_PLAN, validateR13Plan } from "../src/lib/research/m3-r13-round-013-plan.ts";
import { R13OneMinuteCachedClient } from "../src/lib/research/m3-r13-round-013-data.ts";
import { R13OneMinuteIndexedSeries } from "../src/lib/research/m3-r13-round-013-index.ts";

const HOUR = 3_600_000;
const MINUTE = 60_000;
const BASE = Date.parse("2024-01-01T00:00:00.000Z");

function candle(symbol: (typeof R13_SYMBOLS)[number], index: number, close = 100, quoteVolume = 100, takerBuyQuoteVolume = 60): Candle {
  const openTime = BASE + index * HOUR;
  return Object.freeze({ symbol, timeframe: "1h", openTime, closeTime: openTime + HOUR - 1, open: close, high: close + 1, low: close - 1, close, volume: quoteVolume, quoteVolume, tradeCount: 100, takerBuyBaseVolume: takerBuyQuoteVolume / close, takerBuyQuoteVolume });
}

function history(symbol: (typeof R13_SYMBOLS)[number], count = 1_000): readonly Candle[] {
  return Object.freeze(Array.from({ length: count }, (_, index) => candle(symbol, index)));
}

function fourHourHistory(symbol: (typeof R13_SYMBOLS)[number], count = 260): readonly Candle[] {
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const openTime = BASE + index * 4 * HOUR;
    return Object.freeze({ symbol, timeframe: "4h", openTime, closeTime: openTime + 4 * HOUR - 1, open: 100, high: 101, low: 99, close: 100, volume: 400, quoteVolume: 400, tradeCount: 400, takerBuyBaseVolume: 2, takerBuyQuoteVolume: 200 });
  }));
}

function funding(symbol: (typeof R13_SYMBOLS)[number], signalTime: number): readonly HistoricalFundingRecord[] {
  return Object.freeze([
    { symbol, fundingTime: signalTime - 8 * HOUR, fundingRate: 0.0001, directMarkPrice: 100 },
    { symbol, fundingTime: signalTime + 30 * MINUTE, fundingRate: 0.0002, directMarkPrice: 100 },
  ]);
}

function featureInput(signalTime = BASE + 1_000 * HOUR - 1) {
  const allSymbolCandles1h = Object.fromEntries(R13_SYMBOLS.map((symbol) => [symbol, history(symbol)])) as Record<(typeof R13_SYMBOLS)[number], readonly Candle[]>;
  return { symbol: "BTCUSDT" as const, direction: "LONG" as const, signalTime, candles1h: allSymbolCandles1h.BTCUSDT!, candles4h: fourHourHistory("BTCUSDT"), allSymbolCandles1h, funding: funding("BTCUSDT", signalTime) };
}

function minuteCandle(openTime: number, open: number, high = open + 1, low = open - 1): IntrabarSettlementCandle {
  return Object.freeze({ symbol: "BTCUSDT", timeframe: "1m", openTime, closeTime: openTime + MINUTE - 1, open, high, low, close: open, volume: 10, quoteVolume: 1_000, tradeCount: 10, takerBuyBaseVolume: 5, takerBuyQuoteVolume: 500 });
}

function minuteWindow(signalTime: number): readonly IntrabarSettlementCandle[] {
  const start = Math.floor((signalTime + 1) / MINUTE) * MINUTE;
  return Object.freeze(Array.from({ length: 420 }, (_, index) => minuteCandle(start + index * MINUTE, start + index * MINUTE === BASE + HOUR + 6 * MINUTE ? 100 : 100)));
}

describe("Round-013 frozen protocol and conformance", () => {
  it("loads the machine records with the required boundary and governance", () => {
    validateR13Plan();
    readR13SpecConformance();
    expect(R13_PLAN.researchBoundary).toBe(M3_R13_RESEARCH_END_ISO);
    expect(R13_PLAN.featureSpec.count).toBe(18);
    expect(R13_HARD_GATE_IDENTITIES).toHaveLength(16);
    expect(R13_SELECTION_GATE_SHA256).toMatch(/^[0-9a-f]{64}$/u);
    expect(R13_SPEC_CONFORMANCE_REPORT).toMatchObject({
      resultAffectingDeviationCount: 0,
      executionAlignmentVerified: true,
      cacheHitMissSemanticIdentityVerified: true,
      acquisitionSeparatedFromPerformance: true,
      performanceNetworkDisabled: true,
      featureFormulasVerified: true,
      featureUniquenessVerified: true,
      forwardLabelsVerified: true,
      boundedLabelLookupVerified: true,
      noFullSeriesSortPerLabel: true,
      noSilentObservationDropVerified: true,
      fundingIntervalVerified: true,
      MfeMaeMirroringVerified: true,
      purgeEmbargoVerified: true,
      noFeatureLeakage: true,
      researchOnlyStandardizationVerified: true,
      modelTrainingIsolationVerified: true,
      crossSectionalRankingVerified: true,
      fullValidationDecileCalibrationVerified: true,
      crossSectionalSelectionVerified: true,
      productionSeenDataExcluded: true,
      postLockMarketFetchPossible: false,
      privateBinanceApi: false,
      automaticTrading: false,
    });
  });

  it("keeps the fixed feature vector independent of symbol identity and baseline score", () => {
    expect(R13_FEATURE_NAMES).toHaveLength(18);
    expect(R13_FEATURE_NAMES.join(" ")).not.toMatch(/score|grade|symbolId/iu);
    const features = buildR13FeatureVector(featureInput());
    expect(Object.keys(features)).toEqual([...R13_FEATURE_NAMES]);
  });
});

describe("Round-013 acquisition/cache/index boundaries", () => {
  it("returns parsed semantic data on both network miss and cache hit", async () => {
    const cacheDirectory = mkdtempSync(path.join(process.cwd(), ".r13-cache-test-"));
    let fetchCount = 0;
    const raw = [[0, "100", "101", "99", "100", "10", 59_999, "1000", 10, "5", "500", "0"]];
    try {
      const client = new R13OneMinuteCachedClient({ cacheDirectory, clientOptions: { fetchImpl: async () => { fetchCount += 1; return new Response(JSON.stringify(raw), { status: 200, headers: { "content-type": "application/json" } }); } } });
      const first = await client.getOneMinuteKlinesRange("BTCUSDT", 0, 59_999, 1);
      const second = await client.getOneMinuteKlinesRange("BTCUSDT", 0, 59_999, 1);
      expect(fetchCount).toBe(1);
      expect(first.data).toEqual(second.data);
      expect((first.data as readonly { openTime: number }[])[0]!.openTime).toBe(0);
    } finally {
      rmSync(cacheDirectory, { recursive: true, force: true });
    }
  });

  it("does not invoke a fetch in performance/offline mode when a page is absent", async () => {
    const cacheDirectory = mkdtempSync(path.join(process.cwd(), ".r13-cache-test-"));
    let fetchCount = 0;
    try {
      const client = new R13OneMinuteCachedClient({ cacheDirectory, allowNetworkAcquisition: false, clientOptions: { fetchImpl: async () => { fetchCount += 1; return new Response("[]", { status: 200 }); } } });
      await expect(client.getOneMinuteKlinesRange("BTCUSDT", 0, 59_999, 1)).rejects.toThrow(/missing a cached 1m page/u);
      expect(fetchCount).toBe(0);
    } finally {
      rmSync(cacheDirectory, { recursive: true, force: true });
    }
  });

  it("uses one immutable timestamp index with bounded range lookups", () => {
    const candles = Object.freeze(Array.from({ length: 5 }, (_, index) => minuteCandle(index * MINUTE, 100 + index)));
    const series = new R13OneMinuteIndexedSeries(candles);
    expect(series.getExact(2 * MINUTE)?.open).toBe(102);
    expect(series.openAtOrAfter(2 * MINUTE + 1)?.open).toBe(103);
    expect(series.getRange(MINUTE, 3 * MINUTE)).toHaveLength(3);
  });
});

describe("Round-013 F01-F18 formula implementation", () => {
  function richOneHourHistory(symbol: (typeof R13_SYMBOLS)[number]): readonly Candle[] {
    const symbolIndex = R13_SYMBOLS.indexOf(symbol);
    const trends = [0.05, 0.08, -0.05, 0.2, -0.2];
    const biases = [0, 3, -3, 6, -6];
    return Object.freeze(Array.from({ length: 1_000 }, (_, index) => {
      const close = 1_000 + biases[symbolIndex]! + trends[symbolIndex]! * index + (index % 7) * 0.02;
      const quoteVolume = 100 + symbolIndex * 7 + (index % 5) * 10;
      const takerBuyRatio = 0.42 + symbolIndex * 0.03 + (index % 4) * 0.01;
      return Object.freeze({
        symbol,
        timeframe: "1h" as const,
        openTime: BASE + index * HOUR,
        closeTime: BASE + index * HOUR + HOUR - 1,
        open: close,
        high: close + 1 + (index % 3) * 0.1,
        low: close - 1 - (index % 2) * 0.05,
        close,
        volume: quoteVolume,
        quoteVolume,
        tradeCount: 100,
        takerBuyBaseVolume: (quoteVolume * takerBuyRatio) / close,
        takerBuyQuoteVolume: quoteVolume * takerBuyRatio,
      });
    }));
  }

  function richFourHourHistory(symbol: (typeof R13_SYMBOLS)[number]): readonly Candle[] {
    const symbolIndex = R13_SYMBOLS.indexOf(symbol);
    return Object.freeze(Array.from({ length: 260 }, (_, index) => {
      const close = 200 + symbolIndex * 4 + 0.3 * index + (index % 5) * 0.1;
      return Object.freeze({
        symbol,
        timeframe: "4h" as const,
        openTime: BASE + index * 4 * HOUR,
        closeTime: BASE + index * 4 * HOUR + 4 * HOUR - 1,
        open: close,
        high: close + 2 + (index % 3) * 0.2,
        low: close - 2 - (index % 2) * 0.1,
        close,
        volume: 400,
        quoteVolume: 400,
        tradeCount: 400,
        takerBuyBaseVolume: 2,
        takerBuyQuoteVolume: 200,
      });
    }));
  }

  function localEma(candles: readonly Candle[], index: number, period: number): number {
    let value = candles.slice(0, period).reduce((sum, item) => sum + item.close, 0) / period;
    const multiplier = 2 / (period + 1);
    for (let cursor = period; cursor <= index; cursor += 1) value = (candles[cursor]!.close - value) * multiplier + value;
    return value;
  }

  function localAtr(candles: readonly Candle[], index: number): number {
    const ranges: number[] = [];
    for (let cursor = 1; cursor <= index; cursor += 1) {
      const current = candles[cursor]!;
      const previousClose = candles[cursor - 1]!.close;
      ranges.push(Math.max(current.high - current.low, Math.abs(current.high - previousClose), Math.abs(current.low - previousClose)));
    }
    return ranges.slice(-14).reduce((sum, value) => sum + value, 0) / 14;
  }

  function localMedian(values: readonly number[]): number {
    const ordered = [...values].sort((left, right) => left - right);
    const middle = Math.floor(ordered.length / 2);
    return ordered.length % 2 === 0 ? (ordered[middle - 1]! + ordered[middle]!) / 2 : ordered[middle]!;
  }

  function localReturn(candles: readonly Candle[], index: number, bars: number): number {
    return candles[index]!.close / candles[index - bars]!.close - 1;
  }

  it("matches the direct formula values for a constant closed history", () => {
    const features = buildR13FeatureVector(featureInput());
    expect(Object.values(features)).toEqual(expect.arrayContaining([0, 0.02, 1, -0.0001]));
    expect(features.F01_directionAdjustedClose4hMinusEma200Atr).toBe(0);
    expect(features.F02_directionAdjustedEma50MinusEma200Atr).toBe(0);
    expect(features.F03_directionAdjustedEma200FiveBarSlopeAtr).toBe(0);
    expect(features.F04_directionAdjustedReturn1hAtrPriceScale).toBe(0);
    expect(features.F05_directionAdjustedEma20MinusEma50Atr).toBe(0);
    expect(features.F06_directionAdjustedEma20ThreeBarSlopeAtr).toBe(0);
    expect(features.F07_directionAdjustedReturn4hAtrPriceScale).toBe(0);
    expect(features.F08_directionAdjustedReturn12hAtrPriceScale).toBe(0);
    expect(features.F09_directionAdjustedClose1hMinusEma20Atr).toBe(0);
    expect(features.F10_atr14OverClose1h).toBe(0.02);
    expect(features.F11_rollingAtrPricePercentile30d).toBe(1);
    expect(features.F12_logClippedQuoteVolumeOverPast20hMedian).toBe(0);
    expect(features.F13_directionAdjustedTakerImbalance).toBeCloseTo(0.2);
    expect(features.F14_directionAdjustedSymbolMinusBtcReturn12h).toBe(0);
    expect(features.F15_directionAdjustedSymbolMinusBtcReturn24h).toBe(0);
    expect(features.F16_directionAdjustedSettledFundingBurden).toBe(-0.0001);
    expect(features.F17_directionAdjustedEma50Breadth).toBe(0);
    expect(features.F18_directionAdjustedMomentumBreadth12h).toBe(0);
  });

  it("matches independently calculated values for every F01-F18 formula", () => {
    const signalTime = BASE + 1_000 * HOUR - 1;
    const allSymbolCandles1h = Object.fromEntries(R13_SYMBOLS.map((symbol) => [symbol, richOneHourHistory(symbol)])) as Record<(typeof R13_SYMBOLS)[number], readonly Candle[]>;
    const candles1h = allSymbolCandles1h.ETHUSDT!;
    const candles4h = richFourHourHistory("ETHUSDT");
    const index1h = 999;
    const index4h = 249;
    const direction = -1;
    const close1h = candles1h[index1h]!.close;
    const close4h = candles4h[index4h]!.close;
    const atr1h = localAtr(candles1h, index1h);
    const atr4h = localAtr(candles4h, index4h);
    const ema20_1h = localEma(candles1h, index1h, 20);
    const ema50_1h = localEma(candles1h, index1h, 50);
    const ema50_4h = localEma(candles4h, index4h, 50);
    const ema200_4h = localEma(candles4h, index4h, 200);
    const normalizedAtrPrice = atr1h / close1h;
    const symbolReturn1h = localReturn(candles1h, index1h, 1);
    const symbolReturn12h = localReturn(candles1h, index1h, 12);
    const symbolReturn24h = localReturn(candles1h, index1h, 24);
    const btcCandles = allSymbolCandles1h.BTCUSDT!;
    const btcReturn12h = localReturn(btcCandles, index1h, 12);
    const btcReturn24h = localReturn(btcCandles, index1h, 24);
    const rolling = Array.from({ length: 720 }, (_, offset) => {
      const index = index1h - 719 + offset;
      return localAtr(candles1h, index) / candles1h[index]!.close;
    });
    const currentVolatility = atr1h / close1h;
    const percentile = rolling.filter((value) => value <= currentVolatility).length / rolling.length;
    const previousVolumes = candles1h.slice(index1h - 20, index1h).map((item) => item.quoteVolume);
    const volumeRatio = candles1h[index1h]!.quoteVolume / localMedian(previousVolumes);
    const takerBuyRatio = candles1h[index1h]!.takerBuyQuoteVolume / candles1h[index1h]!.quoteVolume;
    const crossSection = R13_SYMBOLS.map((symbol) => {
      const candles = allSymbolCandles1h[symbol]!;
      return { aboveEma50: candles[index1h]!.close > localEma(candles, index1h, 50), positiveReturn12h: localReturn(candles, index1h, 12) > 0 };
    });
    const aboveEma50 = crossSection.filter((value) => value.aboveEma50).length / R13_SYMBOLS.length;
    const positiveMomentum = crossSection.filter((value) => value.positiveReturn12h).length / R13_SYMBOLS.length;
    const expected = [
      direction * (close4h - ema200_4h) / atr4h,
      direction * (ema50_4h - ema200_4h) / atr4h,
      direction * (ema200_4h - localEma(candles4h, index4h - 5, 200)) / atr4h,
      direction * symbolReturn1h / normalizedAtrPrice,
      direction * (ema20_1h - ema50_1h) / atr1h,
      direction * (ema20_1h - localEma(candles1h, index1h - 3, 20)) / atr1h,
      direction * localReturn(candles1h, index1h, 4) / normalizedAtrPrice,
      direction * symbolReturn12h / normalizedAtrPrice,
      direction * (close1h - ema20_1h) / atr1h,
      atr1h / close1h,
      percentile,
      Math.max(-5, Math.min(5, Math.log(volumeRatio))),
      1 - 2 * takerBuyRatio,
      direction * (symbolReturn12h - btcReturn12h),
      direction * (symbolReturn24h - btcReturn24h),
      -direction * 0.0001,
      1 - aboveEma50,
      1 - positiveMomentum,
    ];
    const features = buildR13FeatureVector({ symbol: "ETHUSDT", direction: "SHORT", signalTime, candles1h, candles4h, allSymbolCandles1h, funding: funding("ETHUSDT", signalTime) });
    R13_FEATURE_NAMES.forEach((name, index) => expect(features[name]).toBeCloseTo(expected[index]!, 10));
  });

  it("uses only closed data at or before signalTime for features, rolling windows, and breadth", () => {
    const input = featureInput();
    const futureIndex = 1_001;
    const future = candle("BTCUSDT", futureIndex, 9_999, 9_999, 999);
    const futureOther = candle("ETHUSDT", futureIndex, 9_999, 9_999, 999);
    const changed = { ...input, candles1h: [...input.candles1h, future], allSymbolCandles1h: { ...input.allSymbolCandles1h, BTCUSDT: [...input.allSymbolCandles1h.BTCUSDT!, future], ETHUSDT: [...input.allSymbolCandles1h.ETHUSDT!, futureOther] } };
    expect(buildR13FeatureVector(changed)).toEqual(buildR13FeatureVector(input));
  });

  it("mirrors direction-sensitive formulas without creating a symbol feature", () => {
    const input = featureInput();
    const long = buildR13FeatureVector(input);
    const short = buildR13FeatureVector({ ...input, direction: "SHORT" });
    expect(short.F13_directionAdjustedTakerImbalance).toBeCloseTo(-long.F13_directionAdjustedTakerImbalance);
    expect(short.F16_directionAdjustedSettledFundingBurden).toBeCloseTo(-long.F16_directionAdjustedSettledFundingBurden);
    expect(short.F17_directionAdjustedEma50Breadth).toBe(1 - long.F17_directionAdjustedEma50Breadth);
    expect(short.F18_directionAdjustedMomentumBreadth12h).toBe(1 - long.F18_directionAdjustedMomentumBreadth12h);
  });
});

describe("Round-013 execution-aligned forward labels", () => {
  const signalTime = BASE + HOUR - 1;
  const common = { symbol: "BTCUSDT" as const, signalTime, atr14_1h: 10, candles1m: minuteWindow(signalTime), funding: funding("BTCUSDT", signalTime), researchEndTime: BASE + 48 * HOUR };

  it("normalizes the six-minute action time and never enters earlier", () => {
    expect(r13ActionableAt(signalTime)).toBe(BASE + HOUR + 6 * MINUTE);
    expect(r13SignalValidUntil(signalTime)).toBe(signalTime + HOUR);
    const label = computeR13ForwardLabel({ ...common, direction: "LONG", horizonHours: 4 });
    expect(label.actionableAt).toBe(BASE + HOUR + 6 * MINUTE);
    expect(label.entryTime).toBeGreaterThanOrEqual(label.actionableAt);
    expect(label.entryTime).toBe(BASE + HOUR + 6 * MINUTE);
  });

  it("uses exact horizon time after entry, not after signal time", () => {
    const label = computeR13ForwardLabel({ ...common, direction: "LONG", horizonHours: 4 });
    expect(label.exitTargetTime).toBe(label.entryTime! + 4 * HOUR);
    expect(label.exitTime).toBe(label.exitTargetTime);
    expect(label.grossForwardAtr).not.toBeNull();
  });

  it("keeps seven-minute latency as a stress label and does not replace primary", () => {
    const pair = computeR13PrimaryAndLatencyStress({ ...common, direction: "LONG", horizonHours: 4 });
    expect(pair.primary.delayMs).toBe(6 * MINUTE);
    expect(pair.latencyStress.delayMs).toBe(7 * MINUTE);
    expect(pair.primary.entryTime).toBeLessThanOrEqual(pair.latencyStress.entryTime!);
    expect(pair.primary.horizonHours).toBe(pair.latencyStress.horizonHours);
  });

  it("includes only funding settlements after entry and through exit", () => {
    const label = computeR13ForwardLabel({ ...common, direction: "LONG", horizonHours: 4, funding: [...common.funding, { symbol: "BTCUSDT", fundingTime: common.signalTime + 2 * HOUR, fundingRate: 0.0003, directMarkPrice: 100 }] });
    expect(label.fundingEventCount).toBe(2);
    expect(label.fundingBurdenBps).toBeLessThan(0);
  });

  it("mirrors MFE and MAE for LONG and SHORT", () => {
    const candles = Object.freeze([...common.candles1m].map((value, index) => index === 10 ? minuteCandle(value.openTime, 100, 110, 95) : value));
    const long = computeR13ForwardLabel({ ...common, candles1m: candles, direction: "LONG", horizonHours: 4 });
    const short = computeR13ForwardLabel({ ...common, candles1m: candles, direction: "SHORT", horizonHours: 4 });
    expect(long.mfeAtr).toBeGreaterThan(short.mfeAtr!);
    expect(short.maeAtr).toBeGreaterThan(long.maeAtr!);
    expect(long.timeToMfeMinutes).toBeGreaterThanOrEqual(0);
  });
});

describe("Round-013 model, purge, cross-sectional selection, and drawdown", () => {
  function examples(count = 30) {
    return Array.from({ length: count }, (_, index) => ({ features: featureVectorFromOrderedValues(R13_FEATURE_NAMES.map((_, featureIndex) => (index + 1) * (featureIndex + 1) / 100)), targetNetForwardAtr: index / 100 }));
  }

  it("fits research-only standardization and deterministic ridge without symbol identity", () => {
    const model = fitR13RidgeModel(examples());
    expect(model.lambda).toBe(10);
    expect(model.interceptPenalized).toBe(false);
    expect(Object.keys(model.coefficients)).toEqual([...R13_FEATURE_NAMES]);
    expect(predictR13RidgeModel(model, examples()[0]!.features)).toBeTypeOf("number");
    expect(model.modelIdentitySha256).toMatch(/^[0-9a-f]{64}$/u);
  });

  it("does not leak validation labels through the 24-hour purge", () => {
    const validationStart = BASE + 100 * HOUR;
    expect(isR13TrainingObservationPurgeSafe({ decisionTime: validationStart - 24 * HOUR - 7 * MINUTE, validationStartTime: validationStart })).toBe(true);
    expect(isR13TrainingObservationPurgeSafe({ decisionTime: validationStart - 24 * HOUR - 6 * MINUTE, validationStartTime: validationStart })).toBe(false);
    expect(r13PurgeTrainingObservations([{ decisionTime: validationStart - 30 * HOUR }, { decisionTime: validationStart - 1 * HOUR }], validationStart)).toHaveLength(1);
  });

  it("selects only TOP1 at one timestamp and returns NO_TRADE for non-positive predictions", () => {
    const opportunities = [{ symbol: "ETHUSDT", direction: "SHORT" as const, prediction: 0.2 }, { symbol: "BTCUSDT", direction: "LONG" as const, prediction: 0.2 }, { symbol: "SOLUSDT", direction: "LONG" as const, prediction: -1 }];
    expect(r13SelectTopOne(opportunities).selected?.symbol).toBe("BTCUSDT");
    expect(r13SelectTopOne(opportunities.map((value) => ({ ...value, prediction: -Math.abs(value.prediction) }))).noTrade).toBe(true);
  });

  it("uses the one canonical equity/drawdown implementation", () => {
    expect(calculateR13Drawdown([{ decisionTime: 3, symbol: "ETHUSDT", direction: "SHORT", netForwardAtr: 1 }, { decisionTime: 1, symbol: "BTCUSDT", direction: "LONG", netForwardAtr: 2 }, { decisionTime: 2, symbol: "BTCUSDT", direction: "SHORT", netForwardAtr: -4 }])).toEqual({ cumulativeNetForwardAtr: -1, maximumDrawdownAtr: -4, orderedObservationCount: 3 });
  });
});

describe("Round-013 discovery gates and selection", () => {
  const passing = { horizonHours: 4 as const, selectedValidationObservationsAggregate: 500, selectedValidationObservationsByFold: { F1: 50, F2: 50, F3: 50, F4: 50, F5: 50, F6: 50 }, meanNetForwardAtr: 0.1, atrProfitFactor: 1.3, positiveMeanEdgeFolds: 5, catastrophicFolds: 0, positiveSpearmanFolds: 5, pooledSpearman: 0.03, topBottomDecileSpread: 0.15, positiveSpreadFolds: 5, costStressMean: 0.01, costStressProfitFactor: 1.05, latencyStressMean: 0.01, maximumPositiveSymbolContributionShare: 0.5, maximumSinglePositiveObservationContribution: 0.05, evidenceIntegrity: true, modelProvenance: true };

  it("requires every A-P gate and fails closed on one missing requirement", () => {
    expect(evaluateR13HorizonGates(passing).eligibility).toBe("ELIGIBLE");
    expect(evaluateR13HorizonGates({ ...passing, modelProvenance: false }).eligibility).toBe("INELIGIBLE");
  });

  it("does not promote an ineligible horizon or apply selection when none pass", () => {
    expect(selectR13Horizon([{ horizonHours: 4, eligible: false, meanNetForwardAtr: 1, costStressMean: 1, maximumDrawdownAtr: -1, atrProfitFactor: 2 }])).toMatchObject({ selectedDiscoveryHorizon: null, selectionAlgorithmApplied: false, finalDecision: "NO ROBUST FORWARD EDGE — ROUND-013" });
    expect(selectR13Horizon([{ horizonHours: 4, eligible: true, meanNetForwardAtr: 0.2, costStressMean: 0.1, maximumDrawdownAtr: -1, atrProfitFactor: 2 }, { horizonHours: 8, eligible: true, meanNetForwardAtr: 0.1, costStressMean: 0.1, maximumDrawdownAtr: -1, atrProfitFactor: 2 }]).selectedDiscoveryHorizon).toBe(4);
  });
});
