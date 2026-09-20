import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

export const R31_RESEARCH_ROUND_ID = "baseline-002-research-round-031" as const;
export const R31_CLASSIFICATION = "SOURCE_ADMISSION_REPROBE_ONLY" as const;
export const R31_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R31_BASE_SHA = "c8b96e633179170c888766d7fa459a7b664a35f5" as const;
export const R31_BRANCH = "research/round-031-binance-metrics-live-overlap-reprobe" as const;
export const R31_DATE = "2026-09-18" as const;
export const R31_START_TIME = 1_789_689_600_000 as const;
export const R31_END_TIME = 1_789_775_999_999 as const;
export const R31_ARCHIVE_BASE_URL = "https://data.binance.vision/data/futures/um/daily/metrics" as const;
export const R31_LIVE_BASE_URL = "https://fapi.binance.com/futures/data" as const;
export const R31_PERIOD = "5m" as const;
export const R31_LIMIT = 500 as const;

export const R31_SYMBOLS = Object.freeze(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"] as const);
export type R31Symbol = (typeof R31_SYMBOLS)[number];

export const R31_ENDPOINTS = Object.freeze([
  "openInterestHist",
  "topLongShortAccountRatio",
  "topLongShortPositionRatio",
  "globalLongShortAccountRatio",
  "takerlongshortRatio",
] as const);
export type R31Endpoint = (typeof R31_ENDPOINTS)[number];

export const R31_ARCHIVE_FIELDS = Object.freeze([
  "create_time",
  "symbol",
  "sum_open_interest",
  "sum_open_interest_value",
  "count_toptrader_long_short_ratio",
  "sum_toptrader_long_short_ratio",
  "count_long_short_ratio",
  "sum_taker_long_short_vol_ratio",
] as const);
export type R31ArchiveField = (typeof R31_ARCHIVE_FIELDS)[number];

export const R31_FIELD_MAPPINGS = Object.freeze([
  Object.freeze({ id: "OPEN_INTEREST", archiveField: "sum_open_interest", liveEndpoint: "openInterestHist", liveField: "sumOpenInterest" }),
  Object.freeze({ id: "TOP_TRADER_ACCOUNT", archiveField: "count_toptrader_long_short_ratio", liveEndpoint: "topLongShortAccountRatio", liveField: "longShortRatio" }),
  Object.freeze({ id: "TOP_TRADER_POSITION", archiveField: "sum_toptrader_long_short_ratio", liveEndpoint: "topLongShortPositionRatio", liveField: "longShortRatio" }),
  Object.freeze({ id: "GLOBAL_LONG_SHORT", archiveField: "count_long_short_ratio", liveEndpoint: "globalLongShortAccountRatio", liveField: "longShortRatio" }),
  Object.freeze({ id: "TAKER_RATIO", archiveField: "sum_taker_long_short_vol_ratio", liveEndpoint: "takerlongshortRatio", liveField: "buySellRatio" }),
] as const);

export const R31_TIMESTAMP_MAPPINGS = Object.freeze(["EXACT", "ARCHIVE_MINUS_5M", "ARCHIVE_PLUS_5M"] as const);
export type R31TimestampMapping = (typeof R31_TIMESTAMP_MAPPINGS)[number];

const R31_MAPPING_DELTA: Readonly<Record<R31TimestampMapping, number>> = Object.freeze({
  EXACT: 0,
  ARCHIVE_MINUS_5M: -300_000,
  ARCHIVE_PLUS_5M: 300_000,
});

export const R31_GOVERNANCE = Object.freeze({
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
  m3GStatus: "EXCLUDED_FROM_ROUND_031",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  round020LiquidationClosureReopened: false,
} as const);

export const R31_PROTOCOL_OBJECT = Object.freeze({
  schemaVersion: "m3-r31-binance-metrics-overlap-protocol-001",
  researchRoundId: R31_RESEARCH_ROUND_ID,
  classification: R31_CLASSIFICATION,
  base: Object.freeze({ branch: R31_BASE_BRANCH, sha: R31_BASE_SHA }),
  branch: R31_BRANCH,
  fixedWindow: Object.freeze({ date: R31_DATE, startTime: R31_START_TIME, endTime: R31_END_TIME, timezone: "UTC" }),
  symbols: R31_SYMBOLS,
  endpoints: R31_ENDPOINTS,
  request: Object.freeze({ period: R31_PERIOD, limit: R31_LIMIT, networkAttemptPerLogicalRequest: 1, liveLogicalRequests: 25, noSilentCatch: true }),
  archive: Object.freeze({ baseUrl: R31_ARCHIVE_BASE_URL, requestedZipFiles: 5, requestedChecksumFiles: 5, schema: R31_ARCHIVE_FIELDS, clientSideUtcFiltering: true }),
  fieldMappings: R31_FIELD_MAPPINGS,
  timestampMappings: Object.freeze({ options: R31_TIMESTAMP_MAPPINGS, coverageMinimum: 0.99, endpointIndependent: true }),
  numericAgreement: Object.freeze({ tolerance: "0.5 * 10^(-liveDecimalPlaces) + 1e-12", minimumRate: 0.995, relativeErrorRecorded: true, fixedRelativeErrorThreshold: false }),
  classifications: Object.freeze({
    reachabilityFailure: "SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY",
    allFields: "BINANCE_METRICS_CURRENT_REGIME_MAPPING_ESTABLISHED",
    partialFields: "BINANCE_METRICS_PARTIAL_CURRENT_REGIME_MAPPING_ESTABLISHED",
    noFields: "BINANCE_METRICS_CURRENT_REGIME_MAPPING_INCOMPATIBLE",
  }),
  currentRegimeOnly: Object.freeze({ historicalRegimeMappingEstablished: false, fullHistoricalCoverageCertified: false }),
  pit: Object.freeze({ historicalFeatureAvailableTime: "archiveCreateTime + 5 minutes", finalizationPendingHistoricalRegimeAudit: true }),
  economics: Object.freeze({ economicEvaluationPerformed: false, tradingEconomicMetricsCalculated: false, modelFitCount: 0, candidateCount: 0, championCount: 0, selectedAlertCount: 0 }),
  governance: R31_GOVERNANCE,
} as const);

export type R31ErrorClass = "NETWORK" | "HTTP" | "NON_JSON" | "NON_ARRAY" | "SCHEMA" | "ARCHIVE" | "CHECKSUM" | "DUPLICATE" | "MAPPING" | "NUMERIC" | "RECEIPT";

export type R31RequestEvidence = Readonly<{
  symbol: string;
  endpointOrArchivePath: string;
  requestUrl: string;
  startedAt: string;
  completedAt: string;
  localReceiptTimestamp: string;
  httpStatus: number | null;
  ok: boolean;
  contentType: string | null;
  responseBytes: number | null;
  rawPayloadSha256: string | null;
  responseRowCount: number | null;
  rawLiveRowCount: number | null;
  outOfWindowRowCount: number | null;
  filteredRowCount: number | null;
  exactDuplicateCount: number | null;
  conflictingDuplicateCount: number | null;
  errorClass: R31ErrorClass | null;
  errorMessage: string | null;
  responseBodyPreview: string;
}>;

export type R31ArchiveRow = Readonly<{ timestamp: number; symbol: R31Symbol; fields: Readonly<Record<R31ArchiveField, string>> }>;
export type R31LiveRow = Readonly<{ timestamp: number; rawValue: string; symbol: R31Symbol }>;

export type R31ArchiveEvidence = Readonly<{
  symbol: R31Symbol;
  url: string;
  checksumUrl: string;
  downloadedAt: string;
  httpStatus: number | null;
  checksumHttpStatus: number | null;
  publishedChecksum: string | null;
  localSha256: string | null;
  checksumValid: boolean;
  bytes: number | null;
  schemaValid: boolean;
  rowCount: number;
  firstCreateTime: number | null;
  lastCreateTime: number | null;
  duplicateTimestampCount: number;
  conflictingDuplicateCount: number;
  errorClass: R31ErrorClass | null;
  errorMessage: string | null;
  zipRequest: R31RequestEvidence;
  checksumRequest: R31RequestEvidence;
}>;

export type R31MappingEvidence = Readonly<{
  fieldId: string;
  symbol: R31Symbol;
  archiveField: R31ArchiveField;
  liveEndpoint: R31Endpoint;
  liveField: string;
  timestampChecks: Readonly<Record<R31TimestampMapping, Readonly<{ matchedTimestampRows: number; timestampCoverageRate: number }>>>;
  dominantMapping: R31TimestampMapping | null;
  timestampCoverageRate: number;
  matchedRows: number;
  numericAgreementRows: number;
  numericAgreementRate: number;
  meanAbsoluteError: number | null;
  maxAbsoluteError: number | null;
  meanRelativeError: number | null;
  maxRelativeError: number | null;
  liveDecimalPlaces: Readonly<Record<string, number>>;
  status: "FIELD_MAPPING_ADMITTED_CURRENT_REGIME" | "LIVE_REQUEST_FAILED" | "TIMESTAMP_MAPPING_FAILED" | "NUMERIC_AGREEMENT_FAILED" | "ARCHIVE_UNAVAILABLE";
}>;

export type R31FieldSummary = Readonly<{
  fieldId: string;
  archiveField: R31ArchiveField;
  liveEndpoint: R31Endpoint;
  liveField: string;
  admitted: boolean;
  dominantMapping: R31TimestampMapping | null;
  minimumTimestampCoverage: number;
  minimumNumericAgreement: number;
  symbols: readonly R31MappingEvidence[];
}>;

export type R31Result = Readonly<{
  schemaVersion: "m3-r31-binance-metrics-overlap-result-001";
  researchRoundId: typeof R31_RESEARCH_ROUND_ID;
  classification: typeof R31_CLASSIFICATION;
  protocolCommitSha: string;
  runId: string;
  fixedWindow: Readonly<{ date: typeof R31_DATE; startTime: typeof R31_START_TIME; endTime: typeof R31_END_TIME; timezone: "UTC" }>;
  inheritedR30Conclusion: Readonly<{ longSelectedTarget: null; longClassification: "TARGET_REDESIGN_INSUFFICIENT"; shortSelectedTarget: null; shortClassification: "TARGET_REDESIGN_INSUFFICIENT"; targetRedesignConclusionRobust: true }>;
  liveLogicalRequests: 25;
  liveSuccessfulRequests: number;
  liveFailedRequests: number;
  requestEvidence: readonly R31RequestEvidence[];
  archiveFilesRequested: 5;
  archiveFilesAvailable: number;
  checksumValidFiles: number;
  schemaValidFiles: number;
  archiveEvidence: readonly R31ArchiveEvidence[];
  mappingEvidence: readonly R31MappingEvidence[];
  fieldSummaries: readonly R31FieldSummary[];
  admittedFields: readonly string[];
  rejectedFields: readonly string[];
  admittedFieldCount: number;
  currentRegimeMappingEstablished: boolean;
  historicalRegimeMappingEstablished: false;
  fullHistoricalCoverageCertified: false;
  archiveSampleQualityAccepted: boolean;
  sourceClassification: string;
  sourceNextStage: string;
  economicEvaluationPerformed: false;
  tradingEconomicMetricsCalculated: false;
  modelFitCount: 0;
  candidateCount: 0;
  championCount: 0;
  selectedAlertCount: 0;
  pitPolicyFinalizationPendingHistoricalRegimeAudit: true;
  prospectiveCaptureStarted: false;
  governance: typeof R31_GOVERNANCE;
}>;

export type R31Fetch = (input: string, init?: RequestInit) => Promise<Response>;
export type R31Clock = () => Date;

let runtimeNetworkRequestCount = 0;

export function getR31RuntimeCounters(): Readonly<{ networkRequestCount: number }> {
  return Object.freeze({ networkRequestCount: runtimeNetworkRequestCount });
}

export function sha256Bytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
}

