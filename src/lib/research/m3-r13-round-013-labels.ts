import type { ResearchSymbol } from "../config/constants.ts";
import type { HistoricalFundingRecord, IntrabarSettlementCandle } from "../historical-data/types.ts";
import { BACKTEST_POLICY } from "../backtest/constants.ts";
import type { R13Direction, R13HorizonHours } from "./m3-r13-round-013-protocol.ts";
import { R13OneMinuteIndexedSeries, type R13OneMinuteLookup } from "./m3-r13-round-013-index.ts";
import { requireSafeTimestamp } from "./utils.ts";

export const R13_ONE_MINUTE_MS = 60_000;
export const R13_HOUR_MS = 60 * 60_000;
export const R13_PRIMARY_DELAY_MS = 6 * 60_000;
export const R13_STRESS_DELAY_MS = 7 * 60_000;
export const R13_SIGNAL_VALIDITY_MS = 60 * 60_000;

export type R13LabelStatus = "EXECUTED" | "NO_ENTRY" | "DATA_INCOMPLETE" | "PERIOD_END_CENSORED";

export type R13ForwardLabel = Readonly<{
  symbol: ResearchSymbol;
  direction: R13Direction;
  signalTime: number;
  actionableAt: number;
  signalValidUntil: number;
  delayMs: number;
  horizonHours: R13HorizonHours;
  status: R13LabelStatus;
  entryTime: number | null;
  entryPrice: number | null;
  entryFill: number | null;
  exitTargetTime: number;
  exitTime: number | null;
  exitPrice: number | null;
  exitFill: number | null;
  grossForwardReturnBps: number | null;
  grossForwardAtr: number | null;
  feesBps: number | null;
  fundingBps: number | null;
  slippageBps: number | null;
  netForwardReturnBps: number | null;
  netForwardAtr: number | null;
  netForwardAtrCostStress: number | null;
  mfeAtr: number | null;
  maeAtr: number | null;
  timeToMfeMinutes: number | null;
  timeToMaeMinutes: number | null;
  fundingEventCount: number;
  fundingBurdenBps: number | null;
  diagnostic?: string;
}>;

export type R13LabelInput = Readonly<{
  symbol: ResearchSymbol;
  direction: R13Direction;
  signalTime: number;
  horizonHours: R13HorizonHours;
  atr14_1h: number;
  candles1m: R13OneMinuteLookup | readonly IntrabarSettlementCandle[];
  funding: readonly HistoricalFundingRecord[];
  delayMs?: number;
  researchEndTime?: number;
  feeRate?: number;
  slippageRate?: number;
}>;

function directionSign(direction: R13Direction): 1 | -1 {
  return direction === "LONG" ? 1 : -1;
}

function emptyLabel(input: R13LabelInput, actionableAt: number, status: Exclude<R13LabelStatus, "EXECUTED">, diagnostic?: string): R13ForwardLabel {
  return Object.freeze({
    symbol: input.symbol,
    direction: input.direction,
    signalTime: input.signalTime,
    actionableAt,
    signalValidUntil: input.signalTime + R13_SIGNAL_VALIDITY_MS,
    delayMs: input.delayMs ?? R13_PRIMARY_DELAY_MS,
    horizonHours: input.horizonHours,
    status,
    entryTime: null,
    entryPrice: null,
    entryFill: null,
    exitTargetTime: 0,
    exitTime: null,
    exitPrice: null,
    exitFill: null,
    grossForwardReturnBps: null,
    grossForwardAtr: null,
    feesBps: null,
    fundingBps: null,
    slippageBps: null,
    netForwardReturnBps: null,
    netForwardAtr: null,
    netForwardAtrCostStress: null,
    mfeAtr: null,
    maeAtr: null,
    timeToMfeMinutes: null,
    timeToMaeMinutes: null,
    fundingEventCount: 0,
    fundingBurdenBps: null,
    ...(diagnostic ? { diagnostic } : {}),
  });
}

