import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import type { ResearchSymbol } from "../config/constants.ts";
import {
  M3_R16_RESEARCH_END_ISO,
  R16_BASIS_INTERVAL_MS,
  R16_METRICS_INTERVAL_MS,
  R16_SYMBOLS,
} from "./m3-r16-round-016-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R16_VISION_BASE_URL = "https://data.binance.vision/data/futures/um" as const;
export const R16_ARCHIVE_TIMEOUT_MS = 30_000 as const;
export const R16_ARCHIVE_MAX_ATTEMPTS = 5 as const;

export type R16ArchiveKind = "metrics" | "markPriceKlines" | "indexPriceKlines";
export type R16ArchiveFrequency = "daily" | "monthly";
export type R16ArchiveRequest = Readonly<{
  kind: R16ArchiveKind;
  frequency: R16ArchiveFrequency;
  symbol: ResearchSymbol;
  period: string;
  interval?: "5m";
}>;

export type R16MetricRow = Readonly<{
  symbol: ResearchSymbol;
  timestamp: number;
  sumOpenInterest: number;
  sumOpenInterestValue: number;
  sumTakerLongShortVolRatio: number;
}>;

type R16MetricsParseResult = Readonly<{
  rows: readonly R16MetricRow[];
  invalidRows: number;
}>;

export type R16BasisRow = Readonly<{
  symbol: ResearchSymbol;
  openTime: number;
  closeTime: number;
  markClose: number;
  indexClose: number;
  basisBps: number;
}>;

type R16ParsedBasisRow = Readonly<{
  symbol: ResearchSymbol;
  openTime: number;
  closeTime: number;
  close: number;
}>;

export type R16ArchiveProvenance = Readonly<{
  source: "BINANCE_VISION_ARCHIVE";
  sourceUrl: string;
  checksumUrl: string;
  archiveFileName: string;
  archiveSha256: string;
  officialChecksumContent: string;
  officialChecksumSha256: string;
  symbol: ResearchSymbol;
  dataType: R16ArchiveKind;
  frequency: R16ArchiveFrequency;
  period: string;
  interval: "5m" | null;
  csvFileName: string;
  rowCount: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
  detectedCadenceMs: number | null;
  duplicatesIdentical: number;
  duplicatesConflicting: number;
  invalidRows: number;
  missingIntervals: number;
}>;

export type R16ArchiveFetchOptions = Readonly<{
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}>;

export class R16ArchiveError extends Error {
  readonly sourceUrl: string;
  readonly status: number | null;
  readonly failureKind: "NETWORK" | "HTTP" | "VALIDATION";

  constructor(message: string, sourceUrl: string, status: number | null = null, failureKind: R16ArchiveError["failureKind"] = "VALIDATION") {
    super(message);
    this.name = "R16ArchiveError";
    this.sourceUrl = sourceUrl;
    this.status = status;
    this.failureKind = failureKind;
  }
}

function sha256(value: Uint8Array | string): string { return createHash("sha256").update(value).digest("hex"); }
function monthPeriod(year: number, month: number): string { return `${year}-${String(month).padStart(2, "0")}`; }
function dayPeriod(timestamp: number): string { return new Date(timestamp).toISOString().slice(0, 10); }
function transientStatus(status: number): boolean { return status === 408 || status === 429 || status >= 500; }
function retryDelay(attempt: number, random: () => number): number { const base = Math.min(5_000, 250 * 2 ** (attempt - 1)); return base + Math.floor(Math.max(0, Math.min(1, random())) * base); }

function archiveFileName(request: R16ArchiveRequest): string {
  if (request.kind === "metrics") return `${request.symbol}-metrics-${request.period}.zip`;
  return `${request.symbol}-${request.interval ?? "5m"}-${request.period}.zip`;
}

export function r16ArchiveUrl(request: R16ArchiveRequest): string {
  if (request.kind === "metrics") return `${R16_VISION_BASE_URL}/${request.frequency}/metrics/${request.symbol}/${archiveFileName(request)}`;
  return `${R16_VISION_BASE_URL}/${request.frequency}/${request.kind}/${request.symbol}/${request.interval ?? "5m"}/${archiveFileName(request)}`;
}

