import { createHash } from "node:crypto";

import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { adaptBacktestSignalResult } from "./adapter.ts";
import { calculateResearchDiagnostics } from "./diagnostics.ts";
import { getResearchFoldRoleRange, RESEARCH_FOLDS, selectRecordsForFoldRole } from "./folds.ts";
import type { ResearchFoldId } from "./constants.ts";
import type { BacktestSignalResult } from "../backtest/types.ts";
import type { M3R4CandidateId } from "./selection-gates-round-004.ts";
import { stableStringify, deepFreeze } from "./utils.ts";
import {
  h13RawStatusToResearchStatus,
  type H13RawResult,
} from "./m3-r4-round-004-settlement.ts";
import type { ResearchDiagnostics, NormalizedResearchSignal, ResearchRange } from "./types.ts";

export const M3_R4_ROUND_004_REPORT_SCHEMA_VERSION = "m3-r4-round-004-report-001" as const;
export const M3_R4_ROUND_004_DECISION = "DEFER_TO_M3_R4_D_FROZEN_GATE_APPLICATION" as const;
export const M3_R4_ROUND_004_SIGNAL_LEVEL_DISCLAIMER =
  "THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION." as const;

export type Round004CandidateKey = "CONTROL" | M3R4CandidateId;

export type Round004ResearchRecord = Readonly<{
  candidateId: Round004CandidateKey;
  signal: NormalizedResearchSignal;
  raw: BacktestSignalResult | H13RawResult;
  decisionAudit?: Readonly<Record<string, unknown>>;
  outcomeAudit?: Readonly<Record<string, unknown>>;
}>;

export type Round004FoldDiagnostics = Readonly<{
  foldId: ResearchFoldId;
  research: Readonly<{ range: ResearchRange; records: readonly NormalizedResearchSignal[]; diagnostics: ResearchDiagnostics }>;
  validation: Readonly<{ range: ResearchRange; records: readonly NormalizedResearchSignal[]; diagnostics: ResearchDiagnostics }>;
}>;

export type Round004CandidateEvidence = Readonly<{
  candidateId: Round004CandidateKey;
  fullSeenUniverse: Readonly<{ range: ResearchRange; records: readonly NormalizedResearchSignal[]; diagnostics: ResearchDiagnostics }>;
  folds: readonly Round004FoldDiagnostics[];
  aggregateValidation: Readonly<{
    segments: readonly ResearchRange[];
    records: readonly NormalizedResearchSignal[];
    diagnostics: ResearchDiagnostics;
  }>;
  formalIdentitySha256: string;
  executedIdentitySha256: string;
}>;

export type Round004AuditArtifact = Readonly<{
  schemaVersion: "m3-r4-round-004-audit-001";
  decisions: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
  outcomes: Readonly<Record<string, readonly Readonly<Record<string, unknown>>[]>>;
}>;

export type Round004Report = Readonly<{
  schemaVersion: typeof M3_R4_ROUND_004_REPORT_SCHEMA_VERSION;
  researchRoundId: "baseline-002-research-round-004";
  protocolBaseMainSha: string;
  executionSourceSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  strategyVersion: "baseline-001";
  backtestPolicyVersion: "bt-policy-003";
  dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA";
  researchUniverse: ResearchRange;
  studyServerTime: number;
  performanceLock: "FIRST_M3_R4_PERFORMANCE_RESULT_GENERATED";
  performanceLockTriggered: boolean;
  evidenceStatus: "COMPLETE" | "INCOMPLETE";
  integrityErrors: readonly string[];
  control: Round004CandidateEvidence;
  candidates: readonly Round004CandidateEvidence[];
  auditArtifactPath: string;
  auditArtifactSha256: string;
  decision: typeof M3_R4_ROUND_004_DECISION;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  disclaimer: typeof M3_R4_ROUND_004_SIGNAL_LEVEL_DISCLAIMER;
  seenDataStatement: string;
}>;

export type Round004ExecutionArtifacts = Readonly<{
  report: Round004Report;
  auditArtifact: Round004AuditArtifact;
  summaryJson: string;
  auditJson: string;
  resultsMarkdown: string;
}>;

export type Round004EvidenceIntegrityInput = Readonly<{
  controlParityPassed: boolean;
  candidateFormationDataIncomplete?: readonly string[];
  h13ExpectedIdentities: readonly string[];
  h14ExpectedEligibleIdentities: readonly string[];
}>;

