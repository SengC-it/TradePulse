import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import {
  ROUND_018_ACCEPTED_SOURCE,
  ROUND_018_FOLDS,
  ROUND_018_REGIMES,
  ROUND_018_OBSERVATION_COUNT,
  ROUND_018_OBSERVATION_SHA256,
  ROUND_018_PREFLIGHT_JSON_PATH,
  ROUND_018_PREFLIGHT_MARKDOWN_PATH,
  ROUND_018_RESEARCH_ROUND_ID,
  ROUND_018_STRUCTURAL_OBSERVATION_SOURCE,
  ROUND_018_UNIVERSE,
} from "./m3-r18-round-018-protocol.ts";
import { readR18ObservationFreezeManifest, verifyR18StructuralRecord, type R18ObservationFreezeManifest, type R18StructuralCounts } from "./m3-r18-round-018-observation-freeze.ts";
import { stableStringify } from "./utils.ts";

export const R18_PREFLIGHT_SCHEMA_VERSION = "m3-r18-round-018-structural-preflight-001" as const;
export const R18_G01_FAILURE = "ROUND-018 PERFORMANCE INELIGIBLE — SCORE PROVENANCE" as const;
export const R18_G07_FAILURE = "ROUND-018 PERFORMANCE INELIGIBLE — NON-DISCRIMINATIVE SELECTOR" as const;
export const R18_NON_AUTHORITATIVE_AFTER_G01_FAILURE = "NON_AUTHORITATIVE_AFTER_G01_FAILURE" as const;

export type R18StructuralGateId = "G01_DATA_PROVENANCE" | "G02_POINT_IN_TIME" | "G03_AGGREGATE_BREADTH" | "G04_FOLD_BREADTH" | "G05_SYMBOL_BREADTH" | "G06_REGIME_BREADTH" | "G07_STRUCTURAL_DISCRIMINATION";

export type R18GateResult = Readonly<{
  id: R18StructuralGateId;
  hardGate: true;
  status: "PASS" | "FAIL" | typeof R18_NON_AUTHORITATIVE_AFTER_G01_FAILURE;
  reason: string;
}>;

export type R18PreflightFacts = Readonly<{
  acceptedSourceProvenanceValid: boolean;
  observationSourcePresent: boolean;
  observationCount: number;
  observationBytes: number;
  observationSha256: string;
  sourceStatus: string;
  statusCounts: R18StructuralCounts["statusCounts"];
  labelStatusCounts: R18StructuralCounts["labelStatusCounts"];
  allPopulationPartitioned: boolean;
  duplicateCanonicalCount: number;
  invalidMetadataCount: number;
  provenanceIncompleteCount: number;
  pointInTimeViolationCount: number;
  replaySourceErrors: number;
  formalCount: number;
  controlCount: number;
  candidateCount: number;
  candidateH4ExecutedCount: number;
  validationCandidateH4ExecutedCount: number;
  outsideValidationCandidateH4ExecutedCount: number;
  totalStructuralCandidateH4ExecutedCount: number;
  candidateSymbols: readonly string[];
  candidateRegimes: readonly string[];
  countsByFoldSymbolRegime: R18StructuralCounts["countsByFoldSymbolRegime"];
  compactRecordCount: number;
  compactIntegrityValid: boolean;
  labelDataIncompleteCount: number;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  selectionExecuted: false;
}>;

