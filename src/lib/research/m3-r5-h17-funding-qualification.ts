import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, mkdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { checksumFunding } from "../historical-data/checksum.ts";
import type { HistoricalFundingPagination, HistoricalFundingRecord } from "../historical-data/types.ts";
import {
  M3_R5_RESEARCH_END_ISO,
  M3_R5_RESEARCH_ROUND_ID,
  M3_R5_RESEARCH_RANGE,
  M3_R5_RESEARCH_START_ISO,
  canonicalFundingSlots,
} from "./m3-r5-round-005-protocol.ts";

export const M3_R5_H17_QUALIFICATION_SCHEMA_VERSION = "m3-r5-h17-data-qualification-001" as const;
export const M3_R5_H17_OUTPUT_PATHS = Object.freeze({
  json: "docs/evidence/M3_R5_H17_DATA_QUALIFICATION.json",
  markdown: "docs/M3_R5_H17_DATA_QUALIFICATION.md",
});
export const M3_R5_H17_STAGING_PREFIX = ".tradepulse-m3-r5-h17-";

export type H17QualificationStatus = "COMPLETE" | "DATA_NOT_AVAILABLE";

export type H17FundingManifestProvenance = Readonly<{
  kind: "funding";
  provider: "binance-usdm-public";
  source: "/fapi/v1/fundingRate";
  symbol: ResearchSymbol;
  requestedStartTime: number;
  requestedEndTime: number;
  actualStartTime: number | null;
  actualEndTime: number | null;
  rowCount: number;
  sha256: string;
}>;

export type H17QualificationInput = Readonly<{
  symbol: ResearchSymbol;
  records: readonly HistoricalFundingRecord[];
  pagination: HistoricalFundingPagination;
  manifest: H17FundingManifestProvenance;
}>;

export type H17SymbolQualification = Readonly<{
  symbol: ResearchSymbol;
  requestedStartTime: number;
  requestedEndTime: number;
  expectedCanonicalSlotCount: number;
  observedCanonicalSlotCount: number;
  missingCanonicalSlotCount: number;
  missingCanonicalSlots: readonly number[];
  duplicateSlotCount: number;
  duplicateSlots: readonly number[];
  extraNonCanonicalCount: number;
  firstObservedFundingTime: number | null;
  lastObservedFundingTime: number | null;
  sourceChronological: boolean;
  paginationComplete: boolean;
  pageCount: number;
  terminationReason: HistoricalFundingPagination["terminationReason"];
  manifestChecksumVerified: boolean;
  manifestSha256: string;
  qualificationStatus: "PASS" | "DATA_NOT_AVAILABLE";
}>;

export type H17QualificationReport = Readonly<{
  schemaVersion: typeof M3_R5_H17_QUALIFICATION_SCHEMA_VERSION;
  researchRoundId: typeof M3_R5_RESEARCH_ROUND_ID;
  sourceSha: string;
  requestedStartTime: number;
  requestedEndTime: number;
  requestedStartIso: typeof M3_R5_RESEARCH_START_ISO;
  requestedEndIso: typeof M3_R5_RESEARCH_END_ISO;
  qualificationStatus: H17QualificationStatus;
  h17DataQualification: "PASS" | "DATA_NOT_AVAILABLE";
  symbols: readonly H17SymbolQualification[];
}>;

function isSha256(value: string): boolean {
  return /^[0-9a-f]{64}$/u.test(value);
}

function manifestChecksumVerified(input: H17QualificationInput): boolean {
  try {
    return checksumFunding(input.records) === input.manifest.sha256;
  } catch {
    return false;
  }
}

function manifestIsValid(input: H17QualificationInput, startTime: number, endTime: number): boolean {
  const manifest = input.manifest;
  return (
    manifest.kind === "funding" &&
    manifest.provider === "binance-usdm-public" &&
    manifest.source === "/fapi/v1/fundingRate" &&
    manifest.symbol === input.symbol &&
    manifest.requestedStartTime === startTime &&
    manifest.requestedEndTime === endTime &&
    Number.isInteger(manifest.rowCount) &&
    manifest.rowCount === input.records.length &&
    isSha256(manifest.sha256) &&
    manifestChecksumVerified(input)
  );
}

