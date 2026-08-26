import { readFileSync } from "node:fs";

import { describe, expect, it, vi } from "vitest";

import {
  createInitialReviewState,
  evaluateReview,
  ReviewEngineError,
} from "@/lib/signal-review/engine";
import {
  BinanceReviewMarketDataProvider,
  parseReviewKlinePayload,
  ReviewMarketDataError,
  validateClosedReviewCandles,
} from "@/lib/signal-review/market-data";
import { buildDailyReviewRunKey, runDailySignalReview } from "@/lib/signal-review/runner";
import type {
  ReviewAdvisory,
  ReviewCandle,
  ReviewState,
  SignalReviewRunDependencies,
  SignalReviewStore,
} from "@/lib/signal-review/types";

const minute = 60_000;
const baseTime = Date.parse("2026-08-26T00:00:00.000Z");

function candle(openTime: number, overrides: Partial<ReviewCandle> = {}): ReviewCandle {
  return {
    symbol: "BTCUSDT",
    openTime,
    closeTime: openTime + minute - 1,
    open: 100,
    high: 100.5,
    low: 99.5,
    close: 100,
    volume: 10,
    quoteVolume: 1000,
    tradeCount: 10,
    takerBuyBaseVolume: 5,
    takerBuyQuoteVolume: 500,
    ...overrides,
  };
}

function advisory(overrides: Partial<ReviewAdvisory> = {}): ReviewAdvisory {
  return {
    signalId: "signal-1",
    symbol: "BTCUSDT",
    direction: "LONG",
    strategyVersion: "baseline-001",
    signalTime: new Date(baseTime).toISOString(),
    signalValidUntil: new Date(baseTime + 10 * minute).toISOString(),
    sentAt: new Date(baseTime + 5_000).toISOString(),
    suggestedEntryReference: 100,
    stopLoss: 99,
    takeProfit: 102,
    ...overrides,
  };
}

function kline(openTime: number, overrides: Partial<ReviewCandle> = {}): readonly unknown[] {
  const value = candle(openTime, overrides);
  return [
    value.openTime,
    String(value.open),
    String(value.high),
    String(value.low),
    String(value.close),
    String(value.volume),
    value.closeTime,
    String(value.quoteVolume),
    value.tradeCount,
    String(value.takerBuyBaseVolume),
    String(value.takerBuyQuoteVolume),
    "0",
  ];
}

