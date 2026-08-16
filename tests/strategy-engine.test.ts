import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, STRATEGY_VERSION, type ResearchSymbol } from "@/lib/config/constants";
import { evaluateCandidate, type CandidateFeatures, type CandidateInput } from "@/lib/strategy/candidate";
import { evaluateStrategy } from "@/lib/strategy/engine";
import { calculateBTCRegime, calculateSymbolRegime } from "@/lib/strategy/regimes";
import { rankCandidates } from "@/lib/strategy/ranking";
import { gradeForScore, scoreCandidate } from "@/lib/strategy/scoring";
import type {
  StrategyCandidate,
  StrategyDataset,
  StrategyInput,
} from "@/lib/strategy/types";
import type { Candle } from "@/lib/market-data/types";

const HOUR_MS = 3_600_000;
const FOUR_HOUR_MS = 14_400_000;
const DEFAULT_EVALUATION_TIME = 4_000_000_000;

function makeCandle(
  symbol: ResearchSymbol,
  timeframe: "1h" | "4h",
  index: number,
  close: number,
  high = close + 1,
  low = close - 1,
  quoteVolume = 100,
): Candle {
  const interval = timeframe === "1h" ? HOUR_MS : FOUR_HOUR_MS;
  return {
    symbol,
    timeframe,
    openTime: index * interval,
    closeTime: index * interval + interval - 1,
    open: close,
    high,
    low,
    close,
    volume: quoteVolume / 10,
    quoteVolume,
    tradeCount: 10,
    takerBuyBaseVolume: quoteVolume / 20,
    takerBuyQuoteVolume: quoteVolume / 20,
  };
}

function filledSeries(length: number, value: number | null): (number | null)[] {
  return Array.from({ length }, () => value);
}

function makeDirectCandidateInput(
  direction: "LONG" | "SHORT",
  options: Readonly<{
    atr1h?: number;
    atr4h?: number;
    btcRegime?: CandidateInput["btcRegime"];
    rsi?: number;
    volume?: number;
  }> = {},
): CandidateInput {
  const symbol = "ETHUSDT";
  const candles1h = Array.from({ length: 55 }, (_, index) =>
    makeCandle(
      symbol,
      "1h",
      index,
      direction === "LONG" ? 100 : 100,
      direction === "LONG" ? 101 : 101,
      direction === "LONG" ? 99 : 99,
      index === 54 ? options.volume ?? 200 : options.volume === 0 ? 0 : 100,
    ),
  );

  if (direction === "LONG") {
    candles1h[54] = makeCandle(symbol, "1h", 54, 102, 103, 101, options.volume ?? 200);
  } else {
    candles1h[54] = makeCandle(symbol, "1h", 54, 98, 99, 97, options.volume ?? 200);
  }

  const candles4h = Array.from({ length: 205 }, (_, index) =>
    makeCandle(symbol, "4h", index, direction === "LONG" ? 110 : 90),
  );
  const ema20_1h = filledSeries(55, 100);
  const ema50_1h = filledSeries(55, 100);
  const rsi14_1h = filledSeries(55, options.rsi ?? (direction === "LONG" ? 60 : 40));
  const atr14_1h = filledSeries(55, options.atr1h ?? 2);
  const ema50_4h = filledSeries(205, direction === "LONG" ? 105 : 95);
  const ema200_4h = filledSeries(205, 100);
  const atr14_4h = filledSeries(205, options.atr4h ?? 5);

  ema200_4h[199] = direction === "LONG" ? 95 : 105;

  return {
    symbol,
    direction,
    candles1h,
    candles4h,
    ema20_1h,
    ema50_1h,
    rsi14_1h,
    atr14_1h,
    ema50_4h,
    ema200_4h,
    atr14_4h,
    symbolRegime: direction === "LONG" ? "LONG_ONLY" : "SHORT_ONLY",
    btcRegime: options.btcRegime ?? "BTC_NEUTRAL",
  };
}