export function r31ResultSha256(result: R31Result): string {
  return createHash("sha256").update(stableJson(result), "utf8").digest("hex");
}

function iso(clock: R31Clock): string {
  return clock().toISOString();
}

function errorDetails(error: unknown): { errorClass: R31ErrorClass; errorMessage: string } {
  if (error instanceof SyntaxError) return { errorClass: "NON_JSON", errorMessage: error.message };
  if (error instanceof Error) return { errorClass: "NETWORK", errorMessage: error.message };
  return { errorClass: "NETWORK", errorMessage: String(error) };
}

function preview(value: Uint8Array): string {
  return Buffer.from(value).toString("utf8").slice(0, 500);
}

function emptyRequestEvidence(symbol: string, endpointOrArchivePath: string, requestUrl: string, startedAt: string, completedAt: string, errorClass: R31ErrorClass, errorMessage: string): R31RequestEvidence {
  return Object.freeze({ symbol, endpointOrArchivePath, requestUrl, startedAt, completedAt, localReceiptTimestamp: completedAt, httpStatus: null, ok: false, contentType: null, responseBytes: null, rawPayloadSha256: null, responseRowCount: null, rawLiveRowCount: null, outOfWindowRowCount: null, filteredRowCount: null, exactDuplicateCount: null, conflictingDuplicateCount: null, errorClass, errorMessage, responseBodyPreview: "" });
}