function assertPaginationComplete(input: H17QualificationInput, startTime: number, endTime: number): void {
  const pagination = input.pagination;
  const firstRecord = input.records[0]?.fundingTime ?? null;
  const lastRecord = input.records[input.records.length - 1]?.fundingTime ?? null;
  const validTerminationReason = ["EMPTY_PAGE", "SHORT_PAGE", "END_TIME_REACHED"].includes(pagination.terminationReason);
  const validCursor = Number.isInteger(pagination.finalCursor) && pagination.finalCursor >= startTime;
  const recordTimesAreWellFormed = input.records.every((record) => Number.isInteger(record.fundingTime) && record.fundingTime >= 0);
  const recordsMatchProvenance = !recordTimesAreWellFormed || (
    pagination.firstReturnedFundingTime === firstRecord &&
    pagination.lastReturnedFundingTime === lastRecord &&
    (lastRecord === null || pagination.finalCursor > lastRecord)
  );
  if (
    pagination.paginationComplete !== true ||
    !Number.isInteger(pagination.pageCount) ||
    pagination.pageCount < 1 ||
    pagination.requestedStartTime !== startTime ||
    pagination.requestedEndTime !== endTime ||
    !validTerminationReason ||
    !validCursor ||
    !recordsMatchProvenance
  ) {
    throw new Error(`RETRIEVAL_ABORT: H17 funding pagination provenance is incomplete or inconsistent for ${input.symbol}.`);
  }
}

function symbolQualification(input: H17QualificationInput, startTime: number, endTime: number): H17SymbolQualification {
  const expectedSlots = canonicalFundingSlots(startTime, endTime);
  const expected = new Set(expectedSlots);
  const seen = new Set<number>();
  const duplicateSlots = new Set<number>();
  const observedCanonical = new Set<number>();
  let sourceChronological = true;
  let malformed = false;
  let previousTime: number | null = null;
  const observedTimes: number[] = [];
  let extraNonCanonicalCount = 0;

  for (const record of input.records) {
    const validTime = Number.isInteger(record.fundingTime) && record.fundingTime >= 0;
    const validRate = typeof record.fundingRate === "number" && Number.isFinite(record.fundingRate);
    if (!validTime || !validRate || record.symbol !== input.symbol) {
      malformed = true;
      continue;
    }
    observedTimes.push(record.fundingTime);
    if (previousTime !== null && record.fundingTime <= previousTime) sourceChronological = false;
    previousTime = record.fundingTime;
    if (seen.has(record.fundingTime)) duplicateSlots.add(record.fundingTime);
    seen.add(record.fundingTime);
    if (expected.has(record.fundingTime)) observedCanonical.add(record.fundingTime);
    else extraNonCanonicalCount += 1;
  }

  const missingCanonicalSlots = expectedSlots.filter((timestamp) => !observedCanonical.has(timestamp));
  const firstObservedFundingTime = observedTimes.length > 0 ? observedTimes[0]! : null;
  const lastObservedFundingTime = observedTimes.length > 0 ? observedTimes[observedTimes.length - 1]! : null;
  const status =
    !malformed &&
    sourceChronological &&
    manifestIsValid(input, startTime, endTime) &&
    missingCanonicalSlots.length === 0 &&
    duplicateSlots.size === 0
      ? "PASS"
      : "DATA_NOT_AVAILABLE";

  return Object.freeze({
    symbol: input.symbol,
    requestedStartTime: startTime,
    requestedEndTime: endTime,
    expectedCanonicalSlotCount: expectedSlots.length,
    observedCanonicalSlotCount: observedCanonical.size,
    missingCanonicalSlotCount: missingCanonicalSlots.length,
    missingCanonicalSlots: Object.freeze(missingCanonicalSlots),
    duplicateSlotCount: duplicateSlots.size,
    duplicateSlots: Object.freeze([...duplicateSlots].sort((a, b) => a - b)),
    extraNonCanonicalCount,
    firstObservedFundingTime,
    lastObservedFundingTime,
    sourceChronological,
    paginationComplete: input.pagination.paginationComplete,
    pageCount: input.pagination.pageCount,
    terminationReason: input.pagination.terminationReason,
    manifestChecksumVerified: manifestChecksumVerified(input),
    manifestSha256: input.manifest.sha256,
    qualificationStatus: status,
  });
}

