import {
  calculateAtr14,
  calculateEma20,
  calculateEma50,
  calculateEma200,
  calculateRsi14,
  type IndicatorSeries,
} from "../indicators/index.ts";
import {
  RESEARCH_SYMBOLS,
  STRATEGY_VERSION,
  TIMEFRAMES,
  type ResearchSymbol,
} from "../config/constants.ts";
import type { Candle } from "../market-data/types.ts";
import { evaluateCandidate, type CandidateResult } from "./candidate.ts";
import { calculateBTCRegime, calculateSymbolRegime } from "./regimes.ts";
import { rankCandidates } from "./ranking.ts";
import { gradeForScore, isFormalScore, scoreCandidate } from "./scoring.ts";
import {
  STRATEGY_DIRECTIONS,
  type BTCRegime,
  type SignalGrade,
  type StrategyCandidate,
  type StrategyDataset,
  type StrategyDirection,
  type StrategyEngineResult,
  type StrategyEvaluation,
  type StrategyEvaluationStatus,
  type StrategyInput,
  type StrategyReasonCode,
  type SymbolRegime,
} from "./types.ts";

type DerivedDataset = Readonly<{
  dataset: StrategyDataset;
  ema20_1h: IndicatorSeries;
  ema50_1h: IndicatorSeries;
  rsi14_1h: IndicatorSeries;
  atr14_1h: IndicatorSeries;
  ema50_4h: IndicatorSeries;
  ema200_4h: IndicatorSeries;
  atr14_4h: IndicatorSeries;
  symbolRegime: SymbolRegime | null;
}>;

function finite(value: number | null | undefined): value is number {
  return value !== null && value !== undefined && Number.isFinite(value);
}

function validCandle(candle: Candle, symbol: ResearchSymbol, timeframe: string): boolean {
  if (candle.symbol !== symbol || candle.timeframe !== timeframe) {
    return false;
  }

  if (
    ![
      candle.openTime,
      candle.closeTime,
      candle.open,
      candle.high,
      candle.low,
      candle.close,
      candle.volume,
      candle.quoteVolume,
      candle.tradeCount,
      candle.takerBuyBaseVolume,
      candle.takerBuyQuoteVolume,
    ].every((value) => Number.isFinite(value))
  ) {
    return false;
  }

  return candle.closeTime > candle.openTime && candle.high >= candle.low;
}

function validateCandleSeries(
  candles: readonly Candle[],
  symbol: ResearchSymbol,
  timeframe: string,
  evaluationTime: number,
): StrategyReasonCode | null {
  if (candles.length === 0) {
    return "INVALID_CANDLE_SERIES";
  }

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    if (!candle || !validCandle(candle, symbol, timeframe)) {
      return "INVALID_CANDLE_SERIES";
    }

    if (candle.closeTime > evaluationTime) {
      return "FUTURE_DATA";
    }

    const previous = candles[index - 1];
    if (
      previous &&
      (candle.openTime <= previous.openTime || candle.closeTime <= previous.closeTime)
    ) {
      return "INVALID_CANDLE_SERIES";
    }
  }

  return null;
}

function valueAt(series: IndicatorSeries, index: number): number | null {
  const value = series[index];
  return finite(value) ? value : null;
}

function reasonStatus(reason: StrategyReasonCode): StrategyEvaluationStatus {
  switch (reason) {
    case "PULLBACK_NOT_FOUND":
    case "BREAKOUT_NOT_CONFIRMED":
    case "RSI_OUT_OF_RANGE":
    case "STOP_ATR_OUT_OF_RANGE":
    case "SYMBOL_REGIME_NO_TRADE":
    case "SYMBOL_DIRECTION_MISMATCH":
    case "BTC_DIRECTION_BLOCKED":
      return "NO_ELIGIBLE_CANDIDATE";
    default:
      return "INVALID";
  }
}

