import type { Candle } from "../market-data/types.ts";
import type { StrategyDirection } from "../strategy/types.ts";
import type { BacktestSignalResult } from "../backtest/types.ts";
import { stableStringify } from "./utils.ts";

export const R10_STOP_BUFFER_ATR = 0.2 as const;
export const R10_MIN_STOP_ATR = 0.8 as const;
export const R10_MAX_STOP_ATR = 3.0 as const;
export const R10_TAKE_PROFIT_R = 2 as const;

export type R10RiskGeometry = Readonly<{
  stopReference: number;
  takeProfitReference: number;
  stopDistance: number;
  stopAtr: number;
}>;

export function r10SettlementIdentity(result: BacktestSignalResult): string {
  return stableStringify({
    snapshot: result.snapshot,
    status: result.status,
    entryTime: result.entryTime,
    rawEntryPrice: result.rawEntryPrice,
    entryFill: result.entryFill,
    exitTime: result.exitTime,
    rawExitPrice: result.rawExitPrice,
    exitFill: result.exitFill,
    heldCandleNumber: result.heldCandleNumber,
    exitReason: result.exitReason,
    fundingCharges: result.fundingCharges,
    fundingPnL: result.fundingPnL,
    priceR: result.priceR,
    feeR: result.feeR,
    fundingR: result.fundingR,
    grossR: result.grossR,
    netR: result.netR,
    diagnostic: result.diagnostic ?? null,
  });
}

/** C1 may filter E1 opportunities, but it must retain the exact E1 settlement outcome. */
export function verifyR10C1SettlementIdentity(sourceResults: readonly BacktestSignalResult[], c1Results: readonly BacktestSignalResult[]): boolean {
  return c1Results.every((result) => sourceResults.some((source) => source === result || r10SettlementIdentity(source) === r10SettlementIdentity(result)));
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function getStructuralExtreme(candles: readonly Candle[], direction: StrategyDirection): number | null {
  if (candles.length === 0 || !candles.every((candle) => finite(candle.low) && finite(candle.high))) return null;
  return direction === "LONG"
    ? Math.min(...candles.map((candle) => candle.low))
    : Math.max(...candles.map((candle) => candle.high));
}

function buildRiskGeometry(input: Readonly<{
  direction: StrategyDirection;
  entryReference: number;
  atr14_1h: number;
  structuralExtreme: number;
}>): R10RiskGeometry | null {
  if (!finite(input.entryReference) || !finite(input.atr14_1h) || input.atr14_1h <= 0 || !finite(input.structuralExtreme)) return null;
  const stopReference = input.direction === "LONG"
    ? input.structuralExtreme - R10_STOP_BUFFER_ATR * input.atr14_1h
    : input.structuralExtreme + R10_STOP_BUFFER_ATR * input.atr14_1h;
  const stopDistance = Math.abs(input.entryReference - stopReference);
  const stopAtr = stopDistance / input.atr14_1h;
  if (!finite(stopReference) || !finite(stopDistance) || !finite(stopAtr) || stopDistance <= 0 || stopAtr < R10_MIN_STOP_ATR || stopAtr > R10_MAX_STOP_ATR) return null;
  const takeProfitReference = input.direction === "LONG"
    ? input.entryReference + R10_TAKE_PROFIT_R * stopDistance
    : input.entryReference - R10_TAKE_PROFIT_R * stopDistance;
  if (!finite(takeProfitReference)) return null;
  return Object.freeze({ stopReference, takeProfitReference, stopDistance, stopAtr });
}

export function buildR10E1RiskGeometry(input: Readonly<{
  direction: StrategyDirection;
  entryReference: number;
  atr14_1h: number;
  previousFiveClosedCandles: readonly Candle[];
}>): R10RiskGeometry | null {
  const extreme = getStructuralExtreme(input.previousFiveClosedCandles, input.direction);
  return extreme === null ? null : buildRiskGeometry({ ...input, structuralExtreme: extreme });
}

export function buildR10E2RiskGeometry(input: Readonly<{
  direction: StrategyDirection;
  entryReference: number;
  atr14_1h: number;
  breakoutThroughReclaimClosedCandles: readonly Candle[];
}>): R10RiskGeometry | null {
  const extreme = getStructuralExtreme(input.breakoutThroughReclaimClosedCandles, input.direction);
  return extreme === null ? null : buildRiskGeometry({ ...input, structuralExtreme: extreme });
}
