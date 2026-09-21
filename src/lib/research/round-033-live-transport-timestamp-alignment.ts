import { createHash } from "node:crypto";
import { execFile as defaultExecFile } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import {
  R31_ARCHIVE_FIELDS,
  R31_ENDPOINTS,
  R31_FIELD_MAPPINGS,
  R31_SYMBOLS,
  R31_TIMESTAMP_MAPPINGS,
  filterR31LiveRows,
  liveDecimalPlaces,
  r31RelativeError,
  type R31ArchiveField,
  type R31ArchiveRow,
  type R31Endpoint,
  type R31LiveRow,
  type R31Symbol,
  type R31TimestampMapping,
} from "./round-031-binance-metrics-overlap.ts";
import { parseR32ArchiveRows, type R32ParserMode } from "./round-032-binance-metrics-environment.ts";

export const R33_RESEARCH_ROUND_ID = "baseline-002-research-round-033" as const;
export const R33_CLASSIFICATION = "SOURCE_SEMANTIC_ALIGNMENT_REPROBE_ONLY" as const;
export const R33_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R33_BASE_SHA = "dac13c5a0863f60e0bcfc932ef5db7dab7eff282" as const;
export const R33_BRANCH = "research/round-033-live-transport-timestamp-alignment" as const;
export const R33_DATE = "2026-09-18" as const;
export const R33_START_TIME = 1_789_689_600_000 as const;
export const R33_END_TIME = 1_789_775_999_999 as const;
export const R33_PERIOD = "5m" as const;
export const R33_LIMIT = 500 as const;
export const R33_ARCHIVE_BASE_URL = "https://data.binance.vision/data/futures/um/daily/metrics" as const;
export const R33_LIVE_BASE_URL = "https://fapi.binance.com/futures/data" as const;
export const R33_COMMON_INTERIOR_START = R33_START_TIME + 300_000;
export const R33_COMMON_INTERIOR_END = R33_END_TIME - 599_999;
export const R33_EXPECTED_COMMON_INTERIOR_ROWS = 286 as const;
export const R33_MIN_TIMESTAMP_COVERAGE = 0.99 as const;
export const R33_MIN_NUMERIC_AGREEMENT = 0.995 as const;
export const R33_NUMERIC_TOLERANCE = "0.5 * 10^(-liveDecimalPlaces) + 1e-12" as const;
export const R33_TIMESTAMP_MAPPINGS = R31_TIMESTAMP_MAPPINGS;
export const R33_SYMBOLS = R31_SYMBOLS;
export const R33_ENDPOINTS = R31_ENDPOINTS;
export const R33_ARCHIVE_FIELDS = R31_ARCHIVE_FIELDS;
export const R33_FIELD_MAPPINGS = R31_FIELD_MAPPINGS;

export const R33_ARCHIVE_SHA256 = Object.freeze({
  BTCUSDT: "3558afea198d8579ea1fa8c176726ed2204770dbdd2dd05a5dfed6c83d8c7be3",
  ETHUSDT: "689c8d44f3f3f98091007a25ffa71f218d23583277bf3817c527e6bfd6b52e5a",
  SOLUSDT: "4fddfea48dfbaf59cc6a2b677f67372d862f0533a339a355dc392fa1524ab3b4",
  XRPUSDT: "b5d88e786808b80441b4cd16d43404f2a77a2b3e61799f2e93718da37c838e88",
  BNBUSDT: "ac6121e416d6a4f5d0e03bc4208f759f8324dc039923bb0aab7bf9c10d00a0ea",
} as const);

export const R33_RETRYABLE_CURL_EXIT_CODES = Object.freeze([6, 7, 28, 35, 52, 55, 56] as const);
export const R33_CURL_ARGS = Object.freeze(["--silent", "--show-error", "--fail-with-body", "--connect-timeout", "10", "--max-time", "20", "--retry", "0", "--write-out", "\\n%{http_code}"] as const);

export const R33_GOVERNANCE = Object.freeze({
  economicOutcomeFilesRead: false,
  economicEvaluationPerformed: false,
  tradingEconomicMetricsCalculated: false,
  modelFitCount: 0,
  candidateCount: 0,
  championCount: 0,
  selectedAlertCount: 0,
  candidateExecutableFrozen: false,
  forwardCandidateExists: false,
  forwardValidationAuthorized: false,
  forwardEconomicValuesRead: false,
  forwardReturnRead: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  automaticTrading: false,
  humanDecisionRequired: true,
  productionUnchanged: true,
  emailRestorationAuthorized: false,
  baseline002Status: "NOT_FROZEN",
  m3GStatus: "EXCLUDED_FROM_ROUND_033",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
} as const);

const OFFSET_MILLISECONDS: Readonly<Record<R31TimestampMapping, number>> = Object.freeze({ EXACT: 0, ARCHIVE_MINUS_5M: -300_000, ARCHIVE_PLUS_5M: 300_000 });

export type R33Offset = R31TimestampMapping;
export type R33ParserMode = R32ParserMode;
export type R33ErrorClass = "NETWORK" | "HTTP" | "NON_JSON" | "NON_ARRAY" | "SCHEMA" | "ARCHIVE" | "CHECKSUM" | "DUPLICATE" | "MAPPING" | "NUMERIC" | "RECEIPT";
export type R33CurlResult = Readonly<{ commandAvailable: boolean; exitCode: number | null; httpStatus: number | null; stdout: Uint8Array; stderr: string; errorName?: string | null; errorMessage?: string | null }>;
export type R33CurlRunner = (url: string, args: readonly string[]) => Promise<R33CurlResult>;
export type R33Clock = () => Date;

