import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS, STRATEGY_VERSION, type ResearchSymbol } from "@/lib/config/constants";
import {
  renderSignalAdvisoryEmail,
  sendSignalEmail,
  type SmtpConfiguration,
} from "@/lib/signal-advisory/email";
import { buildDeterministicSignalId } from "@/lib/signal-advisory/identity";
import { runSignalAdvisoryScan } from "@/lib/signal-advisory/scan";
import type {
  AdvisoryHealth,
  ScanRunBeginResult,
  ScanRunCompletion,
  SignalAdvisory,
  SignalAdvisoryStore,
  SystemEventInput,
} from "@/lib/signal-advisory/types";
import type { Candle, MarketSnapshot } from "@/lib/market-data/types";

const HOUR_MS = 3_600_000;
const FOUR_HOUR_MS = 14_400_000;
const EVALUATION_TIME = 4_000_000_000;

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

function makeTrendCandles(symbol: ResearchSymbol): Candle[] {
  return Array.from({ length: 205 }, (_, index) => {
    const close = 100 + index;
    return makeCandle(symbol, "4h", index, close, close + 1, close - 1);
  });
}

function makeSignalCandles(symbol: ResearchSymbol): Candle[] {
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
    makeCandle(symbol, "1h", index, close, close + 3, close - 3, index === 54 ? 200 : 100),
  );
}

function alignCandles(candles: readonly Candle[], targetCloseTime: number): Candle[] {
  const lastCloseTime = candles.at(-1)?.closeTime ?? 0;
  const offset = targetCloseTime - lastCloseTime;
  return candles.map((candle) => ({
    ...candle,
    openTime: candle.openTime + offset,
    closeTime: candle.closeTime + offset,
  }));
}

function makeSnapshot(options: Readonly<{ status?: "VALID" | "PARTIAL"; stale?: boolean }> = {}): MarketSnapshot {
  const symbols = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => {
      const candles1h = alignCandles(makeSignalCandles(symbol), EVALUATION_TIME - 1_000);
      const candles4h = alignCandles(makeTrendCandles(symbol), EVALUATION_TIME - 1_000);
      const serverTime = EVALUATION_TIME + (options.stale ? HOUR_MS : 0);
      return [
        symbol,
        {
          symbol,
          status: "VALID",
          datasets: {
            "1h": {
              symbol,
              timeframe: "1h",
              serverTime,
              expectedLatestOpenTime: candles1h.at(-1)?.openTime ?? 0,
              candles: candles1h,
            },
            "4h": {
              symbol,
              timeframe: "4h",
              serverTime,
              expectedLatestOpenTime: candles4h.at(-1)?.openTime ?? 0,
              candles: candles4h,
            },
          },
        },
      ];
    }),
  );

  return {
    status: options.status ?? "VALID",
    provider: "binance-usdm-public",
    generatedAt: EVALUATION_TIME,
    serverTime: {
      serverTime: EVALUATION_TIME + (options.stale ? HOUR_MS : 0),
      operationStartedAt: EVALUATION_TIME,
      attemptStartedAt: EVALUATION_TIME,
      attemptCompletedAt: EVALUATION_TIME + 10,
      roundTripMs: 10,
      estimatedClockOffsetMs: 0,
    },
    symbols: symbols as unknown as MarketSnapshot["symbols"],
    diagnostics: {
      operationStartedAt: EVALUATION_TIME,
      operationCompletedAt: EVALUATION_TIME + 10,
      roundTripMs: 10,
      requestCount: 12,
      requestWeightHeaders: [],
    },
  };
}

class MemoryStore implements SignalAdvisoryStore {
  readonly runs = new Map<string, { id: string; status: string }>();
  readonly advisories = new Map<string, SignalAdvisory & { deliveryStatus: string }>();
  readonly completions: ScanRunCompletion[] = [];
  readonly events: SystemEventInput[] = [];
  private nextId = 1;

  async beginScanRun(input: { runKey: string; scheduledFor: string; now: string }): Promise<ScanRunBeginResult> {
    const existing = this.runs.get(input.runKey);
    if (existing?.status === "SUCCEEDED") {
      return { action: "SKIP_COMPLETED", scanId: existing.id };
    }
    if (existing?.status === "RUNNING") {
      return { action: "SKIP_IN_PROGRESS", scanId: existing.id };
    }
    const scanId = `scan-${this.nextId++}`;
    this.runs.set(input.runKey, { id: scanId, status: "RUNNING" });
    return { action: "RUN", scanId };
  }

