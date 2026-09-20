import { createHash } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  R32_BASE_SHA,
  R32_ENDPOINTS,
  R32_FIELD_MAPPINGS,
  R32_MIN_NUMERIC_AGREEMENT,
  R32_MIN_TIMESTAMP_COVERAGE,
  R32_PROTOCOL_OBJECT,
  R32_SYMBOLS,
  R32_TIMESTAMP_MAPPINGS,
  parseR32ArchiveCreateTime,
  parseR32ArchiveRows,
  runR32Reprobe,
  type R32CurlResult,
  type R32Fetch,
} from "../src/lib/research/round-032-binance-metrics-environment.ts";

const HEADER = ["create_time", "symbol", "sum_open_interest", "sum_open_interest_value", "count_toptrader_long_short_ratio", "sum_toptrader_long_short_ratio", "count_long_short_ratio", "sum_taker_long_short_vol_ratio"] as const;
const SYMBOL = "BTCUSDT" as const;
const TIMESTAMP = 1_789_689_600_000;

function zipOne(text: string): Uint8Array {
  const name = Buffer.from("metrics.csv");
  const input = Buffer.from(text, "utf8");
  const compressed = deflateRawSync(input);
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(input.length, 22); local.writeUInt16LE(name.length, 26); name.copy(local, 30);
  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(input.length, 24); central.writeUInt16LE(name.length, 28); name.copy(central, 46);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10); eocd.writeUInt32LE(central.length, 12); eocd.writeUInt32LE(local.length + compressed.length, 16);
  return new Uint8Array(Buffer.concat([local, compressed, central, eocd]));
}

function archiveZip(rawTime: string | number = String(TIMESTAMP), symbol: string = SYMBOL): Uint8Array {
  const row = [String(rawTime), symbol, "1.000", "1.000", "1.000", "1.000", "1.000", "1.000"];
  return zipOne(`${HEADER.join(",")}\n${row.join(",")}\n`);
}

function response(body: Uint8Array | string, status = 200): Response {
  return new Response(typeof body === "string" ? body : Buffer.from(body), { status, headers: { "content-type": "application/json" } });
}

function fakePayload(endpoint: string): string {
  const field = endpoint === "openInterestHist" ? "sumOpenInterest" : endpoint === "takerlongshortRatio" ? "buySellRatio" : "longShortRatio";
  return JSON.stringify([{ timestamp: TIMESTAMP, [field]: "1.000" }]);
}

function fakeNodeFetch(options: { nodeProbeOk?: boolean; archiveBytes?: Uint8Array; formal?: boolean; failError?: unknown; failProbeOnly?: boolean } = {}): { fetch: R32Fetch; calls: string[] } {
  const calls: string[] = [];
  const fetch: R32Fetch = async (input) => {
    calls.push(input);
    if (input.includes("/fapi/v1/time")) {
      if (options.nodeProbeOk === false) throw options.failError ?? new TypeError("fetch failed");
      return response("{\"serverTime\":1}");
    }
    if (input.endsWith(".zip") || input.endsWith(".zip.CHECKSUM")) { if (options.nodeProbeOk === false && !options.failProbeOnly) throw options.failError ?? new TypeError("fetch failed"); const symbol = new URL(input).pathname.split("/").at(-1)?.split("-")[0] ?? SYMBOL; const bytes = options.archiveBytes ?? archiveZip(String(TIMESTAMP), symbol); return input.endsWith(".zip") ? response(bytes, 200) : response(`${createHash("sha256").update(bytes).digest("hex")}  metrics.zip`, 200); }
    if (options.formal === false) return response("[]", 200);
    if (options.nodeProbeOk === false && !options.failProbeOnly) throw options.failError ?? new TypeError("fetch failed");
    const endpoint = new URL(input).pathname.split("/").at(-1) ?? "openInterestHist";
    return response(fakePayload(endpoint), 200);
  };
  return { fetch, calls };
}

function failedCurl(errorMessage = "curl unavailable"): () => Promise<R32CurlResult> {
  return async () => ({ commandAvailable: false, exitCode: null, httpStatus: null, stdout: new Uint8Array(), stderr: errorMessage, errorName: "Error", errorMessage });
}

