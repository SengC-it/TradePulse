import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { StringDecoder } from "node:string_decoder";

import { R17_DIRECTIONS, R17_SYMBOLS, type R17Direction, type R17Symbol } from "./m3-r17-round-017-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R17_SETTLEMENT_IDENTITY_AUDIT_SCHEMA_VERSION = "m3-r17-round-017-settlement-identity-audit-001" as const;
export const R17_G01_DATA_COMPLETENESS_FAILURE = "ROUND-017 PERFORMANCE INELIGIBLE — DATA COMPLETENESS" as const;

export const R17_SETTLEMENT_SOURCE_KINDS = Object.freeze([
  "R13_OBSERVATION_CACHE",
  "R14_OBSERVATION_CACHE",
  "R15_OBSERVATION_CACHE",
  "R16_OBSERVATION_CACHE",
] as const);
export type R17SettlementSourceKind = (typeof R17_SETTLEMENT_SOURCE_KINDS)[number];

export type R17SettlementSourceStatus =
  | "ACCEPTED_EXISTING_HISTORICAL_CACHE"
  | "MISSING_SOURCE"
  | "INVALID_PROVENANCE"
  | "NETWORK_ACQUIRED"
  | "RECONSTRUCTED";

export type R17SettlementMatchMode =
  | "EXACT_CANONICAL_IDENTITY"
  | "FUZZY_TIMESTAMP"
  | "NEAREST_TIMESTAMP";

export type R17FormalIdentityInput = Readonly<{
  canonicalIdentity: string;
  formalSourceStatus: "ACCEPTED_BASELINE_001_FORMAL_STREAM" | "INCOMPLETE";
  formalSourcePath: string;
  formalSourceSha256: string;
}>;

export type R17SettlementIdentitySource = Readonly<{
  sourceKind: R17SettlementSourceKind;
  sourcePath: string;
  sourceSha256: string;
  sourceStatus: R17SettlementSourceStatus;
  matchMode: R17SettlementMatchMode;
  networkAcquired: boolean;
  reconstructed: boolean;
  sourceRecordCount: number;
  identityCount: number;
  labelIdentityCount: number;
  duplicateIdentityCount: number;
  invalidIdentityRecordCount: number;
  identityIds: ReadonlySet<string>;
  labelIdentityIds: ReadonlySet<string>;
}>;

export type R17SettlementIdentityMatrixRow = Readonly<{
  canonicalIdentity: string;
  formalProvenanceValid: boolean;
  r14ObservationIdentityPresent: boolean;
  acceptedSettlementLabelIdentityPresent: boolean;
  acceptedSettlementSources: readonly Readonly<{
    sourceKind: R17SettlementSourceKind;
    sourcePath: string;
    sourceSha256: string;
  }>[];
  settlementSourceStatus: R17SettlementSourceStatus | "NO_MATCHING_SOURCE";
  classification:
    | "FORMAL_AND_ACCEPTED_LABEL_IDENTITY_COMPLETE"
    | "FORMAL_COMPLETE_R14_OBSERVATION_ID_MISSING_BUT_OTHER_ACCEPTED_LABEL_IDENTITY_EXISTS"
    | "FORMAL_COMPLETE_NO_ACCEPTED_SETTLEMENT_LABEL_IDENTITY"
    | "FORMAL_SOURCE_PROVENANCE_INCOMPLETE"
    | "OTHER_ANOMALY";
  anomalyCodes: readonly string[];
}>;