export type Round004EvidenceIntegrity = Readonly<{
  passed: boolean;
  errors: readonly string[];
}>;

const CANDIDATE_ORDER: readonly Round004CandidateKey[] = Object.freeze([
  "CONTROL",
  "R4-H11-BREAKOUT-RETEST",
  "R4-H12-PULLBACK-RECLAIM",
  "R4-H13-ADAPTIVE-TREND-EXIT",
  "R4-H14-RELATIVE-STRENGTH",
]);

function symbolIndex(symbol: ResearchSymbol): number {
  return RESEARCH_SYMBOLS.indexOf(symbol);
}

function directionIndex(direction: NormalizedResearchSignal["direction"]): number {
  return direction === "LONG" ? 0 : 1;
}

function identity(signal: Pick<NormalizedResearchSignal, "symbol" | "direction" | "signalTime">): string {
  return `${signal.symbol}|${signal.direction}|${signal.signalTime}`;
}

function recordCompare(left: NormalizedResearchSignal, right: NormalizedResearchSignal): number {
  return left.signalTime - right.signalTime || symbolIndex(left.symbol) - symbolIndex(right.symbol) || directionIndex(left.direction) - directionIndex(right.direction);
}

function candidateIndex(candidateId: Round004CandidateKey): number {
  return CANDIDATE_ORDER.indexOf(candidateId);
}

export function normalizeH13Result(result: H13RawResult): NormalizedResearchSignal {
  return deepFreeze({
    signalTime: result.snapshot.signalTime,
    symbol: result.snapshot.symbol,
    direction: result.snapshot.direction,
    symbolRegime: result.snapshot.symbolRegime,
    btcRegime: result.snapshot.btcRegime,
    totalScore: result.snapshot.totalScore,
    grade: result.snapshot.grade,
    status: h13RawStatusToResearchStatus(result.status),
    entryTime: result.entryTime,
    exitTime: result.exitTime,
    grossR: result.grossR,
    feeR: result.feeR,
    fundingR: result.fundingR,
    netR: result.netR,
  });
}

export function normalizeRound004Result(
  candidateId: Round004CandidateKey,
  result: BacktestSignalResult | H13RawResult,
  audit: Readonly<{ decision?: Readonly<Record<string, unknown>>; outcome?: Readonly<Record<string, unknown>> }> = {},
): Round004ResearchRecord {
  const signal = "decisionAudit" in result ? normalizeH13Result(result) : adaptBacktestSignalResult(result);
  return deepFreeze({
    candidateId,
    signal,
    raw: result,
    ...(audit.decision ? { decisionAudit: audit.decision } : {}),
    ...(audit.outcome ? { outcomeAudit: audit.outcome } : {}),
  });
}

export function canonicalizeRound004Records(records: readonly Round004ResearchRecord[]): readonly Round004ResearchRecord[] {
  const seen = new Set<string>();
  for (const record of records) {
    const key = `${record.candidateId}|${identity(record.signal)}`;
    if (seen.has(key)) throw new Error(`Duplicate Round-004 record: ${key}.`);
    seen.add(key);
  }
  return Object.freeze([...records].sort((left, right) => candidateIndex(left.candidateId) - candidateIndex(right.candidateId) || recordCompare(left.signal, right.signal)));
}

export function canonicalRound004IdentityArray(records: readonly Round004ResearchRecord[], executedOnly = false): readonly string[] {
  return Object.freeze(
    canonicalizeRound004Records(records)
      .filter((record) => !executedOnly || record.signal.status === "EXECUTED")
      .map((record) => `${record.candidateId}|${identity(record.signal)}`),
  );
}

export function hashRound004Identities(records: readonly Round004ResearchRecord[], executedOnly = false): string {
  return createHash("sha256").update(stableStringify(canonicalRound004IdentityArray(records, executedOnly)), "utf8").digest("hex");
}

function diagnosticsFor(records: readonly NormalizedResearchSignal[], range: ResearchRange): ResearchDiagnostics {
  return calculateResearchDiagnostics({ records, range });
}

