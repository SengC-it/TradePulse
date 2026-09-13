import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, linkSync, statSync } from "node:fs";
import path from "node:path";

import type { ResearchSymbol } from "../config/constants.ts";
import {
  M3_R13_RESEARCH_END_ISO,
  M3_R13_RESEARCH_START_ISO,
  R13_SYMBOLS,
  type R13Direction,
} from "./m3-r13-round-013-protocol.ts";
import type { R13LabelStatus } from "./m3-r13-round-013-labels.ts";
import { R23_DEVELOPMENT_DATA_END_ISO, R23_DEVELOPMENT_DATA_START_ISO } from "./round-023-development-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R23_DEVELOPMENT_DATA_MANIFEST_PATH = "docs/research/round-023-development-data-manifest.json" as const;
export const R23_DEVELOPMENT_DATA_PATH = ".cache/tradepulse/round-023/observations.ndjson" as const;
export const R23_ACCEPTED_R14_OBSERVATION_PATH = ".cache/tradepulse/round-014/observations.ndjson" as const;
export const R23_ACCEPTED_R14_FREEZE_MANIFEST_PATH = "docs/research/round-014-observation-freeze.json" as const;
export const R23_ACCEPTED_R13_DATASET_FREEZE_PATH = "docs/research/round-013-dataset-freeze.json" as const;

export const R23_ACCEPTED_R14_OBSERVATION_SHA256 = "5b0e62f93526052d649fdb189792d48d9c2eb0fd0c13cf7af1255efdae517359" as const;
export const R23_ACCEPTED_R14_OBSERVATION_BYTES = 1_893_811_055 as const;
export const R23_ACCEPTED_R14_FREEZE_MANIFEST_FILE_SHA256 = "79c8e56560cd6e1ed2de1772071bd0d92ecd2fac4b4ae065cf65f11f583b3e18" as const;
export const R23_ACCEPTED_R14_FREEZE_MANIFEST_SHA256 = "7d03b1a59f85509c3e350c0ab10053b8ff84193357322b11a1437002c9d25af6" as const;
export const R23_ACCEPTED_R14_FREEZE_COMMIT = "44d630dd387e75ed9a46713a94f38221fa48ab0f" as const;
export const R23_ACCEPTED_R14_FREEZE_MANIFEST_BLOB_SHA = "73fef453b288e340f3f5b8ab32154f500efbd05e" as const;
export const R23_ACCEPTED_R13_DATASET_IDENTITY_SHA256 = "cf836dd3344ef4a896c7a9520c65a648c19f2fa25f5f849ea6ab4e9050d32e26" as const;
export const R23_ACCEPTED_R13_DATASET_FREEZE_COMMIT = "3235d08da1cadf2f98a7b4974dc183a8e50b919e" as const;
export const R23_ACCEPTED_R13_DATASET_FREEZE_BLOB_SHA = "51aacd43b3110fba3a2da96a1a9cfa5ea8a2ccee" as const;
export const R23_ACCEPTED_R13_SOURCE_MANIFEST_IDENTITY_SHA256 = "2ffa7eda3a53edfeaa2e4443812c4380d0a15dd581442eec47e3f8cd82557175" as const;
export const R23_ACCEPTED_R13_COARSE_CACHE_IDENTITY_SHA256 = "43251e252041c66b393588397a069708624e93d937b4d8eabf57d623b9763088" as const;
export const R23_ACCEPTED_R13_FEATURE_PROTOCOL_BLOB_SHA = "fd149404f47410fb9f8d40e5b14c6f78af503c57" as const;
export const R23_ACCEPTED_R13_FEATURE_IMPLEMENTATION_BLOB_SHA = "0006678ef47a2c6adf1f6f91cb976dbcbee9caac" as const;

const LABEL_STATUSES = Object.freeze(["EXECUTED", "NO_ENTRY", "DATA_INCOMPLETE", "PERIOD_END_CENSORED"] as const);
type StatusCounts = Record<R13LabelStatus, number>;
type PerSymbolCounts = Record<ResearchSymbol, number>;