function makeTrendCandles(symbol: ResearchSymbol): Candle[] {
  return Array.from({ length: 205 }, (_, index) => {
    const close = 100 + index;
    return makeCandle(symbol, "4h", index, close, close + 1, close - 1);
  });
}

function makeSignalCandles(symbol: ResearchSymbol, quoteVolumeZero = false): Candle[] {
  const closes = Array.from({ length: 55 }, (_, index) => 100 + index * 0.4);
  const controlledCloses: Record<number, number> = {
    40: 115,
    41: 117,
    42: 114,
    43: 116,
    44: 113,
    45: 115,
    46: 112,
    47: 114,
    48: 111,
    49: 113,
    50: 114,
    51: 115,
    52: 114,
    53: 117,
    54: 121,
  };

  for (const [index, close] of Object.entries(controlledCloses)) {
    closes[Number(index)] = close;
  }

  return closes.map((close, index) =>
    makeCandle(
      symbol,
      "1h",
      index,
      close,
      close + 3,
      close - 3,
      quoteVolumeZero ? 0 : index === 54 ? 200 : 100,
    ),
  );
}

function makeDataset(
  symbol: ResearchSymbol,
  options: Readonly<{
    quoteVolumeZero?: boolean;
    shortTrend?: boolean;
    shortHistory?: boolean;
    invalidCandle?: boolean;
  }> = {},
): StrategyDataset {
  const trendCandles = makeTrendCandles(symbol);
  const signalCandles = makeSignalCandles(symbol, options.quoteVolumeZero);

  if (options.shortTrend) {
    trendCandles.pop();
  }

  if (options.invalidCandle) {
    signalCandles[20] = { ...signalCandles[20], close: Number.NaN };
  }

  if (options.shortHistory) {
    signalCandles.pop();
  }

  return {
    symbol,
    candles1h: signalCandles,
    candles4h: options.shortTrend
      ? trendCandles
      : options.shortHistory
        ? makeTrendCandles(symbol).slice(0, 205)
        : trendCandles,
  };
}

function makeEngineInput(
  overrides: Partial<Record<ResearchSymbol, StrategyDataset | null>> = {},
  evaluationTime = DEFAULT_EVALUATION_TIME,
): StrategyInput {
  return {
    evaluationTime,
    datasets: Object.fromEntries(
      RESEARCH_SYMBOLS.map((symbol) => [
        symbol,
        Object.prototype.hasOwnProperty.call(overrides, symbol)
          ? overrides[symbol] ?? null
          : makeDataset(symbol),
      ]),
    ) as StrategyInput["datasets"],
  };
}

function makeCandidate(symbol: ResearchSymbol, totalScore: number): StrategyCandidate {
  return {
    strategyVersion: STRATEGY_VERSION,
    symbol,
    direction: "LONG",
    symbolRegime: "LONG_ONLY",
    btcRegime: "BTC_NEUTRAL",
    entryReference: 100,
    stopReference: 98,
    takeProfitReference: 104,
    stopDistance: 2,
    stopAtr: 1,
    breakdown: {
      trendStrength: totalScore,
      pullbackQuality: 0,
      breakoutStrength: 0,
      volumeScore: 0,
      riskRewardScore: 0,
    },
    totalScore,
    grade: gradeForScore(totalScore),
    formalSignal: totalScore >= 70,
  };
}