function indexedMinuteSeries(candles: R13LabelInput["candles1m"]): R13OneMinuteLookup {
  return candles instanceof R13OneMinuteIndexedSeries ? candles : new R13OneMinuteIndexedSeries(candles as readonly IntrabarSettlementCandle[]);
}

function canonicalMinuteTimestamp(timestamp: number): number {
  return Math.ceil(timestamp / R13_ONE_MINUTE_MS) * R13_ONE_MINUTE_MS;
}

function fundingBetween(input: R13LabelInput, entryTime: number, exitTime: number, entryPrice: number): Readonly<{ pnl: number; bps: number; count: number }> {
  const sign = directionSign(input.direction);
  let pnl = 0;
  let count = 0;
  for (const event of input.funding) {
    if (event.fundingTime <= entryTime || event.fundingTime > exitTime) continue;
    if (!Number.isFinite(event.fundingRate) || event.directMarkPrice === null || !Number.isFinite(event.directMarkPrice) || event.directMarkPrice <= 0) throw new Error("R13 funding provenance is incomplete for a label interval.");
    pnl += -sign * event.fundingRate * event.directMarkPrice;
    count += 1;
  }
  return { pnl, bps: (pnl / entryPrice) * 10_000, count };
}

function extrema(input: R13LabelInput, candles: readonly IntrabarSettlementCandle[], entryPrice: number): Readonly<{ mfeAtr: number; maeAtr: number; timeToMfeMinutes: number; timeToMaeMinutes: number }> {
  const sign = directionSign(input.direction);
  let mfe = 0;
  let mae = 0;
  let mfeTime = 0;
  let maeTime = 0;
  for (const candle of candles) {
    const favorable = sign === 1 ? candle.high - entryPrice : entryPrice - candle.low;
    const adverse = sign === 1 ? entryPrice - candle.low : candle.high - entryPrice;
    if (favorable > mfe) {
      mfe = favorable;
      mfeTime = Math.max(0, (candle.openTime - candles[0]!.openTime) / 60_000);
    }
    if (adverse > mae) {
      mae = adverse;
      maeTime = Math.max(0, (candle.openTime - candles[0]!.openTime) / 60_000);
    }
  }
  return { mfeAtr: mfe / input.atr14_1h, maeAtr: mae / input.atr14_1h, timeToMfeMinutes: mfeTime, timeToMaeMinutes: maeTime };
}

