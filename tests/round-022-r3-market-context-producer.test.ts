import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, STRATEGY_VERSION, type ResearchSymbol } from "@/lib/config/constants";
import type { Candle, MarketSnapshot } from "@/lib/market-data/types";
import {
  buildMarketContextSnapshotCandidate,
  MarketContextNotEvaluableError,
  R22_R3_MARKET_CONTEXT_IMPLEMENTATION_STATUS,
} from "@/lib/observation-evidence/market-context";
import {
  findForbiddenObservationEconomicField,
  validateObservationEvidenceCandidate,
} from "@/lib/observation-evidence/validator";
import { buildDeterministicSignalId } from "@/lib/signal-advisory/identity";
import type { SignalAdvisory } from "@/lib/signal-advisory/types";
import type { BTCRegime, SymbolRegime } from "@/lib/strategy/types";

const FOUR_HOUR_MS = 14_400_000;
const SIGNAL_TIME = "2026-08-23T00:00:00.000Z";
const SIGNAL_TIME_MS = Date.parse(SIGNAL_TIME);
const CAPTURED_AT = "2026-08-23T00:00:02.000Z";

function advisory(
  symbolRegime: SymbolRegime = "LONG_ONLY",
  btcRegime: BTCRegime = "BTC_NEUTRAL",
): SignalAdvisory {
  return {
    signalId: buildDeterministicSignalId({
      symbol: "BTCUSDT",
      direction: "LONG",
      signalTime: SIGNAL_TIME,
      strategyVersion: STRATEGY_VERSION,
    }),
    symbol: "BTCUSDT",
    direction: "LONG",
    strategyId: "baseline-001",
    strategyVersion: STRATEGY_VERSION,
    signalTime: SIGNAL_TIME,
    signalValidUntil: "2026-08-23T01:00:00.000Z",
    currentReferencePrice: 100,
    suggestedEntryReference: 100,
    stopLoss: 98,
    takeProfit: 104,
    riskReward: 2,
    score: 85,
    grade: "A",
    marketRegime: { btcRegime, symbolRegime },
    dataFreshness: {
      status: "FRESH",
      sourceServerTime: "2026-08-23T00:00:05.000Z",
      candleCloseTime: SIGNAL_TIME,
      ageMs: 5_000,
    },
    recipient: "owner@example.test",
    scanRunKey: "hourly-1h:2026-08-23T00:05:00.000Z",
  };
}

function makeCandle(symbol: ResearchSymbol, closeTime: number, index: number): Candle {
  const close = 100 + index;
  return {
    symbol,
    timeframe: "4h",
    openTime: closeTime - FOUR_HOUR_MS + 1,
    closeTime,
    open: close - 1,
    high: close + 1,
    low: close - 2,
    close,
    volume: 100 + index,
    quoteVolume: 1_000 + index,
    tradeCount: 10 + index,
    takerBuyBaseVolume: 40 + index,
    takerBuyQuoteVolume: 400 + index,
  };
}

function series(symbol: ResearchSymbol, lastCloseTime = SIGNAL_TIME_MS - 1): Candle[] {
  return Array.from({ length: 3 }, (_, index) =>
    makeCandle(symbol, lastCloseTime - (2 - index) * FOUR_HOUR_MS, index),
  );
}