export type R17SettlementIdentityAuditSummary = Readonly<{
  schemaVersion: typeof R17_SETTLEMENT_IDENTITY_AUDIT_SCHEMA_VERSION;
  formalCount: number;
  categoryCounts: Readonly<{
    FORMAL_AND_ACCEPTED_LABEL_IDENTITY_COMPLETE: number;
    FORMAL_COMPLETE_R14_OBSERVATION_ID_MISSING_BUT_OTHER_ACCEPTED_LABEL_IDENTITY_EXISTS: number;
    FORMAL_COMPLETE_NO_ACCEPTED_SETTLEMENT_LABEL_IDENTITY: number;
    FORMAL_SOURCE_PROVENANCE_INCOMPLETE: number;
    OTHER_ANOMALY: number;
  }>;
  partitionTotal: number;
  acceptedSettlementLabelIdentityCompleteCount: number;
  trueMissingRequiredLabelCount: number;
  trueMissingFormalProvenanceCount: number;
  r14ObservationIdentityMissingCount: number;
  r14OnlyIdentityMissingCount: number;
  sourceProvenanceAnomalyCount: number;
  g01DataComplete: boolean;
  g01Failure: typeof R17_G01_DATA_COMPLETENESS_FAILURE | null;
  labelValuesRead: false;
  economicFieldsRead: false;
  matrixSha256: string;
  sources: readonly Readonly<{
    sourceKind: R17SettlementSourceKind;
    sourcePath: string;
    sourceSha256: string;
    sourceStatus: R17SettlementSourceStatus;
    sourceRecordCount: number;
    identityCount: number;
    labelIdentityCount: number;
    matchedFormalIdentityCount: number;
    duplicateIdentityCount: number;
    invalidIdentityRecordCount: number;
  }>[];
}>;

export type R17SettlementIdentityAudit = Readonly<{
  summary: R17SettlementIdentityAuditSummary;
  matrix: readonly R17SettlementIdentityMatrixRow[];
}>;

export type R17SettlementIdentitySourceScanSpec = Readonly<{
  sourceKind: R17SettlementSourceKind;
  sourcePath: string;
  filePath: string;
  identityKey: "observationId" | "signalId";
  labelKeys: readonly string[];
  sourceStatus: R17SettlementSourceStatus;
  matchMode: R17SettlementMatchMode;
  networkAcquired: boolean;
  reconstructed: boolean;
  expectedSha256?: string;
}>;

function copyString(value: string): string {
  // Do not retain a full NDJSON line through a substring stored in a Set.
  return Buffer.from(value, "utf8").toString("utf8");
}

function stringField(line: string, key: string): string | null {
  const match = line.match(new RegExp(`\\"${key}\\"\\s*:\\s*\\"((?:\\\\.|[^\\"\\\\])*)\\"`));
  return match?.[1] === undefined ? null : copyString(match[1]);
}

function hasJsonKey(line: string, key: string): boolean {
  return new RegExp(`\\"${key}\\"\\s*:`).test(line);
}

function readLinesIdentityOnly(
  filePath: string,
  onLine: (line: string) => void,
): Promise<Readonly<{ bytes: number; sha256: string }>> {
  return new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    const decoder = new StringDecoder("utf8");
    const digest = createHash("sha256");
    const newline = String.fromCharCode(10);
    const carriageReturn = String.fromCharCode(13);
    let buffered = "";
    let bytes = 0;

    const consume = (line: string): void => {
      onLine(line.endsWith(carriageReturn) ? line.slice(0, -1) : line);
    };

    stream.on("data", (chunk: Buffer) => {
      digest.update(chunk);
      bytes += chunk.byteLength;
      buffered += decoder.write(chunk);
      let separator = buffered.indexOf(newline);
      while (separator >= 0) {
        consume(buffered.slice(0, separator));
        buffered = buffered.slice(separator + 1);
        separator = buffered.indexOf(newline);
      }
    });
    stream.on("end", () => {
      buffered += decoder.end();
      if (buffered.length > 0) consume(buffered);
      resolve(Object.freeze({ bytes, sha256: digest.digest("hex") }));
    });
    stream.on("error", reject);
  });
}