function invalidEvaluation(
  symbol: ResearchSymbol,
  direction: StrategyDirection,
  reason: StrategyReasonCode,
  symbolRegime: SymbolRegime | null,
  btcRegime: BTCRegime | null,
): StrategyEvaluation {
  return Object.freeze({
    strategyVersion: STRATEGY_VERSION,
    symbol,
    direction,
    status: reasonStatus(reason),
    reason,
    symbolRegime,
    btcRegime,
    candidate: null,
  });
}

function deriveDataset(dataset: StrategyDataset): DerivedDataset {
  const closes1h = dataset.candles1h.map((candle) => candle.close);
  const closes4h = dataset.candles4h.map((candle) => candle.close);
  const ema20_1h = calculateEma20(closes1h);
  const ema50_1h = calculateEma50(closes1h);
  const rsi14_1h = calculateRsi14(closes1h);
  const atr14_1h = calculateAtr14(dataset.candles1h);
  const ema50_4h = calculateEma50(closes4h);
  const ema200_4h = calculateEma200(closes4h);
  const atr14_4h = calculateAtr14(dataset.candles4h);
  const trendIndex = dataset.candles4h.length - 1;
  const symbolRegime = calculateSymbolRegime({
    close: dataset.candles4h[trendIndex]?.close ?? null,
    ema50: valueAt(ema50_4h, trendIndex),
    ema200: valueAt(ema200_4h, trendIndex),
    ema200FiveBarsAgo: valueAt(ema200_4h, trendIndex - 5),
  });

  return Object.freeze({
    dataset,
    ema20_1h,
    ema50_1h,
    rsi14_1h,
    atr14_1h,
    ema50_4h,
    ema200_4h,
    atr14_4h,
    symbolRegime,
  });
}

function evaluateDirection(
  derived: DerivedDataset,
  direction: StrategyDirection,
  btcRegime: BTCRegime | null,
): StrategyEvaluation {
  const { dataset } = derived;
  const candidateResult: CandidateResult = evaluateCandidate({
    symbol: dataset.symbol,
    direction,
    candles1h: dataset.candles1h,
    candles4h: dataset.candles4h,
    ema20_1h: derived.ema20_1h,
    ema50_1h: derived.ema50_1h,
    rsi14_1h: derived.rsi14_1h,
    atr14_1h: derived.atr14_1h,
    ema50_4h: derived.ema50_4h,
    ema200_4h: derived.ema200_4h,
    atr14_4h: derived.atr14_4h,
    symbolRegime: derived.symbolRegime,
    btcRegime,
  });

  if (candidateResult.kind === "INELIGIBLE") {
    return invalidEvaluation(
      dataset.symbol,
      direction,
      candidateResult.reason,
      derived.symbolRegime,
      btcRegime,
    );
  }

  const scoreResult = scoreCandidate(direction, candidateResult.features);
  if (scoreResult === null || !finite(scoreResult.totalScore)) {
    return invalidEvaluation(
      dataset.symbol,
      direction,
      "SCORE_UNAVAILABLE",
      derived.symbolRegime,
      btcRegime,
    );
  }

  if (derived.symbolRegime === null) {
    return invalidEvaluation(
      dataset.symbol,
      direction,
      "INDICATOR_UNAVAILABLE",
      derived.symbolRegime,
      btcRegime,
    );
  }

  if (btcRegime === null) {
    return invalidEvaluation(
      dataset.symbol,
      direction,
      "INVALID_BTC_INPUT",
      derived.symbolRegime,
      btcRegime,
    );
  }

  const formalSignal = isFormalScore(scoreResult.totalScore);
  const grade: SignalGrade | null = gradeForScore(scoreResult.totalScore);
  const candidate: StrategyCandidate = Object.freeze({
    strategyVersion: STRATEGY_VERSION,
    symbol: dataset.symbol,
    direction,
    symbolRegime: derived.symbolRegime,
    btcRegime,
    entryReference: candidateResult.features.entryReference,
    stopReference: candidateResult.features.stopReference,
    takeProfitReference: candidateResult.features.takeProfitReference,
    stopDistance: candidateResult.features.stopDistance,
    stopAtr: candidateResult.features.stopAtr,
    breakdown: scoreResult.breakdown,
    totalScore: scoreResult.totalScore,
    grade,
    formalSignal,
  });

  return Object.freeze({
    strategyVersion: STRATEGY_VERSION,
    symbol: dataset.symbol,
    direction,
    status: formalSignal ? "FORMAL_SIGNAL" : "CANDIDATE_BELOW_THRESHOLD",
    reason: null,
    symbolRegime: derived.symbolRegime,
    btcRegime,
    candidate,
  });
}

