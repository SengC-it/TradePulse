import { RESEARCH_HYPOTHESIS_IDS, RESEARCH_CONTROL_EXPERIMENT_ID, type ResearchHypothesisId } from "./constants.ts";
import type { ExperimentDefinition, ExperimentDefinitionInput, ExperimentOutcome } from "./types.ts";
import { deepFreeze, isPlainScalar, stableStringify } from "./utils.ts";

function requireNonEmpty(value: string, label: string): void {
  if (value.trim().length === 0) throw new Error(`${label} must be non-empty.`);
}

function validateParameterValues(
  values: Readonly<Record<string, readonly (string | number | boolean)[]>>,
): Readonly<Record<string, readonly (string | number | boolean)[]>> {
  const sortedEntries = Object.entries(values).sort(([left], [right]) => left.localeCompare(right));
  const normalized: Record<string, readonly (string | number | boolean)[]> = {};
  for (const [parameter, candidates] of sortedEntries) {
    requireNonEmpty(parameter, "Parameter name");
    if (candidates.length > 5) throw new Error(`Parameter ${parameter} has more than five candidate values.`);
    const seen = new Set<string>();
    const copy = candidates.map((candidate) => {
      if (!isPlainScalar(candidate)) throw new Error(`Parameter ${parameter} contains a non-scalar value.`);
      const key = stableStringify(candidate);
      if (seen.has(key)) throw new Error(`Parameter ${parameter} contains a duplicate candidate value.`);
      seen.add(key);
      return candidate;
    });
    normalized[parameter] = Object.freeze(copy);
  }
  return Object.freeze(normalized);
}

export function isResearchHypothesisId(value: unknown): value is ResearchHypothesisId {
  return RESEARCH_HYPOTHESIS_IDS.includes(value as ResearchHypothesisId);
}

export function createExperimentDefinition(input: ExperimentDefinitionInput): ExperimentDefinition {
  requireNonEmpty(input.researchRoundId, "researchRoundId");
  requireNonEmpty(input.experimentId, "experimentId");
  requireNonEmpty(input.variantId, "variantId");
  requireNonEmpty(input.exactChange, "exactChange");
  requireNonEmpty(input.rationale, "rationale");
  if (!isResearchHypothesisId(input.hypothesisId)) throw new Error(`Unknown research hypothesis: ${String(input.hypothesisId)}.`);
  if (input.parametersTested.some((parameter) => parameter.trim().length === 0)) {
    throw new Error("parametersTested contains an empty parameter name.");
  }
  return deepFreeze({
    researchRoundId: input.researchRoundId,
    experimentId: input.experimentId,
    variantId: input.variantId,
    hypothesisId: input.hypothesisId,
    exactChange: input.exactChange,
    rationale: input.rationale,
    parametersTested: Object.freeze([...input.parametersTested].sort((left, right) => left.localeCompare(right))),
    predeclaredParameterValues: validateParameterValues(input.predeclaredParameterValues),
  });
}

export function validateExperimentRegistry(
  definitions: readonly ExperimentDefinition[],
): readonly ExperimentDefinition[] {
  const experimentIds = new Set<string>();
  const normalized = definitions.map((definition) => {
    if (experimentIds.has(definition.experimentId)) throw new Error(`Duplicate experimentId: ${definition.experimentId}.`);
    experimentIds.add(definition.experimentId);
    return createExperimentDefinition(definition);
  });
  return Object.freeze(normalized);
}

export function attachExperimentOutcome(
  definition: ExperimentDefinition,
  result: Readonly<Record<string, unknown>>,
  decision: string,
): ExperimentOutcome {
  requireNonEmpty(decision, "Experiment decision");
  return deepFreeze({
    definition,
    result,
    decision,
  });
}

export function isControlExperiment(definition: Pick<ExperimentDefinition, "experimentId">): boolean {
  return definition.experimentId === RESEARCH_CONTROL_EXPERIMENT_ID;
}
