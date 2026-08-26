import {
  DAILY_REVIEW_VERSION,
  REVIEW_ONE_MINUTE_MS,
  type ReviewAdvisory,
  type ReviewCandle,
  type ReviewState,
} from "./types.ts";

const TERMINAL_STATUSES = new Set(["TP", "SL", "NO_ENTRY", "AMBIGUOUS"]);

export class ReviewEngineError extends Error {
  readonly code:
    | "INVALID_REVIEW_INPUT"
    | "MALFORMED_CANDLE"
    | "UNORDERED_CANDLES"
    | "DUPLICATE_CANDLE"
    | "MISSING_CANDLE";

  constructor(
    code: ReviewEngineError["code"],
    message: string,
  ) {
    super(message);
    this.name = "ReviewEngineError";
    this.code = code;
  }
}

function finitePositive(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

function isoAt(value: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ReviewEngineError("INVALID_REVIEW_INPUT", "Review timestamp is invalid.");
  }
  return date.toISOString();
}

function timestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new ReviewEngineError("INVALID_REVIEW_INPUT", label + " is invalid.");
  }
  return parsed;
}

function ceilToMinute(value: number): number {
  return Math.ceil(value / REVIEW_ONE_MINUTE_MS) * REVIEW_ONE_MINUTE_MS;
}

function floorToMinute(value: number): number {
  return Math.floor(value / REVIEW_ONE_MINUTE_MS) * REVIEW_ONE_MINUTE_MS;
}

function latestClosedOpenTime(now: number): number {
  return floorToMinute(now - REVIEW_ONE_MINUTE_MS);
}

function assertCandle(candle: ReviewCandle): void {
  if (
    !Number.isSafeInteger(candle.openTime) ||
    !Number.isSafeInteger(candle.closeTime) ||
    candle.closeTime <= candle.openTime ||
    candle.closeTime - candle.openTime !== REVIEW_ONE_MINUTE_MS - 1 ||
    !finitePositive(candle.open) ||
    !finitePositive(candle.high) ||
    !finitePositive(candle.low) ||
    !finitePositive(candle.close) ||
    !Number.isFinite(candle.volume) ||
    candle.volume < 0 ||
    !Number.isFinite(candle.quoteVolume) ||
    candle.quoteVolume < 0 ||
    !Number.isSafeInteger(candle.tradeCount) ||
    candle.tradeCount < 0 ||
    !Number.isFinite(candle.takerBuyBaseVolume) ||
    candle.takerBuyBaseVolume < 0 ||
    !Number.isFinite(candle.takerBuyQuoteVolume) ||
    candle.takerBuyQuoteVolume < 0 ||
    candle.high < candle.open ||
    candle.high < candle.close ||
    candle.high < candle.low ||
    candle.low > candle.open ||
    candle.low > candle.close
  ) {
    throw new ReviewEngineError("MALFORMED_CANDLE", "Review candle is malformed.");
  }
}

function assertOrderedCandles(candles: readonly ReviewCandle[], expectedSymbol: ReviewAdvisory["symbol"]): void {
  const seen = new Set<number>();
  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    assertCandle(candle);
    if (candle.symbol !== expectedSymbol) {
      throw new ReviewEngineError("INVALID_REVIEW_INPUT", "Review candle symbol does not match the advisory.");
    }
    if (seen.has(candle.openTime)) {
      throw new ReviewEngineError("DUPLICATE_CANDLE", "Review candles contain a duplicate.");
    }
    seen.add(candle.openTime);
    if (index > 0) {
      const previous = candles[index - 1];
      if (candle.openTime <= previous.openTime) {
        throw new ReviewEngineError("UNORDERED_CANDLES", "Review candles are not ascending.");
      }
      if (candle.openTime - previous.openTime !== REVIEW_ONE_MINUTE_MS) {
        throw new ReviewEngineError("UNORDERED_CANDLES", "Review candles contain a gap.");
      }
    }
  }
}

function assertIncrementalCoverage(candles: readonly ReviewCandle[], expectedStart: number): void {
  const firstRelevant = candles.find((candle) => candle.openTime >= expectedStart);
  if (firstRelevant && firstRelevant.openTime !== expectedStart) {
    throw new ReviewEngineError(
      "MISSING_CANDLE",
      "Review candles do not begin at the required contiguous boundary.",
    );
  }
}

