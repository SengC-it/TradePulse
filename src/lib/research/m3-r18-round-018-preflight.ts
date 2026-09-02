import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import {
  ROUND_018_ACCEPTED_SOURCE,
  ROUND_018_FOLDS,
  ROUND_018_OBSERVATION_COUNT,
  ROUND_018_OBSERVATION_SHA256,
  ROUND_018_PREFLIGHT_JSON_PATH,
  ROUND_018_PREFLIGHT_MARKDOWN_PATH,
  ROUND_018_RESEARCH_ROUND_ID,
  ROUND_018_STRUCTURAL_OBSERVATION_SOURCE,
} from "./m3-r18-round-018-protocol.ts";
import { readR18ObservationFreezeManifest, verifyR18StructuralRecord, type R18ObservationFreezeManifest, type R18StructuralCounts } from "./m3-r18-round-018-observation-freeze.ts";
import { stableStringify } from "./utils.ts";

export const R18_PREFLIGHT_SCHEMA_VERSION = "m3-r18-round-018-structural-preflight-001" as const;
export const R18_G01_FAILURE = "ROUND-018 PERFORMANCE INELIGIBLE — SCORE PROVENANCE" as const;

export type R18StructuralGateId = "G01_DATA_PROVENANCE" | "G02_POINT_IN_TIME" | "G03_AGGREGATE_BREADTH" | "G04_FOLD_BREADTH" | "G05_SYMBOL_BREADTH" | "G06_REGIME_BREADTH" | "G07_STRUCTURAL_DISCRIMINATION";

export type R18GateResult = Readonly<{
  id: R18StructuralGateId;
  hardGate: true;
  status: "PASS" | "FAIL";
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
  finalClassification: "ROUND-018 PREFLIGHT PASS — PERFORMANCE NOT AUTHORIZED" | "ROUND-018 PERFORMANCE INELIGIBLE AT PREFLIGHT";
  counts: Readonly<{
    r14NativeObservationCount: number;
    deterministicReplayCount: number;
    replayProvenanceIncompleteCount: number;
    noBaselineCandidateCount: number;
    nonFormalCandidateCount: number;
    r14NativeFormalControlCount: number;
    candidateCount: number;
    candidateH4ExecutedCount: number;
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

function gate(id: R18StructuralGateId, pass: boolean, reason: string): R18GateResult {
  return Object.freeze({ id, hardGate: true as const, status: pass ? "PASS" as const : "FAIL" as const, reason });
}

export function evaluateR18StructuralGates(facts: R18PreflightFacts): readonly R18GateResult[] {
  const g01 = facts.acceptedSourceProvenanceValid
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
    && facts.labelDataIncompleteCount === 0;
  const g02 = facts.acceptedSourceProvenanceValid
    && facts.pointInTimeViolationCount === 0
    && facts.observationCount === ROUND_018_OBSERVATION_COUNT;
  const g03 = facts.candidateH4ExecutedCount >= 500;
  const g04 = ROUND_018_FOLDS.every((foldId) => foldCandidateCount(facts.countsByFoldSymbolRegime, foldId) >= 50);
  const g05 = facts.candidateSymbols.length === 5;
  const g06 = ["BTC_STRONG_BULL", "BTC_NEUTRAL", "BTC_STRONG_BEAR"].every((regime) => facts.candidateRegimes.includes(regime));
  const g07 = facts.candidateCount > 0 && facts.candidateCount < facts.controlCount;
  return Object.freeze([
    gate("G01_DATA_PROVENANCE", g01, g01 ? "R14 source, accepted replay provenance, partition, compact identity, and structural labels are complete." : "Accepted source, population partition, replay provenance, or compact structural identity is incomplete."),
    gate("G02_POINT_IN_TIME", g02, g02 ? "Decision-time replay is bounded by the frozen boundary and accepted source." : "A point-in-time or accepted-source invariant failed."),
    gate("G03_AGGREGATE_BREADTH", g03, g03 ? "Candidate structural breadth meets the frozen minimum of 500." : "Candidate structural breadth is below the frozen minimum of 500."),
    gate("G04_FOLD_BREADTH", g04, g04 ? "Every frozen validation fold contains at least 50 candidate rows." : "At least one frozen validation fold is below the minimum candidate breadth."),
    gate("G05_SYMBOL_BREADTH", g05, g05 ? "All five frozen symbols are represented by the candidate." : "Candidate symbol breadth does not cover all five frozen symbols."),
    gate("G06_REGIME_BREADTH", g06, g06 ? "All three frozen BTC regimes are represented by the candidate." : "Candidate regime breadth does not cover all three frozen regimes."),
    gate("G07_STRUCTURAL_DISCRIMINATION", g07, g07 ? "Candidate is a strict non-empty subset of the formal CONTROL." : "Candidate is empty or equal to CONTROL."),
  ]);
}

export function buildR18PreflightReport(facts: R18PreflightFacts): R18PreflightReport {
  const gates = evaluateR18StructuralGates(facts);
  const g01DataComplete = gates[0]!.status === "PASS";
  const allPass = gates.every((current) => current.status === "PASS");
  const counts = Object.freeze({
    r14NativeObservationCount: facts.observationCount,
    deterministicReplayCount: facts.observationCount,
    replayProvenanceIncompleteCount: facts.provenanceIncompleteCount,
    noBaselineCandidateCount: facts.statusCounts.NO_BASELINE_CANDIDATE,
    nonFormalCandidateCount: facts.statusCounts.BASELINE_CANDIDATE_NON_FORMAL,
    r14NativeFormalControlCount: facts.formalCount,
    candidateCount: facts.candidateCount,
    candidateH4ExecutedCount: facts.candidateH4ExecutedCount,
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
    finalClassification: allPass ? "ROUND-018 PREFLIGHT PASS — PERFORMANCE NOT AUTHORIZED" as const : "ROUND-018 PERFORMANCE INELIGIBLE AT PREFLIGHT" as const,
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
    `Consensus candidate H4 EXECUTED rows: ${report.counts.candidateH4ExecutedCount}`,
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
    candidateH4ExecutedCount: candidateH4ExecutedCount(counts.countsByFoldSymbolRegime),
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
