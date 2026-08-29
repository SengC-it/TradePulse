import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

import type { ResearchSymbol } from "../config/constants.ts";
import { parseBinanceIntrabarKlines } from "../historical-data/binance/intrabar.ts";
import type { HistoricalFundingRecord, IntrabarSettlementCandle } from "../historical-data/types.ts";
import { stableStringify } from "./utils.ts";

export const R13_BINANCE_VISION_BASE_URL = "https://data.binance.vision/data/futures/um" as const;
export const R13_ARCHIVE_MAX_ATTEMPTS = 5 as const;
export const R13_ARCHIVE_TIMEOUT_MS = 30_000 as const;

export type R13VisionArchiveKind = "1m" | "funding";
export type R13VisionArchiveFrequency = "monthly" | "daily";

export type R13VisionArchiveRequest = Readonly<{
  kind: R13VisionArchiveKind;
  frequency: R13VisionArchiveFrequency;
  symbol: ResearchSymbol;
  period: string;
}>;

export type R13VisionArchiveProvenance = Readonly<{
  source: "BINANCE_VISION_ARCHIVE";
  sourceUrl: string;
  checksumUrl: string;
  archiveFileName: string;
  archiveSha256: string;
  officialChecksumContent: string;
  officialChecksumSha256: string;
  symbol: ResearchSymbol;
  dataType: R13VisionArchiveKind;
  frequency: R13VisionArchiveFrequency;
  period: string;
  csvFileName: string;
  rowCount: number;
  firstTimestamp: number | null;
  lastTimestamp: number | null;
}>;

export type R13VisionArchiveResult<T> = Readonly<{
  records: readonly T[];
  provenance: R13VisionArchiveProvenance;
}>;

export type R13ArchiveFetchOptions = Readonly<{
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  maxAttempts?: number;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}>;

export type R13VisionArchiveFailureKind = "NETWORK" | "HTTP" | "VALIDATION";

export class R13VisionArchiveError extends Error {
  readonly sourceUrl: string;
  readonly status: number | null;
  readonly failureKind: R13VisionArchiveFailureKind;

  constructor(
    message: string,
    sourceUrl: string,
    status: number | null = null,
    failureKind: R13VisionArchiveFailureKind = "VALIDATION",
  ) {
    super(message);
    this.name = "R13VisionArchiveError";
    this.sourceUrl = sourceUrl;
    this.status = status;
    this.failureKind = failureKind;
  }
}

export function isR13VisionArchiveUnavailable(error: unknown): boolean {
  return error instanceof R13VisionArchiveError
    && (error.failureKind === "NETWORK" || error.status === 403 || error.status === 404 || error.status === 410);
}