function validateAdvisory(advisory: ReviewAdvisory): Readonly<{ sentAt: number; validUntil: number }> {
  const sentAt = timestamp(advisory.sentAt, "sentAt");
  const signalTime = timestamp(advisory.signalTime, "signalTime");
  const validUntil = timestamp(advisory.signalValidUntil, "signalValidUntil");
  if (
    validUntil <= signalTime ||
    !finitePositive(advisory.suggestedEntryReference) ||
    !finitePositive(advisory.stopLoss) ||
    !finitePositive(advisory.takeProfit)
  ) {
    throw new ReviewEngineError("INVALID_REVIEW_INPUT", "Advisory review values are invalid.");
  }
  return { sentAt, validUntil };
}

function unchangedTerminalState(state: ReviewState): ReviewState {
  return state;
}

function stateWith(state: ReviewState, changes: Partial<ReviewState>): ReviewState {
  return Object.freeze({ ...state, ...changes });
}

function resolutionForCandle(
  advisory: ReviewAdvisory,
  candle: ReviewCandle,
): "TP" | "SL" | "AMBIGUOUS" | null {
  const hitsTakeProfit = advisory.direction === "LONG"
    ? candle.high >= advisory.takeProfit
    : candle.low <= advisory.takeProfit;
  const hitsStopLoss = advisory.direction === "LONG"
    ? candle.low <= advisory.stopLoss
    : candle.high >= advisory.stopLoss;

  if (hitsTakeProfit && hitsStopLoss) {
    return "AMBIGUOUS";
  }
  if (hitsTakeProfit) {
    return "TP";
  }
  if (hitsStopLoss) {
    return "SL";
  }
  return null;
}

function entryTouchesExit(advisory: ReviewAdvisory, candle: ReviewCandle): boolean {
  return resolutionForCandle(advisory, candle) !== null;
}

function applyResolution(
  state: ReviewState,
  advisory: ReviewAdvisory,
  candle: ReviewCandle,
  resolution: "TP" | "SL" | "AMBIGUOUS",
): ReviewState {
  if (resolution === "AMBIGUOUS") {
    return stateWith(state, {
      status: "AMBIGUOUS",
      exitCandleTime: isoAt(candle.openTime),
      exitReference: null,
      resultR: null,
      lastEvaluatedCandleTime: isoAt(candle.openTime),
      reason: state.entryCandleTime === isoAt(candle.openTime)
        ? "ENTRY_CANDLE_TOUCHES_EXIT"
        : "SAME_CANDLE_TP_SL",
    });
  }

  return stateWith(state, {
    status: resolution,
    exitCandleTime: isoAt(candle.openTime),
    exitReference: resolution === "TP" ? advisory.takeProfit : advisory.stopLoss,
    resultR: resolution === "TP" ? 2 : -1,
    lastEvaluatedCandleTime: isoAt(candle.openTime),
    reason: resolution === "TP" ? "TAKE_PROFIT" : "STOP_LOSS",
  });
}