export type R23DevelopmentObservationMetadata = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R13Direction;
  primaryH4Status: R13LabelStatus;
  latencyH4Status: R13LabelStatus;
}>;

export type R23DevelopmentMetadataScan = Readonly<{
  metadataOnly: true;
  economicValuesRead: false;
  observationCount: number;
  perSymbolCounts: Readonly<PerSymbolCounts>;
  directionCounts: Readonly<Record<"LONG" | "SHORT", number>>;
  primaryH4StatusCounts: Readonly<StatusCounts>;
  latencyH4StatusCounts: Readonly<StatusCounts>;
  observationDataBytes: number;
  observationDataSha256: string;
  firstObservationId: string | null;
  lastObservationId: string | null;
  firstDecisionTime: number | null;
  lastDecisionTime: number | null;
  duplicateObservationIds: number;
  postBoundaryRows: number;
  beforeWindowRows: number;
  chronologyValid: true;
  requiredSymbolsComplete: boolean;
}>;

export type R23DevelopmentDataManifest = Readonly<{
  schemaVersion: "m3-r23-development-data-manifest-001";
  researchRoundId: "baseline-002-research-round-023";
  datasetId: string;
  sourcePolicy: "PUBLIC_HISTORICAL_SOURCE_ACQUISITION_ALLOWED";
  sourceStatus: "ACCEPTED_EXISTING_R14_OBSERVATION_FREEZE_REUSED";
  provider: "ACCEPTED_BINANCE_VISION_PUBLIC_ARCHIVE_LINEAGE";
  endpoints: readonly string[];
  dataTypes: readonly string[];
  symbols: readonly typeof R13_SYMBOLS[number][];
  directions: readonly ["LONG", "SHORT"];
  timeframe: "1h decision / 4h horizon";
  window: Readonly<{ start: string; end: string; eventTimeInclusive: true; postBoundaryDataRejected: true }>;
  acceptedSource: Readonly<{
    round: "R14";
    observationPath: typeof R23_ACCEPTED_R14_OBSERVATION_PATH;
    observationDataSha256: typeof R23_ACCEPTED_R14_OBSERVATION_SHA256;
    observationDataBytes: typeof R23_ACCEPTED_R14_OBSERVATION_BYTES;
    freezeManifestPath: typeof R23_ACCEPTED_R14_FREEZE_MANIFEST_PATH;
    freezeManifestFileSha256: typeof R23_ACCEPTED_R14_FREEZE_MANIFEST_FILE_SHA256;
    freezeManifestSha256: typeof R23_ACCEPTED_R14_FREEZE_MANIFEST_SHA256;
    freezeCommit: typeof R23_ACCEPTED_R14_FREEZE_COMMIT;
    freezeManifestBlobSha: typeof R23_ACCEPTED_R14_FREEZE_MANIFEST_BLOB_SHA;
  }>;
  normalizedObservationPath: typeof R23_DEVELOPMENT_DATA_PATH;
  rawDataset: Readonly<{
    datasetIdentitySha256: typeof R23_ACCEPTED_R13_DATASET_IDENTITY_SHA256;
    datasetFreezePath: typeof R23_ACCEPTED_R13_DATASET_FREEZE_PATH;
    datasetFreezeCommit: typeof R23_ACCEPTED_R13_DATASET_FREEZE_COMMIT;
    datasetFreezeBlobSha: typeof R23_ACCEPTED_R13_DATASET_FREEZE_BLOB_SHA;
    sourceManifestIdentitySha256: typeof R23_ACCEPTED_R13_SOURCE_MANIFEST_IDENTITY_SHA256;
    coarseCacheIdentitySha256: typeof R23_ACCEPTED_R13_COARSE_CACHE_IDENTITY_SHA256;
    archiveCount: 290;
  }>;
  counts: Readonly<{
    observations: number;
    perSymbol: Readonly<PerSymbolCounts>;
    perDirection: Readonly<Record<"LONG" | "SHORT", number>>;
    primaryH4Status: Readonly<StatusCounts>;
    latencyH4Status: Readonly<StatusCounts>;
  }>;
  earliestDecisionTime: number;
  latestDecisionTime: number;
  rawObservationSha256: typeof R23_ACCEPTED_R14_OBSERVATION_SHA256;
  normalizedObservationSha256: typeof R23_ACCEPTED_R14_OBSERVATION_SHA256;
  rawObservationBytes: typeof R23_ACCEPTED_R14_OBSERVATION_BYTES;
  normalizedObservationBytes: typeof R23_ACCEPTED_R14_OBSERVATION_BYTES;
  normalizationVersion: "R14_EXACT_R13_OBSERVATION_SCHEMA";
  featureSource: Readonly<{
    protocolPath: "src/lib/research/m3-r13-round-013-protocol.ts";
    protocolBlobSha: typeof R23_ACCEPTED_R13_FEATURE_PROTOCOL_BLOB_SHA;
    implementationPath: "src/lib/research/m3-r13-round-013-features.ts";
    implementationBlobSha: typeof R23_ACCEPTED_R13_FEATURE_IMPLEMENTATION_BLOB_SHA;
  }>;
  acquisitionTimestamp: string;
  acquisitionCodeSha256: string;
  networkAcquired: false;
  newHistoricalDevelopmentDataFetched: false;
  postBoundaryRows: 0;
  duplicateObservationIds: 0;
  noFutureInformationLeakage: true;
  decisionTimeBounded: true;
  fundingChronologyValidatedByAcceptedR14Freeze: true;
  pitValidation: Readonly<{
    informationAsOfBoundedByDecisionTime: true;
    settlementUsesAcceptedBtPolicy003: true;
    noFutureInformationLeakage: true;
  }>;
  integrity: "COMPLETE";
  integrityErrors: readonly [];
  frozen: true;
  manifestSha256: string;
}>;

