export const M3_R4_ROUND_004_SYMBOL_ORDER = Object.freeze([
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
] as const);
export type M3R4Symbol = (typeof M3_R4_ROUND_004_SYMBOL_ORDER)[number];
export type M3R4Direction = "LONG" | "SHORT";
export type M3R4BtcRegime = "BTC_STRONG_BULL" | "BTC_NEUTRAL" | "BTC_STRONG_BEAR";
export type M3R4SymbolRegime = "LONG_ONLY" | "SHORT_ONLY" | "NO_TRADE";

const HOUR_MS = 60 * 60 * 1000;

export type M3R4Candle = Readonly<{
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
}>;

export type M3R4IndicatorCandle = M3R4Candle & Readonly<{
  ema20?: number;
  ema50?: number;
  ema200?: number;
  rsi14?: number;
  atr14?: number;
}>;

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function validCandle(candle: M3R4Candle): boolean {
  return (
    Number.isSafeInteger(candle.openTime) &&
    Number.isSafeInteger(candle.closeTime) &&
    candle.closeTime > candle.openTime &&
    finite(candle.open) &&
    finite(candle.high) &&
    finite(candle.low) &&
    finite(candle.close) &&
    candle.open > 0 &&
    candle.high > 0 &&
    candle.low > 0 &&
    candle.close > 0 &&
    candle.high >= Math.max(candle.open, candle.close) &&
    candle.low <= Math.min(candle.open, candle.close)
  );
}

export function isDecisionTimeCandle(candle: M3R4Candle, signalTime: number): boolean {
  return validCandle(candle) && Number.isSafeInteger(signalTime) && candle.closeTime <= signalTime;
}

export function allDecisionTimeCandles(
  candles: readonly M3R4Candle[],
  signalTime: number,
): boolean {
  return candles.every((candle) => isDecisionTimeCandle(candle, signalTime));
}

export type M3R4BaselineFormalOrigin = Readonly<{
  signalTime: number;
  evaluationClosedThrough: number;
  symbol: M3R4Symbol;
  direction: M3R4Direction;
  formalSignal: boolean;
  totalScore: number;
  grade: string | null;
  originStopReference: number;
}>;

export type H11OriginSelectionInput = Readonly<{
  currentCandle: M3R4Candle;
  symbol: M3R4Symbol;
  direction: M3R4Direction;
  origins: readonly M3R4BaselineFormalOrigin[];
}>;

export type H11OriginSelection = Readonly<{
  origin: M3R4BaselineFormalOrigin | null;
  originAgeBars: number | null;
  reason: "PASS" | "NO_QUALIFYING_ORIGIN" | "FUTURE_DATA_REJECTED";
}>;

export function selectH11QualifyingOrigin(input: H11OriginSelectionInput): H11OriginSelection {
  if (!validCandle(input.currentCandle)) throw new Error("H11 current candle is invalid.");
  const matching = input.origins
    .map((origin) => ({
      origin,
      ageBars: (input.currentCandle.closeTime - origin.signalTime) / HOUR_MS,
    }))
    .filter(({ origin, ageBars }) => {
      return (
        origin.symbol === input.symbol &&
        origin.direction === input.direction &&
        Number.isInteger(ageBars) &&
        ageBars >= 1 &&
        ageBars <= 4
      );
    })
    .sort((left, right) => left.ageBars - right.ageBars);

  let sawFutureData = false;
  for (const { origin, ageBars } of matching) {
    if (origin.evaluationClosedThrough > origin.signalTime) {
      sawFutureData = true;
      continue;
    }
    if (!origin.formalSignal || !finite(origin.totalScore) || origin.totalScore < 70) continue;
    if (!finite(origin.originStopReference) || origin.originStopReference <= 0) continue;
    return { origin, originAgeBars: ageBars, reason: "PASS" };
  }
  return {
    origin: null,
    originAgeBars: null,
    reason: sawFutureData ? "FUTURE_DATA_REJECTED" : "NO_QUALIFYING_ORIGIN",
  };
}

export function computeH11BreakoutLevel(input: Readonly<{
  direction: M3R4Direction;
  originSignalTime: number;
  candlesBeforeOrigin: readonly M3R4Candle[];
}>): number | null {
  if (input.candlesBeforeOrigin.length !== 3) return null;
  if (!input.candlesBeforeOrigin.every((candle) => isDecisionTimeCandle(candle, input.originSignalTime - 1))) return null;
  if (!input.candlesBeforeOrigin.every((candle) => candle.closeTime < input.originSignalTime)) return null;
  const levels = input.candlesBeforeOrigin.map((candle) => input.direction === "LONG" ? candle.high : candle.low);
  return input.direction === "LONG" ? Math.max(...levels) : Math.min(...levels);
}