export type R18PreflightReport = Readonly<{
  schemaVersion: typeof R18_PREFLIGHT_SCHEMA_VERSION;
  researchRoundId: typeof ROUND_018_RESEARCH_ROUND_ID;
  acceptedSourceCommit: typeof ROUND_018_ACCEPTED_SOURCE;
  gates: readonly R18GateResult[];
  g01DataComplete: boolean;
  g01Failure: typeof R18_G01_FAILURE | null;
  g07Failure: typeof R18_G07_FAILURE | null;
  finalClassification: "ROUND-018 PREFLIGHT PASS — PERFORMANCE NOT AUTHORIZED" | typeof R18_G01_FAILURE | typeof R18_G07_FAILURE | "ROUND-018 PERFORMANCE INELIGIBLE AT PREFLIGHT";
  counts: Readonly<{
    r14NativeObservationCount: number;
    deterministicReplayCount: number;
    replayProvenanceIncompleteCount: number;
    noBaselineCandidateCount: number;
    nonFormalCandidateCount: number;
    r14NativeFormalControlCount: number;
    candidateCount: number;
    candidateH4ExecutedCount: number;
    validationCandidateH4ExecutedCount: number;
    outsideValidationCandidateH4ExecutedCount: number;
    totalStructuralCandidateH4ExecutedCount: number;
    candidateCountBySymbol: Readonly<Record<string, number>>;
    candidateCountByRegime: Readonly<Record<string, number>>;
    excludedByConsensusCount: number;
    retentionRate: number;
    duplicateCanonicalCount: number;
    compactRecordCount: number;
    labelStatusCounts: R18StructuralCounts["labelStatusCounts"];
    countsByFoldSymbolRegime: R18StructuralCounts["countsByFoldSymbolRegime"];
  }>;
  integrity: Readonly<{
    allPopulationPartitioned: boolean;
    sourceStatus: string;
    sourceSha256: string;
    sourceBytes: number;
    acceptedSourceProvenanceValid: boolean;
    compactIntegrityValid: boolean;
    economicFieldsRead: false;
    economicValuesCalculated: false;
    economicValuesInspected: false;
  }>;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  selectionExecuted: false;
  productionUnchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  automaticTrading: false;
  reportSha256: string;
}>;

function hashText(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function foldCandidateCount(
  counts: R18StructuralCounts["countsByFoldSymbolRegime"],
  fold: string,
): number {
  const bySymbol = counts[fold] ?? {};
  return Object.values(bySymbol).reduce((sum, byRegime) => sum + Object.values(byRegime).reduce((inner, value) => inner + value.candidateH4Executed, 0), 0);
}

function candidateH4ExecutedCount(
  counts: R18StructuralCounts["countsByFoldSymbolRegime"],
): number {
  return Object.values(counts).reduce((foldTotal, bySymbol) => foldTotal + Object.values(bySymbol).reduce(
    (symbolTotal, byRegime) => symbolTotal + Object.values(byRegime).reduce((regimeTotal, value) => regimeTotal + value.candidateH4Executed, 0),
    0,
  ), 0);
}

function candidateH4ExecutedCountForFolds(
  counts: R18StructuralCounts["countsByFoldSymbolRegime"],
  folds: readonly string[],
): number {
  return folds.reduce((total, fold) => total + foldCandidateCount(counts, fold), 0);
}

function candidateCountBySymbol(
  counts: R18StructuralCounts["countsByFoldSymbolRegime"],
): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const bySymbol of Object.values(counts)) {
    for (const [symbol, byRegime] of Object.entries(bySymbol)) {
      result[symbol] = (result[symbol] ?? 0) + Object.values(byRegime).reduce((sum, value) => sum + value.candidate, 0);
    }
  }
  return Object.freeze(result);
}

function candidateCountByRegime(
  counts: R18StructuralCounts["countsByFoldSymbolRegime"],
): Readonly<Record<string, number>> {
  const result: Record<string, number> = {};
  for (const bySymbol of Object.values(counts)) {
    for (const byRegime of Object.values(bySymbol)) {
      for (const [regime, value] of Object.entries(byRegime)) {
        result[regime] = (result[regime] ?? 0) + value.candidate;
      }
    }
  }
  return Object.freeze(result);
}

function gate(id: R18StructuralGateId, pass: boolean, reason: string): R18GateResult {
  return Object.freeze({ id, hardGate: true as const, status: pass ? "PASS" as const : "FAIL" as const, reason });
}