async function requestBytes(symbol: string, endpointOrArchivePath: string, requestUrl: string, fetchImpl: R31Fetch, clock: R31Clock): Promise<{ evidence: R31RequestEvidence; body: Uint8Array | null }> {
  const startedAt = iso(clock);
  runtimeNetworkRequestCount += 1;
  try {
    const response = await fetchImpl(requestUrl, { method: "GET", headers: { accept: "application/json, text/plain, */*" } });
    const body = new Uint8Array(await response.arrayBuffer());
    const completedAt = iso(clock);
    const contentType = response.headers.get("content-type");
    const ok = response.ok && response.status >= 200 && response.status < 300;
    const evidence = Object.freeze({
      symbol,
      endpointOrArchivePath,
      requestUrl,
      startedAt,
      completedAt,
      localReceiptTimestamp: completedAt,
      httpStatus: response.status,
      ok,
      contentType,
      responseBytes: body.byteLength,
      rawPayloadSha256: sha256Bytes(body),
      responseRowCount: null,
      rawLiveRowCount: null,
      outOfWindowRowCount: null,
      filteredRowCount: null,
      exactDuplicateCount: null,
      conflictingDuplicateCount: null,
      errorClass: ok ? null : "HTTP" as const,
      errorMessage: ok ? null : `HTTP ${response.status}`,
      responseBodyPreview: ok ? "" : preview(body),
    });
    return { evidence, body };
  } catch (error) {
    const completedAt = iso(clock);
    const details = errorDetails(error);
    return { evidence: emptyRequestEvidence(symbol, endpointOrArchivePath, requestUrl, startedAt, completedAt, details.errorClass, details.errorMessage), body: null };
  }
}

function littleUInt16(bytes: Uint8Array, offset: number): number {
  return bytes[offset]! | (bytes[offset + 1]! << 8);
}

function littleUInt32(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8) | (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0;
}

function parseZipEntries(bytes: Uint8Array): readonly Uint8Array[] {
  let eocd = -1;
  for (let index = bytes.length - 22; index >= Math.max(0, bytes.length - 65_557); index -= 1) {
    if (littleUInt32(bytes, index) === 0x06054b50) { eocd = index; break; }
  }
  if (eocd < 0) throw new Error("ZIP end-of-central-directory record is missing.");
  const total = littleUInt16(bytes, eocd + 10);
  const centralOffset = littleUInt32(bytes, eocd + 16);
  const entries: Uint8Array[] = [];
  let cursor = centralOffset;
  for (let index = 0; index < total; index += 1) {
    if (littleUInt32(bytes, cursor) !== 0x02014b50) throw new Error("ZIP central directory entry is invalid.");
    const method = littleUInt16(bytes, cursor + 10);
    const compressedSize = littleUInt32(bytes, cursor + 20);
    const localOffset = littleUInt32(bytes, cursor + 42);
    const nameLength = littleUInt16(bytes, cursor + 28);
    const extraLength = littleUInt16(bytes, cursor + 30);
    const commentLength = littleUInt16(bytes, cursor + 32);
    cursor += 46 + nameLength + extraLength + commentLength;
    if (littleUInt32(bytes, localOffset) !== 0x04034b50) throw new Error("ZIP local entry is invalid.");
    const localNameLength = littleUInt16(bytes, localOffset + 26);
    const localExtraLength = littleUInt16(bytes, localOffset + 28);
    const start = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = bytes.slice(start, start + compressedSize);
    if (method === 0) entries.push(compressed);
    else if (method === 8) entries.push(new Uint8Array(inflateRawSync(compressed)));
    else throw new Error(`Unsupported ZIP compression method ${method}.`);
  }
  return Object.freeze(entries);
}