export type H11RetestResult = Readonly<{
  eligible: boolean;
  retestPassed: boolean;
  originInvalidatedByStop: boolean;
  entryReference: number | null;
  reason: "PASS" | "ORIGIN_STOP_TOUCHED" | "RETEST_NOT_CONFIRMED" | "INVALID_INPUT";
}>;

export function evaluateH11Retest(input: Readonly<{
  direction: M3R4Direction;
  originSignalTime: number;
  originStopReference: number;
  breakoutLevel: number;
  candlesFromFirstAfterOrigin: readonly M3R4Candle[];
  currentCandle: M3R4Candle;
}>): H11RetestResult {
  if (
    !finite(input.originStopReference) ||
    input.originStopReference <= 0 ||
    !finite(input.breakoutLevel) ||
    !validCandle(input.currentCandle) ||
    input.candlesFromFirstAfterOrigin.length === 0 ||
    !input.candlesFromFirstAfterOrigin.every((candle) => validCandle(candle) && candle.closeTime > input.originSignalTime && candle.closeTime <= input.currentCandle.closeTime)
  ) {
    return { eligible: false, retestPassed: false, originInvalidatedByStop: false, entryReference: null, reason: "INVALID_INPUT" };
  }
  const originInvalidatedByStop = input.candlesFromFirstAfterOrigin.some((candle) =>
    input.direction === "LONG" ? candle.low <= input.originStopReference : candle.high >= input.originStopReference,
  );
  if (originInvalidatedByStop) {
    return { eligible: false, retestPassed: false, originInvalidatedByStop: true, entryReference: null, reason: "ORIGIN_STOP_TOUCHED" };
  }
  const retestPassed = input.direction === "LONG"
    ? input.currentCandle.low <= input.breakoutLevel && input.currentCandle.close > input.breakoutLevel
    : input.currentCandle.high >= input.breakoutLevel && input.currentCandle.close < input.breakoutLevel;
  return {
    eligible: retestPassed,
    retestPassed,
    originInvalidatedByStop: false,
    entryReference: retestPassed ? input.currentCandle.close : null,
    reason: retestPassed ? "PASS" : "RETEST_NOT_CONFIRMED",
  };
}

export type M3R4RiskGeometry = Readonly<{
  eligible: boolean;
  entryReference: number;
  stopReference: number;
  stopDistance: number;
  stopAtr: number;
  takeProfitReference: number;
}>;

export function computeRiskGeometry(input: Readonly<{
  direction: M3R4Direction;
  entryReference: number;
  stopReference: number;
  atr14: number;
}>): M3R4RiskGeometry | null {
  if (!finite(input.entryReference) || input.entryReference <= 0 || !finite(input.stopReference) || input.stopReference <= 0 || !finite(input.atr14) || input.atr14 <= 0) return null;
  const stopDistance = Math.abs(input.entryReference - input.stopReference);
  const stopAtr = stopDistance / input.atr14;
  if (!finite(stopAtr)) return null;
  const boundaryTolerance = Number.EPSILON * Math.max(1, Math.abs(stopAtr), 3.0) * 32;
  const takeProfitReference = input.direction === "LONG"
    ? input.entryReference + 2 * stopDistance
    : input.entryReference - 2 * stopDistance;
  return {
    eligible: stopAtr >= 0.8 - boundaryTolerance && stopAtr <= 3.0 + boundaryTolerance,
    entryReference: input.entryReference,
    stopReference: input.stopReference,
    stopDistance,
    stopAtr,
    takeProfitReference,
  };
}

export const computeH11RiskGeometry = computeRiskGeometry;

export type H12ReclaimInput = Readonly<{
  symbol: M3R4Symbol;
  direction: M3R4Direction;
  symbolRegime: M3R4SymbolRegime;
  btcRegime: M3R4BtcRegime | null;
  previous: Readonly<Pick<M3R4IndicatorCandle, "high" | "low" | "close" | "ema20" | "ema50">>;
  current: Readonly<Pick<M3R4IndicatorCandle, "high" | "low" | "close" | "ema20" | "rsi14" | "atr14">>;
}>;

export type H12ReclaimResult = Readonly<{
  eligible: boolean;
  reason: "PASS" | "FAIL_CLOSED_DATA_INCOMPLETE" | "BASELINE_CONTEXT_BLOCKED" | "PULLBACK_NOT_FOUND" | "RECLAIM_NOT_CONFIRMED";
}>;

function validBaselineContext(input: H12ReclaimInput): boolean {
  if (input.symbolRegime === "NO_TRADE") return false;
  if (input.direction === "LONG" && input.symbolRegime !== "LONG_ONLY") return false;
  if (input.direction === "SHORT" && input.symbolRegime !== "SHORT_ONLY") return false;
  if (input.btcRegime === null) return false;
  if (
    input.symbol !== "BTCUSDT" &&
    ((input.direction === "LONG" && input.btcRegime === "BTC_STRONG_BEAR") ||
      (input.direction === "SHORT" && input.btcRegime === "BTC_STRONG_BULL"))
  ) return false;
  return true;
}