function sha256(value: Uint8Array | string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function r13ArchiveChecksumMatches(
  archiveBytes: Uint8Array,
  officialChecksumContent: string,
): boolean {
  const expected = officialChecksumContent.match(/[0-9a-f]{64}/iu)?.[0]?.toLowerCase();
  return expected !== undefined && sha256(archiveBytes) === expected;
}

export const R13_SOURCE_PRIORITY = Object.freeze([
  "ACCEPTED_EXISTING_CACHE",
  "BINANCE_VISION_ARCHIVE",
  "BINANCE_PUBLIC_REST_FALLBACK",
] as const);

export function orderR13AcquisitionSources(
  sources: readonly string[],
): readonly string[] {
  return Object.freeze(R13_SOURCE_PRIORITY.filter((source) => sources.includes(source)));
}

export function chooseR13AcquisitionSource(input: Readonly<{
  acceptedCacheAvailable: boolean;
  visionAvailable: boolean;
  restFallbackAllowed: boolean;
}>): string {
  if (input.acceptedCacheAvailable) return "ACCEPTED_EXISTING_CACHE";
  if (input.visionAvailable) return "BINANCE_VISION_ARCHIVE";
  if (input.restFallbackAllowed) return "BINANCE_PUBLIC_REST_FALLBACK";
  throw new Error("No permitted R13 acquisition source is available.");
}

function archiveFileName(request: R13VisionArchiveRequest): string {
  const stem = request.kind === "1m"
    ? `${request.symbol}-1m-${request.period}`
    : `${request.symbol}-fundingRate-${request.period}`;
  return `${stem}.zip`;
}

export function r13VisionArchiveUrl(request: R13VisionArchiveRequest): string {
  const section = request.kind === "1m" ? "klines" : "fundingRate";
  return `${R13_BINANCE_VISION_BASE_URL}/${request.frequency}/${section}/${request.symbol}/${request.kind === "1m" ? "1m/" : ""}${archiveFileName(request)}`;
}

export function r13VisionArchiveChecksumUrl(request: R13VisionArchiveRequest): string {
  return `${r13VisionArchiveUrl(request)}.CHECKSUM`;
}

function transientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function retryDelay(attempt: number, random: () => number): number {
  const base = Math.min(5_000, 250 * 2 ** (attempt - 1));
  return base + Math.floor(Math.max(0, Math.min(1, random())) * base);
}

async function fetchBytes(url: string, options: R13ArchiveFetchOptions): Promise<Uint8Array> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? R13_ARCHIVE_TIMEOUT_MS;
  const maxAttempts = options.maxAttempts ?? R13_ARCHIVE_MAX_ATTEMPTS;
  const sleep = options.sleep ?? ((milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  const random = options.random ?? Math.random;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, { method: "GET", headers: { accept: "*/*" }, signal: controller.signal });
      if (response.ok) return new Uint8Array(await response.arrayBuffer());
      if (!transientStatus(response.status)) {
        throw new R13VisionArchiveError(`Binance Vision archive request returned HTTP ${response.status}.`, url, response.status, "HTTP");
      }
      lastError = new R13VisionArchiveError(`Binance Vision archive request returned transient HTTP ${response.status}.`, url, response.status, "NETWORK");
    } catch (error) {
      lastError = error;
      if (error instanceof R13VisionArchiveError && error.status !== null && !transientStatus(error.status)) throw error;
    } finally {
      clearTimeout(timer);
    }
    if (attempt < maxAttempts) await sleep(retryDelay(attempt, random));
  }

  throw lastError instanceof R13VisionArchiveError
    ? lastError
    : new R13VisionArchiveError("Binance Vision archive request failed after bounded retries.", url);
}

function parseChecksumText(value: string, sourceUrl: string): string {
  const match = value.match(/[0-9a-f]{64}/iu)?.[0]?.toLowerCase();
  if (!match) throw new R13VisionArchiveError("Binance Vision checksum response does not contain a SHA-256 digest.", sourceUrl);
  return match;
}

function readUInt16(buffer: Buffer, offset: number): number {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number): number {
  return buffer.readUInt32LE(offset);
}

