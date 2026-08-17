import type { NumericSelectionGate, SelectionGateSchema } from "./types.ts";
import { deepFreeze, requireFiniteNumber } from "./utils.ts";

const GATE_FIELDS = [
  "minimumAggregateImprovement",
  "minimumImprovedValidationFolds",
  "catastrophicFoldLimit",
  "minimumNetExpectancy",
  "minimumProfitFactor",
  "maximumSymbolConcentration",
  "maximumSingleTradeConcentration",
  "requiredRedundancyImprovement",
  "minimumFormalSignals",
  "minimumExecutedTrades",
  "complexityTieThreshold",
] as const satisfies readonly (keyof Omit<SelectionGateSchema, "researchRoundId" | "sourceSha" | "simplerCandidateRule">)[];

function validateNumericGate(gate: NumericSelectionGate, field: string): NumericSelectionGate {
  requireFiniteNumber(gate.value, `${field}.value`);
  if (gate.unit.trim().length === 0) throw new Error(`${field}.unit must be non-empty.`);
  if (gate.denominator.trim().length === 0) throw new Error(`${field}.denominator must be non-empty.`);
  if (gate.direction !== "MINIMUM" && gate.direction !== "MAXIMUM") throw new Error(`${field}.direction is invalid.`);
  if (!["AT_LEAST", "AT_MOST", "EQUAL"].includes(gate.comparison)) throw new Error(`${field}.comparison is invalid.`);
  return deepFreeze({ ...gate });
}

export function validateSelectionGateSchema(input: SelectionGateSchema): SelectionGateSchema {
  if (input.researchRoundId.trim().length === 0) throw new Error("Selection gate researchRoundId must be non-empty.");
  if (!/^[0-9a-f]{40}$/i.test(input.sourceSha)) throw new Error("Selection gate sourceSha must be a 40-character SHA-1.");
  for (const field of GATE_FIELDS) validateNumericGate(input[field], field);
  if (input.simplerCandidateRule.rule.trim().length === 0) throw new Error("simplerCandidateRule.rule must be non-empty.");
  if (input.simplerCandidateRule.tieBreakOrder.length === 0) throw new Error("simplerCandidateRule.tieBreakOrder must be non-empty.");
  if (input.simplerCandidateRule.tieBreakOrder.some((value) => value.trim().length === 0)) {
    throw new Error("simplerCandidateRule.tieBreakOrder contains an empty value.");
  }
  return deepFreeze({
    ...input,
    simplerCandidateRule: {
      rule: input.simplerCandidateRule.rule,
      tieBreakOrder: Object.freeze([...input.simplerCandidateRule.tieBreakOrder]),
    },
  });
}