const OBSERVATION_ID_MARKER = Buffer.from('"observationId":"', "utf8");
const DECISION_TIME_MARKER = Buffer.from('"decisionTime":', "utf8");
const SYMBOL_MARKER = Buffer.from('"symbol":"', "utf8");
const DIRECTION_MARKER = Buffer.from('"direction":"', "utf8");
const LABELS_H4_MARKER = Buffer.from('"labels":{"4":', "utf8");
const LATENCY_LABELS_H4_MARKER = Buffer.from('"latencyStressLabels":{"4":', "utf8");
const STATUS_MARKER = Buffer.from('"status":"', "utf8");

function emptyStatusCounts(): StatusCounts {
  return Object.fromEntries(LABEL_STATUSES.map((status) => [status, 0])) as StatusCounts;
}

function extractString(line: Buffer, marker: Buffer, lineNumber: number, from = 0): string {
  const markerStart = line.indexOf(marker, from);
  if (markerStart < 0) throw new Error(`R23 metadata line ${lineNumber} is missing ${marker.toString("utf8")}.`);
  const valueStart = markerStart + marker.length;
  const valueEnd = line.indexOf(0x22, valueStart);
  if (valueEnd < 0) throw new Error(`R23 metadata line ${lineNumber} has an unterminated string.`);
  return line.toString("utf8", valueStart, valueEnd);
}

function extractInteger(line: Buffer, marker: Buffer, lineNumber: number): number {
  const markerStart = line.indexOf(marker);
  if (markerStart < 0) throw new Error(`R23 metadata line ${lineNumber} is missing ${marker.toString("utf8")}.`);
  let cursor = markerStart + marker.length;
  const valueStart = cursor;
  while (cursor < line.length && line[cursor]! >= 0x30 && line[cursor]! <= 0x39) cursor += 1;
  if (cursor === valueStart) throw new Error(`R23 metadata line ${lineNumber} has an invalid integer.`);
  const value = Number(line.toString("utf8", valueStart, cursor));
  if (!Number.isSafeInteger(value)) throw new Error(`R23 metadata line ${lineNumber} has an unsafe timestamp.`);
  return value;
}