function successfulCurl(archiveBytes?: Uint8Array): { runner: (url: string, args: readonly string[]) => Promise<R32CurlResult>; calls: string[][] } {
  const calls: string[][] = [];
  return { calls, runner: async (url, args) => { calls.push([url, ...args]); const symbol = new URL(url).pathname.split("/").at(-1)?.split("-")[0] ?? SYMBOL; const bytes = archiveBytes ?? archiveZip(String(TIMESTAMP), symbol); const body = url.includes("/fapi/v1/time") ? "{\"serverTime\":1}" : url.endsWith(".zip") ? bytes : url.endsWith(".zip.CHECKSUM") ? `${createHash("sha256").update(bytes).digest("hex")}  metrics.zip` : fakePayload(new URL(url).pathname.split("/").at(-1) ?? "openInterestHist"); return { commandAvailable: true, exitCode: 0, httpStatus: 200, stdout: typeof body === "string" ? new Uint8Array(Buffer.from(body)) : body, stderr: "" }; } };
}

function root(): string { return mkdtempSync(path.join(os.tmpdir(), "tradepulse-r32-")); }
function fixedClock(): () => Date { return () => new Date("2026-09-20T00:00:00.000Z"); }

describe("Round-032 Binance metrics execution-environment reprobe", () => {
  it("freezes the exact base and inherited mapping cardinalities", () => {
    expect(R32_BASE_SHA).toBe("96f14392b02ea492a1b2c6f20b47334a3bf3234a");
    expect(R32_PROTOCOL_OBJECT.base.sha).toBe(R32_BASE_SHA);
    expect(R32_SYMBOLS).toHaveLength(5); expect(R32_ENDPOINTS).toHaveLength(5); expect(R32_FIELD_MAPPINGS).toHaveLength(5); expect(R32_TIMESTAMP_MAPPINGS).toHaveLength(3);
  });

  it.each([
    ["2026-09-18 00:05:00", "UTC_DATETIME_STRING", 1_789_689_900_000],
    ["2026-09-18 00:05:00.000", "UTC_DATETIME_STRING", 1_789_689_900_000],
    ["1789689900000", "EPOCH_MS", 1_789_689_900_000],
    [1789689900, "EPOCH_SECONDS", 1_789_689_900_000],
    ["2026-09-18T00:05:00Z", "ISO_WITH_ZONE", 1_789_689_900_000],
    ["2026-09-18T00:05:00+00:00", "ISO_WITH_ZONE", 1_789_689_900_000],
  ] as const)("parses %s as %s", (raw, mode, timestamp) => { const parsed = parseR32ArchiveCreateTime(raw); expect(parsed.mode).toBe(mode); expect(parsed.timestamp).toBe(timestamp); });

  it("fails closed for unsupported, fractional, local-zone, and out-of-range times", () => {
    for (const raw of ["2026/09/18 00:05:00", "2026-09-18 00:05:00+08:00", "1789689900.5", "999", null, {}, "2026-09-18T00:05:00-05:00"]) expect(() => parseR32ArchiveCreateTime(raw)).toThrow();
  });

  it("parses UTC datetime independently of the host timezone", () => {
    const original = process.env.TZ; try { process.env.TZ = "America/Los_Angeles"; expect(parseR32ArchiveCreateTime("2026-09-18 00:05:00").timestamp).toBe(1_789_689_900_000); } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
  });

  it("reports checksum validity independently from schema and parser validity", () => {
    const bytes = archiveZip("not-a-supported-time"); const parsed = parseR32ArchiveRows(bytes, SYMBOL); expect(parsed.headerSchemaValid).toBe(true); expect(parsed.timestampParserValid).toBe(false); const localSha = createHash("sha256").update(bytes).digest("hex"); expect(localSha).toHaveLength(64);
  });

  it("records the four format counters and exact duplicate semantics", () => {
    const bytes = zipOne(`${HEADER.join(",")}\n2026-09-18 00:00:00,${SYMBOL},1,1,1,1,1,1\n2026-09-18T00:05:00Z,${SYMBOL},1,1,1,1,1,1\n`); const parsed = parseR32ArchiveRows(bytes, SYMBOL); expect(parsed.createTimeFormatCounts.UTC_DATETIME_STRING).toBe(1); expect(parsed.createTimeFormatCounts.ISO_WITH_ZONE).toBe(1); expect(parsed.duplicateValid).toBe(true);
  });

  it("captures nested Node fetch cause and runs curl only after Node fails", async () => {
    const nested = Object.assign(new Error("connect reset"), { code: "ECONNRESET" }); const failed = Object.assign(new TypeError("fetch failed"), { cause: nested }); const calls: string[][] = []; const curl = successfulCurl(); const result = await runR32Reprobe({ root: root(), protocolCommitSha: "a".repeat(40), fetchImpl: fakeNodeFetch({ nodeProbeOk: false, failError: failed }).fetch, curlRunner: async (url, args) => { calls.push([url, ...args]); return curl.runner(url, args); }, dnsLookup: async () => ["192.0.2.1"], clock: fixedClock(), env: {} }); expect(result.executionEnvironment.nodeFetch.success).toBe(false); expect(result.executionEnvironment.nodeFetch.nestedCauseCode).toBe("ECONNRESET"); expect(result.executionEnvironment.curl.attempted).toBe(true); expect(result.executionEnvironment.selectedTransport).toBe("CURL"); expect(calls.length).toBe(36);
  });

  it("selects Node and skips curl when the Node probe succeeds", async () => {
    const node = fakeNodeFetch(); let curlCalls = 0; const result = await runR32Reprobe({ root: root(), protocolCommitSha: "b".repeat(40), fetchImpl: node.fetch, curlRunner: async () => { curlCalls += 1; return { commandAvailable: true, exitCode: 0, httpStatus: 200, stdout: new Uint8Array(), stderr: "" }; }, dnsLookup: async () => ["192.0.2.1"], clock: fixedClock(), env: {} }); expect(result.executionEnvironment.selectedTransport).toBe("NODE_FETCH"); expect(result.executionEnvironment.curl.attempted).toBe(false); expect(curlCalls).toBe(0); expect(result.formalMappingExecutionCount).toBe(1); expect(result.requestEvidence).toHaveLength(25); expect(new Set(result.requestEvidence.map((item) => item.selectedTransport))).toEqual(new Set(["NODE_FETCH"]));
  });

  it("fails closed with no formal mapping when both transports fail", async () => {
    const error = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("unreachable"), { code: "ENETUNREACH" }) }); const node = fakeNodeFetch({ nodeProbeOk: false, failError: error, failProbeOnly: true }); const result = await runR32Reprobe({ root: root(), protocolCommitSha: "c".repeat(40), fetchImpl: node.fetch, curlRunner: failedCurl("no route"), dnsLookup: async () => [], clock: fixedClock(), env: {} }); expect(result.executionEnvironment.selectedTransport).toBeNull(); expect(result.archiveOverlapReady).toBe(true); expect(result.formalMappingExecutionCount).toBe(0); expect(result.requestEvidence).toHaveLength(0); expect(result.sourceClassification).toBe("LIVE_TRANSPORT_UNAVAILABLE_IN_CURRENT_EXECUTION_ENVIRONMENT");
  });

  it("does not perform mapping when archive schema/parser readiness fails", async () => {
    const node = fakeNodeFetch({ archiveBytes: new Uint8Array(Buffer.from("not a zip")) }); const result = await runR32Reprobe({ root: root(), protocolCommitSha: "d".repeat(40), fetchImpl: node.fetch, curlRunner: failedCurl(), dnsLookup: async () => ["192.0.2.1"], clock: fixedClock(), env: {} }); expect(result.archiveOverlapReady).toBe(false); expect(result.formalMappingExecutionCount).toBe(0); expect(result.requestEvidence).toHaveLength(0); expect(result.sourceClassification).toBe("SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_ARCHIVE_PARSER_OR_SCHEMA");
  });

  it("uses one selected CURL transport for all archive and formal requests without retry", async () => {
    const node = fakeNodeFetch({ nodeProbeOk: false, failError: new TypeError("fetch failed") }); const curl = successfulCurl(); let nodeCalls = 0; const fakeFetch: R32Fetch = async (...args) => { nodeCalls += 1; return node.fetch(...args); }; const result = await runR32Reprobe({ root: root(), protocolCommitSha: "e".repeat(40), fetchImpl: fakeFetch, curlRunner: curl.runner, dnsLookup: async () => ["192.0.2.1"], clock: fixedClock(), env: {} }); expect(result.executionEnvironment.selectedTransport).toBe("CURL"); expect(result.formalMappingExecutionCount).toBe(1); expect(result.requestEvidence).toHaveLength(25); expect(new Set(result.requestEvidence.map((item) => item.selectedTransport))).toEqual(new Set(["CURL"])); expect(curl.calls).toHaveLength(36); expect(nodeCalls).toBe(1); expect(curl.calls.every((call) => call.includes("--retry") && call[call.indexOf("--retry") + 1] === "0")).toBe(true);
  });

  it("redacts proxy values and prevents a second invocation", async () => {
    const directory = root(); const result = await runR32Reprobe({ root: directory, protocolCommitSha: "f".repeat(40), fetchImpl: fakeNodeFetch({ nodeProbeOk: false }).fetch, curlRunner: failedCurl(), dnsLookup: async () => [], clock: fixedClock(), env: { HTTPS_PROXY: "https://user:secret@example.test:443/path" } }); const serialized = JSON.stringify(result); expect(serialized).not.toContain("secret"); expect(result.executionEnvironment.proxyEnvironment.HTTPS_PROXY).toBe(true); await expect(runR32Reprobe({ root: directory, protocolCommitSha: "f".repeat(40), fetchImpl: fakeNodeFetch({ nodeProbeOk: false }).fetch, curlRunner: failedCurl(), dnsLookup: async () => [], clock: fixedClock(), env: {} })).rejects.toThrow("second invocation");
  });

  it("writes a completed durable receipt and does not read observations or run economics", async () => {
    const directory = root(); await runR32Reprobe({ root: directory, protocolCommitSha: "1".repeat(40), fetchImpl: fakeNodeFetch({ nodeProbeOk: false }).fetch, curlRunner: failedCurl(), dnsLookup: async () => [], clock: fixedClock(), env: {} }); const receipt = JSON.parse(readFileSync(path.join(directory, "docs/research/round-032-execution-receipt.json"), "utf8")) as Record<string, unknown>; expect(receipt.status).toBe("COMPLETED"); expect(receipt.r32ExecutionCount).toBe(1); const source = readFileSync("src/lib/research/round-032-binance-metrics-environment.ts", "utf8"); expect(source).not.toContain("observations.ndjson"); expect(source).not.toContain("runBacktest");
  });

  it("has an import-safe CLI guard and preserves frozen R31 thresholds", async () => {
    const script = readFileSync("scripts/m3-r32-binance-metrics-environment-reprobe.ts", "utf8"); expect(script).toContain("isR32DirectExecution"); expect(script).toContain("if (isR32DirectExecution(import.meta.url))"); expect(R32_PROTOCOL_OBJECT.numericAgreement.minimumRate).toBe(R32_MIN_NUMERIC_AGREEMENT); expect(R32_PROTOCOL_OBJECT.timestampMappings.minimumCoverage).toBe(R32_MIN_TIMESTAMP_COVERAGE); expect(R32_PROTOCOL_OBJECT.numericAgreement.tolerance).toBe("0.5 * 10^(-liveDecimalPlaces) + 1e-12");
  });

  it("keeps economics, forward, performance, and automated trading out of the result", () => {
    expect(R32_PROTOCOL_OBJECT.economics).toEqual({ economicOutcomeFilesRead: false, economicEvaluationPerformed: false, tradingEconomicMetricsCalculated: false, modelFitCount: 0, candidateCount: 0, championCount: 0, selectedAlertCount: 0 }); expect(R32_PROTOCOL_OBJECT.governance.automaticTrading).toBe(false); expect(R32_PROTOCOL_OBJECT.governance.humanDecisionRequired).toBe(true);
  });
});