function baseStore(overrides: Partial<SignalReviewStore> = {}): SignalReviewStore {
  return {
    claimDailyReviewRun: vi.fn().mockResolvedValue({ action: "RUN", runId: "run-1" }),
    completeDailyReviewRun: vi.fn().mockResolvedValue(undefined),
    loadSentAdvisories: vi.fn().mockResolvedValue([]),
    ensureReviewRows: vi.fn().mockResolvedValue(0),
    loadActiveReviews: vi.fn().mockResolvedValue([]),
    saveReviewState: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("M6 daily signal review engine", () => {
  it("resolves LONG and SHORT entries using closed 1m candles", () => {
    const long = evaluateReview({
      advisory: advisory(),
      state: createInitialReviewState("signal-1"),
      candles: [
        candle(baseTime + minute, { low: 99.8, high: 100.2 }),
        candle(baseTime + 2 * minute, { high: 102.1 }),
      ],
      now: baseTime + 3 * minute,
    });
    expect(long).toMatchObject({ status: "TP", resultR: 2, entryCandleTime: new Date(baseTime + minute).toISOString() });

    const short = evaluateReview({
      advisory: advisory({ direction: "SHORT", stopLoss: 101, takeProfit: 98 }),
      state: createInitialReviewState("signal-1"),
      candles: [
        candle(baseTime + minute, { low: 99.8, high: 100.2 }),
        candle(baseTime + 2 * minute, { low: 97.9 }),
      ],
      now: baseTime + 3 * minute,
    });
    expect(short).toMatchObject({ status: "TP", resultR: 2 });
  });

  it("marks an entry candle that touches TP and SL as AMBIGUOUS", () => {
    const result = evaluateReview({
      advisory: advisory(),
      state: createInitialReviewState("signal-1"),
      candles: [candle(baseTime + minute, { low: 98.5, high: 102.5 })],
      now: baseTime + 3 * minute,
    });
    expect(result).toMatchObject({ status: "AMBIGUOUS", resultR: null, exitReference: null, reason: "ENTRY_CANDLE_TOUCHES_EXIT" });
  });

  it("keeps terminal review states immutable", () => {
    const terminal: ReviewState = {
      ...createInitialReviewState("signal-1"),
      status: "TP",
      entryCandleTime: new Date(baseTime + minute).toISOString(),
      exitCandleTime: new Date(baseTime + 2 * minute).toISOString(),
      exitReference: 102,
      resultR: 2,
      lastEvaluatedCandleTime: new Date(baseTime + 2 * minute).toISOString(),
      reason: "TAKE_PROFIT",
    };
    expect(evaluateReview({
      advisory: advisory(),
      state: terminal,
      candles: [candle(baseTime + 3 * minute, { high: Number.NaN })],
      now: baseTime + 4 * minute,
    })).toBe(terminal);
  });

  it("ignores a forming candle and fails closed on no-entry expiry", () => {
    const initial = createInitialReviewState("signal-1");
    const forming = evaluateReview({
      advisory: advisory(),
      state: initial,
      candles: [candle(baseTime + minute, { open: 101, high: 101.5, low: 100.5, close: 101 })],
      now: baseTime + minute + 30_000,
    });
    expect(forming).toEqual(initial);

    const expired = evaluateReview({
      advisory: advisory({ signalValidUntil: new Date(baseTime + 2 * minute).toISOString() }),
      state: initial,
      candles: [
        candle(baseTime + minute, { open: 101, high: 101.5, low: 100.5, close: 101 }),
        candle(baseTime + 2 * minute, { open: 101, high: 101.5, low: 100.5, close: 101 }),
      ],
      now: baseTime + 4 * minute,
    });
    expect(expired).toMatchObject({ status: "NO_ENTRY", resultR: null, reason: "ENTRY_NOT_TRIGGERED_BEFORE_EXPIRY" });
  });

  it("continues a newly entered review past entry expiry in the same daily run", async () => {
    const sent = advisory({ signalValidUntil: new Date(baseTime + 3 * minute).toISOString() });
    const state = createInitialReviewState(sent.signalId);
    const store = baseStore({
      loadSentAdvisories: vi.fn().mockResolvedValue([sent]),
      loadActiveReviews: vi.fn().mockResolvedValue([state]),
    });
    const marketData = {
      getServerTime: vi.fn().mockResolvedValue(baseTime + 6 * minute),
      getClosedCandles: vi.fn().mockImplementation(async (_symbol: string, startTime: number) => {
        if (startTime === baseTime + minute) {
          return [candle(baseTime + minute), candle(baseTime + 2 * minute), candle(baseTime + 3 * minute)];
        }
        if (startTime === baseTime + 4 * minute) {
          return [candle(baseTime + 4 * minute, { high: 102.1 }), candle(baseTime + 5 * minute)];
        }
        throw new Error("unexpected review range");
      }),
    };

    const result = await runDailySignalReview({
      dependencies: { store, marketData, now: () => baseTime + 6 * minute },
    });

    expect(result).toMatchObject({ outcome: "SUCCEEDED", updated: 1, resolved: 1 });
    expect(marketData.getClosedCandles).toHaveBeenCalledTimes(2);
    expect(store.saveReviewState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "TP", resultR: 2, exitCandleTime: new Date(baseTime + 4 * minute).toISOString() }),
      new Date(baseTime + 6 * minute).toISOString(),
    );
  });

  it("continues a newly entered review past entry expiry and keeps it OPEN when unresolved", async () => {
    const sent = advisory({ signalValidUntil: new Date(baseTime + 3 * minute).toISOString() });
    const state = createInitialReviewState(sent.signalId);
    const store = baseStore({
      loadSentAdvisories: vi.fn().mockResolvedValue([sent]),
      loadActiveReviews: vi.fn().mockResolvedValue([state]),
    });
    const marketData = {
      getServerTime: vi.fn().mockResolvedValue(baseTime + 6 * minute),
      getClosedCandles: vi.fn().mockImplementation(async (_symbol: string, startTime: number) => {
        if (startTime === baseTime + minute) {
          return [candle(baseTime + minute), candle(baseTime + 2 * minute), candle(baseTime + 3 * minute)];
        }
        if (startTime === baseTime + 4 * minute) {
          return [candle(baseTime + 4 * minute), candle(baseTime + 5 * minute)];
        }
        throw new Error("unexpected review range");
      }),
    };

    const result = await runDailySignalReview({
      dependencies: { store, marketData, now: () => baseTime + 6 * minute },
    });

    expect(result).toMatchObject({ outcome: "SUCCEEDED", updated: 1, resolved: 0 });
    expect(store.saveReviewState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "OPEN", lastEvaluatedCandleTime: new Date(baseTime + 5 * minute).toISOString() }),
      new Date(baseTime + 6 * minute).toISOString(),
    );
  });

  it("continues a newly entered SHORT review past entry expiry to SL in the same run", async () => {
    const sent = advisory({
      direction: "SHORT",
      stopLoss: 101,
      takeProfit: 98,
      signalValidUntil: new Date(baseTime + 3 * minute).toISOString(),
    });
    const state = createInitialReviewState(sent.signalId);
    const store = baseStore({
      loadSentAdvisories: vi.fn().mockResolvedValue([sent]),
      loadActiveReviews: vi.fn().mockResolvedValue([state]),
    });
    const marketData = {
      getServerTime: vi.fn().mockResolvedValue(baseTime + 6 * minute),
      getClosedCandles: vi.fn().mockImplementation(async (_symbol: string, startTime: number) => {
        if (startTime === baseTime + minute) {
          return [candle(baseTime + minute), candle(baseTime + 2 * minute), candle(baseTime + 3 * minute)];
        }
        if (startTime === baseTime + 4 * minute) {
          return [candle(baseTime + 4 * minute, { high: 101.1 }), candle(baseTime + 5 * minute)];
        }
        throw new Error("unexpected review range");
      }),
    };

    const result = await runDailySignalReview({
      dependencies: { store, marketData, now: () => baseTime + 6 * minute },
    });

    expect(result).toMatchObject({ outcome: "SUCCEEDED", updated: 1, resolved: 1 });
    expect(store.saveReviewState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "SL", resultR: -1, exitCandleTime: new Date(baseTime + 4 * minute).toISOString() }),
      new Date(baseTime + 6 * minute).toISOString(),
    );
  });

  it("rejects malformed, unordered, and duplicate candles", () => {
    const input = {
      advisory: advisory(),
      state: createInitialReviewState("signal-1"),
      now: baseTime + 4 * minute,
    };
    expect(() => evaluateReview({ ...input, candles: [candle(baseTime + minute, { high: 90 })] })).toThrowError(
      expect.objectContaining<Partial<ReviewEngineError>>({ code: "MALFORMED_CANDLE" }),
    );
    expect(() => evaluateReview({ ...input, candles: [candle(baseTime + minute), candle(baseTime + 3 * minute)] })).toThrowError(
      expect.objectContaining<Partial<ReviewEngineError>>({ code: "UNORDERED_CANDLES" }),
    );
    expect(() => evaluateReview({ ...input, candles: [candle(baseTime + minute), candle(baseTime + minute)] })).toThrowError(
      expect.objectContaining<Partial<ReviewEngineError>>({ code: "DUPLICATE_CANDLE" }),
    );
  });

  it("parses and validates exact Binance 1m candle coverage", () => {
    const payload = [
      kline(baseTime),
      kline(baseTime + minute),
      kline(baseTime + 2 * minute),
    ];
    const candles = parseReviewKlinePayload(payload, "BTCUSDT");
    expect(candles).toHaveLength(3);
    expect(validateClosedReviewCandles({
      candles,
      symbol: "BTCUSDT",
      startTime: baseTime,
      endTime: baseTime + 2 * minute + minute - 1,
      serverTime: baseTime + 3 * minute + 1,
    })).toHaveLength(3);

    expect(() => validateClosedReviewCandles({
      candles: [candles[0]!, candles[2]!],
      symbol: "BTCUSDT",
      startTime: baseTime,
      endTime: baseTime + 2 * minute + minute - 1,
      serverTime: baseTime + 3 * minute + 1,
    })).toThrowError(expect.objectContaining<Partial<ReviewMarketDataError>>({ code: "REVIEW_DATA_GAP" }));
  });

  it("paginates through the review-specific 1m provider without network-side test fixtures", async () => {
    const getOneMinuteKlinesRange = vi.fn().mockResolvedValue({
      data: [kline(baseTime), kline(baseTime + minute)],
      diagnostics: {},
    });
    const client = { getOneMinuteKlinesRange } as never;
    const provider = new BinanceReviewMarketDataProvider(client);
    const result = await provider.getClosedCandles(
      "BTCUSDT",
      baseTime,
      baseTime + minute + minute - 1,
      baseTime + 2 * minute + 1,
    );
    expect(result).toHaveLength(2);
    expect(getOneMinuteKlinesRange).toHaveBeenCalledWith(
      "BTCUSDT",
      baseTime,
      baseTime + 2 * minute - 1,
      1500,
    );
  });

  it("runs one daily lease, creates only SENT review rows, and saves resolved state", async () => {
    const sent = advisory();
    const state = createInitialReviewState(sent.signalId);
    const store = baseStore({
      loadSentAdvisories: vi.fn().mockResolvedValue([sent]),
      ensureReviewRows: vi.fn().mockResolvedValue(1),
      loadActiveReviews: vi.fn().mockResolvedValue([state]),
    });
    const marketData = {
      getServerTime: vi.fn().mockResolvedValue(baseTime + 3 * minute),
      getClosedCandles: vi.fn().mockResolvedValue([
        candle(baseTime + minute, { low: 99.8, high: 100.2 }),
        candle(baseTime + 2 * minute, { high: 102.1 }),
      ]),
    };
    const dependencies: SignalReviewRunDependencies = { store, marketData, now: () => baseTime + 3 * minute };
    const result = await runDailySignalReview({ dependencies });

    expect(result).toMatchObject({ outcome: "SUCCEEDED", considered: 1, created: 1, updated: 1, resolved: 1 });
    expect(store.ensureReviewRows).toHaveBeenCalledWith([sent]);
    expect(store.saveReviewState).toHaveBeenCalledWith(
      expect.objectContaining({ status: "TP", resultR: 2 }),
      new Date(baseTime + 3 * minute).toISOString(),
    );
    expect(marketData.getClosedCandles).toHaveBeenCalledWith(
      "BTCUSDT",
      baseTime + minute,
      baseTime + 3 * minute - 1,
      baseTime + 3 * minute,
    );
  });

  it("leaves the affected review unchanged when its market provider fails", async () => {
    const sent = advisory();
    const state = createInitialReviewState(sent.signalId);
    const store = baseStore({
      loadSentAdvisories: vi.fn().mockResolvedValue([sent]),
      loadActiveReviews: vi.fn().mockResolvedValue([state]),
    });
    const marketData = {
      getServerTime: vi.fn().mockResolvedValue(baseTime + 4 * minute),
      getClosedCandles: vi.fn().mockRejectedValue(Object.assign(new Error("upstream unavailable"), { code: "REVIEW_DATA_INCOMPLETE" })),
    };

    const result = await runDailySignalReview({
      dependencies: { store, marketData, now: () => baseTime + 4 * minute },
    });

    expect(result).toMatchObject({ outcome: "PARTIAL", ok: false });
    expect(store.saveReviewState).not.toHaveBeenCalled();
    expect(store.completeDailyReviewRun).toHaveBeenCalledWith(expect.objectContaining({ status: "PARTIAL" }));
  });

  it("does not turn stale incomplete entry coverage into NO_ENTRY", () => {
    const stale = {
      ...createInitialReviewState("signal-1"),
      lastEvaluatedCandleTime: new Date(baseTime + minute).toISOString(),
    };
    expect(evaluateReview({
      advisory: advisory({ signalValidUntil: new Date(baseTime + 2 * minute).toISOString() }),
      state: stale,
      candles: [],
      now: baseTime + 4 * minute,
    })).toBe(stale);
  });

  it("fails closed when an incremental range is missing its first required candle", () => {
    const open: ReviewState = {
      ...createInitialReviewState("signal-1"),
      status: "OPEN",
      entryCandleTime: new Date(baseTime + minute).toISOString(),
      lastEvaluatedCandleTime: new Date(baseTime + minute).toISOString(),
      reason: "ENTRY_TRIGGERED",
    };
    expect(() => evaluateReview({
      advisory: advisory(),
      state: open,
      candles: [candle(baseTime + 3 * minute)],
      now: baseTime + 5 * minute,
    })).toThrowError(expect.objectContaining<Partial<ReviewEngineError>>({ code: "MISSING_CANDLE" }));
  });

  it("fetches an OPEN review incrementally after its last evaluated candle", async () => {
    const sent = advisory();
    const state: ReviewState = {
      ...createInitialReviewState(sent.signalId),
      status: "OPEN",
      entryCandleTime: new Date(baseTime + minute).toISOString(),
      lastEvaluatedCandleTime: new Date(baseTime + 2 * minute).toISOString(),
      reason: "ENTRY_TRIGGERED",
    };
    const store = baseStore({
      loadSentAdvisories: vi.fn().mockResolvedValue([sent]),
      loadActiveReviews: vi.fn().mockResolvedValue([state]),
    });
    const marketData = {
      getServerTime: vi.fn().mockResolvedValue(baseTime + 5 * minute),
      getClosedCandles: vi.fn().mockResolvedValue([candle(baseTime + 3 * minute), candle(baseTime + 4 * minute)]),
    };
    const result = await runDailySignalReview({
      dependencies: { store, marketData, now: () => baseTime + 5 * minute },
    });

    expect(result.outcome).toBe("SUCCEEDED");
    expect(marketData.getClosedCandles).toHaveBeenCalledWith(
      "BTCUSDT",
      baseTime + 3 * minute,
      baseTime + 5 * minute - 1,
      baseTime + 5 * minute,
    );
    expect(store.saveReviewState).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "OPEN",
        lastEvaluatedCandleTime: new Date(baseTime + 4 * minute).toISOString(),
      }),
      new Date(baseTime + 5 * minute).toISOString(),
    );
  });

  it("honors completed daily idempotency before touching market data", async () => {
    const store = baseStore({
      claimDailyReviewRun: vi.fn().mockResolvedValue({ action: "SKIP_COMPLETED", runId: "run-1" }),
    });
    const marketData = {
      getServerTime: vi.fn(),
      getClosedCandles: vi.fn(),
    };
    const result = await runDailySignalReview({
      dependencies: { store, marketData, now: () => baseTime },
    });
    expect(result.outcome).toBe("SKIPPED");
    expect(marketData.getServerTime).not.toHaveBeenCalled();
    expect(marketData.getClosedCandles).not.toHaveBeenCalled();
  });

  it("uses the local Asia/Shanghai date in the daily run key", () => {
    expect(buildDailyReviewRunKey(Date.parse("2026-08-25T16:30:00.000Z"))).toBe("daily-review:2026-08-26");
  });

  it("freezes the separate review tables, statuses, service-only access, and atomic claim", () => {
    const migration = readFileSync("supabase/migrations/20260826000000_signal_review_v1.sql", "utf8");
    expect(migration).toContain("create table public.tp_advisory_reviews");
    expect(migration).toContain("references public.tp_signal_advisories(signal_id)");
    expect(migration).toContain("check (status in ('WAITING_ENTRY', 'OPEN', 'TP', 'SL', 'NO_ENTRY', 'AMBIGUOUS'))");
    expect(migration).toContain("result_r = 2");
    expect(migration).toContain("result_r = -1");
    expect(migration).toContain("create table public.tp_review_runs");
    expect(migration).toContain("unique not null");
    expect(migration).toContain("alter table public.tp_advisory_reviews enable row level security");
    expect(migration).toContain("alter table public.tp_review_runs enable row level security");
    expect(migration).toContain("revoke all on table public.tp_advisory_reviews, public.tp_review_runs from anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on table public.tp_advisory_reviews, public.tp_review_runs to service_role");
    expect(migration).toContain("on conflict (run_key) do nothing");
    expect(migration).toContain("returning id into inserted_id");
    expect(migration).not.toContain("on delete cascade");
  });
});