function evaluateWaitingEntry(
  advisory: ReviewAdvisory,
  state: ReviewState,
  candles: readonly ReviewCandle[],
  now: number,
  sentAt: number,
  validUntil: number,
): ReviewState {
  let next = state;
  const trackingStart = ceilToMinute(sentAt);
  const afterLast = state.lastEvaluatedCandleTime
    ? timestamp(state.lastEvaluatedCandleTime, "lastEvaluatedCandleTime") + REVIEW_ONE_MINUTE_MS
    : trackingStart;
  const entryStart = Math.max(trackingStart, afterLast);
  const entryWindowEnd = floorToMinute(validUntil);
  const latestClosed = latestClosedOpenTime(now);
  const alreadyCoveredThroughEntryWindow = state.lastEvaluatedCandleTime !== null && (
    timestamp(state.lastEvaluatedCandleTime, "lastEvaluatedCandleTime") >= entryWindowEnd
  );

  if (!alreadyCoveredThroughEntryWindow && entryStart <= entryWindowEnd) {
    assertIncrementalCoverage(candles, entryStart);
  }

  for (const candle of candles) {
    if (candle.closeTime >= now || candle.openTime < entryStart || candle.openTime > entryWindowEnd) {
      continue;
    }

    next = stateWith(next, { lastEvaluatedCandleTime: isoAt(candle.openTime) });
    if (candle.low <= advisory.suggestedEntryReference && advisory.suggestedEntryReference <= candle.high) {
      next = stateWith(next, {
        status: "OPEN",
        entryCandleTime: isoAt(candle.openTime),
        reason: "ENTRY_TRIGGERED",
      });
      if (entryTouchesExit(advisory, candle)) {
        return applyResolution(next, advisory, candle, "AMBIGUOUS");
      }
      for (const laterCandle of candles) {
        if (
          laterCandle.closeTime < now &&
          laterCandle.openTime > candle.openTime &&
          laterCandle.openTime <= latestClosed
        ) {
          const resolution = resolutionForCandle(advisory, laterCandle);
          next = stateWith(next, { lastEvaluatedCandleTime: isoAt(laterCandle.openTime) });
          if (resolution) {
            return applyResolution(next, advisory, laterCandle, resolution);
          }
        }
      }
      return next;
    }
  }

  const entryWindowIsEmpty = entryStart > entryWindowEnd;
  const entryWindowFullyCovered = entryWindowIsEmpty || (
    next.lastEvaluatedCandleTime !== null &&
    timestamp(next.lastEvaluatedCandleTime, "lastEvaluatedCandleTime") >= entryWindowEnd
  );
  if (next.status === "WAITING_ENTRY" && now > validUntil && entryWindowFullyCovered) {
    return stateWith(next, {
      status: "NO_ENTRY",
      resultR: null,
      reason: "ENTRY_NOT_TRIGGERED_BEFORE_EXPIRY",
    });
  }
  return next;
}

function evaluateOpen(
  advisory: ReviewAdvisory,
  state: ReviewState,
  candles: readonly ReviewCandle[],
  now: number,
): ReviewState {
  if (!state.entryCandleTime) {
    throw new ReviewEngineError("INVALID_REVIEW_INPUT", "OPEN review has no entry candle.");
  }
  const entryTime = timestamp(state.entryCandleTime, "entryCandleTime");
  const afterLast = state.lastEvaluatedCandleTime
    ? timestamp(state.lastEvaluatedCandleTime, "lastEvaluatedCandleTime") + REVIEW_ONE_MINUTE_MS
    : entryTime + REVIEW_ONE_MINUTE_MS;
  let next = state;

  assertIncrementalCoverage(candles, afterLast);

  for (const candle of candles) {
    if (candle.closeTime >= now || candle.openTime < afterLast) {
      continue;
    }
    next = stateWith(next, { lastEvaluatedCandleTime: isoAt(candle.openTime) });
    const resolution = resolutionForCandle(advisory, candle);
    if (resolution) {
      return applyResolution(next, advisory, candle, resolution);
    }
  }
  return next;
}

export function createInitialReviewState(signalId: string): ReviewState {
  return Object.freeze({
    signalId,
    reviewVersion: DAILY_REVIEW_VERSION,
    status: "WAITING_ENTRY",
    entryCandleTime: null,
    exitCandleTime: null,
    exitReference: null,
    resultR: null,
    lastEvaluatedCandleTime: null,
    reason: null,
  });
}

export function evaluateReview(input: Readonly<{
  advisory: ReviewAdvisory;
  state: ReviewState;
  candles: readonly ReviewCandle[];
  now: number;
}>): ReviewState {
  const { advisory, state, candles, now } = input;
  if (!Number.isFinite(now)) {
    throw new ReviewEngineError("INVALID_REVIEW_INPUT", "Review now is invalid.");
  }
  if (TERMINAL_STATUSES.has(state.status)) {
    return unchangedTerminalState(state);
  }
  if (state.reviewVersion !== DAILY_REVIEW_VERSION || state.signalId !== advisory.signalId) {
    throw new ReviewEngineError("INVALID_REVIEW_INPUT", "Review state provenance is invalid.");
  }

  const { sentAt, validUntil } = validateAdvisory(advisory);
  assertOrderedCandles(candles, advisory.symbol);
  if (state.status === "WAITING_ENTRY") {
    return evaluateWaitingEntry(advisory, state, candles, now, sentAt, validUntil);
  }
  if (state.status === "OPEN") {
    return evaluateOpen(advisory, state, candles, now);
  }
  throw new ReviewEngineError("INVALID_REVIEW_INPUT", "Review state status is invalid.");
}