function extractSectionStatus(line: Buffer, sectionMarker: Buffer, lineNumber: number): R13LabelStatus {
  const sectionStart = line.indexOf(sectionMarker);
  if (sectionStart < 0) throw new Error(`R23 metadata line ${lineNumber} is missing ${sectionMarker.toString("utf8")}.`);
  const status = extractString(line, STATUS_MARKER, lineNumber, sectionStart + sectionMarker.length);
  if (!(LABEL_STATUSES as readonly string[]).includes(status)) throw new Error(`R23 metadata line ${lineNumber} has an invalid label status.`);
  return status as R13LabelStatus;
}

function parseMetadataLine(rawLine: Buffer, lineNumber: number): R23DevelopmentObservationMetadata {
  const line = rawLine.length > 0 && rawLine.at(-1) === 0x0d ? rawLine.subarray(0, rawLine.length - 1) : rawLine;
  if (line.length === 0) throw new Error(`R23 metadata line ${lineNumber} is empty.`);
  const observationId = extractString(line, OBSERVATION_ID_MARKER, lineNumber);
  const decisionTime = extractInteger(line, DECISION_TIME_MARKER, lineNumber);
  const symbol = extractString(line, SYMBOL_MARKER, lineNumber) as ResearchSymbol;
  const direction = extractString(line, DIRECTION_MARKER, lineNumber) as R13Direction;
  const primaryH4Status = extractSectionStatus(line, LABELS_H4_MARKER, lineNumber);
  const latencyH4Status = extractSectionStatus(line, LATENCY_LABELS_H4_MARKER, lineNumber);
  if (!R13_SYMBOLS.includes(symbol) || !["LONG", "SHORT"].includes(direction)) throw new Error(`R23 metadata line ${lineNumber} has an unsupported symbol or direction.`);
  if (observationId !== `${decisionTime}|${symbol}|${direction}`) throw new Error(`R23 metadata line ${lineNumber} has a non-canonical observation identity.`);
  return Object.freeze({ observationId, decisionTime, symbol, direction, primaryH4Status, latencyH4Status });
}

function compareMetadata(left: R23DevelopmentObservationMetadata, right: R23DevelopmentObservationMetadata): number {
  return left.decisionTime - right.decisionTime
    || R13_SYMBOLS.indexOf(left.symbol) - R13_SYMBOLS.indexOf(right.symbol)
    || (left.direction === "LONG" ? 0 : 1) - (right.direction === "LONG" ? 0 : 1);
}