export function r16ArchiveChecksumUrl(request: R16ArchiveRequest): string { return `${r16ArchiveUrl(request)}.CHECKSUM`; }

function csvFields(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { field += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === "," && !quoted) { fields.push(field); field = ""; }
    else field += character;
  }
  if (quoted) throw new Error("R16 CSV record has an unterminated quoted field.");
  fields.push(field);
  return fields.map((value) => value.trim());
}

function csvRows(csv: string): readonly string[][] { return csv.replace(/^\uFEFF/u, "").split(/\r?\n/u).filter((line) => line.trim() !== "").map(csvFields); }
function normalizedHeader(value: string): string { return value.toLowerCase().replace(/[^a-z0-9]/gu, ""); }
function requiredNumber(value: string | undefined, label: string, url: string): number {
  if (value === undefined || value.trim() === "") throw new R16ArchiveError(`${label} is missing.`, url);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new R16ArchiveError(`${label} is not finite.`, url);
  return parsed;
}
function requiredTimestamp(value: string | undefined, label: string, url: string): number {
  if (value === undefined || value.trim() === "") throw new R16ArchiveError(`${label} is missing.`, url);
  const trimmed = value.trim();
  const numeric = /^\d+(?:\.\d+)?$/u.test(trimmed) ? Number(trimmed) : Number.NaN;
  const utcText = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/u.test(trimmed) ? `${trimmed.replace(" ", "T")}Z` : trimmed;
  const parsed = Number.isFinite(numeric) ? numeric : Date.parse(utcText);
  if (!Number.isFinite(parsed)) throw new R16ArchiveError(`${label} is not finite.`, url);
  if (!Number.isSafeInteger(parsed) || parsed < 1_000_000_000_000) throw new R16ArchiveError(`${label} is not a millisecond timestamp.`, url);
  return parsed;
}
function indexOfRequired(header: readonly string[], names: readonly string[], label: string, url: string): number {
  const index = header.findIndex((value) => names.includes(value));
  if (index < 0) throw new R16ArchiveError(`R16 metrics schema has no unambiguous ${label} field.`, url);
  return index;
}

function parseR16MetricsCsvDetailed(csv: string, symbol: ResearchSymbol, sourceUrl = "fixture://r16-metrics"): R16MetricsParseResult {
  const rows = csvRows(csv);
  if (rows.length < 2) throw new R16ArchiveError("R16 metrics archive is empty.", sourceUrl);
  const header = rows[0]!.map(normalizedHeader);
  const headerPresent = header.some((value) => ["createtime", "timestamp", "symbol", "sumopeninterest", "sumtakerlongshortvolratio"].includes(value));
  const data = headerPresent ? rows.slice(1) : rows;
  const timestampIndex = headerPresent ? indexOfRequired(header, ["createtime", "timestamp", "time"], "timestamp/create_time", sourceUrl) : 0;
  const symbolIndex = headerPresent ? indexOfRequired(header, ["symbol"], "symbol", sourceUrl) : 1;
  const oiIndex = headerPresent ? indexOfRequired(header, ["sumopeninterest"], "sum_open_interest", sourceUrl) : 2;
  const oiValueIndex = headerPresent ? indexOfRequired(header, ["sumopeninterestvalue"], "sum_open_interest_value", sourceUrl) : 3;
  const takerIndex = headerPresent ? indexOfRequired(header, ["sumtakerlongshortvolratio"], "sum_taker_long_short_vol_ratio", sourceUrl) : 7;
  const output: R16MetricRow[] = [];
  let invalidRows = 0;
  for (const row of data) {
    const rowSymbol = row[symbolIndex] ?? symbol;
    if (rowSymbol !== symbol) throw new R16ArchiveError(`R16 metrics symbol mismatch: ${rowSymbol}.`, sourceUrl);
    let sumOpenInterest: number;
    let sumOpenInterestValue: number;
    let sumTakerLongShortVolRatio: number;
    let timestamp: number;
    try {
      sumOpenInterest = requiredNumber(row[oiIndex], "sum_open_interest", sourceUrl);
      sumOpenInterestValue = requiredNumber(row[oiValueIndex], "sum_open_interest_value", sourceUrl);
      sumTakerLongShortVolRatio = requiredNumber(row[takerIndex], "sum_taker_long_short_vol_ratio", sourceUrl);
      timestamp = requiredTimestamp(row[timestampIndex], "create_time", sourceUrl);
    } catch (error) {
      if (error instanceof R16ArchiveError) { invalidRows += 1; continue; }
      throw error;
    }
    if (!(sumOpenInterest > 0) || !(sumOpenInterestValue > 0) || !(sumTakerLongShortVolRatio > 0)) { invalidRows += 1; continue; }
    output.push(Object.freeze({ symbol, timestamp, sumOpenInterest, sumOpenInterestValue, sumTakerLongShortVolRatio }));
  }
  return Object.freeze({ rows: Object.freeze(output), invalidRows });
}