  async completeScanRun(input: ScanRunCompletion): Promise<void> {
    const run = [...this.runs.values()].find((value) => value.id === input.scanId);
    if (run) {
      run.status = input.status;
    }
    this.completions.push(input);
  }

  async claimSignal(advisory: SignalAdvisory): Promise<"CLAIMED" | "SKIPPED_DUPLICATE"> {
    if (this.advisories.has(advisory.signalId)) {
      return "SKIPPED_DUPLICATE";
    }
    this.advisories.set(advisory.signalId, { ...advisory, deliveryStatus: "PENDING" });
    return "CLAIMED";
  }

  async markSignalSent(input: { signalId: string; sentAt: string; emailMessageId: string }): Promise<void> {
    const advisory = this.advisories.get(input.signalId);
    if (advisory) {
      advisory.deliveryStatus = "SENT";
    }
  }

  async markSignalFailed(input: { signalId: string; failedAt: string; failureReason: string }): Promise<void> {
    const advisory = this.advisories.get(input.signalId);
    if (advisory) {
      advisory.deliveryStatus = "FAILED";
    }
  }

  async recordSystemEvent(input: SystemEventInput): Promise<void> {
    this.events.push(input);
  }

  async getHealth(): Promise<AdvisoryHealth> {
    return {
      lastSuccessfulScan: null,
      lastEmailSent: null,
      lastError: null,
      strategyVersion: STRATEGY_VERSION,
    };
  }
}

function dependencies(input: {
  store: MemoryStore;
  snapshot?: MarketSnapshot;
  send?: (advisory: SignalAdvisory) => Promise<{ emailMessageId: string }>;
}) {
  return {
    marketData: {
      getMarketSnapshot: async () => input.snapshot ?? makeSnapshot(),
    },
    store: input.store,
    sendSignalEmail: input.send ?? (async () => ({ emailMessageId: "<test-message-id>" })),
    now: () => EVALUATION_TIME,
    recipient: "owner@example.test",
  };
}

function exampleAdvisory(direction: "LONG" | "SHORT"): SignalAdvisory {
  return {
    signalId: buildDeterministicSignalId({
      symbol: "BTCUSDT",
      direction,
      signalTime: "2026-08-23T00:00:00.000Z",
      strategyVersion: STRATEGY_VERSION,
    }),
    symbol: "BTCUSDT",
    direction,
    strategyId: "baseline-001",
    strategyVersion: STRATEGY_VERSION,
    signalTime: "2026-08-23T00:00:00.000Z",
    signalValidUntil: "2026-08-23T01:00:00.000Z",
    currentReferencePrice: 100,
    suggestedEntryReference: 100,
    stopLoss: 98,
    takeProfit: 104,
    riskReward: 2,
    score: 85,
    grade: "A",
    marketRegime: { btcRegime: "BTC_NEUTRAL", symbolRegime: "LONG_ONLY" },
    dataFreshness: {
      status: "FRESH",
      sourceServerTime: "2026-08-23T00:00:05.000Z",
      candleCloseTime: "2026-08-23T00:00:00.000Z",
      ageMs: 5_000,
    },
    recipient: "owner@example.test",
    scanRunKey: "hourly-1h:2026-08-23T00:00:00.000Z",
  };
}

describe("signal advisory identity and email", () => {
  it("uses only symbol, direction, signal time, and strategy version for deterministic identity", () => {
    const input = {
      symbol: "BTCUSDT",
      direction: "LONG" as const,
      signalTime: "2026-08-23T00:00:00.000Z",
      strategyVersion: STRATEGY_VERSION,
    };
    expect(buildDeterministicSignalId(input)).toBe(buildDeterministicSignalId(input));
    expect(buildDeterministicSignalId(input)).not.toBe(
      buildDeterministicSignalId({ ...input, direction: "SHORT" }),
    );
  });

  it("renders required LONG and SHORT advisory fields and safety language", () => {
    for (const direction of ["LONG", "SHORT"] as const) {
      const rendered = renderSignalAdvisoryEmail(exampleAdvisory(direction));
      expect(rendered.text).toContain(`Direction: ${direction}`);
      expect(rendered.text).toContain("Signal Time:");
      expect(rendered.text).toContain("Suggested Entry Reference:");
      expect(rendered.text).toContain("Stop Loss:");
      expect(rendered.text).toContain("Take Profit:");
      expect(rendered.text).toContain("Risk / Reward:");
      expect(rendered.text).toContain("Strategy ID:");
      expect(rendered.text).toContain("Signal ID:");
      expect(rendered.text).toContain("SIGNAL ADVISORY ONLY");
      expect(rendered.text).toContain("MANUAL TRADING DECISION REQUIRED");
    }
  });

  it("reports SMTP success and never sends real mail in the test", async () => {
    let mail: Record<string, unknown> | undefined;
    const configuration: SmtpConfiguration = {
      host: "smtp.gmail.com",
      port: 587,
      user: "alerts@example.test",
      appPassword: "test-only-not-real",
      from: "TradePulse <alerts@example.test>",
      to: "owner@example.test",
    };
    const result = await sendSignalEmail(exampleAdvisory("LONG"), {
      configuration,
      transport: {
        sendMail: async (input) => {
          mail = input as Record<string, unknown>;
          return { messageId: "<smtp-test-id>" };
        },
      },
    });
    expect(result).toEqual({ emailMessageId: "<smtp-test-id>" });
    expect(mail?.text).toContain("SIGNAL ADVISORY ONLY");
  });
});

