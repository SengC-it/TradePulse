import { describe, expect, it } from "vitest";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { BacktestError, runBacktest, serializeBacktestReport } from "../src/lib/backtest/index.ts";
import type { BacktestData, BacktestReport } from "../src/lib/backtest/types.ts";
import { loadBacktestDataForRun, toBacktestData } from "../scripts/backtest-run.ts";
import type { HistoricalStudyData } from "../src/lib/historical-data/types.ts";

function emptyData(serverTime?: number): BacktestData {
  const datasets = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, { candles1h: [], candles4h: [] }]),
  ) as unknown as BacktestData["datasets"];
  const funding = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, []])) as unknown as BacktestData["funding"];
  return {
    datasets,
    funding,
    manifests: [],
    ...(serverTime === undefined ? {} : { serverTime }),
  };
}

function runPolicy003(serverTime?: number): BacktestReport {
  return runBacktest({ period: "DEV", policy: "bt-policy-003", data: emptyData(serverTime) });
}

function emptyStudy(serverTime: number): HistoricalStudyData {
  const datasets = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [
      symbol,
      {
        candles1h: { candles: [] },
        candles4h: { candles: [] },
      },
    ]),
  ) as unknown as HistoricalStudyData["datasets"];
  const funding = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, { records: [] }]),
  ) as unknown as HistoricalStudyData["funding"];
  const markPrice = Object.fromEntries(RESEARCH_SYMBOLS.map((symbol) => [symbol, undefined])) as HistoricalStudyData["markPrice"];
  const markPriceSegments = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, undefined]),
  ) as HistoricalStudyData["markPriceSegments"];
  return {
    datasets,
    funding,
    markPrice,
    markPriceSegments,
    manifests: [],
    serverTime,
  } as unknown as HistoricalStudyData;
}

type CurrentIntrabarReport = Extract<BacktestReport, { schemaVersion: "m3-b-report-004" }>;

function currentReport(report: BacktestReport): CurrentIntrabarReport {
  if (report.schemaVersion !== "m3-b-report-004") {
    throw new Error(`Expected m3-b-report-004, received ${report.schemaVersion}.`);
  }
  return report;
}