export function parseR16MetricsCsv(csv: string, symbol: ResearchSymbol, sourceUrl = "fixture://r16-metrics"): readonly R16MetricRow[] {
  return parseR16MetricsCsvDetailed(csv, symbol, sourceUrl).rows;
}

export function parseR16BasisCsv(csv: string, symbol: ResearchSymbol, sourceUrl = "fixture://r16-basis"): readonly R16ParsedBasisRow[] {
  const rows = csvRows(csv);
  if (rows.length < 2) throw new R16ArchiveError("R16 basis archive is empty.", sourceUrl);
  const header = rows[0]!.map(normalizedHeader);
  const headerPresent = header.includes("opentime") && header.includes("closetime");
  const data = headerPresent ? rows.slice(1) : rows;
  const openIndex = headerPresent ? header.indexOf("opentime") : 0;
  const closeIndex = headerPresent ? header.indexOf("closetime") : 6;
  const closePriceIndex = headerPresent ? header.indexOf("close") : 4;
  const output = data.map((row) => {
    const openTime = requiredTimestamp(row[openIndex], "openTime", sourceUrl);
    const closeTime = requiredTimestamp(row[closeIndex], "closeTime", sourceUrl);
    const close = requiredNumber(row[closePriceIndex], "close", sourceUrl);
    if (closeTime !== openTime + R16_BASIS_INTERVAL_MS - 1 || openTime % R16_BASIS_INTERVAL_MS !== 0 || !(close > 0)) throw new R16ArchiveError("R16 basis candle is not a canonical closed positive 5m candle.", sourceUrl);
    return Object.freeze({ symbol, openTime, closeTime, close });
  });
  return Object.freeze(output);
}

function readUInt16(buffer: Buffer, offset: number): number { return buffer.readUInt16LE(offset); }
function readUInt32(buffer: Buffer, offset: number): number { return buffer.readUInt32LE(offset); }
function crc32(buffer: Uint8Array): number { let crc = 0xffffffff; for (const value of buffer) { crc ^= value; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) !== 0 ? 0xedb88320 : 0); } return (crc ^ 0xffffffff) >>> 0; }

function zipCsv(buffer: Uint8Array, sourceUrl: string): Readonly<{ name: string; text: string }> {
  const archive = Buffer.from(buffer);
  const minimumEndOffset = Math.max(0, archive.length - 65_557);
  let endOffset = -1;
  for (let offset = archive.length - 22; offset >= minimumEndOffset; offset -= 1) if (readUInt32(archive, offset) === 0x06054b50) { endOffset = offset; break; }
  if (endOffset < 0) throw new R16ArchiveError("R16 archive has no ZIP end record.", sourceUrl);
  const entries = readUInt16(archive, endOffset + 10);
  const directoryOffset = readUInt32(archive, endOffset + 16);
  let cursor = directoryOffset;
  for (let index = 0; index < entries; index += 1) {
    if (readUInt32(archive, cursor) !== 0x02014b50) throw new R16ArchiveError("R16 ZIP central directory is invalid.", sourceUrl);
    const flags = readUInt16(archive, cursor + 8);
    const method = readUInt16(archive, cursor + 10);
    const compressedSize = readUInt32(archive, cursor + 20);
    const uncompressedSize = readUInt32(archive, cursor + 24);
    const nameLength = readUInt16(archive, cursor + 28);
    const extraLength = readUInt16(archive, cursor + 30);
    const commentLength = readUInt16(archive, cursor + 32);
    const localOffset = readUInt32(archive, cursor + 42);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    const entryOffset = cursor;
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name.toLowerCase().endsWith(".csv")) continue;
    if ((flags & 1) !== 0 || readUInt32(archive, localOffset) !== 0x04034b50) throw new R16ArchiveError("R16 ZIP CSV entry is encrypted or invalid.", sourceUrl);
    const localNameLength = readUInt16(archive, localOffset + 26);
    const localExtraLength = readUInt16(archive, localOffset + 28);
    const compressed = archive.subarray(localOffset + 30 + localNameLength + localExtraLength, localOffset + 30 + localNameLength + localExtraLength + compressedSize);
    const content = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (!content || content.length !== uncompressedSize || crc32(content) !== readUInt32(archive, entryOffset + 16)) throw new R16ArchiveError("R16 ZIP CSV entry failed decompression or CRC validation.", sourceUrl);
    return { name, text: new TextDecoder("utf-8", { fatal: true }).decode(content) };
  }
  throw new R16ArchiveError("R16 archive contains no CSV entry.", sourceUrl);
}