describe("signal advisory scan", () => {
  it("sends a valid formal signal, records it, and logs the scan", async () => {
    const store = new MemoryStore();
    const sent: SignalAdvisory[] = [];
    const result = await runSignalAdvisoryScan({
      dependencies: dependencies({
        store,
        send: async (advisory) => {
          sent.push(advisory);
          return { emailMessageId: "<scan-message-id>" };
        },
      }),
      scheduledFor: "2026-08-23T00:05:00.000Z",
    });

    expect(result.outcome).toBe("SUCCESS");
    expect(result.signalsGenerated).toBeGreaterThan(0);
    expect(result.signalsSent).toBe(sent.length);
    expect(store.advisories.size).toBe(sent.length);
    expect(store.events.at(-1)?.metadata).toMatchObject({ dataFreshness: "FRESH" });
  });

  it("returns NO_SIGNAL and sends nothing for missing or stale data", async () => {
    for (const snapshot of [makeSnapshot({ status: "PARTIAL" }), makeSnapshot({ stale: true })]) {
      const store = new MemoryStore();
      let sendCount = 0;
      const result = await runSignalAdvisoryScan({
        dependencies: dependencies({
          store,
          snapshot,
          send: async () => {
            sendCount += 1;
            return { emailMessageId: "should-not-send" };
          },
        }),
        scheduledFor: "2026-08-23T00:05:00.000Z",
      });
      expect(result.outcome).toBe("NO_SIGNAL");
      expect(result.signalsSent).toBe(0);
      expect(sendCount).toBe(0);
    }
  });

  it("suppresses duplicate delivery across repeated scheduler invocations", async () => {
    const store = new MemoryStore();
    let sendCount = 0;
    const send = async () => {
      sendCount += 1;
      return { emailMessageId: `<message-${sendCount}>` };
    };
    const first = await runSignalAdvisoryScan({
      dependencies: dependencies({ store, send }),
      scheduledFor: "2026-08-23T00:05:00.000Z",
    });
    const repeatedSameRun = await runSignalAdvisoryScan({
      dependencies: dependencies({ store, send }),
      scheduledFor: "2026-08-23T00:05:00.000Z",
    });
    const nextCycle = await runSignalAdvisoryScan({
      dependencies: dependencies({ store, send }),
      scheduledFor: "2026-08-23T01:05:00.000Z",
    });

    expect(first.outcome).toBe("SUCCESS");
    expect(repeatedSameRun.outcome).toBe("SKIPPED");
    expect(nextCycle.signalsSkipped).toBeGreaterThan(0);
    expect(sendCount).toBe(first.signalsSent);
  });

  it("records SMTP failure and never loops into repeated delivery", async () => {
    const store = new MemoryStore();
    let sendCount = 0;
    const result = await runSignalAdvisoryScan({
      dependencies: dependencies({
        store,
        send: async () => {
          sendCount += 1;
          throw new Error("SMTP test failure");
        },
      }),
      scheduledFor: "2026-08-23T00:05:00.000Z",
    });
    const retry = await runSignalAdvisoryScan({
      dependencies: dependencies({
        store,
        send: async () => {
          sendCount += 1;
          return { emailMessageId: "must-not-send" };
        },
      }),
      scheduledFor: "2026-08-23T01:05:00.000Z",
    });

    expect(result.outcome).toBe("PARTIAL");
    expect(result.errors).toContain("SMTP_DELIVERY_FAILED");
    expect(retry.signalsSkipped).toBeGreaterThan(0);
    expect(sendCount).toBe(result.signalsGenerated);
    expect([...store.advisories.values()].every((advisory) => advisory.deliveryStatus === "FAILED")).toBe(true);
  });
});