/** Calculates a label without using any candle before actionableAt as entry. */
export function computeR13ForwardLabel(input: R13LabelInput): R13ForwardLabel {
  requireSafeTimestamp(input.signalTime, "R13 label signalTime");
  if (!Number.isFinite(input.atr14_1h) || input.atr14_1h <= 0) throw new Error("R13 label ATR must be positive.");
  const delayMs = input.delayMs ?? R13_PRIMARY_DELAY_MS;
  if (!Number.isSafeInteger(delayMs) || delayMs < 0) throw new Error("R13 label delay must be a non-negative safe integer.");
  const actionableAt = r13ActionableAt(input.signalTime, delayMs);
  const validUntil = input.signalTime + R13_SIGNAL_VALIDITY_MS;
  const minuteSeries = indexedMinuteSeries(input.candles1m);
  const entry = minuteSeries.openAtOrAfter(actionableAt);
  if (!entry || entry.openTime > validUntil) return emptyLabel({ ...input, delayMs }, actionableAt, "NO_ENTRY", "No complete 1m open exists inside the advisory validity window.");
  const exitTargetTime = entry.openTime + (input.horizonHours * R13_HOUR_MS);
  if (input.researchEndTime !== undefined && exitTargetTime > input.researchEndTime) return Object.freeze({ ...emptyLabel({ ...input, delayMs }, actionableAt, "PERIOD_END_CENSORED", "Forward horizon crosses the frozen research boundary."), exitTargetTime });
  const exit = minuteSeries.getExact(exitTargetTime);
  if (!exit) return Object.freeze({ ...emptyLabel({ ...input, delayMs }, actionableAt, "DATA_INCOMPLETE", "The exact forward exit candle is unavailable."), exitTargetTime });
  const sign = directionSign(input.direction);
  const feeRate = input.feeRate ?? BACKTEST_POLICY.feeRate;
  const slippageRate = input.slippageRate ?? BACKTEST_POLICY.slippageRate;
  const entryPrice = entry.open;
  const exitPrice = exit.open;
  const entryFill = entryPrice * (1 + sign * slippageRate);
  const exitFill = exitPrice * (1 - sign * slippageRate);
  const grossPnl = sign * (exitPrice - entryPrice);
  const pricePnl = sign * (exitFill - entryFill);
  const slippageCost = grossPnl - pricePnl;
  const feeCost = (entryFill + exitFill) * feeRate;
  const funding = fundingBetween(input, entry.openTime, exit.openTime, entryPrice);
  const netPnl = pricePnl - feeCost + funding.pnl;
  const grossBps = (grossPnl / entryPrice) * 10_000;
  const feesBps = (feeCost / entryPrice) * 10_000;
  const slippageBps = (slippageCost / entryPrice) * 10_000;
  const netBps = (netPnl / entryPrice) * 10_000;
  const extremes = extrema(input, minuteSeries.getRange(entry.openTime, exit.openTime), entryPrice);
  const stressNetPnl = grossPnl - (slippageCost + feeCost) * 1.5 + funding.pnl;
  return Object.freeze({
    symbol: input.symbol,
    direction: input.direction,
    signalTime: input.signalTime,
    actionableAt,
    signalValidUntil: validUntil,
    delayMs,
    horizonHours: input.horizonHours,
    status: "EXECUTED",
    entryTime: entry.openTime,
    entryPrice,
    entryFill,
    exitTargetTime,
    exitTime: exit.openTime,
    exitPrice,
    exitFill,
    grossForwardReturnBps: grossBps,
    grossForwardAtr: grossPnl / input.atr14_1h,
    feesBps,
    fundingBps: funding.bps,
    slippageBps,
    netForwardReturnBps: netBps,
    netForwardAtr: netPnl / input.atr14_1h,
    netForwardAtrCostStress: stressNetPnl / input.atr14_1h,
    mfeAtr: extremes.mfeAtr,
    maeAtr: extremes.maeAtr,
    timeToMfeMinutes: extremes.timeToMfeMinutes,
    timeToMaeMinutes: extremes.timeToMaeMinutes,
    fundingEventCount: funding.count,
    fundingBurdenBps: funding.bps,
  });
}

export function computeR13PrimaryAndLatencyStress(input: Omit<R13LabelInput, "delayMs">): Readonly<{ primary: R13ForwardLabel; latencyStress: R13ForwardLabel }> {
  return Object.freeze({ primary: computeR13ForwardLabel({ ...input, delayMs: R13_PRIMARY_DELAY_MS }), latencyStress: computeR13ForwardLabel({ ...input, delayMs: R13_STRESS_DELAY_MS }) });
}

export function r13ActionableAt(signalTime: number, delayMs = R13_PRIMARY_DELAY_MS): number {
  requireSafeTimestamp(signalTime, "R13 signalTime");
  if (!Number.isSafeInteger(delayMs) || delayMs < 0) throw new Error("R13 delay must be a non-negative safe integer.");
  const actionableAt = canonicalMinuteTimestamp(signalTime + delayMs);
  if (!Number.isSafeInteger(actionableAt)) throw new Error("R13 actionableAt must be a safe integer.");
  return actionableAt;
}

export function r13SignalValidUntil(signalTime: number): number {
  requireSafeTimestamp(signalTime, "R13 signalTime");
  return signalTime + R13_SIGNAL_VALIDITY_MS;
}