async function fetchBytes(url: string, options: R16ArchiveFetchOptions): Promise<Uint8Array> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? R16_ARCHIVE_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? R16_ARCHIVE_MAX_ATTEMPTS;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { method: "GET", headers: { accept: "*/*" }, signal: controller.signal });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
      if (!transientStatus(response.status)) throw new R16ArchiveError(`R16 archive request returned HTTP ${response.status}.`, url, response.status, "HTTP");
      lastError = new R16ArchiveError(`R16 archive request returned transient HTTP ${response.status}.`, url, response.status, "NETWORK");
    } catch (error) {
      lastError = error;
      if (error instanceof R16ArchiveError && error.status !== null && !transientStatus(error.status)) throw error;
    } finally { clearTimeout(timer); }
    if (attempt < maxAttempts) await sleep(retryDelay(attempt, random));
  }
  throw lastError instanceof R16ArchiveError ? lastError : new R16ArchiveError("R16 archive request failed after bounded retries.", url, null, "NETWORK");
}

function checksumDigest(content: string, url: string): string { const digest = content.match(/[0-9a-f]{64}/iu)?.[0]?.toLowerCase(); if (!digest) throw new R16ArchiveError("R16 official CHECKSUM has no SHA-256 digest.", url); return digest; }
function archiveDirectory(cacheDirectory: string, request: R16ArchiveRequest): string { return path.join(path.resolve(cacheDirectory), "archives", request.kind, request.symbol, request.frequency, request.interval ?? "none"); }
function requestKey(request: R16ArchiveRequest): string { return `${request.kind}|${request.symbol}|${request.frequency}|${request.interval ?? "none"}|${request.period}`; }
function markerPath(cacheDirectory: string, request: R16ArchiveRequest): string { return path.join(archiveDirectory(cacheDirectory, request), `${requestKey(request).replaceAll("|", "_")}.json`); }

type R16ArchiveMarker = Readonly<{ request: R16ArchiveRequest; archivePath: string; archiveSha256: string; officialChecksumContent: string; officialChecksumSha256: string; provenance: R16ArchiveProvenance }>;

export function collapseR16Rows<T>(rows: readonly T[], keyOf: (row: T) => number): Readonly<{ rows: readonly T[]; invalidKeys: readonly number[] }> {
  const byKey = new Map<number, T>();
  const invalidKeys = new Set<number>();
  for (const row of rows) {
    const key = keyOf(row);
    if (invalidKeys.has(key)) continue;
    const prior = byKey.get(key);
    if (prior === undefined) { byKey.set(key, row); continue; }
    if (stableStringify(prior) !== stableStringify(row)) { byKey.delete(key); invalidKeys.add(key); }
  }
  return Object.freeze({ rows: Object.freeze([...byKey.values()]), invalidKeys: Object.freeze([...invalidKeys].sort((left, right) => left - right)) });
}

function detectCadence(timestamps: readonly number[], interval: number): number | null {
  const differences = timestamps.slice(1).map((value, index) => value - timestamps[index]!).filter((value) => value > 0 && value <= interval * 24);
  if (differences.length === 0) return null;
  const frequencies = new Map<number, number>();
  for (const difference of differences) frequencies.set(difference, (frequencies.get(difference) ?? 0) + 1);
  return [...frequencies.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]![0];
}