export type R33RequestAttempt = Readonly<{ attemptNumber: 1 | 2; startedAt: string; completedAt: string; curlExit: number | null; httpStatus: number | null; bytes: number; sha256: string | null; errorClass: R33ErrorClass | null; errorMessage: string | null }>;
export type R33RequestEvidence = Readonly<{ symbol: R31Symbol; endpointOrPath: string; requestUrl: string; attempt1: R33RequestAttempt; attempt2: R33RequestAttempt | null; finalSuccessful: boolean; finalAttemptNumber: 1 | 2; finalHttpStatus: number | null; finalResponseBytes: number | null; finalPayloadSha256: string | null; finalErrorClass: R33ErrorClass | null; finalErrorMessage: string | null }>;
export type R33OffsetEvaluation = Readonly<{ fieldId: string; symbol: R31Symbol; offset: R33Offset; offsetMilliseconds: number; denominatorRows: number; matchedRows: number; timestampCoverage: number; numericAgreementRows: number; numericAgreementRate: number; meanAbsoluteError: number | null; medianAbsoluteError: number | null; maxAbsoluteError: number | null; meanRelativeError: number | null; maxRelativeError: number | null; pass: boolean }>;
export type R33SymbolVerdict = Readonly<{ fieldId: string; symbol: R31Symbol; offsetEvaluations: readonly R33OffsetEvaluation[]; matchingOffsetCount: number; verdict: "UNIQUE_SEMANTIC_OFFSET" | "NO_SEMANTIC_OFFSET_MATCH" | "TIMESTAMP_SEMANTICS_AMBIGUOUS"; selectedOffset: R33Offset | null }>;
export type R33FieldSummary = Readonly<{ fieldId: string; archiveField: R31ArchiveField; liveEndpoint: R31Endpoint; liveField: string; status: "FIELD_MAPPING_ADMITTED_CURRENT_REGIME" | "FIELD_TIMESTAMP_SEMANTICS_INCONSISTENT_ACROSS_SYMBOLS" | "FIELD_TIMESTAMP_SEMANTICS_AMBIGUOUS" | "FIELD_NUMERIC_SEMANTIC_MISMATCH" | "FIELD_REACHABILITY_INCOMPLETE"; admitted: boolean; selectedOffset: R33Offset | null; symbolVerdicts: readonly R33SymbolVerdict[] }>;
export type R33ArchiveEvidence = Readonly<{ symbol: R31Symbol; zipPath: string; url: string; checksumUrl: string; receivedAt: string; expectedSha256: string; localSha256: string | null; publishedChecksum: string | null; checksumValid: boolean; archiveVersionMatch: boolean; bytes: number | null; schemaValid: boolean; timestampParserValid: boolean; duplicateValid: boolean; rowCount: number; firstTimestamp: number | null; lastTimestamp: number | null; createTimeFormatCounts: Readonly<Record<R33ParserMode, number>>; zipRequest: R33RequestEvidence; checksumRequest: R33RequestEvidence; errorClass: R33ErrorClass | null; errorMessage: string | null }>;
export type R33ManifestEntry = Readonly<{ path: string; sourceUrl: string; receivedAt: string; bytes: number; sha256: string; attemptNumber: 1 | 2; httpStatus: number }>;

export type R33Result = Readonly<{
  schemaVersion: "m3-r33-live-transport-timestamp-alignment-result-001";
  researchRoundId: typeof R33_RESEARCH_ROUND_ID;
  classification: typeof R33_CLASSIFICATION;
  protocolCommitSha: string;
  runId: string;
  r33ExecutionCount: 1;
  fixedWindow: Readonly<{ date: typeof R33_DATE; startTime: typeof R33_START_TIME; endTime: typeof R33_END_TIME; timezone: "UTC" }>;
  inheritedR32Conclusion: Readonly<{ archiveOverlapReady: true; liveSuccessfulRequests: 24; liveFailedRequests: 1; sourceClassification: "SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY" }>;
  archiveEvidence: readonly R33ArchiveEvidence[];
  archiveEvidenceFiles: 5;
  archiveChecksumRequests: 5;
  archiveOverlapReady: boolean;
  archiveVersionDriftDetected: boolean;
  requestEvidence: readonly R33RequestEvidence[];
  firstAttemptSuccessCount: number;
  retryAttemptCount: number;
  retrySuccessCount: number;
  liveLogicalRequests: 25;
  liveSuccessfulRequests: number;
  liveFailedRequests: number;
  fieldSummaries: readonly R33FieldSummary[];
  admittedFields: readonly string[];
  rejectedFields: readonly string[];
  admittedFieldCount: number;
  currentRegimeMappingEstablished: boolean;
  historicalRegimeMappingEstablished: false;
  fullHistoricalCoverageCertified: false;
  historicalFeatureAvailableTime: "archiveCreateTime + 5 minutes";
  pitPolicyFinalizationPendingHistoricalRegimeAudit: true;
  sourceClassification: string;
  sourceNextStage: string;
  economicOutcomeFilesRead: false;
  economicEvaluationPerformed: false;
  tradingEconomicMetricsCalculated: false;
  modelFitCount: 0;
  candidateCount: 0;
  championCount: 0;
  selectedAlertCount: 0;
  governance: typeof R33_GOVERNANCE;
  evidenceManifestPath: "docs/research/round-033-evidence-manifest.json";
}>;

