import { deepFreeze } from "./utils.ts";

export type R8ResearchEvidenceStatus = "COMPLETE" | "INCOMPLETE";

export type R8EvidenceLifecycleInput = Readonly<{
  datasetFreezeCompleted: boolean;
  integrityErrors: readonly string[];
  requiredDataIncomplete: boolean;
  unresolvedSettlementAmbiguity: boolean;
  requiredValidationDatasetsComplete: boolean;
  controlExecutionCompletedStructurally: boolean;
  controlEconomicStatus: "PASS" | "FAIL" | "INCOMPLETE";
  allCandidatesEconomicallyFail?: boolean;
}>;

/** Economic performance and research-evidence completeness are independent. */
export function classifyResearchEvidenceStatus(input: R8EvidenceLifecycleInput): R8ResearchEvidenceStatus {
  if (!input.datasetFreezeCompleted) return "INCOMPLETE";
  if (input.integrityErrors.length > 0) return "INCOMPLETE";
  if (input.requiredDataIncomplete) return "INCOMPLETE";
  if (input.unresolvedSettlementAmbiguity) return "INCOMPLETE";
  if (!input.requiredValidationDatasetsComplete) return "INCOMPLETE";
  if (!input.controlExecutionCompletedStructurally) return "INCOMPLETE";
  return "COMPLETE";
}

export function canContinueR8CandidateExecution(input: R8EvidenceLifecycleInput): boolean {
  return classifyResearchEvidenceStatus(input) === "COMPLETE";
}

export type R8SyntheticLifecycleResult = Readonly<{
  passed: boolean;
  scenarios: readonly Readonly<{ id: string; expected: R8ResearchEvidenceStatus; actual: R8ResearchEvidenceStatus; candidateExecutionContinues: boolean }>[];
}>;

export function runR8SyntheticLifecycleContract(): R8SyntheticLifecycleResult {
  const complete = (controlEconomicStatus: "PASS" | "FAIL", allCandidatesEconomicallyFail = false): R8EvidenceLifecycleInput => ({
    datasetFreezeCompleted: true,
    integrityErrors: [],
    requiredDataIncomplete: false,
    unresolvedSettlementAmbiguity: false,
    requiredValidationDatasetsComplete: true,
    controlExecutionCompletedStructurally: true,
    controlEconomicStatus,
    allCandidatesEconomicallyFail,
  });
  const scenarios = [
    ["A_CONTROL_ECONOMIC_FAIL", complete("FAIL"), "COMPLETE" as const],
    ["B_ALL_CANDIDATES_ECONOMIC_FAIL", complete("FAIL", true), "COMPLETE" as const],
    ["C_CONTROL_ECONOMIC_PASS", complete("PASS"), "COMPLETE" as const],
    ["D_DATA_INCOMPLETE", { ...complete("FAIL"), requiredDataIncomplete: true }, "INCOMPLETE" as const],
    ["E_SETTLEMENT_AMBIGUOUS", { ...complete("FAIL"), unresolvedSettlementAmbiguity: true }, "INCOMPLETE" as const],
    ["F_INTEGRITY_ERROR", { ...complete("FAIL"), integrityErrors: ["synthetic integrity error"] }, "INCOMPLETE" as const],
  ].map(([id, input, expected]) => {
    const actual = classifyResearchEvidenceStatus(input as R8EvidenceLifecycleInput);
    return Object.freeze({ id: id as string, expected: expected as R8ResearchEvidenceStatus, actual, candidateExecutionContinues: canContinueR8CandidateExecution(input as R8EvidenceLifecycleInput) });
  });
  return deepFreeze({ passed: scenarios.every((scenario) => scenario.actual === scenario.expected && (scenario.expected === "COMPLETE" ? scenario.candidateExecutionContinues : !scenario.candidateExecutionContinues)), scenarios });
}