export function evaluateStrategy(input: StrategyInput): StrategyEngineResult {
  if (!finite(input.evaluationTime)) {
    const evaluations = RESEARCH_SYMBOLS.flatMap((symbol) =>
      STRATEGY_DIRECTIONS.map((direction) =>
        invalidEvaluation(
          symbol,
          direction,
          "TIME_ALIGNMENT_INVALID",
          null,
          null,
        ),
      ),
    );

    return Object.freeze({
      strategyVersion: STRATEGY_VERSION,
      btcRegime: null,
      evaluations: Object.freeze(evaluations),
      rankedCandidates: Object.freeze([]),
    });
  }

  const derivedBySymbol = new Map<ResearchSymbol, DerivedDataset>();
  const validationReasons = new Map<ResearchSymbol, StrategyReasonCode>();

  for (const symbol of RESEARCH_SYMBOLS) {
    const dataset = input.datasets[symbol];
    if (!dataset) {
      validationReasons.set(symbol, "INSUFFICIENT_HISTORY");
      continue;
    }

    const signalValidation = validateCandleSeries(
      dataset.candles1h,
      symbol,
      TIMEFRAMES.signal,
      input.evaluationTime,
    );
    const trendValidation = validateCandleSeries(
      dataset.candles4h,
      symbol,
      TIMEFRAMES.trend,
      input.evaluationTime,
    );

    if (signalValidation !== null || trendValidation !== null) {
      validationReasons.set(
        symbol,
        signalValidation ?? trendValidation ?? "INVALID_CANDLE_SERIES",
      );
      continue;
    }

    derivedBySymbol.set(symbol, deriveDataset(dataset));
  }

  const btcDerived = derivedBySymbol.get("BTCUSDT");
  let btcRegime: BTCRegime | null = null;
  if (btcDerived && btcDerived.dataset.candles4h.length >= 205) {
    const trendIndex = btcDerived.dataset.candles4h.length - 1;
    const atr14 = valueAt(btcDerived.atr14_4h, trendIndex);
    const close = btcDerived.dataset.candles4h[trendIndex]?.close ?? null;
    const ema50 = valueAt(btcDerived.ema50_4h, trendIndex);
    const ema200 = valueAt(btcDerived.ema200_4h, trendIndex);
    const ema200FiveBarsAgo = valueAt(btcDerived.ema200_4h, trendIndex - 5);
    btcRegime = calculateBTCRegime({
      close,
      ema50,
      ema200,
      ema200FiveBarsAgo,
      atr14,
    });
  }

  const evaluations: StrategyEvaluation[] = [];
  for (const symbol of RESEARCH_SYMBOLS) {
    const derived = derivedBySymbol.get(symbol);
    for (const direction of STRATEGY_DIRECTIONS) {
      if (!derived) {
        const reason = validationReasons.get(symbol) ?? "INVALID_CANDLE_SERIES";
        evaluations.push(
          invalidEvaluation(symbol, direction, reason, null, btcRegime),
        );
        continue;
      }

      evaluations.push(evaluateDirection(derived, direction, btcRegime));
    }
  }

  const formalCandidates = evaluations.flatMap((evaluation) =>
    evaluation.candidate?.formalSignal ? [evaluation.candidate] : [],
  );

  return Object.freeze({
    strategyVersion: STRATEGY_VERSION,
    btcRegime,
    evaluations: Object.freeze(evaluations),
    rankedCandidates: rankCandidates(formalCandidates),
  });
}

export const evaluateStrategyEngine = evaluateStrategy;