function parseCsv(text: string): readonly string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (quoted) {
      if (character === '"' && text[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') quoted = false;
      else cell += character;
    } else if (character === '"') quoted = true;
    else if (character === ",") { row.push(cell); cell = ""; }
    else if (character === "\n") { row.push(cell.replace(/\r$/, "")); rows.push(row); row = []; cell = ""; }
    else cell += character;
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
  return Object.freeze(rows);
}

function parseArchiveText(bytes: Uint8Array): readonly Record<string, string>[] {
  const entry = parseZipEntries(bytes).find((candidate) => Buffer.from(candidate).toString("utf8").trim().length > 0);
  if (!entry) throw new Error("ZIP contains no non-empty data entry.");
  const text = Buffer.from(entry).toString("utf8").replace(/^\uFEFF/, "");
  const trimmed = text.trim();
  if (trimmed.startsWith("[")) {
    const parsed: unknown = JSON.parse(trimmed);
    if (!Array.isArray(parsed)) throw new Error("Archive JSON payload is not an array.");
    if (!parsed.every((item) => item !== null && typeof item === "object" && !Array.isArray(item))) throw new Error("Archive JSON rows are not objects.");
    return Object.freeze(parsed as Record<string, string>[]);
  }
  const rows = parseCsv(text);
  const header = rows[0] ?? [];
  if (header.length !== R31_ARCHIVE_FIELDS.length || header.some((value, index) => value !== R31_ARCHIVE_FIELDS[index])) throw new Error("Archive schema does not exactly match the frozen fields.");
  return Object.freeze(rows.slice(1).filter((row) => row.length > 1).map((row) => Object.fromEntries(header.map((field, index) => [field, row[index] ?? ""]))));
}

function normalizeArchiveRows(records: readonly Record<string, string>[], symbol: R31Symbol): { rows: readonly R31ArchiveRow[]; exactDuplicateCount: number; conflictingDuplicateCount: number } {
  const grouped = new Map<number, R31ArchiveRow[]>();
  for (const record of records) {
    const missing = R31_ARCHIVE_FIELDS.find((field) => typeof record[field] !== "string");
    if (missing) throw new Error(`Archive row is missing ${missing}.`);
    if (record.symbol !== symbol) throw new Error(`Archive row symbol ${record.symbol} does not match ${symbol}.`);
    const timestamp = Number(record.create_time);
    if (!Number.isInteger(timestamp) || !Number.isFinite(timestamp)) throw new Error("Archive create_time is not an integer timestamp.");
    const row = Object.freeze({ timestamp, symbol, fields: Object.freeze({ ...record }) as Readonly<Record<R31ArchiveField, string>> });
    const existing = grouped.get(timestamp) ?? [];
    existing.push(row);
    grouped.set(timestamp, existing);
  }
  let exactDuplicateCount = 0;
  let conflictingDuplicateCount = 0;
  const rows: R31ArchiveRow[] = [];
  for (const group of grouped.values()) {
    const identity = stableJson(group[0]!.fields);
    if (group.some((row) => stableJson(row.fields) !== identity)) conflictingDuplicateCount += group.length - 1;
    else exactDuplicateCount += Math.max(0, group.length - 1);
    rows.push(group[0]!);
  }
  rows.sort((left, right) => left.timestamp - right.timestamp);
  return { rows: Object.freeze(rows), exactDuplicateCount, conflictingDuplicateCount };
}

export function parseR31ArchiveRows(bytes: Uint8Array, symbol: R31Symbol): Readonly<{ rows: readonly R31ArchiveRow[]; exactDuplicateCount: number; conflictingDuplicateCount: number }> {
  return Object.freeze(normalizeArchiveRows(parseArchiveText(bytes), symbol));
}

function parseLivePayload(body: Uint8Array, symbol: R31Symbol, endpoint: R31Endpoint, responseEvidence: R31RequestEvidence): { rows: readonly R31LiveRow[]; evidence: R31RequestEvidence } {
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.from(body).toString("utf8")); }
  catch (error) { throw Object.assign(new Error(error instanceof Error ? error.message : String(error)), { code: "NON_JSON" }); }
  if (!Array.isArray(parsed)) throw Object.assign(new Error("Live response is not an array."), { code: "NON_ARRAY" });
  const mapping = R31_FIELD_MAPPINGS.find((item) => item.liveEndpoint === endpoint)!;
  const rawRows: R31LiveRow[] = [];
  let outOfWindowRowCount = 0;
  for (const item of parsed) {
    if (item === null || typeof item !== "object" || Array.isArray(item)) throw Object.assign(new Error("Live response contains a non-object row."), { code: "SCHEMA" });
    const row = item as Record<string, unknown>;
    const timestamp = Number(row.timestamp);
    const rawValue = row[mapping.liveField];
    if (!Number.isFinite(timestamp) || !Number.isInteger(timestamp) || (typeof rawValue !== "string" && typeof rawValue !== "number") || !Number.isFinite(Number(rawValue))) throw Object.assign(new Error(`Live row is missing timestamp or ${mapping.liveField}.`), { code: "SCHEMA" });
    if (timestamp < R31_START_TIME || timestamp > R31_END_TIME) { outOfWindowRowCount += 1; continue; }
    rawRows.push(Object.freeze({ timestamp, rawValue: String(rawValue), symbol }));
  }
  const grouped = new Map<number, R31LiveRow[]>();
  for (const row of rawRows) grouped.set(row.timestamp, [...(grouped.get(row.timestamp) ?? []), row]);
  let exactDuplicateCount = 0;
  let conflictingDuplicateCount = 0;
  const rows: R31LiveRow[] = [];
  for (const group of grouped.values()) {
    const first = group[0]!;
    if (group.some((row) => row.rawValue !== first.rawValue)) conflictingDuplicateCount += group.length - 1;
    else exactDuplicateCount += Math.max(0, group.length - 1);
    rows.push(first);
  }
  rows.sort((left, right) => left.timestamp - right.timestamp);
  return { rows: Object.freeze(rows), evidence: Object.freeze({ ...responseEvidence, responseRowCount: parsed.length, rawLiveRowCount: parsed.length, outOfWindowRowCount, filteredRowCount: rows.length, exactDuplicateCount, conflictingDuplicateCount, errorClass: conflictingDuplicateCount > 0 ? "DUPLICATE" as const : null, errorMessage: conflictingDuplicateCount > 0 ? "Conflicting duplicate live timestamps." : null, responseBodyPreview: "" }) };
}

