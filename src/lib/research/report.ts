import {
  RESEARCH_BACKTEST_POLICY_VERSION,
  RESEARCH_CONTROL_EXPERIMENT_ID,
  RESEARCH_DIAGNOSTICS_SCHEMA_VERSION,
} from "./constants.ts";
import { getResearchFold, validateResearchRange } from "./folds.ts";
import type {
  ResearchCandidateIdentity,
  ResearchDiagnosticsReport,
} from "./types.ts";
import { deepFreeze, requireSafeTimestamp, stableStringify } from "./utils.ts";

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must be non-empty.`);
}

export function createResearchDiagnosticsReport(input: Readonly<Omit<ResearchDiagnosticsReport, "schemaVersion">>): ResearchDiagnosticsReport {
  requireNonEmpty(input.researchRoundId, "researchRoundId");
  requireNonEmpty(input.experimentId, "experimentId");
  requireNonEmpty(input.variantId, "variantId");
  getResearchFold(input.foldId);
  validateResearchRange(input.range);
  if (input.foldRole !== "RESEARCH" && input.foldRole !== "VALIDATION") throw new Error("Invalid research fold role.");
  if (input.dataClassification !== "RESEARCH_AVAILABLE_SEEN_DATA" && input.dataClassification !== "SYNTHETIC_FIXTURE") {
    throw new Error("Invalid research data classification.");
  }
  if (input.backtestPolicyVersion !== RESEARCH_BACKTEST_POLICY_VERSION) {
    throw new Error("Research diagnostics must use bt-policy-003.");
  }
  requireSafeTimestamp(input.studyServerTime, "studyServerTime");
  if (input.studyServerTime <= 0) throw new Error("studyServerTime must be positive.");
  return deepFreeze({
    ...input,
    schemaVersion: RESEARCH_DIAGNOSTICS_SCHEMA_VERSION,
    range: { startTime: input.range.startTime, endTime: input.range.endTime },
  });
}

function candidateParameterKey(candidate: ResearchCandidateIdentity): string {
  return stableStringify(candidate.parameterValues ?? {});
}

export function orderResearchCandidates<T extends ResearchCandidateIdentity>(candidates: readonly T[]): readonly T[] {
  return Object.freeze([...candidates].sort((left, right) => {
    const leftControl = left.experimentId === RESEARCH_CONTROL_EXPERIMENT_ID ? 0 : 1;
    const rightControl = right.experimentId === RESEARCH_CONTROL_EXPERIMENT_ID ? 0 : 1;
    if (leftControl !== rightControl) return leftControl - rightControl;
    const experimentDifference = left.experimentId.localeCompare(right.experimentId);
    if (experimentDifference !== 0) return experimentDifference;
    const variantDifference = left.variantId.localeCompare(right.variantId);
    if (variantDifference !== 0) return variantDifference;
    return candidateParameterKey(left).localeCompare(candidateParameterKey(right));
  }));
}

export function serializeResearchDiagnosticsReport(report: ResearchDiagnosticsReport): string {
  return `${stableStringify(report)}\n`;
}

export const serializeResearchReport = serializeResearchDiagnosticsReport;