export async function scanR17SettlementIdentitySource(
  spec: R17SettlementIdentitySourceScanSpec,
): Promise<R17SettlementIdentitySource> {
  const identityIds = new Set<string>();
  const labelIdentityIds = new Set<string>();
  let sourceRecordCount = 0;
  let duplicateIdentityCount = 0;
  let invalidIdentityRecordCount = 0;

  let digest: Readonly<{ bytes: number; sha256: string }>;
  try {
    digest = await readLinesIdentityOnly(spec.filePath, (line) => {
      sourceRecordCount += 1;
      if (line.length === 0) {
        invalidIdentityRecordCount += 1;
        return;
      }
      const identity = stringField(line, spec.identityKey);
      if (identity === null || identity.length === 0) {
        invalidIdentityRecordCount += 1;
        return;
      }
      if (identityIds.has(identity)) duplicateIdentityCount += 1;
      identityIds.add(identity);
      if (spec.labelKeys.length > 0 && spec.labelKeys.every((key) => hasJsonKey(line, key))) labelIdentityIds.add(identity);
    });
  } catch {
    return Object.freeze({
      sourceKind: spec.sourceKind,
      sourcePath: spec.sourcePath,
      sourceSha256: "",
      sourceStatus: "MISSING_SOURCE",
      matchMode: spec.matchMode,
      networkAcquired: spec.networkAcquired,
      reconstructed: spec.reconstructed,
      sourceRecordCount,
      identityCount: identityIds.size,
      labelIdentityCount: labelIdentityIds.size,
      duplicateIdentityCount,
      invalidIdentityRecordCount,
      identityIds,
      labelIdentityIds,
    });
  }

  const sourceStatus = spec.sourceStatus === "ACCEPTED_EXISTING_HISTORICAL_CACHE"
    && spec.expectedSha256 !== undefined
    && spec.expectedSha256 !== digest.sha256
    ? "INVALID_PROVENANCE"
    : spec.sourceStatus;
  return Object.freeze({
    sourceKind: spec.sourceKind,
    sourcePath: spec.sourcePath,
    sourceSha256: digest.sha256,
    sourceStatus,
    matchMode: spec.matchMode,
    networkAcquired: spec.networkAcquired,
    reconstructed: spec.reconstructed,
    sourceRecordCount,
    identityCount: identityIds.size,
    labelIdentityCount: labelIdentityIds.size,
    duplicateIdentityCount,
    invalidIdentityRecordCount,
    identityIds,
    labelIdentityIds,
  });
}

function isCanonicalFormalIdentity(identity: string): boolean {
  const parts = identity.split("|");
  if (parts.length !== 3 || !/^\d+$/.test(parts[0]!)) return false;
  const timestamp = Number(parts[0]);
  return Number.isSafeInteger(timestamp)
    && R17_SYMBOLS.includes(parts[1] as R17Symbol)
    && R17_DIRECTIONS.includes(parts[2] as R17Direction);
}

function isAcceptedSettlementSource(source: R17SettlementIdentitySource): boolean {
  return R17_SETTLEMENT_SOURCE_KINDS.includes(source.sourceKind)
    && source.sourceStatus === "ACCEPTED_EXISTING_HISTORICAL_CACHE"
    && source.matchMode === "EXACT_CANONICAL_IDENTITY"
    && source.networkAcquired === false
    && source.reconstructed === false
    && source.sourceSha256.length === 64
    && source.duplicateIdentityCount === 0
    && source.invalidIdentityRecordCount === 0;
}

function sourceStatusFor(
  sourcesWithIdentity: readonly R17SettlementIdentitySource[],
  acceptedLabelSources: readonly R17SettlementIdentitySource[],
): R17SettlementIdentityMatrixRow["settlementSourceStatus"] {
  if (acceptedLabelSources.length > 0) return "ACCEPTED_EXISTING_HISTORICAL_CACHE";
  const source = sourcesWithIdentity[0];
  if (source === undefined) return "NO_MATCHING_SOURCE";
  return source.sourceStatus;
}