function crc32(buffer: Uint8Array): number {
  let crc = 0xffffffff;
  for (const value of buffer) {
    crc ^= value;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) !== 0 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function zipCsv(buffer: Uint8Array, sourceUrl: string): Readonly<{ name: string; text: string }> {
  const archive = Buffer.from(buffer);
  const minimumEndOffset = Math.max(0, archive.length - 65_557);
  let endOffset = -1;
  for (let offset = archive.length - 22; offset >= minimumEndOffset; offset -= 1) {
    if (readUInt32(archive, offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new R13VisionArchiveError("Binance Vision archive has no ZIP end record.", sourceUrl);
  const entryCount = readUInt16(archive, endOffset + 10);
  const directorySize = readUInt32(archive, endOffset + 12);
  const directoryOffset = readUInt32(archive, endOffset + 16);
  if (entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    throw new R13VisionArchiveError("ZIP64 Binance Vision archives are not supported by the bounded parser.", sourceUrl);
  }

  let cursor = directoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = cursor;
    if (readUInt32(archive, cursor) !== 0x02014b50) throw new R13VisionArchiveError("Binance Vision ZIP central directory is invalid.", sourceUrl);
    const flags = readUInt16(archive, cursor + 8);
    const method = readUInt16(archive, cursor + 10);
    const compressedSize = readUInt32(archive, cursor + 20);
    const uncompressedSize = readUInt32(archive, cursor + 24);
    const nameLength = readUInt16(archive, cursor + 28);
    const extraLength = readUInt16(archive, cursor + 30);
    const commentLength = readUInt16(archive, cursor + 32);
    const localOffset = readUInt32(archive, cursor + 42);
    const name = archive.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8");
    cursor += 46 + nameLength + extraLength + commentLength;
    if (!name.toLowerCase().endsWith(".csv")) continue;
    if ((flags & 1) !== 0) throw new R13VisionArchiveError("Encrypted Binance Vision ZIP entries are not accepted.", sourceUrl);
    if (readUInt32(archive, localOffset) !== 0x04034b50) throw new R13VisionArchiveError("Binance Vision ZIP local entry is invalid.", sourceUrl);
    const localNameLength = readUInt16(archive, localOffset + 26);
    const localExtraLength = readUInt16(archive, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = archive.subarray(dataStart, dataStart + compressedSize);
    const content = method === 0 ? compressed : method === 8 ? inflateRawSync(compressed) : null;
    if (!content || content.length !== uncompressedSize) throw new R13VisionArchiveError("Binance Vision ZIP CSV entry failed decompression validation.", sourceUrl);
    const expectedCrc = readUInt32(archive, entryOffset + 16);
    if (crc32(content) !== expectedCrc) throw new R13VisionArchiveError("Binance Vision ZIP CSV entry failed CRC validation.", sourceUrl);
    return { name, text: new TextDecoder("utf-8", { fatal: true }).decode(content) };
  }
  throw new R13VisionArchiveError("Binance Vision archive contains no CSV entry.", sourceUrl);
}

function csvFields(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      fields.push(field);
      field = "";
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV record has an unterminated quoted field.");
  fields.push(field);
  return fields.map((value) => value.trim());
}

function csvRows(csv: string): readonly string[][] {
  return csv.replace(/^\uFEFF/u, "").split(/\r?\n/u).filter((line) => line.trim() !== "").map(csvFields);
}

function normalizedHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/gu, "");
}

function numberField(value: string, label: string, sourceUrl: string): number {
  if (value.trim() === "") throw new R13VisionArchiveError(`${label} is empty in Binance Vision CSV.`, sourceUrl);
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new R13VisionArchiveError(`${label} is not finite in Binance Vision CSV.`, sourceUrl);
  return parsed;
}

function integerField(value: string, label: string, sourceUrl: string): number {
  const parsed = numberField(value, label, sourceUrl);
  if (!Number.isSafeInteger(parsed) || parsed < 0) throw new R13VisionArchiveError(`${label} is not a non-negative safe integer in Binance Vision CSV.`, sourceUrl);
  return parsed;
}

function parseKlineRows(csv: string, symbol: ResearchSymbol, sourceUrl: string): readonly IntrabarSettlementCandle[] {
  const rows = csvRows(csv);
  const header = rows[0]?.map(normalizedHeader) ?? [];
  const hasHeader = header.includes("opentime") && header.includes("closetime");
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const candles = dataRows.map((row) => {
    if (row.length !== 12) throw new R13VisionArchiveError("Binance Vision Kline CSV row does not contain exactly 12 fields.", sourceUrl);
    const parsed = parseBinanceIntrabarKlines([[row[0], row[1], row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11]]], symbol)[0];
    if (!parsed || parsed.closeTime !== parsed.openTime + 59_999 || parsed.openTime % 60_000 !== 0) throw new R13VisionArchiveError("Binance Vision Kline CSV row failed canonical 1m validation.", sourceUrl);
    return parsed;
  });
  for (let index = 1; index < candles.length; index += 1) {
    if (candles[index]!.openTime <= candles[index - 1]!.openTime) throw new R13VisionArchiveError("Binance Vision Kline CSV contains duplicate or out-of-order minutes.", sourceUrl);
  }
  return Object.freeze(candles);
}

function parseFundingRows(csv: string, symbol: ResearchSymbol, sourceUrl: string): readonly HistoricalFundingRecord[] {
  const rows = csvRows(csv);
  const normalized = rows[0]?.map(normalizedHeader) ?? [];
  const hasHeader = normalized.some((field) => ["fundingtime", "calctime", "fundingrate", "lastfundingrate"].includes(field));
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const timeIndex = hasHeader ? normalized.findIndex((field) => ["fundingtime", "calctime", "timestamp", "time"].includes(field)) : rows[0]?.[0] === symbol ? 1 : 0;
  const rateIndex = hasHeader ? normalized.findIndex((field) => ["fundingrate", "lastfundingrate", "rate"].includes(field)) : rows[0]?.[0] === symbol ? 4 : 3;
  const markIndex = hasHeader ? normalized.findIndex((field) => ["markprice", "mark"].includes(field)) : rows[0]?.[0] === symbol ? 2 : 1;
  if (timeIndex < 0 || rateIndex < 0 || markIndex < 0) throw new R13VisionArchiveError("Binance Vision funding CSV has no canonical time/rate/mark columns.", sourceUrl);
  const records = dataRows.map((row) => {
    if (row.length <= Math.max(timeIndex, rateIndex, markIndex)) throw new R13VisionArchiveError("Binance Vision funding CSV row is too short.", sourceUrl);
    if (hasHeader && normalized.includes("symbol")) {
      const symbolIndex = normalized.indexOf("symbol");
      if (row[symbolIndex] !== symbol) throw new R13VisionArchiveError("Binance Vision funding CSV symbol does not match the requested symbol.", sourceUrl);
    }
    const markText = row[markIndex]!.trim();
    const directMarkPrice = markText === "" ? null : numberField(markText, "markPrice", sourceUrl);
    return Object.freeze({ symbol, fundingTime: integerField(row[timeIndex]!, "fundingTime", sourceUrl), fundingRate: numberField(row[rateIndex]!, "fundingRate", sourceUrl), directMarkPrice });
  }).sort((left, right) => left.fundingTime - right.fundingTime);
  for (let index = 1; index < records.length; index += 1) {
    if (records[index]!.fundingTime <= records[index - 1]!.fundingTime) throw new R13VisionArchiveError("Binance Vision funding CSV contains duplicate funding timestamps.", sourceUrl);
  }
  return Object.freeze(records);
}

function archiveDirectory(cacheDirectory: string, request: R13VisionArchiveRequest): string {
  return path.join(path.resolve(cacheDirectory), "r13", "archive", request.kind, request.symbol);
}

function markerPath(cacheDirectory: string, request: R13VisionArchiveRequest): string {
  return path.join(archiveDirectory(cacheDirectory, request), `${archiveFileName(request)}.verified.json`);
}

function deterministicProvenance(request: R13VisionArchiveRequest, archiveSha256: string, officialChecksumContent: string, officialChecksumSha256: string, csvFileName: string, records: readonly { timestamp: number }[]): R13VisionArchiveProvenance {
  return Object.freeze({ source: "BINANCE_VISION_ARCHIVE", sourceUrl: r13VisionArchiveUrl(request), checksumUrl: r13VisionArchiveChecksumUrl(request), archiveFileName: archiveFileName(request), archiveSha256, officialChecksumContent, officialChecksumSha256, symbol: request.symbol, dataType: request.kind, frequency: request.frequency, period: request.period, csvFileName, rowCount: records.length, firstTimestamp: records[0]?.timestamp ?? null, lastTimestamp: records.at(-1)?.timestamp ?? null });
}

async function loadVerifiedArchive(request: R13VisionArchiveRequest, cacheDirectory: string, options: R13ArchiveFetchOptions, records: (csv: string, sourceUrl: string) => readonly { timestamp: number }[]): Promise<Readonly<{ csv: string; csvFileName: string; provenanceBase: Readonly<{ archiveSha256: string; officialChecksumContent: string; officialChecksumSha256: string }> }>> {
  const directory = archiveDirectory(cacheDirectory, request);
  mkdirSync(directory, { recursive: true });
  const archivePath = path.join(directory, archiveFileName(request));
  const temporaryPath = `${archivePath}.part`;
  const marker = markerPath(cacheDirectory, request);
  let archiveBytes: Uint8Array;
  let officialChecksumSha256: string;
  let officialChecksumContent: string;
  let archiveSha256: string;
  let publishVerifiedFiles = false;
  if (existsSync(archivePath) && existsSync(marker)) {
    const markerValue = JSON.parse(readFileSync(marker, "utf8")) as { archiveSha256?: string; officialChecksumContent?: string; officialChecksumSha256?: string };
    archiveBytes = readFileSync(archivePath);
    archiveSha256 = sha256(archiveBytes);
    if (markerValue.archiveSha256 !== archiveSha256 || typeof markerValue.officialChecksumContent !== "string" || typeof markerValue.officialChecksumSha256 !== "string") throw new R13VisionArchiveError("Verified Binance Vision archive marker does not match the archive bytes.", r13VisionArchiveUrl(request));
    officialChecksumContent = markerValue.officialChecksumContent;
    officialChecksumSha256 = markerValue.officialChecksumSha256;
    if (parseChecksumText(officialChecksumContent, r13VisionArchiveChecksumUrl(request)) !== archiveSha256) throw new R13VisionArchiveError("Verified Binance Vision archive does not match its recorded CHECKSUM.", r13VisionArchiveUrl(request));
  } else {
    archiveBytes = await fetchBytes(r13VisionArchiveUrl(request), options);
    archiveSha256 = sha256(archiveBytes);
    const checksumBytes = await fetchBytes(r13VisionArchiveChecksumUrl(request), options);
    officialChecksumContent = new TextDecoder("utf-8", { fatal: true }).decode(checksumBytes);
    officialChecksumSha256 = sha256(checksumBytes);
    const expected = parseChecksumText(officialChecksumContent, r13VisionArchiveChecksumUrl(request));
    if (archiveSha256 !== expected) throw new R13VisionArchiveError("Binance Vision archive SHA-256 does not match the official CHECKSUM.", r13VisionArchiveUrl(request));
    publishVerifiedFiles = true;
  }
  const csv = zipCsv(archiveBytes, r13VisionArchiveUrl(request));
  const timestamped = records(csv.text, r13VisionArchiveUrl(request));
  if (timestamped.length === 0) throw new R13VisionArchiveError("Binance Vision archive contains no usable records.", r13VisionArchiveUrl(request));
  if (publishVerifiedFiles) {
    if (existsSync(archivePath)) unlinkSync(archivePath);
    if (existsSync(marker)) unlinkSync(marker);
    try {
      writeFileSync(temporaryPath, archiveBytes);
      renameSync(temporaryPath, archivePath);
    } finally {
      if (existsSync(temporaryPath)) {
        try { unlinkSync(temporaryPath); } catch { /* preserve the primary archive publication error */ }
      }
    }
    const markerTemporaryPath = `${marker}.part`;
    try {
      writeFileSync(markerTemporaryPath, stableStringify({ archiveSha256, officialChecksumContent, officialChecksumSha256, sourceUrl: r13VisionArchiveUrl(request), checksumUrl: r13VisionArchiveChecksumUrl(request) }), "utf8");
      renameSync(markerTemporaryPath, marker);
    } finally {
      if (existsSync(markerTemporaryPath)) {
        try { unlinkSync(markerTemporaryPath); } catch { /* preserve the primary marker publication error */ }
      }
    }
  }
  return {
    csv: csv.text,
    csvFileName: csv.name,
    provenanceBase: { archiveSha256, officialChecksumContent, officialChecksumSha256 },
  };
}

export async function downloadR13VisionKlineArchive(input: Readonly<{ request: R13VisionArchiveRequest & { kind: "1m" }; cacheDirectory: string; options?: R13ArchiveFetchOptions }>): Promise<R13VisionArchiveResult<IntrabarSettlementCandle>> {
  const sourceUrl = r13VisionArchiveUrl(input.request);
  const archive = await loadVerifiedArchive(input.request, input.cacheDirectory, input.options ?? {}, (csv, url) => parseKlineRows(csv, input.request.symbol, url).map((candle) => ({ timestamp: candle.openTime })));
  const candles = parseKlineRows(archive.csv, input.request.symbol, sourceUrl);
  const provenance = deterministicProvenance(input.request, archive.provenanceBase.archiveSha256, archive.provenanceBase.officialChecksumContent, archive.provenanceBase.officialChecksumSha256, archive.csvFileName, candles.map((candle) => ({ timestamp: candle.openTime })));
  return Object.freeze({ records: candles, provenance });
}

export async function downloadR13VisionFundingArchive(input: Readonly<{ request: R13VisionArchiveRequest & { kind: "funding" }; cacheDirectory: string; options?: R13ArchiveFetchOptions }>): Promise<R13VisionArchiveResult<HistoricalFundingRecord>> {
  const sourceUrl = r13VisionArchiveUrl(input.request);
  const archive = await loadVerifiedArchive(input.request, input.cacheDirectory, input.options ?? {}, (csv, url) => parseFundingRows(csv, input.request.symbol, url).map((record) => ({ timestamp: record.fundingTime })));
  const funding = parseFundingRows(archive.csv, input.request.symbol, sourceUrl);
  const provenance = deterministicProvenance(input.request, archive.provenanceBase.archiveSha256, archive.provenanceBase.officialChecksumContent, archive.provenanceBase.officialChecksumSha256, archive.csvFileName, funding.map((record) => ({ timestamp: record.fundingTime })));
  return Object.freeze({ records: funding, provenance });
}

export function normalizeVisionKlineCsv(csv: string, symbol: ResearchSymbol, sourceUrl = "fixture://binance-vision-kline"): readonly IntrabarSettlementCandle[] {
  return parseKlineRows(csv, symbol, sourceUrl);
}

export function normalizeVisionFundingCsv(csv: string, symbol: ResearchSymbol, sourceUrl = "fixture://binance-vision-funding"): readonly HistoricalFundingRecord[] {
  return parseFundingRows(csv, symbol, sourceUrl);
}
