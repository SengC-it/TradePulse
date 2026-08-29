import { stableStringify } from "./utils.ts";

export type R13EquityObservation = Readonly<{
  decisionTime: number;
  symbol: string;
  direction: "LONG" | "SHORT";
  netForwardAtr: number;
}>;

export type R13DrawdownResult = Readonly<{
  cumulativeNetForwardAtr: number;
  maximumDrawdownAtr: number;
  orderedObservationCount: number;
}>;

function directionOrder(direction: R13EquityObservation["direction"]): number {
  return direction === "LONG" ? 0 : 1;
}

export function orderR13EquityObservations(observations: readonly R13EquityObservation[]): readonly R13EquityObservation[] {
  if (observations.some((observation) => !Number.isSafeInteger(observation.decisionTime) || !Number.isFinite(observation.netForwardAtr))) throw new Error("R13 drawdown observations must have safe timestamps and finite edge values.");
  return Object.freeze([...observations].sort((left, right) => left.decisionTime - right.decisionTime || left.symbol.localeCompare(right.symbol) || directionOrder(left.direction) - directionOrder(right.direction)));
}

/** The single R13 equity/drawdown definition used by every horizon. */
export function calculateR13Drawdown(observations: readonly R13EquityObservation[]): R13DrawdownResult {
  const ordered = orderR13EquityObservations(observations);
  let equity = 0;
  let peak = 0;
  let maximumDrawdownAtr = 0;
  for (const observation of ordered) {
    equity += observation.netForwardAtr;
    peak = Math.max(peak, equity);
    maximumDrawdownAtr = Math.min(maximumDrawdownAtr, equity - peak);
  }
  return Object.freeze({ cumulativeNetForwardAtr: equity, maximumDrawdownAtr, orderedObservationCount: ordered.length });
}

export function r13DrawdownIdentity(): string {
  return stableStringify({ equityStartsAt: 0, accumulation: "REALIZED_NET_FORWARD_ATR", peak: "MAX_PREVIOUS_EQUITY", drawdown: "EQUITY_MINUS_PEAK", maxDrawdown: "MINIMUM_DRAWDOWN", ordering: ["decisionTime", "symbol", "direction"] });
}