export function buildRound004FoldDiagnostics(records: readonly Round004ResearchRecord[]): readonly Round004FoldDiagnostics[] {
  const signals = records.map((record) => record.signal);
  return Object.freeze(
    (Object.keys(RESEARCH_FOLDS) as ResearchFoldId[]).map((foldId) => {
      const fold = RESEARCH_FOLDS[foldId];
      const research = selectRecordsForFoldRole(signals, foldId, "RESEARCH");
      const validation = selectRecordsForFoldRole(signals, foldId, "VALIDATION");
      return Object.freeze({
        foldId,
        research: Object.freeze({ range: fold.research, records: research, diagnostics: diagnosticsFor(research, getResearchFoldRoleRange(foldId, "RESEARCH")) }),
        validation: Object.freeze({ range: fold.validation, records: validation, diagnostics: diagnosticsFor(validation, getResearchFoldRoleRange(foldId, "VALIDATION")) }),
      });
    }),
  );
}

export function buildAggregateValidationDiagnostics(records: readonly Round004ResearchRecord[]): Round004CandidateEvidence["aggregateValidation"] {
  const signals = records.map((record) => record.signal);
  const segments = Object.values(RESEARCH_FOLDS).map((fold) => fold.validation);
  const aggregate = [...new Map(signals.filter((signal) => segments.some((range) => signal.signalTime >= range.startTime && signal.signalTime <= range.endTime)).map((signal) => [identity(signal), signal])).values()].sort(recordCompare);
  const first = segments[0]!;
  const last = segments[segments.length - 1]!;
  return Object.freeze({
    segments: Object.freeze(segments),
    records: Object.freeze(aggregate),
    diagnostics: diagnosticsFor(aggregate, { startTime: first.startTime, endTime: last.endTime }),
  });
}

export function buildRound004CandidateEvidence(input: Readonly<{
  candidateId: Round004CandidateKey;
  records: readonly Round004ResearchRecord[];
  researchUniverse: ResearchRange;
}>): Round004CandidateEvidence {
  const canonical = canonicalizeRound004Records(input.records).filter((record) => record.candidateId === input.candidateId);
  const signals = Object.freeze(canonical.map((record) => record.signal));
  return Object.freeze({
    candidateId: input.candidateId,
    fullSeenUniverse: Object.freeze({ range: input.researchUniverse, records: signals, diagnostics: diagnosticsFor(signals, input.researchUniverse) }),
    folds: buildRound004FoldDiagnostics(canonical),
    aggregateValidation: buildAggregateValidationDiagnostics(canonical),
    formalIdentitySha256: hashRound004Identities(canonical),
    executedIdentitySha256: hashRound004Identities(canonical, true),
  });
}

function identitySetForCandidate(
  records: readonly Round004ResearchRecord[],
  candidateId: Round004CandidateKey,
): ReadonlySet<string> {
  return new Set(records.filter((record) => record.candidateId === candidateId).map((record) => identity(record.signal)));
}

function appendIdentityMismatch(
  errors: string[],
  label: string,
  expectedIdentities: readonly string[],
  actualIdentities: ReadonlySet<string>,
): void {
  const expected = new Set(expectedIdentities);
  if (expected.size !== expectedIdentities.length) errors.push(`${label}_EXPECTED_IDENTITIES_DUPLICATE`);
  if (actualIdentities.size !== expected.size || [...expected].some((item) => !actualIdentities.has(item))) {
    errors.push(`${label}_IDENTITY_MISMATCH`);
  }
  if ([...actualIdentities].some((item) => !expected.has(item))) errors.push(`${label}_UNEXPECTED_IDENTITY`);
}

export function validateRound004EvidenceIntegrity(
  records: readonly Round004ResearchRecord[],
  input: Round004EvidenceIntegrityInput,
): Round004EvidenceIntegrity {
  const errors: string[] = [];
  if (input.controlParityPassed !== true) errors.push("CONTROL_PARITY_REQUIRED");
  for (const diagnostic of input.candidateFormationDataIncomplete ?? []) {
    errors.push(`CANDIDATE_FORMATION_DATA_INCOMPLETE:${diagnostic}`);
  }
  try {
    canonicalizeRound004Records(records);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "ROUND_004_RECORD_IDENTITY_INVALID");
  }
  for (const record of records) {
    if (record.signal.status === "DATA_INCOMPLETE") errors.push(`DATA_INCOMPLETE:${record.candidateId}:${identity(record.signal)}`);
    if (record.signal.status === "SETTLEMENT_AMBIGUOUS") errors.push(`SETTLEMENT_AMBIGUOUS:${record.candidateId}:${identity(record.signal)}`);
  }
  appendIdentityMismatch(
    errors,
    "H13_FORMAL_POPULATION",
    input.h13ExpectedIdentities,
    identitySetForCandidate(records, "R4-H13-ADAPTIVE-TREND-EXIT"),
  );
  appendIdentityMismatch(
    errors,
    "H14_ELIGIBLE_POPULATION",
    input.h14ExpectedEligibleIdentities,
    identitySetForCandidate(records, "R4-H14-RELATIVE-STRENGTH"),
  );
  try {
    const constructionRange = Object.freeze({
      startTime: RESEARCH_FOLDS.F1.research.startTime,
      endTime: RESEARCH_FOLDS.F6.validation.endTime,
    });
    for (const candidateId of CANDIDATE_ORDER) {
      buildRound004CandidateEvidence({ candidateId, records, researchUniverse: constructionRange });
    }
  } catch (error) {
    errors.push(`CANDIDATE_EVIDENCE_CONSTRUCTION_FAILED:${error instanceof Error ? error.message : "unknown"}`);
  }
  return Object.freeze({ passed: errors.length === 0, errors: Object.freeze(errors) });
}