export async function scanR23MetadataOnly(
  filePath: string,
  input: Readonly<{ startTime?: number; endTime?: number } > = {},
): Promise<R23DevelopmentMetadataScan> {
  const absolute = path.resolve(filePath);
  if (!existsSync(absolute)) throw new Error(`R23 development observation source is missing: ${absolute}`);
  const startTime = input.startTime ?? Date.parse(R23_DEVELOPMENT_DATA_START_ISO);
  const endTime = input.endTime ?? Date.parse(R23_DEVELOPMENT_DATA_END_ISO);
  if (!Number.isSafeInteger(startTime) || !Number.isSafeInteger(endTime) || endTime < startTime) throw new Error("R23 metadata scan window is invalid.");
  const perSymbol = Object.fromEntries(R13_SYMBOLS.map((symbol) => [symbol, 0])) as PerSymbolCounts;
  const directionCounts = { LONG: 0, SHORT: 0 } as Record<"LONG" | "SHORT", number>;
  const primaryH4StatusCounts = emptyStatusCounts();
  const latencyH4StatusCounts = emptyStatusCounts();
  const seen = new Set<string>();
  const digest = createHash("sha256");
  const stream = createReadStream(absolute, { highWaterMark: 8 * 1024 * 1024 });
  let pending = Buffer.alloc(0);
  let lineNumber = 0;
  let observationCount = 0;
  let duplicateObservationIds = 0;
  let postBoundaryRows = 0;
  let beforeWindowRows = 0;
  let previous: R23DevelopmentObservationMetadata | null = null;
  let first: R23DevelopmentObservationMetadata | null = null;
  let last: R23DevelopmentObservationMetadata | null = null;
  try {
    for await (const chunk of stream) {
      const buffer = chunk as Buffer;
      digest.update(buffer);
      const combined = pending.length === 0 ? buffer : Buffer.concat([pending, buffer]);
      let lineStart = 0;
      let lineEnd = combined.indexOf(0x0a, lineStart);
      while (lineEnd >= 0) {
        lineNumber += 1;
        const metadata = parseMetadataLine(combined.subarray(lineStart, lineEnd), lineNumber);
        if (previous && compareMetadata(previous, metadata) > 0) throw new Error(`R23 metadata chronology is not deterministic at line ${lineNumber}.`);
        if (seen.has(metadata.observationId)) duplicateObservationIds += 1;
        seen.add(metadata.observationId);
        if (metadata.decisionTime > endTime) postBoundaryRows += 1;
        if (metadata.decisionTime < startTime) beforeWindowRows += 1;
        perSymbol[metadata.symbol] += 1;
        directionCounts[metadata.direction] += 1;
        primaryH4StatusCounts[metadata.primaryH4Status] += 1;
        latencyH4StatusCounts[metadata.latencyH4Status] += 1;
        observationCount += 1;
        first ??= metadata;
        last = metadata;
        previous = metadata;
        lineStart = lineEnd + 1;
        lineEnd = combined.indexOf(0x0a, lineStart);
      }
      pending = lineStart < combined.length ? Buffer.from(combined.subarray(lineStart)) : Buffer.alloc(0);
    }
    if (pending.length > 0) {
      lineNumber += 1;
      const metadata = parseMetadataLine(pending, lineNumber);
      if (previous && compareMetadata(previous, metadata) > 0) throw new Error(`R23 metadata chronology is not deterministic at line ${lineNumber}.`);
      if (seen.has(metadata.observationId)) duplicateObservationIds += 1;
      seen.add(metadata.observationId);
      if (metadata.decisionTime > endTime) postBoundaryRows += 1;
      if (metadata.decisionTime < startTime) beforeWindowRows += 1;
      perSymbol[metadata.symbol] += 1;
      directionCounts[metadata.direction] += 1;
      primaryH4StatusCounts[metadata.primaryH4Status] += 1;
      latencyH4StatusCounts[metadata.latencyH4Status] += 1;
      observationCount += 1;
      first ??= metadata;
      last = metadata;
    }
  } finally {
    stream.destroy();
  }
  const observationDataBytes = statSync(absolute).size;
  if (duplicateObservationIds > 0) throw new Error(`R23 metadata source contains ${duplicateObservationIds} duplicate observation identities.`);
  if (postBoundaryRows > 0) throw new Error(`R23 metadata source contains ${postBoundaryRows} post-boundary rows.`);
  if (beforeWindowRows > 0) throw new Error(`R23 metadata source contains ${beforeWindowRows} pre-window rows.`);
  const requiredSymbolsComplete = R13_SYMBOLS.every((symbol) => perSymbol[symbol] > 0);
  if (!requiredSymbolsComplete) throw new Error("R23 metadata source is missing a required symbol.");
  return Object.freeze({
    metadataOnly: true,
    economicValuesRead: false,
    observationCount,
    perSymbolCounts: Object.freeze(perSymbol),
    directionCounts: Object.freeze(directionCounts),
    primaryH4StatusCounts: Object.freeze(primaryH4StatusCounts),
    latencyH4StatusCounts: Object.freeze(latencyH4StatusCounts),
    observationDataBytes,
    observationDataSha256: digest.digest("hex"),
    firstObservationId: first?.observationId ?? null,
    lastObservationId: last?.observationId ?? null,
    firstDecisionTime: first?.decisionTime ?? null,
    lastDecisionTime: last?.decisionTime ?? null,
    duplicateObservationIds,
    postBoundaryRows,
    beforeWindowRows,
    chronologyValid: true,
    requiredSymbolsComplete,
  });
}