function parseArchiveRecords(request: R16ArchiveRequest, csv: string, url: string): Readonly<{ records: readonly R16ParsedArchiveRecord[]; invalidRows: number }> {
  if (request.kind === "metrics") {
    const parsed = parseR16MetricsCsvDetailed(csv, request.symbol, url);
    return Object.freeze({ records: parsed.rows, invalidRows: parsed.invalidRows });
  }
  return Object.freeze({ records: parseR16BasisCsv(csv, request.symbol, url), invalidRows: 0 });
}

type R16ParsedArchiveRecord = R16MetricRow | Readonly<{ symbol: ResearchSymbol; openTime: number; closeTime: number; close: number }>;

function archiveRecordTimestamp(record: R16ParsedArchiveRecord): number {
  return "timestamp" in record ? record.timestamp : record.openTime;
}

function archiveQuality(records: readonly R16ParsedArchiveRecord[], interval: number, sourceUrl: string): Readonly<{ timestamps: readonly number[]; duplicatesIdentical: number; duplicatesConflicting: number; missingIntervals: number; detectedCadenceMs: number | null }> {
  const identities = new Map<number, string>();
  let duplicatesIdentical = 0;
  let duplicatesConflicting = 0;
  for (const record of records) {
    const timestamp = archiveRecordTimestamp(record);
    const identity = stableStringify(record);
    const previous = identities.get(timestamp);
    if (previous === undefined) identities.set(timestamp, identity);
    else if (previous === identity) duplicatesIdentical += 1;
    else { duplicatesConflicting += 1; throw new R16ArchiveError(`R16 archive has a conflicting duplicate timestamp at ${timestamp}.`, sourceUrl); }
  }
  const timestamps = Object.freeze([...identities.keys()].sort((left, right) => left - right));
  const detectedCadenceMs = detectCadence(timestamps, interval);
  const missingIntervals = detectedCadenceMs === null ? 0 : timestamps.slice(1).reduce((total, timestamp, index) => total + Math.max(0, Math.round((timestamp - timestamps[index]!) / detectedCadenceMs) - 1), 0);
  return Object.freeze({ timestamps, duplicatesIdentical, duplicatesConflicting, missingIntervals, detectedCadenceMs });
}

async function downloadVerifiedArchive(request: R16ArchiveRequest, cacheDirectory: string, options: R16ArchiveFetchOptions = {}): Promise<R16ArchiveMarker> {
  const url = r16ArchiveUrl(request);
  const checksumUrl = r16ArchiveChecksumUrl(request);
  const directory = archiveDirectory(cacheDirectory, request);
  const markerFile = markerPath(cacheDirectory, request);
  mkdirSync(directory, { recursive: true });
  if (existsSync(markerFile)) {
    const marker = JSON.parse(readFileSync(markerFile, "utf8")) as R16ArchiveMarker;
    if (stableStringify(marker.request) !== stableStringify(request) || !existsSync(marker.archivePath) || sha256(readFileSync(marker.archivePath)) !== marker.archiveSha256) throw new R16ArchiveError("R16 archive marker does not match cached bytes.", url);
    const provenance = Object.freeze({ ...marker.provenance, invalidRows: marker.provenance.invalidRows ?? 0 });
    return Object.freeze({ ...marker, provenance });
  }
  const archiveBytes = await fetchBytes(url, options);
  const archiveSha256 = sha256(archiveBytes);
  const officialChecksumContent = new TextDecoder("utf-8", { fatal: true }).decode(await fetchBytes(checksumUrl, options));
  const expected = checksumDigest(officialChecksumContent, checksumUrl);
  if (archiveSha256 !== expected) throw new R16ArchiveError("R16 archive SHA-256 does not match official CHECKSUM.", url);
  const csv = zipCsv(archiveBytes, url);
  const parsed = parseArchiveRecords(request, csv.text, url);
  if (parsed.records.length === 0) throw new R16ArchiveError("R16 archive has no usable records.", url);
  const quality = archiveQuality(parsed.records, request.kind === "metrics" ? R16_METRICS_INTERVAL_MS : R16_BASIS_INTERVAL_MS, url);
  const provenance: R16ArchiveProvenance = Object.freeze({ source: "BINANCE_VISION_ARCHIVE", sourceUrl: url, checksumUrl, archiveFileName: archiveFileName(request), archiveSha256, officialChecksumContent, officialChecksumSha256: sha256(new TextEncoder().encode(officialChecksumContent)), symbol: request.symbol, dataType: request.kind, frequency: request.frequency, period: request.period, interval: request.interval ?? null, csvFileName: csv.name, rowCount: parsed.records.length, firstTimestamp: quality.timestamps[0] ?? null, lastTimestamp: quality.timestamps.at(-1) ?? null, detectedCadenceMs: quality.detectedCadenceMs, duplicatesIdentical: quality.duplicatesIdentical, duplicatesConflicting: quality.duplicatesConflicting, invalidRows: parsed.invalidRows, missingIntervals: quality.missingIntervals });
  const archivePath = path.join(directory, archiveFileName(request));
  const staging = mkdtempSync(path.join(directory, ".r16-archive-staging-"));
  try {
    const temporary = path.join(staging, path.basename(archivePath));
    writeFileSync(temporary, archiveBytes);
    renameSync(temporary, archivePath);
    const marker: R16ArchiveMarker = Object.freeze({ request, archivePath, archiveSha256, officialChecksumContent, officialChecksumSha256: provenance.officialChecksumSha256, provenance });
    const markerTemporary = path.join(staging, path.basename(markerFile));
    writeFileSync(markerTemporary, stableStringify(marker), "utf8");
    renameSync(markerTemporary, markerFile);
    return marker;
  } finally { if (existsSync(staging)) rmSync(staging, { recursive: true, force: true }); }
}

