import { describe, expect, it, vi } from "vitest";

import { RESEARCH_SYMBOLS, STRATEGY_VERSION, type ResearchSymbol } from "@/lib/config/constants";
import {
  getSmtpConfiguration,
  renderSignalAdvisoryEmail,
  sendSignalEmail,
  SmtpConfigurationError,
  type SmtpConfiguration,
} from "@/lib/signal-advisory/email";
import { buildDeterministicSignalId } from "@/lib/signal-advisory/identity";
import { runSignalAdvisoryScan } from "@/lib/signal-advisory/scan";
import type {
  AdvisoryHealth,
  ScanRunBeginResult,
  ScanRunCompletion,
  SignalAdvisory,
  SignalEvaluationRecord,
  SignalAdvisoryStore,
  SignalClaimResult,
  SystemEventInput,
} from "@/lib/signal-advisory/types";
import type { Candle, MarketSnapshot } from "@/lib/market-data/types";

const HOUR_MS = 3_600_000;
const FOUR_HOUR_MS = 14_400_000;
const EVALUATION_TIME = 4_000_000_000;

async function withSmtpEnvironment<T>(
  alertEmailFrom: string | undefined,
  callback: () => Promise<T>,
): Promise<T> {
  const names = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_APP_PASSWORD", "ALERT_EMAIL_TO", "ALERT_EMAIL_FROM"];
  const original = new Map(names.map((name) => [name, process.env[name]]));
  process.env.SMTP_HOST = "smtp.gmail.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_USER = "zunxian.chi@gmail.com";
  process.env.SMTP_APP_PASSWORD = "test-only-not-real";
  process.env.ALERT_EMAIL_TO = "sheng.chi@qq.com";
  if (alertEmailFrom === undefined) {
    delete process.env.ALERT_EMAIL_FROM;
  } else {
    process.env.ALERT_EMAIL_FROM = alertEmailFrom;
  }

  try {
    return await callback();
  } finally {
    for (const [name, value] of original) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

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

function makeSnapshot(
  options: Readonly<{ status?: "VALID" | "PARTIAL"; stale?: boolean; evaluationTime?: number }> = {},
): MarketSnapshot {
  const evaluationTime = options.evaluationTime ?? EVALUATION_TIME;
  const symbols = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => {
      const candles1h = alignCandles(makeSignalCandles(symbol), evaluationTime - 1_000);
      const candles4h = alignCandles(makeTrendCandles(symbol), evaluationTime - 1_000);
      const serverTime = evaluationTime + (options.stale ? HOUR_MS : 0);
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
    generatedAt: evaluationTime,
    serverTime: {
      serverTime: evaluationTime + (options.stale ? HOUR_MS : 0),
      operationStartedAt: evaluationTime,
      attemptStartedAt: evaluationTime,
      attemptCompletedAt: evaluationTime + 10,
      roundTripMs: 10,
      estimatedClockOffsetMs: 0,
    },
    symbols: symbols as unknown as MarketSnapshot["symbols"],
    diagnostics: {
      operationStartedAt: evaluationTime,
      operationCompletedAt: evaluationTime + 10,
      roundTripMs: 10,
      requestCount: 12,
      requestWeightHeaders: [],
    },
  };
}

class MemoryStore implements SignalAdvisoryStore {
  readonly runs = new Map<string, { id: string; status: string }>();
  readonly advisories = new Map<
    string,
    SignalAdvisory & { deliveryStatus: string; attemptCount: number; lastAttemptAt: string }
  >();
  readonly completions: ScanRunCompletion[] = [];
  readonly events: SystemEventInput[] = [];
  readonly evaluations: SignalEvaluationRecord[] = [];
  evaluationPersistenceFailure = false;
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

  async claimSignal(advisory: SignalAdvisory, _scanId: string, now: string): Promise<SignalClaimResult> {
    const existing = this.advisories.get(advisory.signalId);
    if (!existing) {
      this.advisories.set(advisory.signalId, {
        ...advisory,
        deliveryStatus: "PENDING",
        attemptCount: 1,
        lastAttemptAt: now,
      });
      return "CLAIMED";
    }

    if (
      existing.deliveryStatus === "FAILED" &&
      Date.parse(now) < Date.parse(existing.signalValidUntil) &&
      existing.attemptCount < 2
    ) {
      existing.deliveryStatus = "PENDING";
      existing.attemptCount += 1;
      existing.lastAttemptAt = now;
      return "RETRY_CLAIMED";
    }

    if (existing.deliveryStatus === "FAILED" && Date.parse(now) >= Date.parse(existing.signalValidUntil)) {
      return "SKIPPED_EXPIRED";
    }

    return "SKIPPED_DUPLICATE";
  }

  async markSignalSent(input: { signalId: string; sentAt: string; emailMessageId: string }): Promise<void> {
    const advisory = this.advisories.get(input.signalId);
    if (advisory) {
      advisory.deliveryStatus = "SENT";
    }
  }

  async markSignalFailed(input: { signalId: string; failedAt: string; failureReason: string }): Promise<void> {
    const advisory = this.advisories.get(input.signalId);
    if (advisory && advisory.deliveryStatus !== "SENT") {
      advisory.deliveryStatus = "FAILED";
    }
  }

  async recordStrategyEvaluations(rows: readonly SignalEvaluationRecord[]): Promise<void> {
    if (this.evaluationPersistenceFailure) {
      throw new Error("evaluation persistence unavailable");
    }
    this.evaluations.push(...rows);
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
  now?: () => number;
}) {
  return {
    marketData: {
      getMarketSnapshot: async () => input.snapshot ?? makeSnapshot(),
    },
    store: input.store,
    sendSignalEmail: input.send ?? (async () => ({ emailMessageId: "<test-message-id>" })),
    now: input.now ?? (() => EVALUATION_TIME),
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

  it("renders the concise Chinese LONG and SHORT advisory template", () => {
    for (const direction of ["LONG", "SHORT"] as const) {
      const rendered = renderSignalAdvisoryEmail(exampleAdvisory(direction));
      const expectedDirection = direction === "LONG" ? "看涨（做多）" : "看跌（做空）";
      expect(rendered.subject).toBe(`【Trade Pulse】BTCUSDT ${expectedDirection}｜85分`);
      expect(rendered.text).toContain("Trade Pulse 信号提醒");
      expect(rendered.text).toContain("币种：BTCUSDT（比特币）");
      expect(rendered.text).toContain(`方向：${expectedDirection}`);
      expect(rendered.text).toContain("信号时间：08-23 08:00");
      expect(rendered.text).toContain("有效至：08-23 09:00");
      expect(rendered.text).toContain("止损：98");
      expect(rendered.text).toContain("止盈：104");
      expect(rendered.text).toContain("信号强度：85分");
      expect(rendered.text).toContain("仅供参考，请自行决定是否交易。");
      expect(rendered.text).toContain("系统不会自动下单或替你做交易决定。");
      for (const internalField of [
        "Strategy ID",
        "Strategy Version",
        "Signal ID",
        "Market Regime",
        "Data freshness",
        "Risk / Reward",
        "SIGNAL ADVISORY ONLY",
        "MANUAL TRADING DECISION REQUIRED",
      ]) {
        expect(rendered.text).not.toContain(internalField);
      }
    }
  });

  it("uses Chinese symbol names with a safe fallback", () => {
    const symbols = [
      ["BTCUSDT", "BTCUSDT（比特币）"],
      ["ETHUSDT", "ETHUSDT（以太坊）"],
      ["SOLUSDT", "SOLUSDT"],
      ["XRPUSDT", "XRPUSDT"],
      ["BNBUSDT", "BNBUSDT"],
    ] as const;

    for (const [symbol, expected] of symbols) {
      const rendered = renderSignalAdvisoryEmail({ ...exampleAdvisory("LONG"), symbol });
      expect(rendered.text).toContain(`币种：${expected}`);
    }
  });

  it("groups large prices without losing small-decimal precision", () => {
    const rendered = renderSignalAdvisoryEmail({
      ...exampleAdvisory("LONG"),
      currentReferencePrice: 116_200,
      suggestedEntryReference: 4_280.5,
      stopLoss: 0.005161,
      takeProfit: 119_600,
    });

    expect(rendered.text).toContain("当前价格：116,200");
    expect(rendered.text).toContain("参考进场：4,280.5");
    expect(rendered.text).toContain("止损：0.005161");
    expect(rendered.text).toContain("止盈：119,600");
  });

  it("reports SMTP success and never sends real mail in the test", async () => {
    let mail: Record<string, unknown> | undefined;
    const configuration: SmtpConfiguration = {
      host: "smtp.gmail.com",
      port: 587,
      user: "zunxian.chi@gmail.com",
      appPassword: "test-only-not-real",
      to: "sheng.chi@qq.com",
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
    expect(mail?.from).toEqual({
      name: "Trade Pulse",
      address: "zunxian.chi@gmail.com",
    });
    expect(mail?.to).toBe("sheng.chi@qq.com");
    expect(mail?.subject).toBe("【Trade Pulse】BTCUSDT 看涨（做多）｜85分");
    expect(mail?.text).toContain("仅供参考，请自行决定是否交易。");
    expect(mail?.headers).toMatchObject({
      "X-TradePulse-Signal-ID": exampleAdvisory("LONG").signalId,
      "X-TradePulse-Advisory": "true",
    });
  });

  it("fails closed for an invalid SMTP user before sending", async () => {
    const sendMail = vi.fn();

    await expect(
      sendSignalEmail(exampleAdvisory("LONG"), {
        configuration: {
          host: "smtp.gmail.com",
          port: 587,
          user: "not-an-email",
          appPassword: "test-only-not-real",
          to: "sheng.chi@qq.com",
        },
        transport: { sendMail },
      }),
    ).rejects.toThrow("SMTP_USER must be a valid email address.");

    expect(sendMail).not.toHaveBeenCalled();
  });

  it.each([undefined, "zunxian.chi", "Wrong Name <wrong@example.com>"])(
    "does not require or trust ALERT_EMAIL_FROM (%s)",
    async (alertEmailFrom) => {
      await withSmtpEnvironment(alertEmailFrom, async () => {
        const configuration = getSmtpConfiguration();
        let mail: Record<string, unknown> | undefined;

        await sendSignalEmail(exampleAdvisory("SHORT"), {
          configuration,
          transport: {
            sendMail: async (input) => {
              mail = input as Record<string, unknown>;
              return { messageId: "<malformed-from-test-id>" };
            },
          },
        });

        expect(mail?.from).toEqual({ name: "Trade Pulse", address: "zunxian.chi@gmail.com" });
        expect(mail?.to).toBe("sheng.chi@qq.com");
      });
    },
  );
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
    expect(store.evaluations).toHaveLength(RESEARCH_SYMBOLS.length * 2);
    expect(store.evaluations.every((evaluation) => evaluation.scanRunId === result.scanId)).toBe(true);
    expect(store.evaluations.some((evaluation) => evaluation.status === "FORMAL_SIGNAL")).toBe(true);
    expect(store.events.at(-1)?.metadata).toMatchObject({ dataFreshness: "FRESH" });
  });

  it("keeps signal eligibility and email delivery unchanged when evaluation logging fails", async () => {
    const store = new MemoryStore();
    store.evaluationPersistenceFailure = true;
    let sendCount = 0;
    const result = await runSignalAdvisoryScan({
      dependencies: dependencies({
        store,
        send: async () => {
          sendCount += 1;
          return { emailMessageId: "<evaluation-log-failure-email>" };
        },
      }),
      scheduledFor: "2026-08-23T00:05:00.000Z",
    });

    expect(result.outcome).toBe("PARTIAL");
    expect(result.errors).toContain("EVALUATION_PERSISTENCE_FAILED");
    expect(sendCount).toBe(result.signalsGenerated);
    expect(result.signalsSent).toBe(result.signalsGenerated);
  });

  it("classifies invalid SMTP configuration as a safe failure class", async () => {
    const store = new MemoryStore();
    const result = await runSignalAdvisoryScan({
      dependencies: dependencies({
        store,
        send: async () => {
          throw new SmtpConfigurationError("SMTP_APP_PASSWORD is missing and must not be logged.");
        },
      }),
      scheduledFor: "2026-08-23T00:05:00.000Z",
    });

    expect(result.errors).toContain("EMAIL_CONFIGURATION_INVALID");
    expect(store.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "signal-advisory-email",
          errorCode: "EMAIL_CONFIGURATION_INVALID",
          metadata: expect.objectContaining({
            failureClass: "EMAIL_CONFIGURATION_INVALID",
          }),
        }),
      ]),
    );
    expect(JSON.stringify(store.events)).not.toContain("SMTP_APP_PASSWORD");
  });

  it("classifies SMTP authentication failures without storing raw errors", async () => {
    const store = new MemoryStore();
    const result = await runSignalAdvisoryScan({
      dependencies: dependencies({
        store,
        send: async () => {
          throw { code: "EAUTH", responseCode: 535, message: "password must not be logged" };
        },
      }),
      scheduledFor: "2026-08-23T00:05:00.000Z",
    });

    expect(result.errors).toContain("SMTP_AUTH_FAILED");
    expect(store.events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          operation: "signal-advisory-email",
          errorCode: "SMTP_AUTH_FAILED",
          metadata: expect.objectContaining({ failureClass: "SMTP_AUTH_FAILED" }),
        }),
      ]),
    );
    expect(JSON.stringify(store.events)).not.toContain("password must not be logged");
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

  it("retries one failed valid signal after SMTP recovery", async () => {
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
    expect([...store.advisories.values()].every((advisory) => advisory.deliveryStatus === "FAILED")).toBe(true);
    const retry = await runSignalAdvisoryScan({
      dependencies: dependencies({
        store,
        send: async () => {
          sendCount += 1;
          return { emailMessageId: "<retry-message-id>" };
        },
      }),
      scheduledFor: "2026-08-23T01:05:00.000Z",
    });

    expect(result.outcome).toBe("PARTIAL");
    expect(result.errors).toContain("SMTP_DELIVERY_FAILED");
    expect(retry.outcome).toBe("SUCCESS");
    expect(retry.signalsSent).toBe(result.signalsGenerated);
    expect(retry.signalsSkipped).toBe(0);
    expect(sendCount).toBe(result.signalsGenerated * 2);
    expect([...store.advisories.values()].every((advisory) => advisory.deliveryStatus === "SENT")).toBe(true);
    expect([...store.advisories.values()].every((advisory) => advisory.attemptCount === 2)).toBe(true);
  });

  it("retries a failed HH:05 advisory at HH:10 using an advancing clock", async () => {
    const store = new MemoryStore();
    const snapshotTime = Date.parse("2026-08-23T00:00:05.000Z");
    const firstNow = Date.parse("2026-08-23T00:05:00.000Z");
    let currentNow = firstNow;
    let sendCount = 0;
    const snapshot = makeSnapshot({ evaluationTime: snapshotTime });
    const send = async () => {
      sendCount += 1;
      if (currentNow === firstNow) {
        throw new Error("SMTP test failure at HH:05");
      }
      return { emailMessageId: "<same-hour-retry-message-id>" };
    };

    const first = await runSignalAdvisoryScan({
      dependencies: dependencies({ store, snapshot, send, now: () => currentNow }),
      scheduledFor: "2026-08-23T00:05:00.000Z",
    });
    const firstSignal = [...store.advisories.values()][0];
    expect(first.outcome).toBe("PARTIAL");
    expect(firstSignal).toBeDefined();
    expect(Date.parse(firstSignal!.signalValidUntil)).toBeGreaterThan(firstNow);
    expect(firstSignal!.deliveryStatus).toBe("FAILED");

    currentNow = Date.parse("2026-08-23T00:10:00.000Z");
    const retry = await runSignalAdvisoryScan({
      dependencies: dependencies({ store, snapshot, send, now: () => currentNow }),
      scheduledFor: "2026-08-23T00:10:00.000Z",
    });

    expect(retry.outcome).toBe("SUCCESS");
    expect(retry.signalsSent).toBe(first.signalsGenerated);
    expect(retry.signalsSkipped).toBe(0);
    expect(sendCount).toBe(first.signalsGenerated * 2);
    expect([...store.advisories.values()]).toEqual(
      expect.arrayContaining([expect.objectContaining({ deliveryStatus: "SENT", attemptCount: 2 })]),
    );
  });

  it("skips the same hourly cycle at HH:10 after a successful HH:05 run", async () => {
    const store = new MemoryStore();
    const snapshot = makeSnapshot({ evaluationTime: Date.parse("2026-08-23T00:00:05.000Z") });
    let currentNow = Date.parse("2026-08-23T00:05:00.000Z");
    let sendCount = 0;
    const first = await runSignalAdvisoryScan({
      dependencies: dependencies({
        store,
        snapshot,
        now: () => currentNow,
        send: async () => {
          sendCount += 1;
          return { emailMessageId: `<same-hour-success-${sendCount}>` };
        },
      }),
      scheduledFor: "2026-08-23T00:05:00.000Z",
    });

    currentNow = Date.parse("2026-08-23T00:10:00.000Z");
    const repeated = await runSignalAdvisoryScan({
      dependencies: dependencies({
        store,
        snapshot,
        now: () => currentNow,
        send: async () => {
          sendCount += 1;
          return { emailMessageId: "must-not-send" };
        },
      }),
      scheduledFor: "2026-08-23T00:10:00.000Z",
    });

    expect(first.outcome).toBe("SUCCESS");
    expect(repeated.outcome).toBe("SKIPPED");
    expect(repeated.signalsGenerated).toBe(0);
    expect(sendCount).toBe(first.signalsSent);
  });

  it("does not retry an expired FAILED signal", async () => {
    const store = new MemoryStore();
    const advisory = exampleAdvisory("LONG");

    expect(await store.claimSignal(advisory, "scan-1", "2026-08-23T00:05:00.000Z")).toBe("CLAIMED");
    await store.markSignalFailed({
      signalId: advisory.signalId,
      failedAt: "2026-08-23T00:05:01.000Z",
      failureReason: "SMTP_DELIVERY_FAILED",
    });

    expect(await store.claimSignal(advisory, "scan-2", "2026-08-23T01:00:00.000Z")).toBe("SKIPPED_EXPIRED");
    expect(store.advisories.get(advisory.signalId)?.attemptCount).toBe(1);
  });

  it("does not retry a FAILED signal after the second attempt", async () => {
    const store = new MemoryStore();
    const advisory = exampleAdvisory("SHORT");

    expect(await store.claimSignal(advisory, "scan-1", "2026-08-23T00:05:00.000Z")).toBe("CLAIMED");
    await store.markSignalFailed({
      signalId: advisory.signalId,
      failedAt: "2026-08-23T00:05:01.000Z",
      failureReason: "SMTP_DELIVERY_FAILED",
    });
    expect(await store.claimSignal(advisory, "scan-2", "2026-08-23T00:10:00.000Z")).toBe("RETRY_CLAIMED");
    await store.markSignalFailed({
      signalId: advisory.signalId,
      failedAt: "2026-08-23T00:10:01.000Z",
      failureReason: "SMTP_DELIVERY_FAILED",
    });

    expect(await store.claimSignal(advisory, "scan-3", "2026-08-23T00:15:00.000Z")).toBe("SKIPPED_DUPLICATE");
    expect(store.advisories.get(advisory.signalId)?.attemptCount).toBe(2);
  });

  it("allows only one concurrent retry claim", async () => {
    const store = new MemoryStore();
    const advisory = exampleAdvisory("LONG");

    expect(await store.claimSignal(advisory, "scan-1", "2026-08-23T00:05:00.000Z")).toBe("CLAIMED");
    await store.markSignalFailed({
      signalId: advisory.signalId,
      failedAt: "2026-08-23T00:05:01.000Z",
      failureReason: "SMTP_DELIVERY_FAILED",
    });

    const claims = await Promise.all([
      store.claimSignal(advisory, "scan-2", "2026-08-23T00:10:00.000Z"),
      store.claimSignal(advisory, "scan-3", "2026-08-23T00:10:00.000Z"),
    ]);
    expect(claims.filter((claim) => claim === "RETRY_CLAIMED")).toHaveLength(1);
    expect(claims.filter((claim) => claim === "SKIPPED_DUPLICATE")).toHaveLength(1);
    expect(store.advisories.get(advisory.signalId)).toMatchObject({
      deliveryStatus: "PENDING",
      attemptCount: 2,
    });
  });
});