describe("M2-B regimes, candidate rules, and score", () => {
  it("implements strict symbol and BTC regime boundaries", () => {
    expect(
      calculateSymbolRegime({ close: 110, ema50: 105, ema200: 100, ema200FiveBarsAgo: 95 }),
    ).toBe("LONG_ONLY");
    expect(
      calculateSymbolRegime({ close: 90, ema50: 95, ema200: 100, ema200FiveBarsAgo: 105 }),
    ).toBe("SHORT_ONLY");
    expect(
      calculateSymbolRegime({ close: 100, ema50: 105, ema200: 100, ema200FiveBarsAgo: 95 }),
    ).toBe("NO_TRADE");
    expect(
      calculateSymbolRegime({ close: 100, ema50: 100, ema200: 100, ema200FiveBarsAgo: 95 }),
    ).toBe("NO_TRADE");
    expect(
      calculateSymbolRegime({ close: 110, ema50: 105, ema200: 100, ema200FiveBarsAgo: 100 }),
    ).toBe("NO_TRADE");

    expect(
      calculateBTCRegime({ close: 110, ema50: 105, ema200: 100, ema200FiveBarsAgo: 95, atr14: 5 }),
    ).toBe("BTC_STRONG_BULL");
    expect(
      calculateBTCRegime({ close: 90, ema50: 95, ema200: 100, ema200FiveBarsAgo: 105, atr14: 5 }),
    ).toBe("BTC_STRONG_BEAR");
    expect(
      calculateBTCRegime({ close: 101, ema50: 100.5, ema200: 100, ema200FiveBarsAgo: 99.9, atr14: 5 }),
    ).toBe("BTC_NEUTRAL");
    expect(
      calculateBTCRegime({ close: 110, ema50: 105, ema200: 100, ema200FiveBarsAgo: 95, atr14: 0 }),
    ).toBeNull();
    expect(
      calculateBTCRegime({ close: 110, ema50: 105, ema200: 100, ema200FiveBarsAgo: 99, atr14: 10 }),
    ).toBe("BTC_STRONG_BULL");
    expect(
      calculateBTCRegime({ close: 109.99, ema50: 105, ema200: 100, ema200FiveBarsAgo: 99, atr14: 10 }),
    ).toBe("BTC_NEUTRAL");
    expect(
      calculateBTCRegime({ close: 110, ema50: 104.99, ema200: 100, ema200FiveBarsAgo: 99, atr14: 10 }),
    ).toBe("BTC_NEUTRAL");
    expect(
      calculateBTCRegime({ close: 110, ema50: 105, ema200: 100, ema200FiveBarsAgo: 99.01, atr14: 10 }),
    ).toBe("BTC_NEUTRAL");
  });

  it("rejects a wrong-direction BTC EMA200 slope", () => {
    expect(
      calculateBTCRegime({
        close: 110,
        ema50: 105,
        ema200: 100,
        ema200FiveBarsAgo: 101,
        atr14: 10,
      }),
    ).toBe("BTC_NEUTRAL");
    expect(
      calculateBTCRegime({
        close: 90,
        ema50: 95,
        ema200: 100,
        ema200FiveBarsAgo: 99,
        atr14: 10,
      }),
    ).toBe("BTC_NEUTRAL");
  });

  it("requires pullback, breakout, RSI, volume, and the inclusive stop guard", () => {
    const long = evaluateCandidate(makeDirectCandidateInput("LONG"));
    expect(long.kind).toBe("ELIGIBLE");
    if (long.kind === "ELIGIBLE") {
      expect(long.features.entryReference).toBe(102);
      expect(long.features.stopReference).toBeCloseTo(98.6, 12);
      expect(long.features.takeProfitReference).toBeCloseTo(108.8, 12);
      expect(long.features.pullbackQuality).toBe(20);
    }

    const short = evaluateCandidate(makeDirectCandidateInput("SHORT"));
    expect(short.kind).toBe("ELIGIBLE");

    const ema20Only = makeDirectCandidateInput("LONG");
    expect(
      evaluateCandidate({
        ...ema20Only,
        ema50_1h: filledSeries(55, 90),
      }),
    ).toMatchObject({ kind: "ELIGIBLE", features: { pullbackQuality: 15 } });
    const ema50Only = makeDirectCandidateInput("LONG");
    expect(
      evaluateCandidate({
        ...ema50Only,
        ema20_1h: filledSeries(55, 90),
      }),
    ).toMatchObject({ kind: "ELIGIBLE", features: { pullbackQuality: 20 } });
    const oldDeepRecentShallow = makeDirectCandidateInput("LONG");
    const oldDeepEma50 = filledSeries(55, 90);
    oldDeepEma50[49] = 100;
    const recentEma20 = filledSeries(55, 90);
    recentEma20[53] = 100;
    expect(
      evaluateCandidate({
        ...oldDeepRecentShallow,
        ema20_1h: recentEma20,
        ema50_1h: oldDeepEma50,
      }),
    ).toMatchObject({ kind: "ELIGIBLE", features: { pullbackQuality: 20 } });
    const tMinus3Touch = makeDirectCandidateInput("LONG");
    const tMinus3Ema20 = filledSeries(55, 90);
    tMinus3Ema20[51] = 100;
    expect(
      evaluateCandidate({
        ...tMinus3Touch,
        ema20_1h: tMinus3Ema20,
        ema50_1h: filledSeries(55, 90),
      }),
    ).toMatchObject({ kind: "ELIGIBLE", features: { pullbackQuality: 13 } });

    expect(evaluateCandidate(makeDirectCandidateInput("LONG", { atr1h: 0 }))).toEqual({
      kind: "INELIGIBLE",
      reason: "INVALID_ATR",
    });
    expect(evaluateCandidate(makeDirectCandidateInput("LONG", { atr4h: 0 }))).toEqual({
      kind: "INELIGIBLE",
      reason: "INVALID_ATR",
    });
    const nonFiniteIndicator = makeDirectCandidateInput("LONG");
    expect(
      evaluateCandidate({
        ...nonFiniteIndicator,
        ema20_1h: nonFiniteIndicator.ema20_1h.map((value, index) =>
          index === 49 ? Number.NaN : value,
        ),
      }),
    ).toEqual({
      kind: "INELIGIBLE",
      reason: "INDICATOR_UNAVAILABLE",
    });
    expect(
      evaluateCandidate({
        ...nonFiniteIndicator,
        ema20_1h: nonFiniteIndicator.ema20_1h.map((value, index) =>
          index === 49 ? Number.POSITIVE_INFINITY : value,
        ),
      }),
    ).toEqual({
      kind: "INELIGIBLE",
      reason: "INDICATOR_UNAVAILABLE",
    });
    expect(evaluateCandidate(makeDirectCandidateInput("LONG", { volume: 0 }))).toEqual({
      kind: "INELIGIBLE",
      reason: "INVALID_VOLUME_BASELINE",
    });
    expect(
      evaluateCandidate({
        ...makeDirectCandidateInput("LONG"),
        rsi14_1h: filledSeries(55, null),
      }),
    ).toEqual({
      kind: "INELIGIBLE",
      reason: "INDICATOR_UNAVAILABLE",
    });
    expect(
      evaluateCandidate({
        ...makeDirectCandidateInput("LONG"),
        atr14_1h: filledSeries(55, null),
      }),
    ).toEqual({
      kind: "INELIGIBLE",
      reason: "INDICATOR_UNAVAILABLE",
    });
    const fewerThanTwentyPriorCandles = makeDirectCandidateInput("LONG");
    expect(
      evaluateCandidate({
        ...fewerThanTwentyPriorCandles,
        candles1h: fewerThanTwentyPriorCandles.candles1h.slice(0, 54),
      }),
    ).toEqual({
      kind: "INELIGIBLE",
      reason: "INSUFFICIENT_HISTORY",
    });
    expect(evaluateCandidate(makeDirectCandidateInput("LONG", { rsi: 50 }))).toEqual({
      kind: "INELIGIBLE",
      reason: "RSI_OUT_OF_RANGE",
    });
    expect(evaluateCandidate(makeDirectCandidateInput("LONG", { rsi: 70 }))).toEqual({
      kind: "INELIGIBLE",
      reason: "RSI_OUT_OF_RANGE",
    });
    expect(evaluateCandidate(makeDirectCandidateInput("SHORT", { rsi: 30 }))).toEqual({
      kind: "INELIGIBLE",
      reason: "RSI_OUT_OF_RANGE",
    });
    expect(evaluateCandidate(makeDirectCandidateInput("SHORT", { rsi: 50 }))).toEqual({
      kind: "INELIGIBLE",
      reason: "RSI_OUT_OF_RANGE",
    });
    const noPullback = makeDirectCandidateInput("LONG");
    expect(
      evaluateCandidate({
        ...noPullback,
        candles1h: noPullback.candles1h.map((candle, index) =>
          index >= 49 && index < 54 ? { ...candle, low: 101 } : candle,
        ),
      }),
    ).toEqual({
      kind: "INELIGIBLE",
      reason: "PULLBACK_NOT_FOUND",
    });
    const noBreakout = makeDirectCandidateInput("LONG");
    expect(
      evaluateCandidate({
        ...noBreakout,
        candles1h: noBreakout.candles1h.map((candle, index) =>
          index === 54 ? { ...candle, close: 100, high: 101, low: 99 } : candle,
        ),
      }),
    ).toEqual({
      kind: "INELIGIBLE",
      reason: "BREAKOUT_NOT_CONFIRMED",
    });
    expect(
      evaluateCandidate({
        ...makeDirectCandidateInput("SHORT"),
        btcRegime: "BTC_STRONG_BULL",
      }),
    ).toEqual({
      kind: "INELIGIBLE",
      reason: "BTC_DIRECTION_BLOCKED",
    });
    expect(
      evaluateCandidate({
        ...makeDirectCandidateInput("LONG"),
        btcRegime: "BTC_STRONG_BEAR",
      }),
    ).toEqual({
      kind: "INELIGIBLE",
      reason: "BTC_DIRECTION_BLOCKED",
    });
    expect(
      evaluateCandidate({
        ...makeDirectCandidateInput("SHORT"),
        symbol: "BTCUSDT",
        btcRegime: "BTC_STRONG_BULL",
      }).kind,
    ).toBe("ELIGIBLE");
    expect(evaluateCandidate({ ...makeDirectCandidateInput("LONG"), btcRegime: null })).toEqual({
      kind: "INELIGIBLE",
      reason: "INVALID_BTC_INPUT",
    });
    expect(evaluateCandidate(makeDirectCandidateInput("LONG", { atr1h: 5 })).kind).toBe("ELIGIBLE");
    expect(evaluateCandidate(makeDirectCandidateInput("LONG", { atr1h: 3 / 2.8 })).kind).toBe("ELIGIBLE");
    expect(evaluateCandidate(makeDirectCandidateInput("LONG", { atr1h: 1 }))).toEqual({
      kind: "INELIGIBLE",
      reason: "STOP_ATR_OUT_OF_RANGE",
    });
    expect(evaluateCandidate(makeDirectCandidateInput("LONG", { atr1h: 6 }))).toEqual({
      kind: "INELIGIBLE",
      reason: "STOP_ATR_OUT_OF_RANGE",
    });
  });

  it("uses the five component tables, exact grade boundaries, and score consistency", () => {
    const features: CandidateFeatures = {
      entryReference: 110,
      stopReference: 105,
      takeProfitReference: 120,
      stopDistance: 5,
      stopAtr: 1,
      pullbackQuality: 20,
      breakoutDistance: 0.5,
      volumeRatio: 1.5,
      close4h: 110,
      ema50_4h: 105,
      ema200_4h: 100,
      ema200FiveBarsAgo: 95,
      atr14_4h: 5,
      atr14_1h: 2,
    };
    const score = scoreCandidate("LONG", features);

    expect(score).not.toBeNull();
    expect(score?.breakdown).toEqual({
      trendStrength: 40,
      pullbackQuality: 20,
      breakoutStrength: 20,
      volumeScore: 10,
      riskRewardScore: 10,
    });
    expect(score?.totalScore).toBe(100);
    expect([69, 70, 74, 75, 84, 85, 100].map(gradeForScore)).toEqual([
      null,
      "C",
      "C",
      "B",
      "B",
      "A",
      "A",
    ]);

    expect(scoreCandidate("LONG", { ...features, breakoutDistance: 0.09 })?.breakdown.breakoutStrength).toBe(10);
    expect(scoreCandidate("LONG", { ...features, breakoutDistance: 0.1 })?.breakdown.breakoutStrength).toBe(14);
    expect(scoreCandidate("LONG", { ...features, breakoutDistance: 0.25 })?.breakdown.breakoutStrength).toBe(17);
    expect(scoreCandidate("LONG", { ...features, breakoutDistance: 0.5 })?.breakdown.breakoutStrength).toBe(20);
    expect(scoreCandidate("LONG", { ...features, volumeRatio: 0.99 })?.breakdown.volumeScore).toBe(0);
    expect(scoreCandidate("LONG", { ...features, volumeRatio: 1 })?.breakdown.volumeScore).toBe(4);
    expect(scoreCandidate("LONG", { ...features, volumeRatio: 1.2 })?.breakdown.volumeScore).toBe(7);
    expect(scoreCandidate("LONG", { ...features, volumeRatio: 1.5 })?.breakdown.volumeScore).toBe(10);
    expect(scoreCandidate("LONG", { ...features, stopAtr: 0.8 })?.breakdown.riskRewardScore).toBe(7);
    expect(scoreCandidate("LONG", { ...features, stopAtr: 1 })?.breakdown.riskRewardScore).toBe(10);
    expect(scoreCandidate("LONG", { ...features, stopAtr: 2.5 })?.breakdown.riskRewardScore).toBe(7);
    expect(scoreCandidate("LONG", { ...features, stopAtr: 3 })?.breakdown.riskRewardScore).toBe(4);
    expect(scoreCandidate("LONG", { ...features, stopAtr: 0.99 })?.breakdown.riskRewardScore).toBe(7);
    expect(scoreCandidate("LONG", { ...features, stopAtr: 2.01 })?.breakdown.riskRewardScore).toBe(7);
    expect(scoreCandidate("LONG", { ...features, stopAtr: 2.51 })?.breakdown.riskRewardScore).toBe(4);

    const withTrend = (closeDistance: number, spread: number, slope: number): CandidateFeatures => ({
      ...features,
      close4h: 100 + closeDistance * 5,
      ema50_4h: 100 + spread * 5,
      ema200_4h: 100,
      ema200FiveBarsAgo: 100 - slope * 5,
      atr14_4h: 5,
    });
    expect(scoreCandidate("LONG", withTrend(0.001, 1, 1))?.breakdown.trendStrength).toBe(29);
    expect(scoreCandidate("LONG", withTrend(0.5, 1, 1))?.breakdown.trendStrength).toBe(33);
    expect(scoreCandidate("LONG", withTrend(1, 1, 1))?.breakdown.trendStrength).toBe(37);
    expect(scoreCandidate("LONG", withTrend(1.5, 1, 1))?.breakdown.trendStrength).toBe(40);
    expect(scoreCandidate("LONG", withTrend(1, 0.001, 1))?.breakdown.trendStrength).toBe(26);
    expect(scoreCandidate("LONG", withTrend(1, 0.25, 1))?.breakdown.trendStrength).toBe(30);
    expect(scoreCandidate("LONG", withTrend(1, 0.5, 1))?.breakdown.trendStrength).toBe(34);
    expect(scoreCandidate("LONG", withTrend(1, 0.75, 1))?.breakdown.trendStrength).toBe(37);
    expect(scoreCandidate("LONG", withTrend(1, 1, 0.001))?.breakdown.trendStrength).toBe(29);
    expect(scoreCandidate("LONG", withTrend(1, 1, 0.05))?.breakdown.trendStrength).toBe(32);
    expect(scoreCandidate("LONG", withTrend(1, 1, 0.1))?.breakdown.trendStrength).toBe(35);
    expect(scoreCandidate("LONG", withTrend(1, 1, 0.2))?.breakdown.trendStrength).toBe(37);
  });

  it("ranks formal candidates by score and fixed research-universe order", () => {
    const ranked = rankCandidates([
      makeCandidate("BNBUSDT", 80),
      makeCandidate("BTCUSDT", 80),
      makeCandidate("ETHUSDT", 85),
      makeCandidate("SOLUSDT", 80),
    ]);

    expect(ranked.map((candidate) => candidate.symbol)).toEqual([
      "ETHUSDT",
      "BTCUSDT",
      "SOLUSDT",
      "BNBUSDT",
    ]);
    expect(rankCandidates(ranked)).toEqual(ranked);
  });
});

