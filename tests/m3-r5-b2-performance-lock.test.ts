import { describe, expect, it, vi } from "vitest";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import type { BacktestRunInput, BacktestSignalResult } from "../src/lib/backtest/types.ts";
import type { HistoricalStudyData } from "../src/lib/historical-data/types.ts";

const mocks = vi.hoisted(() => ({
  runBacktest: vi.fn(),
}));

vi.mock("../src/lib/backtest/runner.ts", async () => {
  const actual = await vi.importActual<typeof import("../src/lib/backtest/runner.ts")>("../src/lib/backtest/runner.ts");
  return { ...actual, runBacktest: mocks.runBacktest };
});

import {
  executeRound005Authoritative,
  Round005AuthoritativeExecutionError,
} from "../src/lib/research/m3-r5-round-005-performance.ts";

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

describe("M3-R5-B.2 performance lock transition", () => {
  it("locks on the first CONTROL result before a later CONTROL failure", async () => {
    const syntheticResult = {} as BacktestSignalResult;
    mocks.runBacktest.mockImplementation((input: BacktestRunInput) => {
      input.onPerformanceResultGenerated?.(syntheticResult);
      throw new Error("CONTROL_REPORT_FAILED_AFTER_FIRST_RESULT");
    });

    const loader = {
      loadStudyData: async () => emptyStudy(1_780_000_000_000),
      loadIntrabarSettlementWindows: async () => [],
    };

    const error = await executeRound005Authoritative({
      loader,
      executionSourceSha: "a".repeat(40),
    }).catch((value: unknown) => value);

    expect(error).toBeInstanceOf(Round005AuthoritativeExecutionError);
    expect(error).toMatchObject({
      classification: "POST_PERFORMANCE_EXECUTION_ABORT",
      performanceLockTriggered: true,
      lifecycle: "POST_PERFORMANCE",
      message: "CONTROL_REPORT_FAILED_AFTER_FIRST_RESULT",
    });
    expect(mocks.runBacktest).toHaveBeenCalledTimes(1);
  });
});