export function locateR23DevelopmentDataSource(root = process.cwd()): string | null {
  const resolvedRoot = path.resolve(root);
  const candidates = [
    process.env.TRADEPULSE_R23_SOURCE_OBSERVATION_FILE,
    path.join(resolvedRoot, R23_DEVELOPMENT_DATA_PATH),
    path.join(resolvedRoot, R23_ACCEPTED_R14_OBSERVATION_PATH),
    path.resolve(resolvedRoot, "..", "round-014-r13-execution-replay", R23_ACCEPTED_R14_OBSERVATION_PATH),
  ].filter((value): value is string => typeof value === "string" && value.length > 0);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

export function materializeR23DevelopmentDataPath(root: string, sourcePath: string): string {
  const target = path.resolve(root, R23_DEVELOPMENT_DATA_PATH);
  if (existsSync(target)) return target;
  mkdirSync(path.dirname(target), { recursive: true });
  linkSync(path.resolve(sourcePath), target);
  return target;
}

function manifestHash(value: Readonly<Record<string, unknown>>): string {
  return createHash("sha256").update(stableStringify(value), "utf8").digest("hex");
}

export function buildR23DevelopmentDataManifest(input: Readonly<{
  scan: R23DevelopmentMetadataScan;
  acquisitionTimestamp: string;
  acquisitionCodeSha256: string;
}>): R23DevelopmentDataManifest {
  const { scan } = input;
  if (scan.observationDataSha256 !== R23_ACCEPTED_R14_OBSERVATION_SHA256 || scan.observationDataBytes !== R23_ACCEPTED_R14_OBSERVATION_BYTES) throw new Error("R23 source does not match the accepted R14 observation identity.");
  if (scan.observationCount !== 244810 || scan.directionCounts.LONG !== 122405 || scan.directionCounts.SHORT !== 122405) throw new Error("R23 source metadata count does not match the accepted R14 freeze.");
  const raw: Omit<R23DevelopmentDataManifest, "manifestSha256"> = {
    schemaVersion: "m3-r23-development-data-manifest-001",
    researchRoundId: "baseline-002-research-round-023",
    datasetId: `r23-r14-r13-h4-${R23_ACCEPTED_R14_OBSERVATION_SHA256.slice(0, 16)}`,
    sourcePolicy: "PUBLIC_HISTORICAL_SOURCE_ACQUISITION_ALLOWED",
    sourceStatus: "ACCEPTED_EXISTING_R14_OBSERVATION_FREEZE_REUSED",
    provider: "ACCEPTED_BINANCE_VISION_PUBLIC_ARCHIVE_LINEAGE",
    endpoints: Object.freeze([
      "https://data.binance.vision/data/futures/um/daily/klines/{symbol}/",
      "https://data.binance.vision/data/futures/um/daily/fundingRate/{symbol}/",
      "https://data.binance.vision/data/futures/um/daily/markPriceKlines/{symbol}/",
    ]),
    dataTypes: Object.freeze(["R13_FEATURE_VECTOR", "BT_POLICY_003_H4_SETTLEMENT_LABEL", "BT_POLICY_003_H4_LATENCY_STRESS_LABEL"]),
    symbols: R13_SYMBOLS,
    directions: ["LONG", "SHORT"],
    timeframe: "1h decision / 4h horizon",
    window: { start: R23_DEVELOPMENT_DATA_START_ISO, end: R23_DEVELOPMENT_DATA_END_ISO, eventTimeInclusive: true, postBoundaryDataRejected: true },
    acceptedSource: {
      round: "R14",
      observationPath: R23_ACCEPTED_R14_OBSERVATION_PATH,
      observationDataSha256: R23_ACCEPTED_R14_OBSERVATION_SHA256,
      observationDataBytes: R23_ACCEPTED_R14_OBSERVATION_BYTES,
      freezeManifestPath: R23_ACCEPTED_R14_FREEZE_MANIFEST_PATH,
      freezeManifestFileSha256: R23_ACCEPTED_R14_FREEZE_MANIFEST_FILE_SHA256,
      freezeManifestSha256: R23_ACCEPTED_R14_FREEZE_MANIFEST_SHA256,
      freezeCommit: R23_ACCEPTED_R14_FREEZE_COMMIT,
      freezeManifestBlobSha: R23_ACCEPTED_R14_FREEZE_MANIFEST_BLOB_SHA,
    },
    normalizedObservationPath: R23_DEVELOPMENT_DATA_PATH,
    rawDataset: {
      datasetIdentitySha256: R23_ACCEPTED_R13_DATASET_IDENTITY_SHA256,
      datasetFreezePath: R23_ACCEPTED_R13_DATASET_FREEZE_PATH,
      datasetFreezeCommit: R23_ACCEPTED_R13_DATASET_FREEZE_COMMIT,
      datasetFreezeBlobSha: R23_ACCEPTED_R13_DATASET_FREEZE_BLOB_SHA,
      sourceManifestIdentitySha256: R23_ACCEPTED_R13_SOURCE_MANIFEST_IDENTITY_SHA256,
      coarseCacheIdentitySha256: R23_ACCEPTED_R13_COARSE_CACHE_IDENTITY_SHA256,
      archiveCount: 290,
    },
    counts: {
      observations: scan.observationCount,
      perSymbol: scan.perSymbolCounts,
      perDirection: scan.directionCounts,
      primaryH4Status: scan.primaryH4StatusCounts,
      latencyH4Status: scan.latencyH4StatusCounts,
    },
    earliestDecisionTime: scan.firstDecisionTime!,
    latestDecisionTime: scan.lastDecisionTime!,
    rawObservationSha256: R23_ACCEPTED_R14_OBSERVATION_SHA256,
    normalizedObservationSha256: scan.observationDataSha256 as typeof R23_ACCEPTED_R14_OBSERVATION_SHA256,
    rawObservationBytes: R23_ACCEPTED_R14_OBSERVATION_BYTES,
    normalizedObservationBytes: scan.observationDataBytes as typeof R23_ACCEPTED_R14_OBSERVATION_BYTES,
    normalizationVersion: "R14_EXACT_R13_OBSERVATION_SCHEMA",
    featureSource: {
      protocolPath: "src/lib/research/m3-r13-round-013-protocol.ts",
      protocolBlobSha: R23_ACCEPTED_R13_FEATURE_PROTOCOL_BLOB_SHA,
      implementationPath: "src/lib/research/m3-r13-round-013-features.ts",
      implementationBlobSha: R23_ACCEPTED_R13_FEATURE_IMPLEMENTATION_BLOB_SHA,
    },
    acquisitionTimestamp: input.acquisitionTimestamp,
    acquisitionCodeSha256: input.acquisitionCodeSha256,
    networkAcquired: false,
    newHistoricalDevelopmentDataFetched: false,
    postBoundaryRows: scan.postBoundaryRows as 0,
    duplicateObservationIds: scan.duplicateObservationIds as 0,
    noFutureInformationLeakage: true,
    decisionTimeBounded: true,
    fundingChronologyValidatedByAcceptedR14Freeze: true,
    pitValidation: { informationAsOfBoundedByDecisionTime: true, settlementUsesAcceptedBtPolicy003: true, noFutureInformationLeakage: true },
    integrity: "COMPLETE",
    integrityErrors: [],
    frozen: true,
  };
  return Object.freeze({ ...raw, manifestSha256: manifestHash({ ...raw, manifestSha256: null }) });
}

export function acceptedR23R14Identity(): Readonly<{ path: typeof R23_ACCEPTED_R14_OBSERVATION_PATH; sha256: typeof R23_ACCEPTED_R14_OBSERVATION_SHA256; bytes: typeof R23_ACCEPTED_R14_OBSERVATION_BYTES }> {
  return Object.freeze({ path: R23_ACCEPTED_R14_OBSERVATION_PATH, sha256: R23_ACCEPTED_R14_OBSERVATION_SHA256, bytes: R23_ACCEPTED_R14_OBSERVATION_BYTES });
}