describe("M2-B pure Strategy Engine", () => {
  it("produces the same deterministic result for realtime and backtest-shaped inputs", () => {
    const evaluationTime = makeDataset("BTCUSDT").candles4h.at(-1)?.closeTime ?? 0;
    const input = makeEngineInput({}, evaluationTime);
    const realtimeResult = evaluateStrategy(input);
    const backtestResult = evaluateStrategy(structuredClone(input) as StrategyInput);

    expect(realtimeResult).toEqual(backtestResult);
    expect(realtimeResult.strategyVersion).toBe("baseline-001");
    expect(realtimeResult.btcRegime).toBe("BTC_STRONG_BULL");
    expect(realtimeResult.rankedCandidates.map((candidate) => candidate.symbol)).toEqual(RESEARCH_SYMBOLS);
    expect(realtimeResult.rankedCandidates.every((candidate) => candidate.formalSignal)).toBe(true);
  });

  it("allows a normalized dataset whose latest closed candles are at the as-of time", () => {
    const evaluationTime = makeDataset("BTCUSDT").candles4h.at(-1)?.closeTime ?? 0;
    const result = evaluateStrategy(makeEngineInput({}, evaluationTime));

    expect(result.btcRegime).toBe("BTC_STRONG_BULL");
    expect(result.evaluations.every((evaluation) => evaluation.reason !== "FUTURE_DATA")).toBe(true);
  });

  it("fails closed when a supplied 4H candle is after evaluationTime", () => {
    const evaluationTime = makeDataset("ETHUSDT").candles4h.at(-1)?.closeTime ?? 0;
    const futureEthTrend = [
      ...makeDataset("ETHUSDT").candles4h,
      makeCandle("ETHUSDT", "4h", 205, 305, 306, 304),
    ];
    const futureEthResult = evaluateStrategy(
      makeEngineInput(
        {
          ETHUSDT: { ...makeDataset("ETHUSDT"), candles4h: futureEthTrend },
        },
        evaluationTime,
      ),
    );
    const ethEvaluation = futureEthResult.evaluations.find(
      (evaluation) => evaluation.symbol === "ETHUSDT" && evaluation.direction === "LONG",
    );

    expect(ethEvaluation?.reason).toBe("FUTURE_DATA");
    expect(ethEvaluation?.candidate).toBeNull();
    expect(futureEthResult.rankedCandidates.some((candidate) => candidate.symbol === "ETHUSDT")).toBe(false);

    const futureBtcTrend = [
      ...makeDataset("BTCUSDT").candles4h,
      makeCandle("BTCUSDT", "4h", 205, 305, 306, 304),
    ];
    const futureBtcResult = evaluateStrategy(
      makeEngineInput(
        {
          BTCUSDT: { ...makeDataset("BTCUSDT"), candles4h: futureBtcTrend },
        },
        evaluationTime,
      ),
    );

    expect(futureBtcResult.btcRegime).toBeNull();
    expect(
      futureBtcResult.evaluations.find(
        (evaluation) => evaluation.symbol === "ETHUSDT" && evaluation.direction === "LONG",
      )?.reason,
    ).toBe("INVALID_BTC_INPUT");
    expect(futureBtcResult.rankedCandidates).toEqual([]);
  });

  it("rejects a non-finite evaluationTime without consulting the wall clock", () => {
    const result = evaluateStrategy({
      ...makeEngineInput(),
      evaluationTime: Number.NaN,
    });

    expect(result.btcRegime).toBeNull();
    expect(result.evaluations.every((evaluation) => evaluation.reason === "TIME_ALIGNMENT_INVALID")).toBe(true);
    expect(result.rankedCandidates).toEqual([]);
  });

  it("fails closed for warm-up, invalid candles, zero denominators, and zero volume means", () => {
    const shortHistory = evaluateStrategy(
      makeEngineInput({ ETHUSDT: makeDataset("ETHUSDT", { shortTrend: true }) }),
    );
    expect(shortHistory.evaluations.find((evaluation) => evaluation.symbol === "ETHUSDT" && evaluation.direction === "LONG")?.reason).toBe("INSUFFICIENT_HISTORY");

    const insufficient1hWarmup = evaluateStrategy(
      makeEngineInput({ ETHUSDT: makeDataset("ETHUSDT", { shortHistory: true }) }),
    );
    expect(insufficient1hWarmup.evaluations.find((evaluation) => evaluation.symbol === "ETHUSDT" && evaluation.direction === "LONG")?.reason).toBe("INSUFFICIENT_HISTORY");

    const invalidCandle = evaluateStrategy(
      makeEngineInput({ ETHUSDT: makeDataset("ETHUSDT", { invalidCandle: true }) }),
    );
    expect(invalidCandle.evaluations.find((evaluation) => evaluation.symbol === "ETHUSDT" && evaluation.direction === "LONG")?.reason).toBe("INVALID_CANDLE_SERIES");

    const zeroVolume = evaluateStrategy(
      makeEngineInput({ ETHUSDT: makeDataset("ETHUSDT", { quoteVolumeZero: true }) }),
    );
    expect(zeroVolume.evaluations.find((evaluation) => evaluation.symbol === "ETHUSDT" && evaluation.direction === "LONG")?.reason).toBe("INVALID_VOLUME_BASELINE");

    const noNaNScore = zeroVolume.evaluations
      .map((evaluation) => evaluation.candidate?.totalScore)
      .filter((score): score is number => score !== undefined);
    expect(noNaNScore.every(Number.isFinite)).toBe(true);
  });

  it("blocks all non-BTC candidates when BTC inputs are unavailable and never invents neutral", () => {
    const result = evaluateStrategy(makeEngineInput({ BTCUSDT: null }));

    expect(result.btcRegime).toBeNull();
    expect(
      result.evaluations
        .filter(
          (evaluation) =>
            evaluation.symbol !== "BTCUSDT" && evaluation.direction === "LONG",
        )
        .every((evaluation) => evaluation.reason === "INVALID_BTC_INPUT"),
    ).toBe(true);
    expect(result.rankedCandidates).toEqual([]);

    const flatBtc = Array.from({ length: 205 }, (_, index) =>
      makeCandle("BTCUSDT", "4h", index, 100, 100, 100),
    );
    const invalidBtcResult = evaluateStrategy(
      makeEngineInput({
        BTCUSDT: { ...makeDataset("BTCUSDT"), candles4h: flatBtc },
      }),
    );
    expect(invalidBtcResult.btcRegime).toBeNull();
    expect(
      invalidBtcResult.evaluations.find(
        (evaluation) => evaluation.symbol === "ETHUSDT" && evaluation.direction === "LONG",
      )?.reason,
    ).toBe("INVALID_BTC_INPUT");
  });

  it("keeps a zero 4H ATR invalid instead of calculating normalized regime scores", () => {
    const flatTrend = Array.from({ length: 205 }, (_, index) =>
      makeCandle("ETHUSDT", "4h", index, 100, 100, 100),
    );
    const result = evaluateStrategy(
      makeEngineInput({
        ETHUSDT: {
          ...makeDataset("ETHUSDT"),
          candles4h: flatTrend,
        },
      }),
    );

    const evaluation = result.evaluations.find(
      (item) => item.symbol === "ETHUSDT" && item.direction === "LONG",
    );
    expect(evaluation?.reason).toBe("INVALID_ATR");
    expect(evaluation?.candidate).toBeNull();
  });
});