function nonAuthoritativeGate(id: R18StructuralGateId, diagnosticPass: boolean, reason: string): R18GateResult {
  return Object.freeze({
    id,
    hardGate: true as const,
    status: R18_NON_AUTHORITATIVE_AFTER_G01_FAILURE,
    reason: `G01 failed; diagnostic result was ${diagnosticPass ? "PASS" : "FAIL"} but is non-authoritative. ${reason}`,
  });
}

function rawGatePasses(facts: R18PreflightFacts): Readonly<{
  g01: boolean;
  g02: boolean;
  g03: boolean;
  g04: boolean;
  g05: boolean;
  g06: boolean;
  g07: boolean;
}> {
  const bySymbol = candidateCountBySymbol(facts.countsByFoldSymbolRegime);
  const byRegime = candidateCountByRegime(facts.countsByFoldSymbolRegime);
  const validationCandidateH4ExecutedCount = candidateH4ExecutedCountForFolds(facts.countsByFoldSymbolRegime, ROUND_018_FOLDS);
  return Object.freeze({
    g01: facts.acceptedSourceProvenanceValid
      && facts.observationSourcePresent
      && facts.sourceStatus === "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE"
      && facts.observationCount === ROUND_018_OBSERVATION_COUNT
      && facts.observationSha256 === ROUND_018_OBSERVATION_SHA256
      && facts.observationBytes === 1_893_811_055
      && facts.allPopulationPartitioned
      && facts.duplicateCanonicalCount === 0
      && facts.invalidMetadataCount === 0
      && facts.provenanceIncompleteCount === 0
      && facts.replaySourceErrors === 0
      && facts.formalCount === facts.controlCount
      && facts.compactIntegrityValid
      && facts.compactRecordCount === facts.formalCount
      && facts.labelDataIncompleteCount === 0,
    g02: facts.acceptedSourceProvenanceValid
      && facts.pointInTimeViolationCount === 0
      && facts.observationCount === ROUND_018_OBSERVATION_COUNT,
    g03: validationCandidateH4ExecutedCount >= 500,
    g04: ROUND_018_FOLDS.every((foldId) => foldCandidateCount(facts.countsByFoldSymbolRegime, foldId) >= 50),
    g05: ROUND_018_UNIVERSE.every((symbol) => (bySymbol[symbol] ?? 0) >= 20),
    g06: ROUND_018_REGIMES.every((regime) => (byRegime[regime] ?? 0) >= 50),
    g07: facts.candidateCount > 0 && facts.candidateCount < facts.controlCount,
  });
}

export function evaluateR18StructuralGates(facts: R18PreflightFacts): readonly R18GateResult[] {
  const raw = rawGatePasses(facts);
  const g01 = raw.g01;
  const subsequent = (id: R18StructuralGateId, pass: boolean, reason: string): R18GateResult => g01 ? gate(id, pass, reason) : nonAuthoritativeGate(id, pass, reason);
  return Object.freeze([
    gate("G01_DATA_PROVENANCE", g01, g01 ? "R14 source, accepted replay provenance, partition, compact identity, and structural labels are complete." : "Accepted source, population partition, replay provenance, or compact structural identity is incomplete."),
    subsequent("G02_POINT_IN_TIME", raw.g02, raw.g02 ? "Decision-time replay is bounded by the frozen boundary and accepted source." : "A point-in-time or accepted-source invariant failed."),
    subsequent("G03_AGGREGATE_BREADTH", raw.g03, raw.g03 ? "F1-F6 candidate H4 EXECUTED validation breadth meets the frozen minimum of 500." : "F1-F6 candidate H4 EXECUTED validation breadth is below the frozen minimum of 500; OUTSIDE_VALIDATION is excluded."),
    subsequent("G04_FOLD_BREADTH", raw.g04, raw.g04 ? "Every frozen validation fold contains at least 50 candidate rows." : "At least one frozen validation fold is below the minimum candidate breadth."),
    subsequent("G05_SYMBOL_BREADTH", raw.g05, raw.g05 ? "Every frozen symbol has at least 20 candidate rows." : "At least one frozen symbol has fewer than 20 candidate rows."),
    subsequent("G06_REGIME_BREADTH", raw.g06, raw.g06 ? "Every frozen BTC regime has at least 50 candidate rows." : "At least one frozen BTC regime has fewer than 50 candidate rows."),
    subsequent("G07_STRUCTURAL_DISCRIMINATION", raw.g07, raw.g07 ? "Candidate is a strict non-empty subset of the formal CONTROL." : "Candidate is empty or equal to CONTROL; selector is non-discriminative."),
  ]);
}