describe("M3-F study clock provenance", () => {
  it("emits m3-b-report-004 with the exact BacktestData.serverTime", () => {
    const report = currentReport(runPolicy003(1_700_000_000_123));

    expect(report.schemaVersion).toBe("m3-b-report-004");
    expect(report.backtestPolicyVersion).toBe("bt-policy-003");
    expect(report.studyServerTime).toBe(1_700_000_000_123);
  });

  it.each([
    ["missing", undefined],
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["NaN", Number.NaN],
    ["infinite", Number.POSITIVE_INFINITY],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ])("fails closed when studyServerTime is %s", (_label, serverTime) => {
    expect(() => runPolicy003(serverTime)).toThrowError(BacktestError);
    try {
      runPolicy003(serverTime);
    } catch (error) {
      expect(error).toMatchObject({ code: "DATA_INCOMPLETE" });
    }
  });

  it("serializes the study clock deterministically", () => {
    const first = currentReport(runPolicy003(1_700_000_000_000));
    const second = currentReport(runPolicy003(1_700_000_000_000));

    expect(serializeBacktestReport(first)).toBe(serializeBacktestReport(second));
    expect(serializeBacktestReport(first)).toContain('"studyServerTime": 1700000000000');
  });

  it("changes only provenance bytes when only studyServerTime changes", () => {
    const first = currentReport(runPolicy003(1_700_000_000_000));
    const second = currentReport(runPolicy003(1_700_000_000_001));
    const firstSerialized = serializeBacktestReport(first);
    const secondSerialized = serializeBacktestReport(second);

    expect(firstSerialized).not.toBe(secondSerialized);
    const firstWithoutClock = JSON.parse(firstSerialized) as Record<string, unknown>;
    const secondWithoutClock = JSON.parse(secondSerialized) as Record<string, unknown>;
    delete firstWithoutClock.studyServerTime;
    delete secondWithoutClock.studyServerTime;
    expect(secondWithoutClock).toEqual(firstWithoutClock);
  });

  it("does not change metrics, results, acceptance, breakdowns, or audits with the clock", () => {
    const first = currentReport(runPolicy003(1_700_000_000_000));
    const second = currentReport(runPolicy003(1_700_000_000_001));
    const { studyServerTime: _firstClock, ...firstWithoutClock } = first;
    const { studyServerTime: _secondClock, ...secondWithoutClock } = second;

    expect(_firstClock).toBe(1_700_000_000_000);
    expect(_secondClock).toBe(1_700_000_000_001);
    expect(secondWithoutClock.metrics).toEqual(firstWithoutClock.metrics);
    expect(secondWithoutClock.metricsByPeriod).toEqual(firstWithoutClock.metricsByPeriod);
    expect(secondWithoutClock.signalResults).toEqual(firstWithoutClock.signalResults);
    expect(secondWithoutClock.acceptance).toEqual(firstWithoutClock.acceptance);
    expect(secondWithoutClock.selectedPeriodAcceptance).toEqual(firstWithoutClock.selectedPeriodAcceptance);
    expect(secondWithoutClock.overallAcceptance).toEqual(firstWithoutClock.overallAcceptance);
    expect(secondWithoutClock.acceptanceByPeriod).toEqual(firstWithoutClock.acceptanceByPeriod);
    expect(secondWithoutClock.breakdowns).toEqual(firstWithoutClock.breakdowns);
    expect(secondWithoutClock.fundingEventsTotal).toEqual(firstWithoutClock.fundingEventsTotal);
    expect(secondWithoutClock.fundingEventsDirectMarkPrice).toEqual(firstWithoutClock.fundingEventsDirectMarkPrice);
    expect(secondWithoutClock.fundingEventsFallbackMarkPrice).toEqual(firstWithoutClock.fundingEventsFallbackMarkPrice);
    expect(secondWithoutClock.intrabarSettlementWindowsLoaded).toEqual(firstWithoutClock.intrabarSettlementWindowsLoaded);
    expect(secondWithoutClock.remainingSettlementAmbiguousCount).toEqual(firstWithoutClock.remainingSettlementAmbiguousCount);
  });

  it("preserves the study clock in toBacktestData", () => {
    const study = emptyStudy(1_700_000_000_123);
    expect(toBacktestData(study).serverTime).toBe(study.serverTime);
  });

  it("passes the exact study clock to intrabar loading without a second clock lookup", async () => {
    const study = emptyStudy(1_700_000_000_123);
    const settlementServerTimes: number[] = [];
    let studyLoadCount = 0;
    const loader = {
      loadStudyData: async () => {
        studyLoadCount += 1;
        return study;
      },
      loadIntrabarSettlementWindows: async (_requirements: unknown[], serverTime: number) => {
        settlementServerTimes.push(serverTime);
        return [];
      },
    } as unknown as Parameters<typeof loadBacktestDataForRun>[0];

    const data = await loadBacktestDataForRun(loader, "DEV", "bt-policy-003");

    expect(studyLoadCount).toBe(1);
    expect(settlementServerTimes).toEqual([study.serverTime]);
    expect(data.serverTime).toBe(study.serverTime);
  });

  it("keeps bt-policy-001 and bt-policy-002 historical schemas unchanged", () => {
    const legacy = runBacktest({ period: "DEV", policy: "bt-policy-001", data: emptyData() });
    const compatibility = runBacktest({ period: "DEV", policy: "bt-policy-002", data: emptyData() });

    expect(legacy.schemaVersion).toBe("m3-b-report-001");
    expect(compatibility.schemaVersion).toBe("m3-b-report-002");
    expect(legacy).not.toHaveProperty("studyServerTime");
    expect(compatibility).not.toHaveProperty("studyServerTime");
    expect(serializeBacktestReport(legacy)).not.toContain("studyServerTime");
    expect(serializeBacktestReport(compatibility)).not.toContain("studyServerTime");
  });
});