export function qualifyH17FundingUniverse(input: Readonly<{
  startTime: number;
  endTime: number;
  symbols: readonly H17QualificationInput[];
}>): readonly H17SymbolQualification[] {
  if (input.symbols.length !== RESEARCH_SYMBOLS.length) throw new Error("H17 qualification requires all five research symbols.");
  const seen = new Set<ResearchSymbol>();
  const result = input.symbols.map((symbolInput) => {
    if (seen.has(symbolInput.symbol)) throw new Error(`H17 qualification duplicated symbol: ${symbolInput.symbol}`);
    seen.add(symbolInput.symbol);
    assertPaginationComplete(symbolInput, input.startTime, input.endTime);
    return symbolQualification(symbolInput, input.startTime, input.endTime);
  });
  if (seen.size !== RESEARCH_SYMBOLS.length || RESEARCH_SYMBOLS.some((symbol) => !seen.has(symbol))) {
    throw new Error("H17 qualification did not cover the complete research universe.");
  }
  return Object.freeze(RESEARCH_SYMBOLS.map((symbol) => result.find((item) => item.symbol === symbol)!));
}

export function createH17QualificationReport(input: Readonly<{
  sourceSha: string;
  researchRoundId: string;
  startTime: number;
  endTime: number;
  symbols: readonly H17QualificationInput[];
}>): H17QualificationReport {
  if (input.researchRoundId !== M3_R5_RESEARCH_ROUND_ID) throw new Error("H17 research round mismatch.");
  if (input.startTime !== M3_R5_RESEARCH_RANGE.startTime || input.endTime !== M3_R5_RESEARCH_RANGE.endTime) throw new Error("H17 research range mismatch.");
  if (!/^[0-9a-f]{40}$/u.test(input.sourceSha)) throw new Error("H17 source SHA must be a lowercase 40-character Git SHA.");
  const symbols = qualifyH17FundingUniverse({ startTime: input.startTime, endTime: input.endTime, symbols: input.symbols });
  const complete = symbols.every((symbol) => symbol.qualificationStatus === "PASS");
  return Object.freeze({
    schemaVersion: M3_R5_H17_QUALIFICATION_SCHEMA_VERSION,
    researchRoundId: M3_R5_RESEARCH_ROUND_ID,
    sourceSha: input.sourceSha,
    requestedStartTime: input.startTime,
    requestedEndTime: input.endTime,
    requestedStartIso: M3_R5_RESEARCH_START_ISO,
    requestedEndIso: M3_R5_RESEARCH_END_ISO,
    qualificationStatus: complete ? "COMPLETE" : "DATA_NOT_AVAILABLE",
    h17DataQualification: complete ? "PASS" : "DATA_NOT_AVAILABLE",
    symbols,
  });
}

export function serializeH17QualificationReport(report: H17QualificationReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}

export function renderH17QualificationMarkdown(report: H17QualificationReport, jsonSha256: string): string {
  const rows = report.symbols.map((symbol) =>
    `| ${symbol.symbol} | ${symbol.qualificationStatus} | ${symbol.expectedCanonicalSlotCount} | ${symbol.observedCanonicalSlotCount} | ${symbol.missingCanonicalSlotCount} | ${symbol.duplicateSlotCount} | ${symbol.extraNonCanonicalCount} |`,
  );
  return [
    "# M3-R5 H17 Funding Data Qualification",
    "",
    `- researchRoundId: \`${report.researchRoundId}\``,
    `- requested range: \`${report.requestedStartIso}\` .. \`${report.requestedEndIso}\``,
    `- qualificationStatus: **${report.qualificationStatus}**`,
    `- H17_DATA_QUALIFICATION: **${report.h17DataQualification}**`,
    `- sourceSha: \`${report.sourceSha}\``,
    `- summary JSON SHA-256: \`${jsonSha256}\``,
    "",
    "No funding-rate values or distribution statistics are included in this qualification artifact.",
    "",
    "| Symbol | Status | Expected canonical slots | Observed canonical slots | Missing | Duplicate | Extra noncanonical |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
    ...rows,
    "",
  ].join("\n");
}