function categoryCountTemplate(): {
  FORMAL_AND_ACCEPTED_LABEL_IDENTITY_COMPLETE: number;
  FORMAL_COMPLETE_R14_OBSERVATION_ID_MISSING_BUT_OTHER_ACCEPTED_LABEL_IDENTITY_EXISTS: number;
  FORMAL_COMPLETE_NO_ACCEPTED_SETTLEMENT_LABEL_IDENTITY: number;
  FORMAL_SOURCE_PROVENANCE_INCOMPLETE: number;
  OTHER_ANOMALY: number;
} {
  return {
    FORMAL_AND_ACCEPTED_LABEL_IDENTITY_COMPLETE: 0,
    FORMAL_COMPLETE_R14_OBSERVATION_ID_MISSING_BUT_OTHER_ACCEPTED_LABEL_IDENTITY_EXISTS: 0,
    FORMAL_COMPLETE_NO_ACCEPTED_SETTLEMENT_LABEL_IDENTITY: 0,
    FORMAL_SOURCE_PROVENANCE_INCOMPLETE: 0,
    OTHER_ANOMALY: 0,
  };
}

export function auditR17SettlementIdentityMatrix(input: Readonly<{
  formalIdentities: readonly R17FormalIdentityInput[];
  settlementSources: readonly R17SettlementIdentitySource[];
}>): R17SettlementIdentityAudit {
  const acceptedSources = input.settlementSources.filter(isAcceptedSettlementSource);
  const r14Sources = input.settlementSources.filter((source) => source.sourceKind === "R14_OBSERVATION_CACHE");
  const categoryCounts = categoryCountTemplate();
  let acceptedSettlementLabelIdentityCompleteCount = 0;
  let trueMissingRequiredLabelCount = 0;
  let trueMissingFormalProvenanceCount = 0;
  let r14ObservationIdentityMissingCount = 0;
  let sourceProvenanceAnomalyCount = 0;

  const matrix = input.formalIdentities.map((formal) => {
    const canonicalValid = isCanonicalFormalIdentity(formal.canonicalIdentity);
    const formalProvenanceValid = formal.formalSourceStatus === "ACCEPTED_BASELINE_001_FORMAL_STREAM"
      && formal.formalSourcePath.length > 0
      && formal.formalSourceSha256.length === 64;
    const r14ObservationIdentityPresent = r14Sources.some((source) => source.identityIds.has(formal.canonicalIdentity));
    if (!r14ObservationIdentityPresent) r14ObservationIdentityMissingCount += 1;

    const sourcesWithIdentity = input.settlementSources.filter((source) => source.identityIds.has(formal.canonicalIdentity));
    const acceptedLabelSources = acceptedSources.filter((source) => source.labelIdentityIds.has(formal.canonicalIdentity));
    const sourceAnomaly = sourcesWithIdentity.some((source) => !isAcceptedSettlementSource(source));
    if (sourceAnomaly) sourceProvenanceAnomalyCount += 1;

    let classification: R17SettlementIdentityMatrixRow["classification"];
    const anomalyCodes: string[] = [];
    if (!canonicalValid) {
      classification = "OTHER_ANOMALY";
      anomalyCodes.push("INVALID_CANONICAL_FORMAL_IDENTITY");
    } else if (!formalProvenanceValid) {
      classification = "FORMAL_SOURCE_PROVENANCE_INCOMPLETE";
      anomalyCodes.push("FORMAL_SOURCE_PROVENANCE_INCOMPLETE");
      trueMissingFormalProvenanceCount += 1;
    } else if (acceptedLabelSources.length === 0) {
      classification = "FORMAL_COMPLETE_NO_ACCEPTED_SETTLEMENT_LABEL_IDENTITY";
      trueMissingRequiredLabelCount += 1;
      if (sourceAnomaly) anomalyCodes.push("SETTLEMENT_SOURCE_PROVENANCE_REJECTED");
    } else if (!r14ObservationIdentityPresent) {
      classification = "FORMAL_COMPLETE_R14_OBSERVATION_ID_MISSING_BUT_OTHER_ACCEPTED_LABEL_IDENTITY_EXISTS";
      acceptedSettlementLabelIdentityCompleteCount += 1;
    } else {
      classification = "FORMAL_AND_ACCEPTED_LABEL_IDENTITY_COMPLETE";
      acceptedSettlementLabelIdentityCompleteCount += 1;
    }
    if (classification === "OTHER_ANOMALY") categoryCounts.OTHER_ANOMALY += 1;
    else categoryCounts[classification] += 1;
    return Object.freeze({
      canonicalIdentity: formal.canonicalIdentity,
      formalProvenanceValid,
      r14ObservationIdentityPresent,
      acceptedSettlementLabelIdentityPresent: acceptedLabelSources.length > 0,
      acceptedSettlementSources: Object.freeze(acceptedLabelSources.map((source) => Object.freeze({ sourceKind: source.sourceKind, sourcePath: source.sourcePath, sourceSha256: source.sourceSha256 }))),
      settlementSourceStatus: sourceStatusFor(sourcesWithIdentity, acceptedLabelSources),
      classification,
      anomalyCodes: Object.freeze(anomalyCodes),
    });
  });

  const sourceSummaries = input.settlementSources.map((source) => Object.freeze({
    sourceKind: source.sourceKind,
    sourcePath: source.sourcePath,
    sourceSha256: source.sourceSha256,
    sourceStatus: source.sourceStatus,
    sourceRecordCount: source.sourceRecordCount,
    identityCount: source.identityCount,
    labelIdentityCount: source.labelIdentityCount,
    matchedFormalIdentityCount: input.formalIdentities.filter((formal) => source.identityIds.has(formal.canonicalIdentity)).length,
    duplicateIdentityCount: source.duplicateIdentityCount,
    invalidIdentityRecordCount: source.invalidIdentityRecordCount,
  }));
  const partitionTotal = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
  const summaryWithoutHash = {
    schemaVersion: R17_SETTLEMENT_IDENTITY_AUDIT_SCHEMA_VERSION,
    formalCount: input.formalIdentities.length,
    categoryCounts: Object.freeze(categoryCounts),
    partitionTotal,
    acceptedSettlementLabelIdentityCompleteCount,
    trueMissingRequiredLabelCount,
    trueMissingFormalProvenanceCount,
    r14ObservationIdentityMissingCount,
    r14OnlyIdentityMissingCount: r14ObservationIdentityMissingCount,
    sourceProvenanceAnomalyCount,
    g01DataComplete: categoryCounts.FORMAL_COMPLETE_NO_ACCEPTED_SETTLEMENT_LABEL_IDENTITY === 0
      && categoryCounts.FORMAL_SOURCE_PROVENANCE_INCOMPLETE === 0
      && categoryCounts.OTHER_ANOMALY === 0
      && acceptedSettlementLabelIdentityCompleteCount === input.formalIdentities.length
      && sourceProvenanceAnomalyCount === 0,
    g01Failure: null as typeof R17_G01_DATA_COMPLETENESS_FAILURE | null,
    labelValuesRead: false as const,
    economicFieldsRead: false as const,
    matrixSha256: "",
    sources: Object.freeze(sourceSummaries),
  };
  const g01Failure = summaryWithoutHash.g01DataComplete ? null : R17_G01_DATA_COMPLETENESS_FAILURE;
  const matrixSha256 = createHash("sha256").update(stableStringify(matrix), "utf8").digest("hex");
  const summary = Object.freeze({ ...summaryWithoutHash, g01Failure, matrixSha256 });
  return Object.freeze({ summary, matrix: Object.freeze(matrix) });
}

export function isR17AcceptedSettlementSource(source: R17SettlementIdentitySource): boolean {
  return isAcceptedSettlementSource(source);
}
