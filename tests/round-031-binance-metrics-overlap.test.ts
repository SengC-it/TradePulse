import { existsSync, readFileSync, rmSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  R31_ARCHIVE_FIELDS,
  R31_BASE_BRANCH,
  R31_BASE_SHA,
  R31_ENDPOINTS,
  R31_FIELD_MAPPINGS,
  R31_GOVERNANCE,
  R31_PROTOCOL_OBJECT,
  R31_START_TIME,
  R31_END_TIME,
  R31_SYMBOLS,
  R31_TIMESTAMP_MAPPINGS,
  assertR31ProtocolRuntime,
  classifyR31Source,
  evaluateR31Mapping,
  filterR31LiveRows,
  getR31RuntimeCounters,
  liveDecimalPlaces,
  r31AbsoluteTolerance,
  r31RelativeError,
  startR31ExecutionReceipt,
  type R31ArchiveRow,
  type R31LiveRow,
} from "../src/lib/research/round-031-binance-metrics-overlap.ts";

function archiveRow(timestamp: number, value: string): R31ArchiveRow {
  return {
    timestamp,
    symbol: "BTCUSDT",
    fields: {
      create_time: String(timestamp),
      symbol: "BTCUSDT",
      sum_open_interest: value,
      sum_open_interest_value: "2",
      count_toptrader_long_short_ratio: value,
      sum_toptrader_long_short_ratio: value,
      count_long_short_ratio: value,
      sum_taker_long_short_vol_ratio: value,
    },
  };
}

function liveRow(timestamp: number, value: string): R31LiveRow {
  return { timestamp, rawValue: value, symbol: "BTCUSDT" };
}