function requestsForRange(kind: R16ArchiveKind, symbol: ResearchSymbol): readonly R16ArchiveRequest[] {
  const end = Date.parse(M3_R16_RESEARCH_END_ISO);
  const requests: R16ArchiveRequest[] = [];
  if (kind === "metrics") {
    for (let day = Date.parse("2023-01-01T00:00:00.000Z"); day <= end; day += 86_400_000) requests.push({ kind, frequency: "daily", symbol, period: dayPeriod(day) });
  } else {
    const startDate = new Date(Date.parse("2023-01-01T00:00:00.000Z"));
    const endDate = new Date(end);
    let year = startDate.getUTCFullYear();
    let month = startDate.getUTCMonth() + 1;
    const endYear = endDate.getUTCFullYear();
    const endMonth = endDate.getUTCMonth() + 1;
    while (year < endYear || (year === endYear && month < endMonth)) {
      requests.push({ kind, frequency: "monthly", symbol, period: monthPeriod(year, month), interval: "5m" });
      month += 1;
      if (month === 13) { year += 1; month = 1; }
    }
    const finalMonth = `${endYear}-${String(endMonth).padStart(2, "0")}`;
    for (let day = 1; day <= endDate.getUTCDate(); day += 1) requests.push({ kind, frequency: "daily", symbol, period: `${finalMonth}-${String(day).padStart(2, "0")}`, interval: "5m" });
  }
  return Object.freeze(requests);
}

export function buildR16ArchiveRequests(): readonly R16ArchiveRequest[] {
  return Object.freeze(R16_SYMBOLS.flatMap((symbol) => [
    ...requestsForRange("metrics", symbol),
    ...requestsForRange("markPriceKlines", symbol),
    ...requestsForRange("indexPriceKlines", symbol),
  ]));
}

export type R16AcquisitionManifest = Readonly<{
  schemaVersion: "m3-r16-round-016-micro-acquisition-001";
  source: "BINANCE_VISION_ARCHIVE";
  cacheDirectory: ".cache/tradepulse/round-016";
  archiveCount: number;
  archiveProvenance: readonly R16ArchiveProvenance[];
  officialChecksumsVerified: boolean;
  metricsSchemaVerified: boolean;
  metricsCadenceVerified: boolean;
  markIndexPairingVerified: boolean;
  detectedCadenceBySourcePeriod: Readonly<Record<string, number | null>>;
  dataSourceIdentitySha256: string;
  completed: boolean;
}>;

