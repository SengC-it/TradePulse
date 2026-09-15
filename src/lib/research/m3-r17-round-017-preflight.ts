import {
  M3_R17_DESIGN_PATH,
  M3_R17_RESEARCH_END_ISO,
  M3_R17_RESEARCH_ROUND_ID,
  M3_R17_RESEARCH_START_ISO,
  R17_FOLD_IDS,
  R17_REGIMES,
  R17_SYMBOLS,
  M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT,
  type R17FoldId,
  type R17Regime,
} from "./m3-r17-round-017-protocol.ts";
import { validateR17Design } from "./m3-r17-round-017-protocol.ts";
import { readR17ObservationFreeze, verifyR17ObservationFreeze, type R17ObservationFreezeManifest, type R17ObservationScan } from "./m3-r17-round-017-observation-freeze.ts";
import { assertR17ClassifierGapInvariant, type R17FormalStreamAudit } from "./m3-r17-round-017-formal-stream.ts";
import type { R17SettlementIdentityAuditSummary } from "./m3-r17-round-017-settlement-audit.ts";

export const R17_PREFLIGHT_SCHEMA_VERSION = "m3-r17-round-017-preflight-001" as const;
export const R17_ALLOWED_PREFLIGHT_GATES = Object.freeze(["G01_DATA_COMPLETE", "G02_POINT_IN_TIME", "G03_CANDIDATE_AGGREGATE_MINIMUM", "G04_CANDIDATE_FOLD_MINIMUM", "G05_SYMBOL_BREADTH", "G06_REGIME_BREADTH", "G14_EMAIL_VOLUME_REDUCTION"] as const);
export type R17PreflightGateId = (typeof R17_ALLOWED_PREFLIGHT_GATES)[number];

export type R17PreflightGate = Readonly<{ id: R17PreflightGateId; passed: boolean; detail: string }>;

export type R17PreflightReport = Readonly<{
  schemaVersion: typeof R17_PREFLIGHT_SCHEMA_VERSION;
  researchRoundId: typeof M3_R17_RESEARCH_ROUND_ID;
  researchBoundary: Readonly<{ start: typeof M3_R17_RESEARCH_START_ISO; end: typeof M3_R17_RESEARCH_END_ISO; classification: "RESEARCH_AVAILABLE_SEEN_DATA" }>;
  status: "PASS" | "ROUND-017 PERFORMANCE INELIGIBLE AT PREFLIGHT";
  gates: readonly R17PreflightGate[];
  provenance: Readonly<{
    rawSourceRowCount: number;
    evaluationRowCount: number;
    candidateRowCount: number;
    formalCandidateRowCount: number;
    uniqueFormalSignalIdentityCount: number;
    acceptedHistoricalFormalCount: typeof M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT;
    formalStreamReconciliation: "PASS" | "FAIL";
  }>;
  structuralAudit: R17FormalStreamAudit & Readonly<{ foldAssignmentBeforeCount: number; foldAssignmentAfterCount: number }>;
  settlementIdentityAudit: R17SettlementIdentityAuditSummary | null;
  stats: Readonly<{
    controlCount: number;
    candidateCount: number;
    firstCount: number;
    followUpCount: number;
    suppressedCount: number;
    suppressionRate: number;
    candidateByFold: Readonly<Record<R17FoldId, number>>;
    candidateBySymbol: Readonly<Record<(typeof R17_SYMBOLS)[number], number>>;
    candidateByRegime: Readonly<Record<R17Regime, number>>;
    minSignalTime: number | null;
    maxSignalTime: number | null;
  }>;
  integrity: Readonly<{ complete: boolean; integrityErrors: number; settlementIdentityComplete: boolean }>;
  performanceExecutionCount: 0;
  performanceLockTriggered: false;
  performanceExecuted: false;
  selectionExecuted: false;
  networkAccessed: false;
}>;