export function buildR18PreflightReport(facts: R18PreflightFacts): R18PreflightReport {
  const gates = evaluateR18StructuralGates(facts);
  const g01DataComplete = gates[0]!.status === "PASS";
  const raw = rawGatePasses(facts);
  const allPass = g01DataComplete && gates.every((current) => current.status === "PASS");
  const finalClassification = !raw.g01
    ? R18_G01_FAILURE
    : !raw.g07
      ? R18_G07_FAILURE
      : allPass
        ? "ROUND-018 PREFLIGHT PASS — PERFORMANCE NOT AUTHORIZED" as const
        : "ROUND-018 PERFORMANCE INELIGIBLE AT PREFLIGHT" as const;
  const validationCandidateH4ExecutedCount = candidateH4ExecutedCountForFolds(facts.countsByFoldSymbolRegime, ROUND_018_FOLDS);
  const outsideValidationCandidateH4ExecutedCount = candidateH4ExecutedCountForFolds(facts.countsByFoldSymbolRegime, ["OUTSIDE_VALIDATION"]);
  const totalStructuralCandidateH4ExecutedCount = candidateH4ExecutedCount(facts.countsByFoldSymbolRegime);
  const counts = Object.freeze({
    r14NativeObservationCount: facts.observationCount,
    deterministicReplayCount: facts.observationCount,
    replayProvenanceIncompleteCount: facts.provenanceIncompleteCount,
    noBaselineCandidateCount: facts.statusCounts.NO_BASELINE_CANDIDATE,
    nonFormalCandidateCount: facts.statusCounts.BASELINE_CANDIDATE_NON_FORMAL,
    r14NativeFormalControlCount: facts.formalCount,
    candidateCount: facts.candidateCount,
    candidateH4ExecutedCount: totalStructuralCandidateH4ExecutedCount,
    validationCandidateH4ExecutedCount,
    outsideValidationCandidateH4ExecutedCount,
    totalStructuralCandidateH4ExecutedCount,
    candidateCountBySymbol: candidateCountBySymbol(facts.countsByFoldSymbolRegime),
    candidateCountByRegime: candidateCountByRegime(facts.countsByFoldSymbolRegime),
    excludedByConsensusCount: facts.controlCount - facts.candidateCount,
    retentionRate: facts.controlCount === 0 ? 0 : facts.candidateCount / facts.controlCount,
    duplicateCanonicalCount: facts.duplicateCanonicalCount,
    compactRecordCount: facts.compactRecordCount,
    labelStatusCounts: Object.freeze({ ...facts.labelStatusCounts }),
    countsByFoldSymbolRegime: facts.countsByFoldSymbolRegime,
  });
  const unsigned = {
    schemaVersion: R18_PREFLIGHT_SCHEMA_VERSION,
    researchRoundId: ROUND_018_RESEARCH_ROUND_ID,
    acceptedSourceCommit: ROUND_018_ACCEPTED_SOURCE,
    gates,
    g01DataComplete,
    g01Failure: g01DataComplete ? null : R18_G01_FAILURE,
    g07Failure: g01DataComplete && !raw.g07 ? R18_G07_FAILURE : null,
    finalClassification,
    counts,
    integrity: {
      allPopulationPartitioned: facts.allPopulationPartitioned,
      sourceStatus: facts.sourceStatus,
      sourceSha256: facts.observationSha256,
      sourceBytes: facts.observationBytes,
      acceptedSourceProvenanceValid: facts.acceptedSourceProvenanceValid,
      compactIntegrityValid: facts.compactIntegrityValid,
      economicFieldsRead: false as const,
      economicValuesCalculated: false as const,
      economicValuesInspected: false as const,
    },
    performanceExecutionCount: 0 as const,
    performanceLedgerPresent: false as const,
    selectionExecuted: false as const,
    productionUnchanged: true as const,
    baseline002Status: "NOT_FROZEN" as const,
    m3JStatus: "BLOCKED" as const,
    m4Status: "NOT_STARTED" as const,
    automaticTrading: false as const,
  };
  return Object.freeze({ ...unsigned, reportSha256: hashText(stableStringify({ ...unsigned, reportSha256: null })) }) as R18PreflightReport;
}