export const R33_PROTOCOL_OBJECT = Object.freeze({
  schemaVersion: "m3-r33-live-transport-timestamp-alignment-protocol-001",
  researchRoundId: R33_RESEARCH_ROUND_ID,
  classification: R33_CLASSIFICATION,
  base: Object.freeze({ branch: R33_BASE_BRANCH, sha: R33_BASE_SHA }),
  branch: R33_BRANCH,
  fixedWindow: Object.freeze({ date: R33_DATE, startTime: R33_START_TIME, endTime: R33_END_TIME, timezone: "UTC" }),
  symbols: R33_SYMBOLS,
  endpoints: R33_ENDPOINTS,
  request: Object.freeze({ period: R33_PERIOD, limit: R33_LIMIT, logicalRequests: 25, maxAttempts: 2, transport: "CURL_ONLY", curlArguments: R33_CURL_ARGS, retryExitCodes: R33_RETRYABLE_CURL_EXIT_CODES, retryWaitSeconds: 2, noThirdAttempt: true }),
  archive: Object.freeze({ baseUrl: R33_ARCHIVE_BASE_URL, zipFiles: 5, checksumFiles: 5, expectedSha256: R33_ARCHIVE_SHA256, parser: "R32_MULTI_FORMAT_UTC_TIMESTAMP", commonInterior: Object.freeze({ start: R33_COMMON_INTERIOR_START, end: R33_COMMON_INTERIOR_END, expectedRows: R33_EXPECTED_COMMON_INTERIOR_ROWS }) }),
  fieldMappings: R33_FIELD_MAPPINGS,
  timestampMappings: Object.freeze({ options: R33_TIMESTAMP_MAPPINGS, offsetsMilliseconds: OFFSET_MILLISECONDS, noOtherOffsets: true, minimumCoverage: R33_MIN_TIMESTAMP_COVERAGE }),
  numericAgreement: Object.freeze({ tolerance: R33_NUMERIC_TOLERANCE, minimumRate: R33_MIN_NUMERIC_AGREEMENT, sameDenominator: true }),
  classifications: Object.freeze({ archiveDrift: "ARCHIVE_VERSION_DRIFT_DETECTED", archiveDriftNext: "ARCHIVE_REVISION_AUDIT_REQUIRED", reachabilityFailure: "SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY", reachabilityNext: "BINANCE_REACHABLE_EXECUTION_ENVIRONMENT_REQUIRED", allFields: "BINANCE_METRICS_CURRENT_REGIME_MAPPING_ESTABLISHED", partialFields: "BINANCE_METRICS_PARTIAL_CURRENT_REGIME_MAPPING_ESTABLISHED", ambiguous: "BINANCE_METRICS_TIMESTAMP_SEMANTICS_AMBIGUOUS", incompatible: "BINANCE_METRICS_CURRENT_REGIME_MAPPING_INCOMPATIBLE" }),
  pit: Object.freeze({ historicalFeatureAvailableTime: "archiveCreateTime + 5 minutes", finalizationPendingHistoricalRegimeAudit: true }),
  currentOnly: Object.freeze({ historicalRegimeMappingEstablished: false, fullHistoricalCoverageCertified: false }),
  m3G1: Object.freeze({ status: "EXCLUDED_FROM_ROUND_033", reason: "R33 is source transport and timestamp alignment only." }),
  economics: Object.freeze({ economicOutcomeFilesRead: false, economicEvaluationPerformed: false, tradingEconomicMetricsCalculated: false, modelFitCount: 0, candidateCount: 0, championCount: 0, selectedAlertCount: 0 }),
  governance: R33_GOVERNANCE,
} as const);