export type R17PreflightFacts = Readonly<{
  scan: R17ObservationScan;
  integrityComplete: boolean;
  integrityErrors: number;
  settlementIdentityComplete: boolean;
  settlementIdentityAudit?: R17SettlementIdentityAuditSummary;
  pointInTimeComplete: boolean;
  formalStreamReconciled: boolean;
  classifierInvariantPass: boolean;
  structuralAudit: R17PreflightReport["structuralAudit"];
  provenance: Readonly<{
    rawSourceRowCount: number;
    evaluationRowCount: number;
    candidateRowCount: number;
    formalCandidateRowCount: number;
    uniqueFormalSignalIdentityCount: number;
  }>;
}>;

function gate(id: R17PreflightGateId, passed: boolean, detail: string): R17PreflightGate {
  return Object.freeze({ id, passed, detail });
}

function safeSuppressionRate(scan: R17ObservationScan): number {
  return scan.controlCount === 0 ? 0 : scan.suppressedCount / scan.controlCount;
}

export function evaluateR17Preflight(facts: R17PreflightFacts): R17PreflightReport {
  const scan = facts.scan;
  const suppressionRate = safeSuppressionRate(scan);
  const structuralAudit = facts.structuralAudit;
  const foldBreadth = R17_FOLD_IDS.every((foldId) => scan.candidateByFold[foldId] >= 50);
  const symbolBreadth = R17_SYMBOLS.every((symbol) => scan.candidateBySymbol[symbol] >= 20);
  const regimeBreadth = R17_REGIMES.every((regime) => scan.candidateByRegime[regime] >= 50);
  const gates = Object.freeze([
    gate("G01_DATA_COMPLETE", facts.integrityComplete && facts.integrityErrors === 0 && facts.settlementIdentityComplete && facts.formalStreamReconciled && structuralAudit.duplicateCanonicalIdentityCount === 0, "canonical formal identity, accepted settlement-label identity/provenance, formal-stream provenance, and integrity must be complete"),
    gate("G02_POINT_IN_TIME", facts.pointInTimeComplete && facts.classifierInvariantPass, "classification must use event-time state only and honor the formal-stream classifier invariant"),
    gate("G03_CANDIDATE_AGGREGATE_MINIMUM", scan.candidateCount >= 500, "candidateCount must be at least 500"),
    gate("G04_CANDIDATE_FOLD_MINIMUM", foldBreadth, "candidateCount must be at least 50 in every frozen validation fold"),
    gate("G05_SYMBOL_BREADTH", symbolBreadth, "candidateCount must be at least 20 for every frozen symbol"),
    gate("G06_REGIME_BREADTH", regimeBreadth, "candidateCount must be at least 50 in every frozen BTC regime bucket"),
    gate("G14_EMAIL_VOLUME_REDUCTION", suppressionRate >= 0.2 && scan.candidateCount < scan.controlCount, "suppressionRate must be at least 0.20 and candidateCount must be below controlCount"),
  ]);
  return Object.freeze({
    schemaVersion: R17_PREFLIGHT_SCHEMA_VERSION,
    researchRoundId: M3_R17_RESEARCH_ROUND_ID,
    researchBoundary: { start: M3_R17_RESEARCH_START_ISO, end: M3_R17_RESEARCH_END_ISO, classification: "RESEARCH_AVAILABLE_SEEN_DATA" as const },
    status: gates.every((value) => value.passed) ? "PASS" : "ROUND-017 PERFORMANCE INELIGIBLE AT PREFLIGHT",
    gates,
    provenance: Object.freeze({ rawSourceRowCount: facts.provenance.rawSourceRowCount, evaluationRowCount: facts.provenance.evaluationRowCount, candidateRowCount: facts.provenance.candidateRowCount, formalCandidateRowCount: facts.provenance.formalCandidateRowCount, uniqueFormalSignalIdentityCount: facts.provenance.uniqueFormalSignalIdentityCount, acceptedHistoricalFormalCount: M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT, formalStreamReconciliation: facts.formalStreamReconciled ? "PASS" : "FAIL" }),
    structuralAudit,
    stats: Object.freeze({ controlCount: scan.controlCount, candidateCount: scan.candidateCount, firstCount: scan.firstCount, followUpCount: scan.followUpCount, suppressedCount: scan.suppressedCount, suppressionRate, candidateByFold: scan.candidateByFold, candidateBySymbol: scan.candidateBySymbol, candidateByRegime: scan.candidateByRegime, minSignalTime: scan.minSignalTime, maxSignalTime: scan.maxSignalTime }),
    integrity: Object.freeze({ complete: facts.integrityComplete, integrityErrors: facts.integrityErrors, settlementIdentityComplete: facts.settlementIdentityComplete }),
    settlementIdentityAudit: facts.settlementIdentityAudit ?? null,
    performanceExecutionCount: 0,
    performanceLockTriggered: false,
    performanceExecuted: false,
    selectionExecuted: false,
    networkAccessed: false,
  });
}