export function evaluateH12Reclaim(input: H12ReclaimInput): H12ReclaimResult {
  const previousHigh = input.previous.high;
  const previousLow = input.previous.low;
  const previousClose = input.previous.close;
  const previousEma20 = input.previous.ema20;
  const previousEma50 = input.previous.ema50;
  const currentHigh = input.current.high;
  const currentLow = input.current.low;
  const currentClose = input.current.close;
  const currentEma20 = input.current.ema20;
  const currentRsi14 = input.current.rsi14;
  const currentAtr14 = input.current.atr14;
  if (
    typeof previousHigh !== "number" || typeof previousLow !== "number" || typeof previousClose !== "number" ||
    typeof previousEma20 !== "number" || typeof previousEma50 !== "number" || typeof currentHigh !== "number" ||
    typeof currentLow !== "number" || typeof currentClose !== "number" || typeof currentEma20 !== "number" ||
    typeof currentRsi14 !== "number" || typeof currentAtr14 !== "number" ||
    ![previousHigh, previousLow, previousClose, previousEma20, previousEma50, currentHigh, currentLow, currentClose, currentEma20, currentRsi14, currentAtr14].every(finite)
  ) {
    return { eligible: false, reason: "FAIL_CLOSED_DATA_INCOMPLETE" };
  }
  if (!validBaselineContext(input)) return { eligible: false, reason: "BASELINE_CONTEXT_BLOCKED" };
  if (currentAtr14 <= 0) return { eligible: false, reason: "FAIL_CLOSED_DATA_INCOMPLETE" };
  const rsiInRange = input.direction === "LONG"
    ? currentRsi14 > 50 && currentRsi14 < 70
    : currentRsi14 > 30 && currentRsi14 < 50;
  if (!rsiInRange) return { eligible: false, reason: "PULLBACK_NOT_FOUND" };
  const pullback = input.direction === "LONG"
    ? (previousLow <= previousEma20 || previousLow <= previousEma50) && previousClose <= previousEma20
    : (previousHigh >= previousEma20 || previousHigh >= previousEma50) && previousClose >= previousEma20;
  if (!pullback) return { eligible: false, reason: "PULLBACK_NOT_FOUND" };
  const reclaim = input.direction === "LONG"
    ? currentClose > currentEma20 && currentClose > previousHigh
    : currentClose < currentEma20 && currentClose < previousLow;
  return { eligible: reclaim, reason: reclaim ? "PASS" : "RECLAIM_NOT_CONFIRMED" };
}

export function computeH12RiskGeometry(input: Readonly<{
  direction: M3R4Direction;
  currentClose: number;
  currentAtr14: number;
  priorFiveCandles: readonly Pick<M3R4Candle, "high" | "low">[];
}>): M3R4RiskGeometry | null {
  if (input.priorFiveCandles.length !== 5 || !input.priorFiveCandles.every((candle) => finite(candle.high) && finite(candle.low))) return null;
  if (!finite(input.currentAtr14) || input.currentAtr14 <= 0 || !finite(input.currentClose) || input.currentClose <= 0) return null;
  const extreme = input.direction === "LONG"
    ? Math.min(...input.priorFiveCandles.map((candle) => candle.low))
    : Math.max(...input.priorFiveCandles.map((candle) => candle.high));
  const stopReference = input.direction === "LONG"
    ? extreme - 0.2 * input.currentAtr14
    : extreme + 0.2 * input.currentAtr14;
  return computeRiskGeometry({
    direction: input.direction,
    entryReference: input.currentClose,
    stopReference,
    atr14: input.currentAtr14,
  });
}

export type H13ExitAction = "SL" | "TREND_EXIT_TRIGGER" | "TIME_EXIT" | "CONTINUE";
export type H13ExitStepResult = Readonly<{
  action: H13ExitAction;
  heldCandleNumber: number;
  trendTriggerHeldCandleNumber: number | null;
}>;