function findForbiddenStructuralKey(value: unknown): string | null {
  const forbidden = new Set(["grossForwardReturnBps", "grossForwardAtr", "netForwardReturnBps", "netForwardAtr", "netForwardAtrCostStress", "feesBps", "fundingBps", "fundingBurdenBps", "slippageBps", "entryPrice", "exitPrice", "netR", "profitFactor", "drawdown", "winLoss"]);
  if (Array.isArray(value)) {
    for (const child of value) { const found = findForbiddenStructuralKey(child); if (found) return found; }
    return null;
  }
  if (typeof value !== "object" || value === null) return null;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) return key;
    const found = findForbiddenStructuralKey(child);
    if (found) return found;
  }
  return null;
}

function verifyCompactStructuralData(root: string, manifest: R18ObservationFreezeManifest): Readonly<{ recordCount: number; valid: boolean }> {
  const dataPath = path.join(root, ROUND_018_STRUCTURAL_OBSERVATION_SOURCE);
  if (!existsSync(dataPath)) return Object.freeze({ recordCount: 0, valid: false });
  const content = readFileSync(dataPath, "utf8");
  if (Buffer.byteLength(content, "utf8") !== manifest.compactStructuralObservation.bytes || hashText(content) !== manifest.compactStructuralObservation.sha256) return Object.freeze({ recordCount: 0, valid: false });
  const lines = content.length === 0 ? [] : content.split(/\r?\n/).filter((line) => line.length > 0);
  let valid = true;
  for (const line of lines) {
    try {
      const record: unknown = JSON.parse(line);
      if (!verifyR18StructuralRecord(record) || findForbiddenStructuralKey(record) !== null) valid = false;
    } catch { valid = false; }
  }
  return Object.freeze({ recordCount: lines.length, valid });
}

export function writeR18PreflightArtifacts(root: string, report: R18PreflightReport): void {
  const absoluteRoot = path.resolve(root);
  const jsonPath = path.join(absoluteRoot, ROUND_018_PREFLIGHT_JSON_PATH);
  const markdownPath = path.join(absoluteRoot, ROUND_018_PREFLIGHT_MARKDOWN_PATH);
  if (existsSync(jsonPath) || existsSync(markdownPath)) {
    if (!existsSync(jsonPath) || !existsSync(markdownPath)) throw new Error("R18 preflight output is partially present; refusing to overwrite it.");
    return;
  }
  mkdirSync(path.dirname(jsonPath), { recursive: true });
  const markdown = [
    "# Round-018 structural preflight",
    "",
    `Research round: ${report.researchRoundId}`,
    `Accepted source: ${report.acceptedSourceCommit}`,
    `Final classification: ${report.finalClassification}`,
    "",
    "This report is metadata-only. Economic values were not read, calculated, or inspected.",
    "",
    `R14 native observations: ${report.counts.r14NativeObservationCount}`,
    `Formal CONTROL rows: ${report.counts.r14NativeFormalControlCount}`,
    `Consensus candidate rows: ${report.counts.candidateCount}`,
    `Validation candidate H4 EXECUTED rows (F1-F6): ${report.counts.validationCandidateH4ExecutedCount}`,
    `Outside-validation candidate H4 EXECUTED rows: ${report.counts.outsideValidationCandidateH4ExecutedCount}`,
    `Total structural candidate H4 EXECUTED rows: ${report.counts.totalStructuralCandidateH4ExecutedCount}`,
    `Excluded by consensus: ${report.counts.excludedByConsensusCount}`,
    `Retention rate: ${report.counts.retentionRate}`,
    "",
    "| Gate | Status |",
    "| --- | --- |",
    ...report.gates.map((current) => `| ${current.id} | ${current.status} |`),
    "",
    `performanceExecutionCount: ${report.performanceExecutionCount}`,
    `performanceLedgerPresent: ${report.performanceLedgerPresent}`,
    `selectionExecuted: ${report.selectionExecuted}`,
    `Production unchanged: ${report.productionUnchanged}`,
    `baseline-002: ${report.baseline002Status}`,
    `automaticTrading: ${report.automaticTrading}`,
    "",
  ].join("\n");
  writeFileSync(jsonPath, stableStringify(report), "utf8");
  writeFileSync(markdownPath, markdown, "utf8");
}