function makeSnapshot(options: Readonly<{
  symbolCandles?: readonly Candle[];
  btcCandles?: readonly Candle[];
}> = {}): MarketSnapshot {
  const serverTime = SIGNAL_TIME_MS + 3_600_000;
  const symbols = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => {
      const candles4h = symbol === "BTCUSDT"
        ? [...(options.btcCandles ?? series("BTCUSDT"))]
        : symbol === "ETHUSDT"
          ? [...(options.symbolCandles ?? series("ETHUSDT"))]
          : series(symbol);
      const candles1h: Candle[] = [{
        ...makeCandle(symbol, SIGNAL_TIME_MS - 1, 0),
        timeframe: "1h",
        openTime: SIGNAL_TIME_MS - 3_599_999,
      }];
      return [symbol, {
        symbol,
        status: "VALID" as const,
        datasets: {
          "1h": {
            symbol,
            timeframe: "1h" as const,
            serverTime,
            expectedLatestOpenTime: candles1h[0].openTime,
            candles: candles1h,
          },
          "4h": {
            symbol,
            timeframe: "4h" as const,
            serverTime,
            expectedLatestOpenTime: candles4h.at(-1)?.openTime ?? 0,
            candles: candles4h,
          },
        },
      }];
    }),
  );

  return {
    status: "VALID",
    provider: "binance-usdm-public",
    generatedAt: SIGNAL_TIME_MS + 1_000,
    serverTime: {
      serverTime,
      operationStartedAt: SIGNAL_TIME_MS,
      attemptStartedAt: SIGNAL_TIME_MS,
      attemptCompletedAt: SIGNAL_TIME_MS + 1_000,
      roundTripMs: 1_000,
      estimatedClockOffsetMs: 0,
    },
    symbols: symbols as unknown as MarketSnapshot["symbols"],
    diagnostics: {
      operationStartedAt: SIGNAL_TIME_MS,
      operationCompletedAt: SIGNAL_TIME_MS + 1_000,
      roundTripMs: 1_000,
      requestCount: 0,
      requestWeightHeaders: [],
    },
  };
}

function build(overrides: Readonly<{
  symbolRegime?: SymbolRegime;
  btcRegime?: BTCRegime;
  snapshot?: MarketSnapshot;
  capturedAt?: string;
}> = {}) {
  return buildMarketContextSnapshotCandidate({
    advisory: advisory(overrides.symbolRegime, overrides.btcRegime),
    snapshot: overrides.snapshot ?? makeSnapshot(),
    capturedAt: overrides.capturedAt ?? CAPTURED_AT,
  });
}

