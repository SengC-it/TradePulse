import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import {
  R33_ARCHIVE_SHA256,
  R33_BASE_BRANCH,
  R33_BASE_SHA,
  R33_CLASSIFICATION,
  R33_COMMON_INTERIOR_END,
  R33_COMMON_INTERIOR_START,
  R33_CURL_ARGS,
  R33_ENDPOINTS,
  R33_EXPECTED_COMMON_INTERIOR_ROWS,
  R33_FIELD_MAPPINGS,
  R33_GOVERNANCE,
  R33_RETRYABLE_CURL_EXIT_CODES,
  R33_SYMBOLS,
  R33_TIMESTAMP_MAPPINGS,
  R33_PROTOCOL_OBJECT,
  assertR33NoPreviousExecution,
  classifyR33Overall,
  classifyR33Symbol,
  evaluateR33Offset,
  r33AbsoluteTolerance,
  r33CommonInteriorSupport,
  r33ManifestSha256,
  r33ShouldRetry,
  summarizeR33Field,
  type R33OffsetEvaluation,
} from "../src/lib/research/round-033-live-transport-timestamp-alignment.ts";
import type { R31ArchiveRow, R31LiveRow, R31Symbol } from "../src/lib/research/round-031-binance-metrics-overlap.ts";
import { isR33DirectExecution } from "../scripts/m3-r33-live-transport-timestamp-alignment.ts";

const temporaryRoots: string[] = [];
afterEach(() => { for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true }); });

function archiveRows(symbol: R31Symbol = "BTCUSDT"): R31ArchiveRow[] {
  return Array.from({ length: R33_EXPECTED_COMMON_INTERIOR_ROWS }, (_, index) => {
    const timestamp = R33_COMMON_INTERIOR_START + index * 300_000;
    return {
      timestamp,
      symbol,
      fields: {
        create_time: new Date(timestamp).toISOString(),
        symbol,
        sum_open_interest: "1.00",
        sum_open_interest_value: "1.00",
        count_toptrader_long_short_ratio: "1.00",
        sum_toptrader_long_short_ratio: "1.00",
        count_long_short_ratio: "1.00",
        sum_taker_long_short_vol_ratio: "1.00",
      },
    };
  });
}

function liveRows(offset: number, symbol: R31Symbol = "BTCUSDT", value = "1.00"): R31LiveRow[] {
  return archiveRows(symbol).map((row) => ({ timestamp: row.timestamp + offset, rawValue: value, symbol }));
}

function evaluation(offset: "EXACT" | "ARCHIVE_MINUS_5M" | "ARCHIVE_PLUS_5M", symbol: R31Symbol = "BTCUSDT", pass = true): R33OffsetEvaluation {
  const milliseconds = offset === "EXACT" ? 0 : offset === "ARCHIVE_MINUS_5M" ? -300_000 : 300_000;
  return { fieldId: "OPEN_INTEREST", symbol, offset, offsetMilliseconds: milliseconds, denominatorRows: 286, matchedRows: pass ? 286 : 0, timestampCoverage: pass ? 1 : 0, numericAgreementRows: pass ? 286 : 0, numericAgreementRate: pass ? 1 : 0, meanAbsoluteError: pass ? 0 : null, medianAbsoluteError: pass ? 0 : null, maxAbsoluteError: pass ? 0 : null, meanRelativeError: pass ? 0 : null, maxRelativeError: pass ? 0 : null, pass };
}