export function filterR31LiveRows(payload: unknown, symbol: R31Symbol, endpoint: R31Endpoint): Readonly<{ rows: readonly R31LiveRow[]; rawLiveRowCount: number; outOfWindowRowCount: number; filteredRowCount: number; exactDuplicateCount: number; conflictingDuplicateCount: number }> {
  const body = Buffer.from(JSON.stringify(payload), "utf8");
  const evidence = Object.freeze({ symbol, endpointOrArchivePath: endpoint, requestUrl: "fixture://r31", startedAt: "", completedAt: "", localReceiptTimestamp: "", httpStatus: 200, ok: true, contentType: "application/json", responseBytes: body.length, rawPayloadSha256: sha256Bytes(body), responseRowCount: null, rawLiveRowCount: null, outOfWindowRowCount: null, filteredRowCount: null, exactDuplicateCount: null, conflictingDuplicateCount: null, errorClass: null, errorMessage: null, responseBodyPreview: "" });
  const parsed = parseLivePayload(body, symbol, endpoint, evidence);
  return Object.freeze({ rows: parsed.rows, rawLiveRowCount: parsed.evidence.rawLiveRowCount ?? 0, outOfWindowRowCount: parsed.evidence.outOfWindowRowCount ?? 0, filteredRowCount: parsed.evidence.filteredRowCount ?? 0, exactDuplicateCount: parsed.evidence.exactDuplicateCount ?? 0, conflictingDuplicateCount: parsed.evidence.conflictingDuplicateCount ?? 0 });
}

export function liveDecimalPlaces(raw: string): number {
  const normalized = raw.toLowerCase();
  const [mantissa, exponentText] = normalized.split("e");
  const exponent = Number(exponentText ?? 0);
  const decimal = mantissa!.split(".")[1]?.length ?? 0;
  return Math.max(0, decimal - exponent);
}

export function r31AbsoluteTolerance(rawLiveValue: string): number {
  return 0.5 * (10 ** -liveDecimalPlaces(rawLiveValue)) + 1e-12;
}

export function r31RelativeError(left: number, right: number): number {
  return Math.abs(left - right) / Math.max(Math.abs(left), Math.abs(right), 1e-12);
}

function timestampMatches(archiveTimestamp: number, liveTimestamp: number, mapping: R31TimestampMapping): boolean {
  return archiveTimestamp + R31_MAPPING_DELTA[mapping] === liveTimestamp;
}

export function evaluateR31Mapping(archiveRows: readonly R31ArchiveRow[], liveRows: readonly R31LiveRow[], archiveField: R31ArchiveField, fieldId: string, symbol: R31Symbol, liveEndpoint: R31Endpoint, liveField: string): R31MappingEvidence {
  const liveByTimestamp = new Map(liveRows.map((row) => [row.timestamp, row]));
  const timestampChecks = Object.fromEntries(R31_TIMESTAMP_MAPPINGS.map((mapping) => {
    const matchedTimestampRows = archiveRows.filter((row) => [...liveByTimestamp.keys()].some((timestamp) => timestampMatches(row.timestamp, timestamp, mapping))).length;
    return [mapping, { matchedTimestampRows, timestampCoverageRate: archiveRows.length === 0 ? 0 : matchedTimestampRows / archiveRows.length }];
  })) as Record<R31TimestampMapping, { matchedTimestampRows: number; timestampCoverageRate: number }>;
  const ordered = [...R31_TIMESTAMP_MAPPINGS].sort((left, right) => timestampChecks[right]!.matchedTimestampRows - timestampChecks[left]!.matchedTimestampRows);
  const best = ordered[0]!;
  const tied = ordered.length > 1 && timestampChecks[ordered[1]!]!.matchedTimestampRows === timestampChecks[best]!.matchedTimestampRows;
  const coverage = timestampChecks[best]!.timestampCoverageRate;
  if (tied || coverage < 0.99 || archiveRows.length === 0) return Object.freeze({ fieldId, symbol, archiveField, liveEndpoint, liveField, timestampChecks: Object.freeze(timestampChecks), dominantMapping: null, timestampCoverageRate: coverage, matchedRows: timestampChecks[best]!.matchedTimestampRows, numericAgreementRows: 0, numericAgreementRate: 0, meanAbsoluteError: null, maxAbsoluteError: null, meanRelativeError: null, maxRelativeError: null, liveDecimalPlaces: Object.freeze({}), status: "TIMESTAMP_MAPPING_FAILED" });
  const mapping = best;
  const decimalDistribution: Record<string, number> = {};
  const errors: number[] = [];
  const relatives: number[] = [];
  let agreements = 0;
  let matchedRows = 0;
  for (const archiveRow of archiveRows) {
    const liveRow = liveRows.find((candidate) => timestampMatches(archiveRow.timestamp, candidate.timestamp, mapping));
    if (!liveRow) continue;
    matchedRows += 1;
    const archiveValue = Number(archiveRow.fields[archiveField]);
    const liveValue = Number(liveRow.rawValue);
    const places = liveDecimalPlaces(liveRow.rawValue);
    decimalDistribution[String(places)] = (decimalDistribution[String(places)] ?? 0) + 1;
    const absoluteError = Math.abs(archiveValue - liveValue);
    errors.push(absoluteError);
    relatives.push(r31RelativeError(archiveValue, liveValue));
    if (absoluteError <= r31AbsoluteTolerance(liveRow.rawValue)) agreements += 1;
  }
  const numericAgreementRate = matchedRows === 0 ? 0 : agreements / matchedRows;
  const mean = (values: readonly number[]) => values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
  const status = numericAgreementRate >= 0.995 ? "FIELD_MAPPING_ADMITTED_CURRENT_REGIME" : "NUMERIC_AGREEMENT_FAILED";
  return Object.freeze({ fieldId, symbol, archiveField, liveEndpoint, liveField, timestampChecks: Object.freeze(timestampChecks), dominantMapping: mapping, timestampCoverageRate: coverage, matchedRows, numericAgreementRows: agreements, numericAgreementRate, meanAbsoluteError: mean(errors), maxAbsoluteError: errors.length === 0 ? null : Math.max(...errors), meanRelativeError: mean(relatives), maxRelativeError: relatives.length === 0 ? null : Math.max(...relatives), liveDecimalPlaces: Object.freeze(decimalDistribution), status });
}