export function evaluateH13ExitStep(input: Readonly<{
  direction: M3R4Direction;
  heldCandleNumber: number;
  candle: Readonly<Pick<M3R4Candle, "high" | "low" | "close">>;
  ema20: number;
  stopReference: number;
}>): H13ExitStepResult {
  if (!Number.isInteger(input.heldCandleNumber) || input.heldCandleNumber < 1 || input.heldCandleNumber > 48) throw new Error("H13 held candle must be in [1, 48].");
  if (![input.candle.high, input.candle.low, input.candle.close, input.ema20, input.stopReference].every((value) => finite(value))) throw new Error("H13 exit inputs must be finite.");
  const stopTouched = input.direction === "LONG" ? input.candle.low <= input.stopReference : input.candle.high >= input.stopReference;
  if (stopTouched) return { action: "SL", heldCandleNumber: input.heldCandleNumber, trendTriggerHeldCandleNumber: null };
  if (input.heldCandleNumber === 48) return { action: "TIME_EXIT", heldCandleNumber: 48, trendTriggerHeldCandleNumber: null };
  const trendTriggered = input.direction === "LONG" ? input.candle.close < input.ema20 : input.candle.close > input.ema20;
  return {
    action: trendTriggered ? "TREND_EXIT_TRIGGER" : "CONTINUE",
    heldCandleNumber: input.heldCandleNumber,
    trendTriggerHeldCandleNumber: trendTriggered ? input.heldCandleNumber : null,
  };
}

export function h13EntryProtectiveStopValid(input: Readonly<{
  direction: M3R4Direction;
  entryFill: number;
  stopReference: number;
}>): boolean {
  return finite(input.entryFill) && finite(input.stopReference) &&
    (input.direction === "LONG" ? input.entryFill > input.stopReference : input.entryFill < input.stopReference);
}

export type H14MomentumResult = Readonly<{
  status: "VALID" | "FAIL_CLOSED_DATA_INCOMPLETE";
  momentum24h: number | null;
}>;

export function computeH14Momentum24h(input: Readonly<{ closeNow: number; close24BarsAgo: number }>): H14MomentumResult {
  if (!finite(input.closeNow) || !finite(input.close24BarsAgo) || input.closeNow <= 0 || input.close24BarsAgo <= 0) {
    return { status: "FAIL_CLOSED_DATA_INCOMPLETE", momentum24h: null };
  }
  return { status: "VALID", momentum24h: input.closeNow / input.close24BarsAgo - 1 };
}

export type H14RankingResult = Readonly<{
  status: "VALID" | "FAIL_CLOSED_DATA_INCOMPLETE";
  orderedSymbols: readonly M3R4Symbol[];
  rankBySymbol: Readonly<Partial<Record<M3R4Symbol, number>>>;
}>;

export function rankH14RelativeStrength(momentumBySymbol: Partial<Record<M3R4Symbol, number>>): H14RankingResult {
  if (!M3_R4_ROUND_004_SYMBOL_ORDER.every((symbol) => {
    const value = momentumBySymbol[symbol];
    return typeof value === "number" && finite(value);
  })) {
    return { status: "FAIL_CLOSED_DATA_INCOMPLETE", orderedSymbols: [], rankBySymbol: {} };
  }
  const orderedSymbols = [...M3_R4_ROUND_004_SYMBOL_ORDER].sort((left, right) => {
    const delta = momentumBySymbol[right]! - momentumBySymbol[left]!;
    return delta === 0 ? M3_R4_ROUND_004_SYMBOL_ORDER.indexOf(left) - M3_R4_ROUND_004_SYMBOL_ORDER.indexOf(right) : delta;
  });
  const rankBySymbol = Object.fromEntries(orderedSymbols.map((symbol, index) => [symbol, index + 1])) as Record<M3R4Symbol, number>;
  return { status: "VALID", orderedSymbols, rankBySymbol };
}

export function evaluateH14Eligibility(input: Readonly<{ direction: M3R4Direction; rank: number | undefined }>): boolean {
  const rank = input.rank;
  if (typeof rank !== "number" || !Number.isInteger(rank)) return false;
  return input.direction === "LONG" ? rank <= 2 : rank >= 4;
}

export function m3R4SignalIdentity(input: Readonly<{ symbol: M3R4Symbol; direction: M3R4Direction; signalTime: number }>): string {
  if (!Number.isSafeInteger(input.signalTime)) throw new Error("M3-R4 signalTime must be a safe integer.");
  return `${input.symbol}|${input.direction}|${input.signalTime}`;
}

export type M3R4ControlOutcome = Readonly<{
  symbol: M3R4Symbol;
  direction: M3R4Direction;
  signalTime: number;
  [key: string]: unknown;
}>;

export function reuseH14ControlOutcome(input: Readonly<{
  symbol: M3R4Symbol;
  direction: M3R4Direction;
  signalTime: number;
  controlResults: readonly M3R4ControlOutcome[];
}>): Readonly<{ status: "REUSED" | "DATA_INCOMPLETE"; outcome: M3R4ControlOutcome | null }> {
  const identity = m3R4SignalIdentity(input);
  const outcome = input.controlResults.find((candidate) => m3R4SignalIdentity(candidate) === identity) ?? null;
  return outcome === null ? { status: "DATA_INCOMPLETE", outcome: null } : { status: "REUSED", outcome };
}