describe("Round-033 frozen protocol", () => {
  it("pins the exact base, branch, source-only classification, and fixed inputs", () => {
    expect(R33_BASE_BRANCH).toBe("research/round-015-beta-alpha-decomposition");
    expect(R33_BASE_SHA).toBe("dac13c5a0863f60e0bcfc932ef5db7dab7eff282");
    expect(R33_CLASSIFICATION).toBe("SOURCE_SEMANTIC_ALIGNMENT_REPROBE_ONLY");
    expect(R33_SYMBOLS).toHaveLength(5);
    expect(R33_ENDPOINTS).toHaveLength(5);
    expect(R33_FIELD_MAPPINGS).toHaveLength(5);
    expect(R33_TIMESTAMP_MAPPINGS).toEqual(["EXACT", "ARCHIVE_MINUS_5M", "ARCHIVE_PLUS_5M"]);
    expect(R33_PROTOCOL_OBJECT.m3G1.status).toBe("EXCLUDED_FROM_ROUND_033");
  });

  it("pins all five R32 archive SHA identities", () => {
    expect(Object.keys(R33_ARCHIVE_SHA256).sort()).toEqual([...R33_SYMBOLS].sort());
    expect(new Set(Object.values(R33_ARCHIVE_SHA256)).size).toBe(5);
    expect(Object.values(R33_ARCHIVE_SHA256).every((value) => /^[0-9a-f]{64}$/u.test(value))).toBe(true);
  });

  it("uses curl only and permits exactly one retry for transport exit codes", () => {
    expect(R33_CURL_ARGS).toEqual(expect.arrayContaining(["--silent", "--show-error", "--fail-with-body", "--connect-timeout", "10", "--max-time", "20", "--retry", "0"]));
    expect(R33_PROTOCOL_OBJECT.request.transport).toBe("CURL_ONLY");
    for (const code of R33_RETRYABLE_CURL_EXIT_CODES) expect(r33ShouldRetry(code, 1)).toBe(true);
    expect(r33ShouldRetry(28, 2)).toBe(false);
    expect(r33ShouldRetry(22, 1)).toBe(false);
    expect(r33ShouldRetry(null, 1)).toBe(false);
  });

  it("uses the 286-row common interior and the same denominator", () => {
    const rows = archiveRows();
    const support = r33CommonInteriorSupport(rows);
    expect(support.valid).toBe(true);
    expect(support.rows).toHaveLength(286);
    expect(support.firstTimestamp).toBe(R33_COMMON_INTERIOR_START);
    expect(support.lastTimestamp).toBe(R33_COMMON_INTERIOR_END);
    expect(support.rows.every((row) => row.timestamp >= R33_COMMON_INTERIOR_START && row.timestamp <= R33_COMMON_INTERIOR_END)).toBe(true);
  });

  it("evaluates exact, minus-five-minute, and plus-five-minute timestamp semantics", () => {
    const rows = archiveRows();
    const exact = evaluateR33Offset(rows, liveRows(0), "sum_open_interest", "OPEN_INTEREST", "BTCUSDT", "EXACT");
    const minus = evaluateR33Offset(rows, liveRows(-300_000), "sum_open_interest", "OPEN_INTEREST", "BTCUSDT", "ARCHIVE_MINUS_5M");
    const plus = evaluateR33Offset(rows, liveRows(300_000), "sum_open_interest", "OPEN_INTEREST", "BTCUSDT", "ARCHIVE_PLUS_5M");
    expect([exact, minus, plus].map((item) => item.denominatorRows)).toEqual([286, 286, 286]);
    expect(exact.pass).toBe(true);
    expect(minus.pass).toBe(true);
    expect(plus.pass).toBe(true);
    expect(r33AbsoluteTolerance("1.00")).toBeCloseTo(0.005000000001);
  });

  it("requires full-support numeric agreement and records error statistics", () => {
    const rows = archiveRows();
    const live = liveRows(0).map((row, index) => index < 2 ? { ...row, rawValue: "2.00" } : row);
    const result = evaluateR33Offset(rows, live, "sum_open_interest", "OPEN_INTEREST", "BTCUSDT", "EXACT");
    expect(result.denominatorRows).toBe(286);
    expect(result.matchedRows).toBe(286);
    expect(result.numericAgreementRows).toBe(284);
    expect(result.numericAgreementRate).toBeLessThan(0.995);
    expect(result.pass).toBe(false);
    expect(result.maxAbsoluteError).toBe(1);
  });

  it("uses one-pass, zero-pass, and multi-pass symbol verdicts without tie-breaking", () => {
    expect(classifyR33Symbol("OPEN_INTEREST", "BTCUSDT", [evaluation("EXACT"), evaluation("ARCHIVE_MINUS_5M", "BTCUSDT", false), evaluation("ARCHIVE_PLUS_5M", "BTCUSDT", false)]).verdict).toBe("UNIQUE_SEMANTIC_OFFSET");
    expect(classifyR33Symbol("OPEN_INTEREST", "BTCUSDT", [evaluation("EXACT", "BTCUSDT", false), evaluation("ARCHIVE_MINUS_5M", "BTCUSDT", false), evaluation("ARCHIVE_PLUS_5M", "BTCUSDT", false)]).verdict).toBe("NO_SEMANTIC_OFFSET_MATCH");
    expect(classifyR33Symbol("OPEN_INTEREST", "BTCUSDT", [evaluation("EXACT"), evaluation("ARCHIVE_MINUS_5M"), evaluation("ARCHIVE_PLUS_5M", "BTCUSDT", false)]).verdict).toBe("TIMESTAMP_SEMANTICS_AMBIGUOUS");
  });

  it("requires every symbol to select the same offset for field admission", () => {
    const mapping = R33_FIELD_MAPPINGS[0]!;
    const same = R33_SYMBOLS.map((symbol) => classifyR33Symbol(mapping.id, symbol, [evaluation("ARCHIVE_MINUS_5M", symbol), evaluation("EXACT", symbol, false), evaluation("ARCHIVE_PLUS_5M", symbol, false)]));
    const admitted = summarizeR33Field(mapping, same);
    expect(admitted.status).toBe("FIELD_MAPPING_ADMITTED_CURRENT_REGIME");
    expect(admitted.admitted).toBe(true);
    const inconsistent = [...same.slice(0, 4), classifyR33Symbol(mapping.id, "BNBUSDT", [evaluation("EXACT", "BNBUSDT"), evaluation("ARCHIVE_MINUS_5M", "BNBUSDT", false), evaluation("ARCHIVE_PLUS_5M", "BNBUSDT", false)])];
    expect(summarizeR33Field(mapping, inconsistent).status).toBe("FIELD_TIMESTAMP_SEMANTICS_INCONSISTENT_ACROSS_SYMBOLS");
    expect(summarizeR33Field(mapping, same.slice(0, 4), ["BNBUSDT"]).status).toBe("FIELD_REACHABILITY_INCOMPLETE");
  });

  it("applies overall classification priority and keeps historical mapping false", () => {
    const mapping = R33_FIELD_MAPPINGS[0]!;
    const verdicts = R33_SYMBOLS.map((symbol) => classifyR33Symbol(mapping.id, symbol, [evaluation("EXACT", symbol), evaluation("ARCHIVE_MINUS_5M", symbol, false), evaluation("ARCHIVE_PLUS_5M", symbol, false)]));
    const summary = summarizeR33Field(mapping, verdicts);
    expect(classifyR33Overall(true, false, 25, [summary, summary, summary, summary, summary])).toEqual({ sourceClassification: "BINANCE_METRICS_CURRENT_REGIME_MAPPING_ESTABLISHED", sourceNextStage: "HISTORICAL_METRICS_REGIME_AND_COVERAGE_AUDIT_REQUIRED", currentRegimeMappingEstablished: true });
    expect(classifyR33Overall(true, false, 24, [summary])).toMatchObject({ sourceClassification: "SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY" });
    expect(classifyR33Overall(true, true, 25, [])).toMatchObject({ sourceClassification: "ARCHIVE_VERSION_DRIFT_DETECTED" });
  });

  it("hashes an evidence manifest deterministically and prevents a second receipt", () => {
    const manifest = { entries: [{ path: "x", sha256: "a" }], archiveEvidenceFiles: 1, liveEvidenceFiles: 0 };
    expect(r33ManifestSha256(manifest)).toBe(r33ManifestSha256({ liveEvidenceFiles: 0, archiveEvidenceFiles: 1, entries: [{ sha256: "a", path: "x" }] }));
    const root = mkdtempSync(path.join(os.tmpdir(), "r33-"));
    temporaryRoots.push(root);
    expect(() => assertR33NoPreviousExecution(root)).not.toThrow();
    const receiptPath = path.join(root, "docs", "research");
    mkdirSync(receiptPath, { recursive: true });
    writeFileSync(path.join(receiptPath, "round-033-execution-receipt.json"), "{}\n");
    expect(() => assertR33NoPreviousExecution(root)).toThrow(/second invocation/u);
  });

  it("keeps the source-only governance boundary", () => {
    expect(R33_GOVERNANCE.economicOutcomeFilesRead).toBe(false);
    expect(R33_GOVERNANCE.economicEvaluationPerformed).toBe(false);
    expect(R33_GOVERNANCE.performanceExecutionCount).toBe(0);
    expect(R33_GOVERNANCE.automaticTrading).toBe(false);
    expect(R33_GOVERNANCE.humanDecisionRequired).toBe(true);
    expect(JSON.stringify(R33_PROTOCOL_OBJECT)).not.toContain(".cache/tradepulse/round-014/observations.ndjson");
  });

  it("keeps the CLI import-safe", () => {
    expect(isR33DirectExecution("file:///not-the-script.ts", "C:\\other.ts")).toBe(false);
  });
});