describe("Round-022 R3 MARKET_CONTEXT producer", () => {
  it("builds a valid snapshot from the existing advisory regimes and source snapshot", () => {
    const candidate = build({ symbolRegime: "SHORT_ONLY", btcRegime: "BTC_STRONG_BEAR" });

    expect(validateObservationEvidenceCandidate(candidate)).toMatchObject({ status: "VALID", reason: "NONE" });
    expect(candidate.artifactType).toBe("MARKET_CONTEXT");
    expect(candidate.informationAsOf).toBe("2026-08-22T23:59:59.999Z");
    expect(candidate.payload).toEqual({
      symbol: "BTCUSDT",
      direction: "LONG",
      symbolRegime: "SHORT_ONLY",
      btcRegime: "BTC_STRONG_BEAR",
      sourceManifest: expect.objectContaining({
        provider: "binance-usdm-public",
        strategyVersion: STRATEGY_VERSION,
        symbol: expect.objectContaining({ symbol: "BTCUSDT", timeframe: "4h", candleCount: 3 }),
        btc: expect.objectContaining({ symbol: "BTCUSDT", timeframe: "4h", candleCount: 3 }),
      }),
      humanDecisionRequired: true,
      automaticTrading: false,
    });
  });

  it.each([
    ["LONG_ONLY", "BTC_STRONG_BULL"],
    ["SHORT_ONLY", "BTC_STRONG_BEAR"],
    ["NO_TRADE", "BTC_NEUTRAL"],
  ] as const)("preserves real runtime regime enums: %s / %s", (symbolRegime, btcRegime) => {
    const candidate = build({ symbolRegime, btcRegime });
    expect(candidate.payload).toMatchObject({ symbolRegime, btcRegime });
    expect(candidate.payload).not.toEqual(expect.objectContaining({ symbolRegime: "BULL" }));
    expect(candidate.payload).not.toEqual(expect.objectContaining({ symbolRegime: "BEAR" }));
  });

  it("reuses R1 identity formulas and keeps capture time out of logical idempotency", () => {
    const first = build({ capturedAt: "2026-08-23T00:00:02.000Z" });
    const second = build({ capturedAt: "2026-08-23T00:00:04.000Z" });

    expect(second.artifactId).toBe(first.artifactId);
    expect(second.sourceRef).toBe(first.sourceRef);
    expect(second.contentHash).toBe(first.contentHash);
    expect(second.idempotencyKey).toBe(first.idempotencyKey);
    expect(second.evidenceHash).not.toBe(first.evidenceHash);
    expect(second.evidenceId).not.toBe(first.evidenceId);
  });

  it("binds sourceRef, contentHash, and idempotency to the complete ordered source series", () => {
    const original = series("BTCUSDT");
    const changed = original.map((candle, index) => index === 0 ? { ...candle, close: candle.close + 0.25 } : candle);
    const first = build({ snapshot: makeSnapshot({ btcCandles: original }) });
    const second = build({ snapshot: makeSnapshot({ btcCandles: changed }) });

    const firstManifest = first.payload as { readonly sourceManifest: { readonly symbol: { readonly orderedSeriesHash: string } } };
    const secondManifest = second.payload as { readonly sourceManifest: { readonly symbol: { readonly orderedSeriesHash: string } } };
    expect(secondManifest.sourceManifest.symbol.orderedSeriesHash).not.toBe(firstManifest.sourceManifest.symbol.orderedSeriesHash);
    expect(second.sourceRef).not.toBe(first.sourceRef);
    expect(second.contentHash).not.toBe(first.contentHash);
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
  });

  it("rejects reordered source input instead of treating order as irrelevant", () => {
    const reordered = series("ETHUSDT").reverse();
    expect(() => build({ snapshot: makeSnapshot({ btcCandles: reordered }) }))
      .toThrow(MarketContextNotEvaluableError);
  });

  it.each([
    ["before", SIGNAL_TIME_MS - 1, false],
    ["equal", SIGNAL_TIME_MS, false],
    ["after", SIGNAL_TIME_MS + 1, true],
  ] as const)("enforces PIT cutoff when source closes are %s signal time", (_label, closeTime, shouldFail) => {
    const candles = series("BTCUSDT", closeTime);
    if (shouldFail) {
      expect(() => build({ snapshot: makeSnapshot({ btcCandles: candles }) }))
        .toThrow(MarketContextNotEvaluableError);
    } else {
      expect(build({ snapshot: makeSnapshot({ btcCandles: candles }) }).informationAsOf)
        .toBe(new Date(closeTime).toISOString());
    }
  });

  it("rejects capture before signal time and invalid/missing source", () => {
    expect(() => build({ capturedAt: "2026-08-22T23:59:59.999Z" }))
      .toThrow(MarketContextNotEvaluableError);
    expect(() => build({ snapshot: makeSnapshot({ btcCandles: [] }) }))
      .toThrow(MarketContextNotEvaluableError);
  });

  it("does not expose economic fields and reports R3 governance only", () => {
    const candidate = build();
    expect(findForbiddenObservationEconomicField(candidate.payload)).toBeNull();
    expect(JSON.stringify(candidate.payload)).not.toMatch(/pnl|profit|loss|return|forward|future|drawdown/i);
    expect(R22_R3_MARKET_CONTEXT_IMPLEMENTATION_STATUS).toMatchObject({
      r1FoundationImplemented: true,
      r2QualitySnapshotProducerImplemented: true,
      r3MarketContextProducerImplemented: true,
      closesReadinessNodes: ["S02"],
      s01Status: "SOURCE_READY",
      s01AcceptedReady: true,
      s02ImplementationStatus: "SOURCE_READY_PENDING_ACCEPTANCE",
      s02AcceptedReady: false,
      observationInstrumentationImplemented: false,
      observationExecuted: false,
      performanceAuthorized: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      economicValuesRead: false,
      forwardReturnRead: false,
      newMarketDataFetched: false,
      productionUnchanged: true,
      automaticTrading: false,
    });
  });
});