export function buildRound004AuditArtifact(records: readonly Round004ResearchRecord[]): Round004AuditArtifact {
  const decisions: Record<string, Readonly<Record<string, unknown>>[]> = {};
  const outcomes: Record<string, Readonly<Record<string, unknown>>[]> = {};
  for (const record of canonicalizeRound004Records(records)) {
    if (record.decisionAudit) (decisions[record.candidateId] ??= []).push(record.decisionAudit);
    if (record.outcomeAudit) (outcomes[record.candidateId] ??= []).push(record.outcomeAudit);
  }
  return deepFreeze({ schemaVersion: "m3-r4-round-004-audit-001", decisions, outcomes });
}

export function buildRound004Report(input: Readonly<{
  protocolBaseMainSha: string;
  executionSourceSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  studyServerTime: number;
  researchUniverse: ResearchRange;
  records: readonly Round004ResearchRecord[];
  integrityErrors?: readonly string[];
  integrityValidation?: Round004EvidenceIntegrity;
}>): Round004Report {
  const all = canonicalizeRound004Records(input.records);
  const artifact = buildRound004AuditArtifact(all);
  const artifactJson = stableStringify(artifact);
  const byCandidate = CANDIDATE_ORDER.map((candidateId) =>
    buildRound004CandidateEvidence({ candidateId, records: all, researchUniverse: input.researchUniverse }),
  );
  const integrityErrors = Object.freeze([
    ...(input.integrityErrors ?? []),
    ...(input.integrityValidation?.errors ?? ["EVIDENCE_INTEGRITY_NOT_VALIDATED"]),
  ]);
  const evidenceComplete = input.integrityValidation?.passed === true && integrityErrors.length === 0;
  return deepFreeze({
    schemaVersion: M3_R4_ROUND_004_REPORT_SCHEMA_VERSION,
    researchRoundId: "baseline-002-research-round-004",
    protocolBaseMainSha: input.protocolBaseMainSha,
    executionSourceSha: input.executionSourceSha,
    selectionGateSha256: input.selectionGateSha256,
    experimentPlanSha256: input.experimentPlanSha256,
    strategyVersion: "baseline-001",
    backtestPolicyVersion: "bt-policy-003",
    dataClassification: "RESEARCH_AVAILABLE_SEEN_DATA",
    researchUniverse: input.researchUniverse,
    studyServerTime: input.studyServerTime,
    performanceLock: "FIRST_M3_R4_PERFORMANCE_RESULT_GENERATED",
    performanceLockTriggered: all.some((record) => record.signal.status === "EXECUTED"),
    evidenceStatus: evidenceComplete ? "COMPLETE" : "INCOMPLETE",
    integrityErrors,
    control: byCandidate[0]!,
    candidates: Object.freeze(byCandidate.slice(1)),
    auditArtifactPath: "docs/evidence/M3_R4_ROUND_004_AUDIT.json",
    auditArtifactSha256: createHash("sha256").update(artifactJson, "utf8").digest("hex"),
    decision: M3_R4_ROUND_004_DECISION,
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
    disclaimer: M3_R4_ROUND_004_SIGNAL_LEVEL_DISCLAIMER,
    seenDataStatement: "All market data through 2026-08-15 is research-available seen data and is NOT true forward unseen OOS.",
  });
}

export function serializeRound004Report(report: Round004Report): string {
  return `${stableStringify(report)}\n`;
}

function formatMetric(value: number | null): string {
  return value === null ? "null" : String(value);
}

