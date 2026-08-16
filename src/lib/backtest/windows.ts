import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import type { StrategyDataset, StrategyInput } from "../strategy/types.ts";
import { BacktestError } from "./errors.ts";
import { BACKTEST_POLICY } from "./constants.ts";

function assertEvaluationTime(evaluationTime: number): void {
  if (!Number.isInteger(evaluationTime) || evaluationTime < 0) {
    throw new BacktestError("INVALID_INPUT", "Backtest evaluationTime must be a UTC epoch millisecond integer.");
  }
}

export function latestAsOfWindow(
  candles: readonly Candle[],
  evaluationTime: number,
  requiredCandles = BACKTEST_POLICY.strategyWindowCandles,
): readonly Candle[] {
  assertEvaluationTime(evaluationTime);
  if (!Number.isInteger(requiredCandles) || requiredCandles < 1) {
    throw new BacktestError("INVALID_INPUT", "The as-of window size must be a positive integer.");
  }
  const closed = candles.filter((candle) => candle.closeTime <= evaluationTime);
  if (closed.length < requiredCandles) {
    throw new BacktestError(
      "DATA_INCOMPLETE",
      `Exactly ${requiredCandles} fully closed candles are required for the strategy window.`,
    );
  }
  const window = closed.slice(-requiredCandles);
  if (window.length !== requiredCandles || window.some((candle) => candle.closeTime > evaluationTime)) {
    throw new BacktestError("DATA_INCOMPLETE", "The historical strategy window is not fully closed as of evaluationTime.");
  }
  const intervalMs = INTERVAL_MS[window[0]?.timeframe ?? "1h"];
  for (let index = 1; index < window.length; index += 1) {
    if (window[index]!.openTime - window[index - 1]!.openTime !== intervalMs) {
      throw new BacktestError("DATA_INCOMPLETE", "The historical strategy window contains a gap.");
    }
  }
  return Object.freeze([...window]);
}

export const buildAsOfWindow = latestAsOfWindow;

export function buildStrategyInput(
  datasets: Readonly<Record<ResearchSymbol, Readonly<{ candles1h: readonly Candle[]; candles4h: readonly Candle[] }>>>,
  evaluationTime: number,
): StrategyInput {
  const normalized = {} as Record<ResearchSymbol, StrategyDataset>;
  for (const symbol of RESEARCH_SYMBOLS) {
    const dataset = datasets[symbol];
    if (!dataset) {
      throw new BacktestError("DATA_INCOMPLETE", `Historical dataset is missing for ${symbol}.`);
    }
    normalized[symbol] = Object.freeze({
      symbol,
      candles1h: latestAsOfWindow(dataset.candles1h, evaluationTime),
      candles4h: latestAsOfWindow(dataset.candles4h, evaluationTime),
    });
  }
  return Object.freeze({ evaluationTime, datasets: Object.freeze(normalized) });
}

export const buildAsOfStrategyInput = buildStrategyInput;
export const buildRollingStrategyInput = buildStrategyInput;
export const getLatestAsOfWindow = latestAsOfWindow;

export function findSignalCandle(candles: readonly Candle[], signalTime: number): Candle {
  const candle = candles.find((item) => item.closeTime === signalTime);
  if (!candle) {
    throw new BacktestError("DATA_INCOMPLETE", "The signal candle is not present in the historical 1H series.");
  }
  return candle;
}

export function getHeldCandles(
  candles: readonly Candle[],
  signalTime: number,
  heldCandleCount = BACKTEST_POLICY.heldCandleCount,
): readonly Candle[] {
  const signalCandle = findSignalCandle(candles, signalTime);
  const nextIndex = candles.indexOf(signalCandle) + 1;
  const held = candles.slice(nextIndex, nextIndex + heldCandleCount);
  if (held.length !== heldCandleCount) {
    throw new BacktestError("DATA_INCOMPLETE", `Exactly ${heldCandleCount} held candles are required; no held #25 exists.`);
  }
  const intervalMs = INTERVAL_MS["1h"];
  for (let index = 0; index < held.length; index += 1) {
    const expectedOpen = signalCandle.openTime + intervalMs * (index + 1);
    if (held[index]!.openTime !== expectedOpen) {
      throw new BacktestError("DATA_INCOMPLETE", "The required held 1H candles contain a gap.");
    }
  }
  return Object.freeze([...held]);
}