function sha256(value: Uint8Array | string): string { return createHash("sha256").update(value).digest("hex"); }
export function r33ResultSha256(result: R33Result): string { return sha256(stableJson(result)); }
export function r33ManifestSha256(manifest: unknown): string { return sha256(stableJson(manifest)); }
function stableJson(value: unknown): string { if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null"; if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`; const record = value as Record<string, unknown>; return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`; }
function iso(clock: R33Clock): string { return clock().toISOString(); }
function offsetMilliseconds(offset: R33Offset): number { return OFFSET_MILLISECONDS[offset]; }

export function r33CommonInteriorRows(rows: readonly R31ArchiveRow[]): readonly R31ArchiveRow[] { return Object.freeze(rows.filter((row) => row.timestamp >= R33_COMMON_INTERIOR_START && row.timestamp <= R33_COMMON_INTERIOR_END).sort((left, right) => left.timestamp - right.timestamp)); }
export function r33CommonInteriorSupport(rows: readonly R31ArchiveRow[]): Readonly<{ rows: readonly R31ArchiveRow[]; valid: boolean; expectedCount: number; firstTimestamp: number | null; lastTimestamp: number | null }> {
  const interior = r33CommonInteriorRows(rows);
  const expectedFirst = R33_COMMON_INTERIOR_START;
  const expectedLast = R33_COMMON_INTERIOR_END;
  const contiguous = interior.every((row, index) => row.timestamp === expectedFirst + index * 300_000);
  return Object.freeze({ rows: interior, valid: interior.length === R33_EXPECTED_COMMON_INTERIOR_ROWS && interior[0]?.timestamp === expectedFirst && interior.at(-1)?.timestamp === expectedLast && contiguous, expectedCount: R33_EXPECTED_COMMON_INTERIOR_ROWS, firstTimestamp: interior[0]?.timestamp ?? null, lastTimestamp: interior.at(-1)?.timestamp ?? null });
}

function median(values: readonly number[]): number | null { if (values.length === 0) return null; const sorted = [...values].sort((left, right) => left - right); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2; }
export function r33AbsoluteTolerance(rawLiveValue: string): number { return 0.5 * (10 ** -liveDecimalPlaces(rawLiveValue)) + 1e-12; }

export function evaluateR33Offset(archiveRows: readonly R31ArchiveRow[], liveRows: readonly R31LiveRow[], archiveField: R31ArchiveField, fieldId: string, symbol: R31Symbol, offset: R33Offset): R33OffsetEvaluation {
  const support = r33CommonInteriorSupport(archiveRows);
  const liveByTimestamp = new Map(liveRows.map((row) => [row.timestamp, row]));
  const errors: number[] = [];
  const relatives: number[] = [];
  let matchedRows = 0;
  let numericAgreementRows = 0;
  for (const archiveRow of support.rows) {
    const liveRow = liveByTimestamp.get(archiveRow.timestamp + offsetMilliseconds(offset));
    if (!liveRow) continue;
    matchedRows += 1;
    const archiveValue = Number(archiveRow.fields[archiveField]);
    const liveValue = Number(liveRow.rawValue);
    const absoluteError = Math.abs(archiveValue - liveValue);
    errors.push(absoluteError);
    relatives.push(r31RelativeError(archiveValue, liveValue));
    if (absoluteError <= r33AbsoluteTolerance(liveRow.rawValue)) numericAgreementRows += 1;
  }
  const mean = (values: readonly number[]): number | null => values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
  const numericAgreementRate = matchedRows === 0 ? 0 : numericAgreementRows / matchedRows;
  const timestampCoverage = support.rows.length === 0 ? 0 : matchedRows / support.rows.length;
  return Object.freeze({ fieldId, symbol, offset, offsetMilliseconds: offsetMilliseconds(offset), denominatorRows: support.rows.length, matchedRows, timestampCoverage, numericAgreementRows, numericAgreementRate, meanAbsoluteError: mean(errors), medianAbsoluteError: median(errors), maxAbsoluteError: errors.length === 0 ? null : Math.max(...errors), meanRelativeError: mean(relatives), maxRelativeError: relatives.length === 0 ? null : Math.max(...relatives), pass: timestampCoverage >= R33_MIN_TIMESTAMP_COVERAGE && numericAgreementRate >= R33_MIN_NUMERIC_AGREEMENT });
}

export function classifyR33Symbol(fieldId: string, symbol: R31Symbol, evaluations: readonly R33OffsetEvaluation[]): R33SymbolVerdict {
  const matching = evaluations.filter((evaluation) => evaluation.pass);
  const verdict = matching.length === 1 ? "UNIQUE_SEMANTIC_OFFSET" : matching.length === 0 ? "NO_SEMANTIC_OFFSET_MATCH" : "TIMESTAMP_SEMANTICS_AMBIGUOUS";
  return Object.freeze({ fieldId, symbol, offsetEvaluations: Object.freeze([...evaluations]), matchingOffsetCount: matching.length, verdict, selectedOffset: matching.length === 1 ? matching[0]!.offset : null });
}

export function summarizeR33Field(mapping: (typeof R33_FIELD_MAPPINGS)[number], symbolVerdicts: readonly R33SymbolVerdict[], failedSymbols: readonly R31Symbol[] = []): R33FieldSummary {
  const hasFailure = failedSymbols.length > 0 || symbolVerdicts.length !== R33_SYMBOLS.length;
  const hasAmbiguous = symbolVerdicts.some((verdict) => verdict.verdict === "TIMESTAMP_SEMANTICS_AMBIGUOUS");
  const hasNoMatch = symbolVerdicts.some((verdict) => verdict.verdict === "NO_SEMANTIC_OFFSET_MATCH");
  const selected = symbolVerdicts.filter((verdict) => verdict.selectedOffset !== null).map((verdict) => verdict.selectedOffset!);
  const allSame = selected.length === R33_SYMBOLS.length && new Set(selected).size === 1;
  const status = hasFailure ? "FIELD_REACHABILITY_INCOMPLETE" : hasAmbiguous ? "FIELD_TIMESTAMP_SEMANTICS_AMBIGUOUS" : hasNoMatch ? "FIELD_NUMERIC_SEMANTIC_MISMATCH" : allSame ? "FIELD_MAPPING_ADMITTED_CURRENT_REGIME" : "FIELD_TIMESTAMP_SEMANTICS_INCONSISTENT_ACROSS_SYMBOLS";
  return Object.freeze({ fieldId: mapping.id, archiveField: mapping.archiveField, liveEndpoint: mapping.liveEndpoint, liveField: mapping.liveField, status, admitted: status === "FIELD_MAPPING_ADMITTED_CURRENT_REGIME", selectedOffset: status === "FIELD_MAPPING_ADMITTED_CURRENT_REGIME" ? selected[0]! : null, symbolVerdicts: Object.freeze([...symbolVerdicts]) });
}

export function classifyR33Overall(archiveReady: boolean, archiveVersionDriftDetected: boolean, liveSuccessfulRequests: number, summaries: readonly R33FieldSummary[]): Readonly<{ sourceClassification: string; sourceNextStage: string; currentRegimeMappingEstablished: boolean }> {
  if (archiveVersionDriftDetected) return Object.freeze({ sourceClassification: "ARCHIVE_VERSION_DRIFT_DETECTED", sourceNextStage: "ARCHIVE_REVISION_AUDIT_REQUIRED", currentRegimeMappingEstablished: false });
  if (!archiveReady) return Object.freeze({ sourceClassification: "ARCHIVE_OVERLAP_INPUT_INVALID", sourceNextStage: "ARCHIVE_REVISION_AUDIT_REQUIRED", currentRegimeMappingEstablished: false });
  if (liveSuccessfulRequests < 25) return Object.freeze({ sourceClassification: "SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY", sourceNextStage: "BINANCE_REACHABLE_EXECUTION_ENVIRONMENT_REQUIRED", currentRegimeMappingEstablished: false });
  const admitted = summaries.filter((summary) => summary.admitted).length;
  if (admitted === 5) return Object.freeze({ sourceClassification: "BINANCE_METRICS_CURRENT_REGIME_MAPPING_ESTABLISHED", sourceNextStage: "HISTORICAL_METRICS_REGIME_AND_COVERAGE_AUDIT_REQUIRED", currentRegimeMappingEstablished: true });
  if (admitted >= 1) return Object.freeze({ sourceClassification: "BINANCE_METRICS_PARTIAL_CURRENT_REGIME_MAPPING_ESTABLISHED", sourceNextStage: "ADMITTED_FIELDS_HISTORICAL_AUDIT_REQUIRED", currentRegimeMappingEstablished: false });
  if (summaries.some((summary) => summary.status === "FIELD_TIMESTAMP_SEMANTICS_AMBIGUOUS")) return Object.freeze({ sourceClassification: "BINANCE_METRICS_TIMESTAMP_SEMANTICS_AMBIGUOUS", sourceNextStage: "SOURCE_DOCUMENTATION_OR_ALTERNATIVE_REQUIRED", currentRegimeMappingEstablished: false });
  return Object.freeze({ sourceClassification: "BINANCE_METRICS_CURRENT_REGIME_MAPPING_INCOMPATIBLE", sourceNextStage: "ALTERNATIVE_OR_PAID_INFORMATION_SOURCE_REQUIRED", currentRegimeMappingEstablished: false });
}

export function r33ArchiveUrls(symbol: R31Symbol): Readonly<{ url: string; checksumUrl: string; zipPath: string }> { const zipPath = `${symbol}/${symbol}-metrics-${R33_DATE}.zip`; const url = `${R33_ARCHIVE_BASE_URL}/${zipPath}`; return Object.freeze({ url, checksumUrl: `${url}.CHECKSUM`, zipPath }); }
export function r33LiveUrl(symbol: R31Symbol, endpoint: R31Endpoint): string { const url = new URL(`${R33_LIVE_BASE_URL}/${endpoint}`); url.search = new URLSearchParams({ symbol, period: R33_PERIOD, startTime: String(R33_START_TIME), endTime: String(R33_END_TIME), limit: String(R33_LIMIT) }).toString(); return url.toString(); }

function extractChecksum(body: Uint8Array | null): string | null { return body ? Buffer.from(body).toString("utf8").match(/\b[a-f0-9]{64}\b/iu)?.[0]?.toLowerCase() ?? null : null; }
function isRetryable(code: number | null): boolean { return code !== null && (R33_RETRYABLE_CURL_EXIT_CODES as readonly number[]).includes(code); }
export function r33ShouldRetry(curlExitCode: number | null, attemptNumber: 1 | 2): boolean { return attemptNumber === 1 && isRetryable(curlExitCode); }
function parseCurlOutput(result: R33CurlResult): R33CurlResult {
  if (result.httpStatus !== null) return result;
  const text = Buffer.from(result.stdout).toString("latin1");
  const marker = /\r?\n(\d{3})\s*$/u.exec(text);
  if (!marker) return result;
  return Object.freeze({ ...result, httpStatus: Number(marker[1]), stdout: result.stdout.slice(0, marker.index) });
}

async function defaultCurlRunner(url: string, args: readonly string[]): Promise<R33CurlResult> {
  const execFile = promisify(defaultExecFile);
  try {
    const result = await execFile(process.platform === "win32" ? "curl.exe" : "curl", [...args, url], { encoding: "buffer", maxBuffer: 50 * 1024 * 1024 });
    return parseCurlOutput(Object.freeze({ commandAvailable: true, exitCode: 0, httpStatus: null, stdout: new Uint8Array(result.stdout as Buffer), stderr: String(result.stderr ?? "").slice(0, 1000) }));
  } catch (error) {
    const record = error as { stdout?: unknown; stderr?: unknown; status?: unknown; code?: unknown; message?: unknown; name?: unknown };
    const raw = record.stdout instanceof Buffer ? new Uint8Array(record.stdout) : new Uint8Array();
    return parseCurlOutput(Object.freeze({ commandAvailable: record.code !== "ENOENT", exitCode: typeof record.status === "number" ? record.status : null, httpStatus: null, stdout: raw, stderr: typeof record.stderr === "string" ? record.stderr.slice(0, 1000) : "", errorName: typeof record.name === "string" ? record.name : "Error", errorMessage: typeof record.message === "string" ? record.message : String(error) }));
  }
}

type RequestKind = "ARCHIVE_ZIP" | "CHECKSUM" | "LIVE_JSON";
type RequestValidation<T> = Readonly<{ value: T | null; errorClass: R33ErrorClass | null; errorMessage: string | null }>;

function validateResponse<T>(kind: RequestKind, body: Uint8Array, symbol: R31Symbol, endpoint: R31Endpoint | null): RequestValidation<T> {
  if (body.byteLength === 0) return Object.freeze({ value: null, errorClass: kind === "CHECKSUM" ? "CHECKSUM" : "ARCHIVE", errorMessage: "Successful curl response was empty." });
  if (kind === "ARCHIVE_ZIP" || kind === "CHECKSUM") return Object.freeze({ value: body as T, errorClass: null, errorMessage: null });
  try {
    const payload: unknown = JSON.parse(Buffer.from(body).toString("utf8"));
    if (!Array.isArray(payload)) return Object.freeze({ value: null, errorClass: "NON_ARRAY", errorMessage: "Live response is not an array." });
    if (!endpoint) return Object.freeze({ value: null, errorClass: "SCHEMA", errorMessage: "Live endpoint is missing." });
    const parsed = filterR31LiveRows(payload, symbol, endpoint);
    if (parsed.conflictingDuplicateCount > 0) return Object.freeze({ value: null, errorClass: "DUPLICATE", errorMessage: "Conflicting duplicate live timestamps." });
    return Object.freeze({ value: parsed.rows as T, errorClass: null, errorMessage: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const code = error instanceof Error && "code" in error && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : null;
    const errorClass: R33ErrorClass = code === "NON_JSON" ? "NON_JSON" : code === "NON_ARRAY" || message.includes("not an array") ? "NON_ARRAY" : code === "DUPLICATE" ? "DUPLICATE" : "SCHEMA";
    return Object.freeze({ value: null, errorClass, errorMessage: message });
  }
}

async function runLogicalRequest<T>(input: Readonly<{ symbol: R31Symbol; endpointOrPath: string; url: string; kind: RequestKind; endpoint: R31Endpoint | null; curlRunner: R33CurlRunner; clock: R33Clock }>): Promise<Readonly<{ evidence: R33RequestEvidence; body: Uint8Array | null; value: T | null }>> {
  const attempts: R33RequestAttempt[] = [];
  let body: Uint8Array | null = null;
  let value: T | null = null;
  let finalErrorClass: R33ErrorClass | null = null;
  let finalErrorMessage: string | null = null;
  for (const attemptNumber of [1, 2] as const) {
    const startedAt = iso(input.clock);
    const result = parseCurlOutput(await input.curlRunner(input.url, R33_CURL_ARGS));
    const completedAt = iso(input.clock);
    const bytes = result.stdout.byteLength;
    const payloadSha256 = bytes > 0 ? sha256(result.stdout) : null;
    let errorClass: R33ErrorClass | null = null;
    let errorMessage: string | null = null;
    const httpSuccess = result.exitCode === 0 && result.httpStatus !== null && result.httpStatus >= 200 && result.httpStatus < 300;
    if (httpSuccess) {
      const validation = validateResponse<T>(input.kind, result.stdout, input.symbol, input.endpoint);
      if (validation.errorClass === null) { body = result.stdout; value = validation.value; }
      else { errorClass = validation.errorClass; errorMessage = validation.errorMessage; }
    } else {
      errorClass = result.exitCode === 0 ? "HTTP" : "NETWORK";
      errorMessage = result.errorMessage ?? (result.stderr.slice(0, 1000) || `curl exit ${result.exitCode ?? "unknown"}`);
    }
    attempts.push(Object.freeze({ attemptNumber, startedAt, completedAt, curlExit: result.exitCode, httpStatus: result.httpStatus, bytes, sha256: payloadSha256, errorClass, errorMessage }));
    finalErrorClass = errorClass;
    finalErrorMessage = errorMessage;
    if (errorClass === null) break;
    if (r33ShouldRetry(result.exitCode, attemptNumber)) { await new Promise<void>((resolve) => setTimeout(resolve, 2000)); continue; }
    break;
  }
  const attempt1 = attempts[0]!;
  const attempt2 = attempts[1] ?? null;
  const finalAttempt = attempt2 ?? attempt1;
  const evidence: R33RequestEvidence = Object.freeze({ symbol: input.symbol, endpointOrPath: input.endpointOrPath, requestUrl: input.url, attempt1, attempt2, finalSuccessful: finalErrorClass === null, finalAttemptNumber: finalAttempt.attemptNumber, finalHttpStatus: finalAttempt.httpStatus, finalResponseBytes: finalAttempt.bytes, finalPayloadSha256: finalAttempt.sha256, finalErrorClass, finalErrorMessage });
  return Object.freeze({ evidence, body: finalErrorClass === null ? body : null, value: finalErrorClass === null ? value : null });
}

function writeJson(filePath: string, value: unknown, flag?: "wx"): void { writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, flag ? { flag } : undefined); }
function fileRelative(root: string, filePath: string): string { return path.relative(root, filePath).replaceAll("\\", "/"); }

export type R33RunOptions = Readonly<{ root?: string; protocolCommitSha: string; runId?: string; curlRunner?: R33CurlRunner; clock?: R33Clock }>;
export function r33ReceiptPath(root: string): string { return path.join(path.resolve(root), "docs", "research", "round-033-execution-receipt.json"); }
export function r33ResultPath(root: string): string { return path.join(path.resolve(root), "docs", "research", "round-033-live-transport-timestamp-alignment-result.json"); }
export function assertR33NoPreviousExecution(root: string): true { if (existsSync(r33ReceiptPath(root)) || existsSync(r33ResultPath(root))) throw new Error("R33 execution receipt or result already exists; refusing a second invocation."); return true; }

function randomRunId(): string { return `r33-${sha256(`${process.pid}:${Math.random()}:${new Date().toISOString()}`).slice(0, 24)}`; }
function completedReceipt(receipt: Readonly<Record<string, unknown>>, result: R33Result, manifest: unknown, clock: R33Clock): Record<string, unknown> { return { ...receipt, status: "COMPLETED", completedAt: iso(clock), resultSha256: r33ResultSha256(result), evidenceManifestSha256: r33ManifestSha256(manifest) }; }

export async function runR33Reprobe(options: R33RunOptions): Promise<R33Result> {
  if (!/^[0-9a-f]{40}$/u.test(options.protocolCommitSha)) throw new Error("R33 protocol commit SHA is invalid.");
  const root = path.resolve(options.root ?? process.cwd());
  assertR33NoPreviousExecution(root);
  const researchDir = path.join(root, "docs", "research");
  const archiveDir = path.join(researchDir, "round-033-evidence", "archive");
  const liveDir = path.join(researchDir, "round-033-evidence", "live");
  mkdirSync(archiveDir, { recursive: true });
  mkdirSync(liveDir, { recursive: true });
  const clock = options.clock ?? (() => new Date());
  const runId = options.runId ?? randomRunId();
  const startedReceipt = Object.freeze({ schemaVersion: "m3-r33-execution-receipt-001", runId, protocolCommitSha: options.protocolCommitSha, startedAt: iso(clock), executionType: "BINANCE_METRICS_TIMESTAMP_ALIGNMENT_REPROBE", status: "STARTED" as const, r33ExecutionCount: 1 as const });
  writeJson(r33ReceiptPath(root), startedReceipt, "wx");
  const curlRunner = options.curlRunner ?? defaultCurlRunner;
  const archiveData = new Map<R31Symbol, Readonly<{ evidence: R33ArchiveEvidence; rows: readonly R31ArchiveRow[]; zipBody: Uint8Array | null }>>();
  for (const symbol of R33_SYMBOLS) {
    const urls = r33ArchiveUrls(symbol);
    const zipRequest = await runLogicalRequest<Uint8Array>({ symbol, endpointOrPath: urls.zipPath, url: urls.url, kind: "ARCHIVE_ZIP", endpoint: null, curlRunner, clock });
    const checksumRequest = await runLogicalRequest<Uint8Array>({ symbol, endpointOrPath: `${urls.zipPath}.CHECKSUM`, url: urls.checksumUrl, kind: "CHECKSUM", endpoint: null, curlRunner, clock });
    let parsed: ReturnType<typeof parseR32ArchiveRows> | null = null;
    let parseError: string | null = null;
    if (zipRequest.body) {
      try { parsed = parseR32ArchiveRows(zipRequest.body, symbol); } catch (error) { parseError = error instanceof Error ? error.message : String(error); }
    }
    const localSha256 = zipRequest.evidence.finalPayloadSha256;
    const publishedChecksum = extractChecksum(checksumRequest.body);
    const checksumValid = localSha256 !== null && publishedChecksum !== null && localSha256 === publishedChecksum;
    const expectedSha256 = R33_ARCHIVE_SHA256[symbol];
    const archiveVersionMatch = localSha256 === expectedSha256;
    const emptyCounts: Record<R33ParserMode, number> = { EPOCH_MS: 0, EPOCH_SECONDS: 0, UTC_DATETIME_STRING: 0, ISO_WITH_ZONE: 0 };
    const rows = parsed?.rows ?? [];
    const errorClass: R33ErrorClass | null = parseError ? "ARCHIVE" : !archiveVersionMatch && zipRequest.evidence.finalSuccessful ? "CHECKSUM" : !checksumValid && zipRequest.evidence.finalSuccessful && checksumRequest.evidence.finalSuccessful ? "CHECKSUM" : zipRequest.evidence.finalErrorClass ?? checksumRequest.evidence.finalErrorClass;
    const archiveEvidence: R33ArchiveEvidence = Object.freeze({ symbol, zipPath: `docs/research/round-033-evidence/archive/${symbol}-metrics-${R33_DATE}.zip`, url: urls.url, checksumUrl: urls.checksumUrl, receivedAt: iso(clock), expectedSha256, localSha256, publishedChecksum, checksumValid, archiveVersionMatch, bytes: zipRequest.evidence.finalResponseBytes, schemaValid: parsed?.headerSchemaValid ?? false, timestampParserValid: parsed?.timestampParserValid ?? false, duplicateValid: parsed?.duplicateValid ?? false, rowCount: rows.length, firstTimestamp: rows[0]?.timestamp ?? null, lastTimestamp: rows.at(-1)?.timestamp ?? null, createTimeFormatCounts: Object.freeze(parsed?.createTimeFormatCounts ?? emptyCounts), zipRequest: zipRequest.evidence, checksumRequest: checksumRequest.evidence, errorClass, errorMessage: parseError ?? (!archiveVersionMatch && zipRequest.evidence.finalSuccessful ? "Downloaded archive SHA256 differs from frozen R32 identity." : null) });
    archiveData.set(symbol, Object.freeze({ evidence: archiveEvidence, rows, zipBody: zipRequest.body }));
  }
  const archiveEvidence = Object.freeze(R33_SYMBOLS.map((symbol) => archiveData.get(symbol)!.evidence));
  const archiveVersionDriftDetected = archiveEvidence.some((item) => !item.archiveVersionMatch);
  const archiveOverlapReady = archiveEvidence.every((item) => item.archiveVersionMatch && item.checksumValid && item.schemaValid && item.timestampParserValid && item.duplicateValid && item.rowCount > 0);
  const requestEvidence: R33RequestEvidence[] = [];
  const liveData = new Map<string, readonly R31LiveRow[]>();
  const liveBodies: Array<Readonly<{ evidence: R33RequestEvidence; body: Uint8Array }>> = [];
  if (!archiveVersionDriftDetected && archiveOverlapReady) {
    for (const symbol of R33_SYMBOLS) for (const endpoint of R33_ENDPOINTS) {
      const request = await runLogicalRequest<readonly R31LiveRow[]>({ symbol, endpointOrPath: endpoint, url: r33LiveUrl(symbol, endpoint), kind: "LIVE_JSON", endpoint, curlRunner, clock });
      requestEvidence.push(request.evidence);
      liveData.set(`${symbol}:${endpoint}`, request.value ?? []);
      if (request.body && request.evidence.finalSuccessful && request.evidence.finalHttpStatus !== null) liveBodies.push(Object.freeze({ evidence: request.evidence, body: request.body }));
    }
  }
  const fieldSummaries: R33FieldSummary[] = [];
  if (!archiveVersionDriftDetected && archiveOverlapReady) for (const mapping of R33_FIELD_MAPPINGS) {
    const symbolVerdicts: R33SymbolVerdict[] = [];
    const failedSymbols: R31Symbol[] = [];
    for (const symbol of R33_SYMBOLS) {
      const request = requestEvidence.find((item) => item.symbol === symbol && item.endpointOrPath === mapping.liveEndpoint);
      if (!request?.finalSuccessful) { failedSymbols.push(symbol); continue; }
      const archiveRows = archiveData.get(symbol)!.rows;
      const liveRows = liveData.get(`${symbol}:${mapping.liveEndpoint}`) ?? [];
      const evaluations = R33_TIMESTAMP_MAPPINGS.map((offset) => evaluateR33Offset(archiveRows, liveRows, mapping.archiveField, mapping.id, symbol, offset));
      symbolVerdicts.push(classifyR33Symbol(mapping.id, symbol, evaluations));
    }
    fieldSummaries.push(summarizeR33Field(mapping, symbolVerdicts, failedSymbols));
  }
  const liveSuccessfulRequests = requestEvidence.filter((item) => item.finalSuccessful).length;
  const overall = classifyR33Overall(archiveOverlapReady, archiveVersionDriftDetected, liveSuccessfulRequests, fieldSummaries);
  const admittedFields = Object.freeze(fieldSummaries.filter((summary) => summary.admitted).map((summary) => summary.fieldId));
  const rejectedFields = Object.freeze(fieldSummaries.filter((summary) => !summary.admitted).map((summary) => summary.fieldId));
  const firstAttemptSuccessCount = requestEvidence.filter((item) => item.attempt1.errorClass === null).length;
  const retryAttemptCount = requestEvidence.filter((item) => item.attempt2 !== null).length;
  const retrySuccessCount = requestEvidence.filter((item) => item.attempt2?.errorClass === null).length;
  const result: R33Result = Object.freeze({ schemaVersion: "m3-r33-live-transport-timestamp-alignment-result-001", researchRoundId: R33_RESEARCH_ROUND_ID, classification: R33_CLASSIFICATION, protocolCommitSha: options.protocolCommitSha, runId, r33ExecutionCount: 1, fixedWindow: Object.freeze({ date: R33_DATE, startTime: R33_START_TIME, endTime: R33_END_TIME, timezone: "UTC" }), inheritedR32Conclusion: Object.freeze({ archiveOverlapReady: true, liveSuccessfulRequests: 24, liveFailedRequests: 1, sourceClassification: "SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY" }), archiveEvidence, archiveEvidenceFiles: 5, archiveChecksumRequests: 5, archiveOverlapReady, archiveVersionDriftDetected, requestEvidence: Object.freeze(requestEvidence), firstAttemptSuccessCount, retryAttemptCount, retrySuccessCount, liveLogicalRequests: 25, liveSuccessfulRequests, liveFailedRequests: 25 - liveSuccessfulRequests, fieldSummaries: Object.freeze(fieldSummaries), admittedFields, rejectedFields, admittedFieldCount: admittedFields.length, currentRegimeMappingEstablished: overall.currentRegimeMappingEstablished, historicalRegimeMappingEstablished: false, fullHistoricalCoverageCertified: false, historicalFeatureAvailableTime: "archiveCreateTime + 5 minutes", pitPolicyFinalizationPendingHistoricalRegimeAudit: true, sourceClassification: overall.sourceClassification, sourceNextStage: overall.sourceNextStage, economicOutcomeFilesRead: false, economicEvaluationPerformed: false, tradingEconomicMetricsCalculated: false, modelFitCount: 0, candidateCount: 0, championCount: 0, selectedAlertCount: 0, governance: R33_GOVERNANCE, evidenceManifestPath: "docs/research/round-033-evidence-manifest.json" });
  const manifestEntries: R33ManifestEntry[] = [];
  for (const item of archiveEvidence) {
    const data = archiveData.get(item.symbol)!;
    if (data.zipBody && item.zipRequest.finalSuccessful && item.zipRequest.finalHttpStatus !== null) { const filePath = path.join(root, item.zipPath); writeFileSync(filePath, data.zipBody, { flag: "wx" }); manifestEntries.push(Object.freeze({ path: item.zipPath, sourceUrl: item.url, receivedAt: item.zipRequest.attempt1.completedAt, bytes: data.zipBody.byteLength, sha256: sha256(data.zipBody), attemptNumber: item.zipRequest.finalAttemptNumber, httpStatus: item.zipRequest.finalHttpStatus })); }
  }
  for (const item of liveBodies) { const filePath = path.join(liveDir, `${item.evidence.symbol}-${item.evidence.endpointOrPath}.json`); writeFileSync(filePath, item.body, { flag: "wx" }); manifestEntries.push(Object.freeze({ path: fileRelative(root, filePath), sourceUrl: item.evidence.requestUrl, receivedAt: item.evidence.attempt1.completedAt, bytes: item.body.byteLength, sha256: sha256(item.body), attemptNumber: item.evidence.finalAttemptNumber, httpStatus: item.evidence.finalHttpStatus! })); }
  const manifest = Object.freeze({ schemaVersion: "m3-r33-evidence-manifest-001", researchRoundId: R33_RESEARCH_ROUND_ID, generatedAt: iso(clock), archiveEvidenceFiles: manifestEntries.filter((entry) => entry.path.includes("/archive/")).length, liveEvidenceFiles: manifestEntries.filter((entry) => entry.path.includes("/live/")).length, allEvidenceSha256Present: manifestEntries.every((entry) => /^[0-9a-f]{64}$/u.test(entry.sha256)), entries: Object.freeze(manifestEntries) });
  writeJson(path.join(researchDir, "round-033-evidence-manifest.json"), manifest, "wx");
  writeJson(r33ResultPath(root), result, "wx");
  writeJson(r33ReceiptPath(root), completedReceipt(startedReceipt, result, manifest, clock));
  writeFileSync(path.join(researchDir, "round-033-live-transport-timestamp-alignment-result.md"), renderR33Markdown(result, manifest), { flag: "wx" });
  return result;
}

export function renderR33Markdown(result: R33Result, manifest: Readonly<{ archiveEvidenceFiles?: unknown; liveEvidenceFiles?: unknown }>): string {
  const archive = result.archiveEvidence.map((item) => `- ${item.symbol}: frozenSHA=${item.expectedSha256}, localSHA=${item.localSha256 ?? "null"}, versionMatch=${item.archiveVersionMatch}, checksum=${item.checksumValid}, rows=${item.rowCount}`).join("\n");
  const fields = result.fieldSummaries.length === 0 ? "- Semantic comparison was not executed." : result.fieldSummaries.map((item) => `- ${item.fieldId}: status=${item.status}, admitted=${item.admitted}, selectedOffset=${item.selectedOffset ?? "null"}`).join("\n");
  return `# Round-033 Live Transport + Timestamp Semantic Alignment\n\n- Classification: \`${result.sourceClassification}\`\n- Next stage: \`${result.sourceNextStage}\`\n- r33ExecutionCount: \`${result.r33ExecutionCount}\`\n- Archive version drift: \`${result.archiveVersionDriftDetected}\`\n- Live requests: \`${result.liveSuccessfulRequests}/${result.liveLogicalRequests}\` successful\n\n## Archive\n\n${archive}\n\n## Field results\n\n${fields}\n\n## Evidence\n\n- Manifest: \`${result.evidenceManifestPath}\`\n- archiveEvidenceFiles: \`${manifest.archiveEvidenceFiles ?? "unknown"}\`\n- liveEvidenceFiles: \`${manifest.liveEvidenceFiles ?? "unknown"}\`\n\n## PIT and governance\n\n- historicalFeatureAvailableTime: \`${result.historicalFeatureAvailableTime}\`\n- historicalRegimeMappingEstablished: \`${result.historicalRegimeMappingEstablished}\`\n- economicOutcomeFilesRead: \`${result.economicOutcomeFilesRead}\`\n- economicEvaluationPerformed: \`${result.economicEvaluationPerformed}\`\n- forwardEconomicValuesRead: \`${result.governance.forwardEconomicValuesRead}\`\n- performanceExecutionCount: \`${result.governance.performanceExecutionCount}\`\n- automaticTrading: \`${result.governance.automaticTrading}\`\n- Production unchanged: \`${result.governance.productionUnchanged}\`\n`;
}