export function summarizeR31Field(mapping: (typeof R31_FIELD_MAPPINGS)[number], evidence: readonly R31MappingEvidence[]): R31FieldSummary {
  const admitted = evidence.length === R31_SYMBOLS.length && evidence.every((item) => item.status === "FIELD_MAPPING_ADMITTED_CURRENT_REGIME") && new Set(evidence.map((item) => item.dominantMapping)).size === 1;
  return Object.freeze({ fieldId: mapping.id, archiveField: mapping.archiveField, liveEndpoint: mapping.liveEndpoint, liveField: mapping.liveField, admitted, dominantMapping: admitted ? evidence[0]!.dominantMapping : null, minimumTimestampCoverage: evidence.length === 0 ? 0 : Math.min(...evidence.map((item) => item.timestampCoverageRate)), minimumNumericAgreement: evidence.length === 0 ? 0 : Math.min(...evidence.map((item) => item.numericAgreementRate)), symbols: Object.freeze([...evidence]) });
}

export function classifyR31Source(liveSuccessfulRequests: number, archiveSampleQualityAccepted: boolean, admittedFieldCount: number): Readonly<{ sourceClassification: string; sourceNextStage: string; currentRegimeMappingEstablished: boolean }> {
  if (liveSuccessfulRequests < 25) return Object.freeze({ sourceClassification: "SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY", sourceNextStage: "LIVE_ENDPOINT_EXECUTION_ENVIRONMENT_REPROBE_REQUIRED", currentRegimeMappingEstablished: false });
  if (!archiveSampleQualityAccepted) return Object.freeze({ sourceClassification: "SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_ARCHIVE_REACHABILITY", sourceNextStage: "ARCHIVE_OVERLAP_EXECUTION_ENVIRONMENT_REPROBE_REQUIRED", currentRegimeMappingEstablished: false });
  if (admittedFieldCount === 5) return Object.freeze({ sourceClassification: "BINANCE_METRICS_CURRENT_REGIME_MAPPING_ESTABLISHED", sourceNextStage: "HISTORICAL_METRICS_REGIME_AND_COVERAGE_AUDIT_REQUIRED", currentRegimeMappingEstablished: true });
  if (admittedFieldCount > 0) return Object.freeze({ sourceClassification: "BINANCE_METRICS_PARTIAL_CURRENT_REGIME_MAPPING_ESTABLISHED", sourceNextStage: "HISTORICAL_AUDIT_FOR_ADMITTED_METRICS_FIELDS_REQUIRED", currentRegimeMappingEstablished: false });
  return Object.freeze({ sourceClassification: "BINANCE_METRICS_CURRENT_REGIME_MAPPING_INCOMPATIBLE", sourceNextStage: "ALTERNATIVE_OR_PAID_INFORMATION_SOURCE_REQUIRED", currentRegimeMappingEstablished: false });
}

function requestUrl(endpoint: R31Endpoint, symbol: R31Symbol): string {
  const url = new URL(`${R31_LIVE_BASE_URL}/${endpoint}`);
  url.search = new URLSearchParams({ symbol, period: R31_PERIOD, startTime: String(R31_START_TIME), endTime: String(R31_END_TIME), limit: String(R31_LIMIT) }).toString();
  return url.toString();
}

function archiveUrls(symbol: R31Symbol): { url: string; checksumUrl: string; path: string } {
  const archivePath = `${symbol}/${symbol}-metrics-${R31_DATE}.zip`;
  const url = `${R31_ARCHIVE_BASE_URL}/${archivePath}`;
  return { url, checksumUrl: `${url}.CHECKSUM`, path: archivePath };
}

function extractChecksum(body: Uint8Array): string | null {
  return Buffer.from(body).toString("utf8").match(/\b[a-f0-9]{64}\b/i)?.[0]?.toLowerCase() ?? null;
}

async function downloadArchive(symbol: R31Symbol, fetchImpl: R31Fetch, clock: R31Clock): Promise<{ evidence: R31ArchiveEvidence; rows: readonly R31ArchiveRow[] }> {
  const urls = archiveUrls(symbol);
  const zip = await requestBytes(symbol, urls.path, urls.url, fetchImpl, clock);
  const checksum = await requestBytes(symbol, `${urls.path}.CHECKSUM`, urls.checksumUrl, fetchImpl, clock);
  let rows: readonly R31ArchiveRow[] = [];
  let schemaValid = false;
  let duplicateTimestampCount = 0;
  let conflictingDuplicateCount = 0;
  let archiveError: R31ErrorClass | null = null;
  let errorMessage: string | null = null;
  if (zip.evidence.ok && zip.body && checksum.evidence.ok && checksum.body) {
    try {
      const parsed = parseR31ArchiveRows(zip.body, symbol);
      rows = parsed.rows;
      duplicateTimestampCount = parsed.exactDuplicateCount;
      conflictingDuplicateCount = parsed.conflictingDuplicateCount;
      schemaValid = conflictingDuplicateCount === 0;
      const published = extractChecksum(checksum.body);
      if (!published || published !== zip.evidence.rawPayloadSha256) { schemaValid = false; archiveError = "CHECKSUM"; errorMessage = "Published checksum did not match the downloaded ZIP SHA-256."; }
    } catch (error) {
      archiveError = "ARCHIVE";
      errorMessage = error instanceof Error ? error.message : String(error);
    }
  } else {
    archiveError = zip.evidence.errorClass ?? checksum.evidence.errorClass ?? "ARCHIVE";
    errorMessage = zip.evidence.errorMessage ?? checksum.evidence.errorMessage ?? "Archive or checksum request failed.";
  }
  const timestamps = rows.map((row) => row.timestamp);
  return { rows, evidence: Object.freeze({ symbol, url: urls.url, checksumUrl: urls.checksumUrl, downloadedAt: zip.evidence.completedAt, httpStatus: zip.evidence.httpStatus, checksumHttpStatus: checksum.evidence.httpStatus, publishedChecksum: checksum.body ? extractChecksum(checksum.body) : null, localSha256: zip.evidence.rawPayloadSha256, checksumValid: schemaValid && archiveError !== "CHECKSUM", bytes: zip.evidence.responseBytes, schemaValid, rowCount: rows.length, firstCreateTime: timestamps[0] ?? null, lastCreateTime: timestamps[timestamps.length - 1] ?? null, duplicateTimestampCount, conflictingDuplicateCount, errorClass: archiveError, errorMessage, zipRequest: zip.evidence, checksumRequest: checksum.evidence }) };
}