export function buildR18PreflightFromFreeze(root = process.cwd()): R18PreflightReport {
  const absoluteRoot = path.resolve(root);
  const manifest = readR18ObservationFreezeManifest(absoluteRoot);
  const compact = verifyCompactStructuralData(absoluteRoot, manifest);
  const counts = manifest.counts;
  const validationCandidateH4ExecutedCount = candidateH4ExecutedCountForFolds(
    counts.countsByFoldSymbolRegime,
    ROUND_018_FOLDS,
  );
  const outsideValidationCandidateH4ExecutedCount = candidateH4ExecutedCountForFolds(
    counts.countsByFoldSymbolRegime,
    ["OUTSIDE_VALIDATION"],
  );
  const totalStructuralCandidateH4ExecutedCount = candidateH4ExecutedCount(
    counts.countsByFoldSymbolRegime,
  );

  const facts: R18PreflightFacts = {
    acceptedSourceProvenanceValid: manifest.acceptedSourceCommit === ROUND_018_ACCEPTED_SOURCE
      && manifest.observationSource.sourceStatus === "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE"
      && manifest.acceptedCandleCache.sourceStatus === "ACCEPTED_EXISTING_ROUND006_CANDLE_CACHE"
      && manifest.acceptedCandleCache.networkAcquired === false,
    observationSourcePresent: manifest.observationSource.observationCount === ROUND_018_OBSERVATION_COUNT,
    observationCount: manifest.observationSource.observationCount,
    observationBytes: manifest.observationSource.bytes,
    observationSha256: manifest.observationSource.sha256,
    sourceStatus: manifest.observationSource.sourceStatus,
    statusCounts: counts.statusCounts,
    labelStatusCounts: counts.labelStatusCounts,
    allPopulationPartitioned: manifest.integrity.allPopulationPartitioned,
    duplicateCanonicalCount: counts.duplicateCanonicalCount,
    invalidMetadataCount: counts.invalidMetadataCount,
    provenanceIncompleteCount: counts.provenanceIncompleteCount,
    pointInTimeViolationCount: counts.pointInTimeViolationCount,
    replaySourceErrors: counts.replaySourceErrors.length,
    formalCount: counts.formalCount,
    controlCount: counts.controlCount,
    candidateCount: counts.candidateCount,
    candidateH4ExecutedCount: totalStructuralCandidateH4ExecutedCount,
    validationCandidateH4ExecutedCount,
    outsideValidationCandidateH4ExecutedCount,
    totalStructuralCandidateH4ExecutedCount,
    candidateSymbols: counts.symbolsWithCandidate,
    candidateRegimes: counts.regimesWithCandidate,
    countsByFoldSymbolRegime: counts.countsByFoldSymbolRegime,
    compactRecordCount: compact.recordCount,
    compactIntegrityValid: compact.valid,
    labelDataIncompleteCount: counts.labelStatusCounts.DATA_INCOMPLETE,
    performanceExecutionCount: 0,
    performanceLedgerPresent: false,
    selectionExecuted: false,
  };
  const report = buildR18PreflightReport(facts);
  writeR18PreflightArtifacts(absoluteRoot, report);
  return report;
}