function acquisitionManifestPath(cacheDirectory: string): string { return path.join(path.resolve(cacheDirectory), "micro-acquisition-manifest.json"); }
function atomicWrite(filePath: string, value: unknown): void { mkdirSync(path.dirname(filePath), { recursive: true }); const staging = mkdtempSync(path.join(path.dirname(filePath), ".r16-manifest-staging-")); try { const temporary = path.join(staging, path.basename(filePath)); writeFileSync(temporary, stableStringify(value), "utf8"); renameSync(temporary, filePath); } finally { if (existsSync(staging)) rmSync(staging, { recursive: true, force: true }); } }

export function readR16AcquisitionManifest(cacheDirectory: string): R16AcquisitionManifest | null { const filePath = acquisitionManifestPath(cacheDirectory); return existsSync(filePath) ? JSON.parse(readFileSync(filePath, "utf8")) as R16AcquisitionManifest : null; }

export async function acquireR16Archives(input: Readonly<{ cacheDirectory: string; options?: R16ArchiveFetchOptions; concurrency?: number }>): Promise<R16AcquisitionManifest> {
  const cacheDirectory = path.resolve(input.cacheDirectory);
  const requests = buildR16ArchiveRequests();
  const results: R16ArchiveProvenance[] = [];
  let cursor = 0;
  const concurrency = Math.max(1, Math.min(16, input.concurrency ?? 8));
  const worker = async (): Promise<void> => { while (true) { const index = cursor++; if (index >= requests.length) return; const marker = await downloadVerifiedArchive(requests[index]!, cacheDirectory, input.options); results[index] = marker.provenance; } };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  const sorted = results.filter((value): value is R16ArchiveProvenance => value !== undefined).sort((left, right) => `${left.dataType}|${left.symbol}|${left.period}|${left.frequency}`.localeCompare(`${right.dataType}|${right.symbol}|${right.period}|${right.frequency}`));
  const expectedMetrics = requests.filter((value) => value.kind === "metrics");
  const metricCadences = sorted.filter((value) => value.dataType === "metrics").map((value) => value.detectedCadenceMs);
  const metricsCadenceVerified = metricCadences.length === expectedMetrics.length && metricCadences.every((value) => value === R16_METRICS_INTERVAL_MS) && new Set(metricCadences).size === 1;
  const pairKey = (value: R16ArchiveProvenance): string => `${value.symbol}|${value.frequency}|${value.period}|${value.interval ?? "none"}`;
  const markPeriods = new Set(sorted.filter((value) => value.dataType === "markPriceKlines").map(pairKey));
  const indexPeriods = new Set(sorted.filter((value) => value.dataType === "indexPriceKlines").map(pairKey));
  const markIndexPairingVerified = markPeriods.size === indexPeriods.size && [...markPeriods].every((value) => indexPeriods.has(value));
  const manifestBase = { schemaVersion: "m3-r16-round-016-micro-acquisition-001" as const, source: "BINANCE_VISION_ARCHIVE" as const, cacheDirectory: ".cache/tradepulse/round-016" as const, archiveCount: sorted.length, archiveProvenance: sorted, officialChecksumsVerified: sorted.length === requests.length && sorted.every((value) => value.archiveSha256.length === 64 && value.officialChecksumSha256.length === 64), metricsSchemaVerified: sorted.filter((value) => value.dataType === "metrics").length === expectedMetrics.length && sorted.filter((value) => value.dataType === "metrics").every((value) => value.rowCount > 0), metricsCadenceVerified, markIndexPairingVerified, detectedCadenceBySourcePeriod: Object.fromEntries(sorted.map((value) => [`${value.dataType}|${value.symbol}|${value.period}|${value.frequency}`, value.detectedCadenceMs])), dataSourceIdentitySha256: "", completed: true };
  const manifest = Object.freeze({ ...manifestBase, dataSourceIdentitySha256: sha256(stableStringify(manifestBase)) }) as R16AcquisitionManifest;
  atomicWrite(acquisitionManifestPath(cacheDirectory), manifest);
  return manifest;
}