function updateEvidence(evidence: R31RequestEvidence, updates: Partial<R31RequestEvidence>): R31RequestEvidence {
  return Object.freeze({ ...evidence, ...updates });
}

export async function runR31Reprobe(options: Readonly<{ root?: string; protocolCommitSha: string; runId?: string; fetchImpl?: R31Fetch; clock?: R31Clock }>): Promise<R31Result> {
  const root = path.resolve(options.root ?? process.cwd());
  const fetchImpl = options.fetchImpl ?? fetch;
  const clock = options.clock ?? (() => new Date());
  const runId = options.runId ?? `r31-${cryptoRandomId()}`;
  const researchDir = path.join(root, "docs", "research");
  const receiptPath = path.join(researchDir, "round-031-execution-receipt.json");
  const resultPath = path.join(researchDir, "round-031-binance-metrics-overlap-result.json");
  if (existsSync(receiptPath) || existsSync(resultPath)) throw new Error("R31 execution receipt or result already exists; refusing a second run.");
  mkdirSync(researchDir, { recursive: true });
  const startedAt = iso(clock);
  const startedReceipt = { schemaVersion: "m3-r31-execution-receipt-001", runId, protocolCommitSha: options.protocolCommitSha, startedAt, executionType: "BINANCE_METRICS_LIVE_OVERLAP_REPROBE", status: "STARTED" } as const;
  try { writeFileSync(receiptPath, `${JSON.stringify(startedReceipt, null, 2)}\n`, { flag: "wx" }); }
  catch (error) { throw new Error(`R31 could not create STARTED receipt: ${error instanceof Error ? error.message : String(error)}`); }

  const archiveData = new Map<R31Symbol, { evidence: R31ArchiveEvidence; rows: readonly R31ArchiveRow[] }>();
  for (const symbol of R31_SYMBOLS) archiveData.set(symbol, await downloadArchive(symbol, fetchImpl, clock));
  const requestEvidence: R31RequestEvidence[] = [];
  const liveData = new Map<string, readonly R31LiveRow[]>();
  for (const symbol of R31_SYMBOLS) {
    for (const endpoint of R31_ENDPOINTS) {
      const url = requestUrl(endpoint, symbol);
      const request = await requestBytes(symbol, endpoint, url, fetchImpl, clock);
      let evidence = request.evidence;
      let rows: readonly R31LiveRow[] = [];
      if (request.body && evidence.ok) {
        try {
          const parsed = parseLivePayload(request.body, symbol, endpoint, evidence);
          rows = parsed.rows;
          evidence = parsed.evidence;
        } catch (error) {
          const code = (error as { code?: string }).code;
          const errorClass: R31ErrorClass = code === "NON_JSON" ? "NON_JSON" : code === "NON_ARRAY" ? "NON_ARRAY" : "SCHEMA";
          evidence = updateEvidence(evidence, { ok: false, errorClass, errorMessage: error instanceof Error ? error.message : String(error), responseBodyPreview: preview(request.body) });
        }
      }
      requestEvidence.push(evidence);
      liveData.set(`${symbol}:${endpoint}`, rows);
    }
  }
  const archiveEvidence = R31_SYMBOLS.map((symbol) => archiveData.get(symbol)!.evidence);
  const mappingEvidence: R31MappingEvidence[] = [];
  const fieldSummaries: R31FieldSummary[] = [];
  for (const mapping of R31_FIELD_MAPPINGS) {
    const evidence = R31_SYMBOLS.map((symbol) => {
      const archive = archiveData.get(symbol)!;
      const liveRequest = requestEvidence.find((item) => item.symbol === symbol && item.endpointOrArchivePath === mapping.liveEndpoint);
      if (!archive.evidence.schemaValid || !archive.evidence.checksumValid) return Object.freeze({ fieldId: mapping.id, symbol, archiveField: mapping.archiveField, liveEndpoint: mapping.liveEndpoint, liveField: mapping.liveField, timestampChecks: Object.freeze(Object.fromEntries(R31_TIMESTAMP_MAPPINGS.map((key) => [key, { matchedTimestampRows: 0, timestampCoverageRate: 0 }]))) as R31MappingEvidence["timestampChecks"], dominantMapping: null, timestampCoverageRate: 0, matchedRows: 0, numericAgreementRows: 0, numericAgreementRate: 0, meanAbsoluteError: null, maxAbsoluteError: null, meanRelativeError: null, maxRelativeError: null, liveDecimalPlaces: Object.freeze({}), status: "ARCHIVE_UNAVAILABLE" as const });
      if (!liveRequest?.ok || liveRequest.conflictingDuplicateCount && liveRequest.conflictingDuplicateCount > 0) return Object.freeze({ fieldId: mapping.id, symbol, archiveField: mapping.archiveField, liveEndpoint: mapping.liveEndpoint, liveField: mapping.liveField, timestampChecks: Object.freeze(Object.fromEntries(R31_TIMESTAMP_MAPPINGS.map((key) => [key, { matchedTimestampRows: 0, timestampCoverageRate: 0 }]))) as R31MappingEvidence["timestampChecks"], dominantMapping: null, timestampCoverageRate: 0, matchedRows: 0, numericAgreementRows: 0, numericAgreementRate: 0, meanAbsoluteError: null, maxAbsoluteError: null, meanRelativeError: null, maxRelativeError: null, liveDecimalPlaces: Object.freeze({}), status: "LIVE_REQUEST_FAILED" as const });
      return evaluateR31Mapping(archive.rows, liveData.get(`${symbol}:${mapping.liveEndpoint}`) ?? [], mapping.archiveField, mapping.id, symbol, mapping.liveEndpoint, mapping.liveField);
    });
    mappingEvidence.push(...evidence);
    fieldSummaries.push(summarizeR31Field(mapping, evidence));
  }
  const liveSuccessfulRequests = requestEvidence.filter((evidence) => evidence.ok && evidence.errorClass === null).length;
  const archiveSampleQualityAccepted = archiveEvidence.every((evidence) => evidence.schemaValid && evidence.checksumValid && evidence.conflictingDuplicateCount === 0);
  const admittedFields = fieldSummaries.filter((summary) => summary.admitted).map((summary) => summary.fieldId);
  const rejectedFields = fieldSummaries.filter((summary) => !summary.admitted).map((summary) => summary.fieldId);
  const classification = classifyR31Source(liveSuccessfulRequests, archiveSampleQualityAccepted, admittedFields.length);
  const result: R31Result = Object.freeze({
    schemaVersion: "m3-r31-binance-metrics-overlap-result-001",
    researchRoundId: R31_RESEARCH_ROUND_ID,
    classification: R31_CLASSIFICATION,
    protocolCommitSha: options.protocolCommitSha,
    runId,
    fixedWindow: Object.freeze({ date: R31_DATE, startTime: R31_START_TIME, endTime: R31_END_TIME, timezone: "UTC" }),
    inheritedR30Conclusion: Object.freeze({ longSelectedTarget: null, longClassification: "TARGET_REDESIGN_INSUFFICIENT", shortSelectedTarget: null, shortClassification: "TARGET_REDESIGN_INSUFFICIENT", targetRedesignConclusionRobust: true }),
    liveLogicalRequests: 25,
    liveSuccessfulRequests,
    liveFailedRequests: 25 - liveSuccessfulRequests,
    requestEvidence: Object.freeze(requestEvidence),
    archiveFilesRequested: 5,
    archiveFilesAvailable: archiveEvidence.filter((item) => item.bytes !== null && item.httpStatus !== null && item.httpStatus >= 200 && item.httpStatus < 300).length,
    checksumValidFiles: archiveEvidence.filter((item) => item.checksumValid).length,
    schemaValidFiles: archiveEvidence.filter((item) => item.schemaValid).length,
    archiveEvidence: Object.freeze(archiveEvidence),
    mappingEvidence: Object.freeze(mappingEvidence),
    fieldSummaries: Object.freeze(fieldSummaries),
    admittedFields: Object.freeze(admittedFields),
    rejectedFields: Object.freeze(rejectedFields),
    admittedFieldCount: admittedFields.length,
    currentRegimeMappingEstablished: classification.currentRegimeMappingEstablished,
    historicalRegimeMappingEstablished: false,
    fullHistoricalCoverageCertified: false,
    archiveSampleQualityAccepted,
    sourceClassification: classification.sourceClassification,
    sourceNextStage: classification.sourceNextStage,
    economicEvaluationPerformed: false,
    tradingEconomicMetricsCalculated: false,
    modelFitCount: 0,
    candidateCount: 0,
    championCount: 0,
    selectedAlertCount: 0,
    pitPolicyFinalizationPendingHistoricalRegimeAudit: true,
    prospectiveCaptureStarted: false,
    governance: R31_GOVERNANCE,
  });
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
  const completedAt = iso(clock);
  const completedReceipt = Object.freeze({ ...startedReceipt, status: "COMPLETED", completedAt, resultSha256: r31ResultSha256(result) });
  writeFileSync(receiptPath, `${JSON.stringify(completedReceipt, null, 2)}\n`);
  return result;
}