describe("Round-031 frozen reprobe protocol", () => {
  it("freezes the exact base, date, symbol, and endpoint cardinalities", () => {
    expect(R31_BASE_BRANCH).toBe("research/round-015-beta-alpha-decomposition");
    expect(R31_BASE_SHA).toBe("c8b96e633179170c888766d7fa459a7b664a35f5");
    expect(R31_START_TIME).toBe(1789689600000);
    expect(R31_END_TIME).toBe(1789775999999);
    expect(R31_SYMBOLS).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]);
    expect(R31_ENDPOINTS).toEqual(["openInterestHist", "topLongShortAccountRatio", "topLongShortPositionRatio", "globalLongShortAccountRatio", "takerlongshortRatio"]);
    expect(R31_FIELD_MAPPINGS).toHaveLength(5);
    expect(assertR31ProtocolRuntime()).toBe(true);
  });

  it("freezes the exact archive schema and field mappings", () => {
    expect(R31_ARCHIVE_FIELDS).toEqual([
      "create_time",
      "symbol",
      "sum_open_interest",
      "sum_open_interest_value",
      "count_toptrader_long_short_ratio",
      "sum_toptrader_long_short_ratio",
      "count_long_short_ratio",
      "sum_taker_long_short_vol_ratio",
    ]);
    expect(R31_FIELD_MAPPINGS.map((mapping) => [mapping.archiveField, mapping.liveEndpoint, mapping.liveField])).toEqual([
      ["sum_open_interest", "openInterestHist", "sumOpenInterest"],
      ["count_toptrader_long_short_ratio", "topLongShortAccountRatio", "longShortRatio"],
      ["sum_toptrader_long_short_ratio", "topLongShortPositionRatio", "longShortRatio"],
      ["count_long_short_ratio", "globalLongShortAccountRatio", "longShortRatio"],
      ["sum_taker_long_short_vol_ratio", "takerlongshortRatio", "buySellRatio"],
    ]);
  });

  it("uses client-side inclusive UTC filtering and records duplicate semantics", () => {
    const payload = [
      { timestamp: R31_START_TIME - 1, sumOpenInterest: "1.0" },
      { timestamp: R31_START_TIME, sumOpenInterest: "1.0000" },
      { timestamp: R31_START_TIME, sumOpenInterest: "1.0000" },
      { timestamp: R31_END_TIME, sumOpenInterest: "2.0000" },
    ];
    const result = filterR31LiveRows(payload, "BTCUSDT", "openInterestHist");
    expect(result.rawLiveRowCount).toBe(4);
    expect(result.outOfWindowRowCount).toBe(1);
    expect(result.filteredRowCount).toBe(2);
    expect(result.exactDuplicateCount).toBe(1);
    expect(result.conflictingDuplicateCount).toBe(0);
  });

  it("fails the duplicate contract without silently merging conflicting values", () => {
    const result = filterR31LiveRows([
      { timestamp: R31_START_TIME, sumOpenInterest: "1.0000" },
      { timestamp: R31_START_TIME, sumOpenInterest: "1.0001" },
    ], "BTCUSDT", "openInterestHist");
    expect(result.exactDuplicateCount).toBe(0);
    expect(result.conflictingDuplicateCount).toBe(1);
  });

  it("uses precision-aware numeric tolerance from the raw live string", () => {
    expect(liveDecimalPlaces("4.1234")).toBe(4);
    expect(r31AbsoluteTolerance("4.1234")).toBeCloseTo(0.000050000001, 12);
    expect(r31RelativeError(4.1234, 4.12345)).toBeGreaterThan(0);
    const evidence = evaluateR31Mapping([archiveRow(1_000_000, "4.12345")], [liveRow(1_000_000, "4.1234")], "sum_open_interest", "OPEN_INTEREST", "BTCUSDT", "openInterestHist", "sumOpenInterest");
    expect(evidence.dominantMapping).toBe("EXACT");
    expect(evidence.numericAgreementRate).toBe(1);
    expect(evidence.status).toBe("FIELD_MAPPING_ADMITTED_CURRENT_REGIME");
  });

  it("allows only the three endpoint-independent timestamp mappings", () => {
    expect(R31_TIMESTAMP_MAPPINGS).toEqual(["EXACT", "ARCHIVE_MINUS_5M", "ARCHIVE_PLUS_5M"]);
    expect(evaluateR31Mapping([archiveRow(1_000_000, "1")], [liveRow(700_000, "1")], "sum_open_interest", "OPEN_INTEREST", "BTCUSDT", "openInterestHist", "sumOpenInterest").dominantMapping).toBe("ARCHIVE_MINUS_5M");
    expect(evaluateR31Mapping([archiveRow(1_000_000, "1")], [liveRow(1_300_000, "1")], "sum_open_interest", "OPEN_INTEREST", "BTCUSDT", "openInterestHist", "sumOpenInterest").dominantMapping).toBe("ARCHIVE_PLUS_5M");
  });

  it("requires a unique dominant mapping with at least 99 percent coverage", () => {
    const archives = [archiveRow(1_000_000, "1"), archiveRow(1_300_000, "1")];
    const ambiguous = evaluateR31Mapping(archives, [liveRow(700_000, "1"), liveRow(1_300_000, "1")], "sum_open_interest", "OPEN_INTEREST", "BTCUSDT", "openInterestHist", "sumOpenInterest");
    expect(ambiguous.dominantMapping).toBeNull();
    const insufficient = evaluateR31Mapping([archiveRow(1_000_000, "1"), archiveRow(2_000_000, "1")], [liveRow(1_000_000, "1")], "sum_open_interest", "OPEN_INTEREST", "BTCUSDT", "openInterestHist", "sumOpenInterest");
    expect(insufficient.status).toBe("TIMESTAMP_MAPPING_FAILED");
  });

  it("requires same endpoint mapping across all five symbols at admission", () => {
    const passing = classifyR31Source(25, true, 5);
    const partial = classifyR31Source(25, true, 2);
    const none = classifyR31Source(25, true, 0);
    expect(passing).toEqual({ sourceClassification: "BINANCE_METRICS_CURRENT_REGIME_MAPPING_ESTABLISHED", sourceNextStage: "HISTORICAL_METRICS_REGIME_AND_COVERAGE_AUDIT_REQUIRED", currentRegimeMappingEstablished: true });
    expect(partial.sourceClassification).toBe("BINANCE_METRICS_PARTIAL_CURRENT_REGIME_MAPPING_ESTABLISHED");
    expect(none.sourceClassification).toBe("BINANCE_METRICS_CURRENT_REGIME_MAPPING_INCOMPATIBLE");
  });

  it("gives live reachability precedence over mapping incompatibility", () => {
    expect(classifyR31Source(24, true, 0)).toEqual({ sourceClassification: "SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY", sourceNextStage: "LIVE_ENDPOINT_EXECUTION_ENVIRONMENT_REPROBE_REQUIRED", currentRegimeMappingEstablished: false });
  });

  it("keeps economics, forward, Production, and automatic trading closed", () => {
    expect(R31_PROTOCOL_OBJECT.economics).toEqual({ economicEvaluationPerformed: false, tradingEconomicMetricsCalculated: false, modelFitCount: 0, candidateCount: 0, championCount: 0, selectedAlertCount: 0 });
    expect(R31_GOVERNANCE).toMatchObject({ forwardEconomicValuesRead: false, forwardReturnRead: false, performanceExecutionCount: 0, automaticTrading: false, humanDecisionRequired: true, productionUnchanged: true });
  });

  it("creates a durable STARTED receipt and rejects a second execution", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "r31-receipt-"));
    try {
      const started = startR31ExecutionReceipt(root, "a".repeat(40), "r31-test", "2026-09-20T00:00:00.000Z");
      expect(existsSync(started.path)).toBe(true);
      expect(JSON.parse(readFileSync(started.path, "utf8")).status).toBe("STARTED");
      expect(() => startR31ExecutionReceipt(root, "b".repeat(40), "r31-test-2", "2026-09-20T00:00:01.000Z")).toThrow(/already exists/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("imports the CLI without running the reprobe", async () => {
    const before = getR31RuntimeCounters().networkRequestCount;
    const cli = await import("../scripts/m3-r31-binance-metrics-overlap.ts");
    expect(cli.isR31DirectExecution(import.meta.url, undefined)).toBe(false);
    expect(getR31RuntimeCounters().networkRequestCount).toBe(before);
  });
});