function factsFromManifest(manifest: R17ObservationFreezeManifest, scan: R17ObservationScan): R17PreflightFacts {
  const structuralAudit = manifest.structuralAudit;
  const formalStreamReconciled = manifest.formalStream.observationCount === M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT
    && manifest.formalStream.formalCandidateRowCount === M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT
    && manifest.formalStream.uniqueFormalSignalIdentityCount === M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT
    && structuralAudit.duplicateCanonicalIdentityCount === 0
    && structuralAudit.foldAssignmentBeforeCount === M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT
    && structuralAudit.foldAssignmentAfterCount === M3_R17_ACCEPTED_BASELINE_FORMAL_SIGNAL_COUNT;
  const classifierInvariantPass = (() => {
    try { assertR17ClassifierGapInvariant(structuralAudit, scan.followUpCount); return true; } catch { return false; }
  })();
  return Object.freeze({
    scan,
    integrityComplete: manifest.settlementIdentityAudit.g01DataComplete && manifest.settlementIdentityAudit.partitionTotal === manifest.formalStream.observationCount && manifest.newMarketDataFetched === false && manifest.productionDataIncluded === false,
    integrityErrors: manifest.settlementIdentityAudit.trueMissingRequiredLabelCount + manifest.settlementIdentityAudit.trueMissingFormalProvenanceCount + manifest.settlementIdentityAudit.categoryCounts.OTHER_ANOMALY,
    settlementIdentityComplete: manifest.settlementIdentityAudit.g01DataComplete && manifest.settlementIdentityAudit.acceptedSettlementLabelIdentityCompleteCount === manifest.formalStream.observationCount,
    settlementIdentityAudit: manifest.settlementIdentityAudit,
    pointInTimeComplete: manifest.classifier.futureOutcomeDependency === false && manifest.performanceExecuted === false && manifest.selectionExecuted === false && manifest.observationCount === manifest.formalStream.observationCount,
    formalStreamReconciled,
    classifierInvariantPass,
    structuralAudit,
    provenance: Object.freeze({ rawSourceRowCount: manifest.settlementAvailability.sourceRecordCount, evaluationRowCount: manifest.formalStream.evaluationRowCount, candidateRowCount: manifest.formalStream.candidateRowCount, formalCandidateRowCount: manifest.formalStream.formalCandidateRowCount, uniqueFormalSignalIdentityCount: manifest.formalStream.uniqueFormalSignalIdentityCount }),
  });
}

export async function buildR17Preflight(root = process.cwd()): Promise<R17PreflightReport> {
  validateR17Design(root);
  const manifest = readR17ObservationFreeze(root);
  if (manifest.observationDataPath !== ".cache/tradepulse/round-017/observations.ndjson" || manifest.designPath !== M3_R17_DESIGN_PATH) throw new Error("R17 preflight observation manifest path identity is invalid.");
  const verified = await verifyR17ObservationFreeze(root);
  return evaluateR17Preflight(factsFromManifest(verified.manifest, verified.scan));
}