export function renderRound004ResultsMarkdown(report: Round004Report): string {
  const lines = [
    "# M3-R4-C Round-004 Performance Results",
    "",
    `researchRoundId: ${report.researchRoundId}`,
    `protocolBaseMainSha: ${report.protocolBaseMainSha}`,
    `executionSourceSha: ${report.executionSourceSha}`,
    `selectionGateSha256: ${report.selectionGateSha256}`,
    `experimentPlanSha256: ${report.experimentPlanSha256}`,
    `strategyVersion: ${report.strategyVersion}`,
    `backtestPolicyVersion: ${report.backtestPolicyVersion}`,
    `dataClassification: ${report.dataClassification}`,
    `studyServerTime: ${report.studyServerTime}`,
    `performanceLock: ${report.performanceLock}`,
    `performanceLockTriggered: ${report.performanceLockTriggered}`,
    `evidenceStatus: ${report.evidenceStatus}`,
    `integrityErrors: ${report.integrityErrors.length === 0 ? "none" : report.integrityErrors.join("; ")}`,
    `auditArtifactSha256: ${report.auditArtifactSha256}`,
    `decision: ${report.decision}`,
    `baseline002Status: ${report.baseline002Status}`,
    `m3JStatus: ${report.m3JStatus}`,
    `m4Status: ${report.m4Status}`,
    "",
    "## Candidate summaries",
    "",
    "| candidate | full-seen formal signals | full-seen executed trades | full-seen net R | validation formal signals | validation executed trades | validation net R | formal identity SHA-256 | executed identity SHA-256 |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
  ];
  for (const evidence of [report.control, ...report.candidates]) {
    const full = evidence.fullSeenUniverse.diagnostics;
    const validation = evidence.aggregateValidation.diagnostics;
    lines.push(`| ${evidence.candidateId} | ${full.formalSignals} | ${full.executedTrades} | ${formatMetric(full.netR)} | ${validation.formalSignals} | ${validation.executedTrades} | ${formatMetric(validation.netR)} | ${evidence.formalIdentitySha256} | ${evidence.executedIdentitySha256} |`);
  }
  lines.push(
    "",
    "## F1-F6 validation diagnostics",
    "",
    "| candidate | fold | formal signals | executed trades | net R | expectancy R | profit factor |",
    "| --- | --- | ---: | ---: | ---: | ---: | ---: |",
  );
  for (const evidence of [report.control, ...report.candidates]) {
    for (const fold of evidence.folds) {
      const diagnostics = fold.validation.diagnostics;
      lines.push(`| ${evidence.candidateId} | ${fold.foldId} | ${diagnostics.formalSignals} | ${diagnostics.executedTrades} | ${formatMetric(diagnostics.netR)} | ${formatMetric(diagnostics.expectancyR)} | ${formatMetric(diagnostics.profitFactor)} |`);
    }
  }
  lines.push(
    "",
    "## Data integrity and governance",
    "",
    `auditArtifactPath: ${report.auditArtifactPath}`,
    "Gate application: deferred to M3-R4-D; no candidate selection is performed by M3-R4-C.",
    "Baseline-002 remains NOT FROZEN.",
    report.disclaimer,
    report.seenDataStatement,
    "",
  );
  return `${lines.join("\n")}\n`;
}

export function buildRound004ExecutionArtifacts(input: Readonly<{
  protocolBaseMainSha: string;
  executionSourceSha: string;
  selectionGateSha256: string;
  experimentPlanSha256: string;
  studyServerTime: number;
  researchUniverse: ResearchRange;
  records: readonly Round004ResearchRecord[];
  integrityErrors?: readonly string[];
  integrityValidation?: Round004EvidenceIntegrity;
}>): Round004ExecutionArtifacts {
  const report = buildRound004Report(input);
  const auditArtifact = buildRound004AuditArtifact(input.records);
  const auditCanonicalJson = stableStringify(auditArtifact);
  const auditJson = `${auditCanonicalJson}\n`;
  const auditSha256 = createHash("sha256").update(auditCanonicalJson, "utf8").digest("hex");
  if (auditSha256 !== report.auditArtifactSha256) throw new Error("Round-004 audit SHA binding failed.");
  return Object.freeze({
    report,
    auditArtifact,
    summaryJson: serializeRound004Report(report),
    auditJson,
    resultsMarkdown: renderRound004ResultsMarkdown(report),
  });
}

export const round004CandidateOrder = CANDIDATE_ORDER;