function cryptoRandomId(): string {
  return createHash("sha256").update(`${process.pid}:${Math.random()}:${new Date().toISOString()}`, "utf8").digest("hex").slice(0, 24);
}

export function startR31ExecutionReceipt(root: string, protocolCommitSha: string, runId: string, startedAt: string): Readonly<{ path: string; runId: string }> {
  const researchDir = path.join(path.resolve(root), "docs", "research");
  const receiptPath = path.join(researchDir, "round-031-execution-receipt.json");
  mkdirSync(researchDir, { recursive: true });
  if (existsSync(receiptPath)) throw new Error("R31 execution receipt already exists.");
  writeFileSync(receiptPath, `${JSON.stringify({ schemaVersion: "m3-r31-execution-receipt-001", runId, protocolCommitSha, startedAt, executionType: "BINANCE_METRICS_LIVE_OVERLAP_REPROBE", status: "STARTED" }, null, 2)}\n`, { flag: "wx" });
  return Object.freeze({ path: receiptPath, runId });
}

export function assertR31ProtocolRuntime(): true {
  if (R31_BASE_SHA !== "c8b96e633179170c888766d7fa459a7b664a35f5") throw new Error("R31 base identity changed.");
  if (R31_SYMBOLS.length !== 5 || R31_ENDPOINTS.length !== 5 || R31_FIELD_MAPPINGS.length !== 5 || R31_TIMESTAMP_MAPPINGS.length !== 3) throw new Error("R31 fixed cardinality changed.");
  if (R31_GOVERNANCE.automaticTrading || R31_GOVERNANCE.performanceExecutionCount !== 0 || R31_GOVERNANCE.forwardEconomicValuesRead) throw new Error("R31 governance boundary changed.");
  return true;
}

export function readR31Result(root: string): R31Result {
  return JSON.parse(readFileSync(path.join(path.resolve(root), "docs", "research", "round-031-binance-metrics-overlap-result.json"), "utf8")) as R31Result;
}