export type R16MicroSeries = Readonly<{
  metrics: Readonly<Record<ResearchSymbol, readonly R16MetricRow[]>>;
  basis: Readonly<Record<ResearchSymbol, readonly R16BasisRow[]>>;
  acquisition: R16AcquisitionManifest;
}>;

export function loadR16MicroSeries(cacheDirectory: string): R16MicroSeries {
  const acquisition = readR16AcquisitionManifest(cacheDirectory);
  if (!acquisition?.completed || !acquisition.officialChecksumsVerified || !acquisition.metricsSchemaVerified || !acquisition.metricsCadenceVerified || !acquisition.markIndexPairingVerified) throw new Error("R16 micro archive acquisition manifest is missing or incomplete.");
  const metrics = Object.fromEntries(R16_SYMBOLS.map((symbol) => [symbol, [] as R16MetricRow[]])) as Record<ResearchSymbol, R16MetricRow[]>;
  const mark = Object.fromEntries(R16_SYMBOLS.map((symbol) => [symbol, [] as R16ParsedBasisRow[]])) as Record<ResearchSymbol, R16ParsedBasisRow[]>;
  const index = Object.fromEntries(R16_SYMBOLS.map((symbol) => [symbol, [] as R16ParsedBasisRow[]])) as Record<ResearchSymbol, R16ParsedBasisRow[]>;
  for (const provenance of acquisition.archiveProvenance) {
    const request: R16ArchiveRequest = { kind: provenance.dataType, frequency: provenance.frequency, symbol: provenance.symbol, period: provenance.period, ...(provenance.interval ? { interval: provenance.interval } : {}) };
    const filePath = path.join(path.resolve(cacheDirectory), "archives", request.kind, request.symbol, request.frequency, request.interval ?? "none", archiveFileName(request));
    const csv = zipCsv(readFileSync(filePath), provenance.sourceUrl);
    if (request.kind === "metrics") metrics[request.symbol]!.push(...parseR16MetricsCsv(csv.text, request.symbol, provenance.sourceUrl));
    else { const destination = request.kind === "markPriceKlines" ? mark[request.symbol]! : index[request.symbol]!; destination.push(...parseR16BasisCsv(csv.text, request.symbol, provenance.sourceUrl)); }
  }
  const metricOutput = {} as Record<ResearchSymbol, readonly R16MetricRow[]>;
  const basisOutput = {} as Record<ResearchSymbol, readonly R16BasisRow[]>;
  for (const symbol of R16_SYMBOLS) {
    const metricRows = collapseR16Rows(metrics[symbol]!, (row) => row.timestamp).rows;
    metricOutput[symbol] = Object.freeze([...metricRows].sort((left, right) => left.timestamp - right.timestamp));
    const markByTime = new Map(collapseR16Rows(mark[symbol]!, (row) => row.openTime).rows.map((row) => [row.openTime, row]));
    const indexByTime = new Map(collapseR16Rows(index[symbol]!, (row) => row.openTime).rows.map((row) => [row.openTime, row]));
    const paired = [...markByTime.keys()].filter((time) => indexByTime.has(time)).sort((left, right) => left - right).map((openTime) => { const left = markByTime.get(openTime)!; const right = indexByTime.get(openTime)!; if (!(right.close > 0)) throw new Error(`R16 index close is not positive at ${symbol}/${openTime}.`); return Object.freeze({ symbol, openTime, closeTime: Math.min(left.closeTime, right.closeTime), markClose: left.close, indexClose: right.close, basisBps: 10_000 * (left.close - right.close) / right.close }); });
    basisOutput[symbol] = Object.freeze(paired.filter((row) => Number.isFinite(row.basisBps)));
  }
  return Object.freeze({ metrics: Object.freeze(metricOutput), basis: Object.freeze(basisOutput), acquisition });
}

export function r16ArchiveRequestForRepresentativeDates(symbol: ResearchSymbol): readonly R16ArchiveRequest[] {
  return Object.freeze(["2023-01-01", "2024-06-15", "2025-06-15", "2026-08-15"].map((period) => ({ kind: "metrics" as const, frequency: "daily" as const, symbol, period })));
}

export function r16ExpectedMetricsCadence(): number { return R16_METRICS_INTERVAL_MS; }
export function r16ExpectedBasisCadence(): number { return R16_BASIS_INTERVAL_MS; }