export function h17QualificationRawSha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function assertH17QualificationPreflight(input: Readonly<{
  headSha: string;
  requestedSourceSha: string;
  round: string;
  startTime: number;
  endTime: number;
  cleanWorktree: boolean;
  existingOutputArtifacts: readonly string[];
  confirmAuthoritativeQualification: boolean;
}>): void {
  if (!input.confirmAuthoritativeQualification) throw new Error("--confirm-authoritative-qualification is required; no network access was attempted.");
  if (input.headSha !== input.requestedSourceSha) throw new Error("H17 qualification source SHA does not match current HEAD.");
  if (!/^[0-9a-f]{40}$/u.test(input.requestedSourceSha)) throw new Error("H17 source SHA must be a lowercase 40-character Git SHA.");
  if (input.round !== M3_R5_RESEARCH_ROUND_ID) throw new Error("Unknown H17 research round.");
  if (input.startTime !== M3_R5_RESEARCH_RANGE.startTime || input.endTime !== M3_R5_RESEARCH_RANGE.endTime) throw new Error("H17 qualification range is not the frozen Round-005 range.");
  if (!input.cleanWorktree) throw new Error("H17 qualification requires a clean worktree before network access.");
  if (input.existingOutputArtifacts.length > 0) throw new Error("H17 qualification outputs already exist; refusing overwrite.");
}

export function h17QualificationStagingPrefix(jsonPath: string): string {
  return path.join(path.dirname(jsonPath), M3_R5_H17_STAGING_PREFIX);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function publicationFailureWithRollbackErrors(publicationError: unknown, rollbackErrors: readonly unknown[]): Error {
  return new Error(
    `M3-R5 H17 publication failed: ${errorMessage(publicationError)}; rollback failed: ${rollbackErrors.map(errorMessage).join("; ")}`,
    { cause: publicationError },
  );
}

export function publishH17QualificationArtifactsAtomically(input: Readonly<{
  jsonPath: string;
  markdownPath: string;
  jsonBytes: Uint8Array;
  markdownBytes: Uint8Array;
  renameFile?: typeof renameSync;
  onStagingDirectory?: (directory: string) => void;
}>): void {
  const destinations = [input.markdownPath, input.jsonPath];
  if (destinations.some((destination) => existsSync(destination))) throw new Error("M3-R5 H17 output already exists; refusing overwrite.");
  mkdirSync(path.dirname(input.jsonPath), { recursive: true });
  mkdirSync(path.dirname(input.markdownPath), { recursive: true });
  const stagingDirectory = mkdtempSync(h17QualificationStagingPrefix(input.jsonPath));
  input.onStagingDirectory?.(stagingDirectory);
  const stagingPaths = [
    path.join(stagingDirectory, path.basename(input.markdownPath)),
    path.join(stagingDirectory, path.basename(input.jsonPath)),
  ];
  const renameFile = input.renameFile ?? renameSync;
  const published: string[] = [];
  try {
    writeFileSync(stagingPaths[0]!, input.markdownBytes);
    writeFileSync(stagingPaths[1]!, input.jsonBytes);
    for (let index = 0; index < destinations.length; index += 1) {
      const destination = destinations[index]!;
      if (existsSync(destination)) throw new Error(`M3-R5 H17 output appeared during publication; refusing overwrite: ${destination}`);
      renameFile(stagingPaths[index]!, destination);
      published.push(destination);
    }
  } catch (publicationError) {
    const rollbackErrors: unknown[] = [];
    for (const destination of [...published].reverse()) {
      try {
        rmSync(destination, { force: true });
      } catch (rollbackError) {
        rollbackErrors.push(rollbackError);
      }
    }
    try {
      rmSync(stagingDirectory, { recursive: true, force: true });
    } catch (cleanupError) {
      rollbackErrors.push(cleanupError);
    }
    if (rollbackErrors.length > 0) throw publicationFailureWithRollbackErrors(publicationError, rollbackErrors);
    throw publicationError;
  }
  rmSync(stagingDirectory, { recursive: true, force: true });
}
