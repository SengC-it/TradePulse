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
  "maximumFeeBurdenRatio",
  "requiredRedundancyImprovement",
  "minimumFormalSignals",
  "minimumExecutedTrades",
  "complexityTieThreshold",
] as const satisfies readonly (keyof Omit<SelectionGateSchema, "researchRoundId" | "sourceSha" | "simplerCandidateRule">)[];

type GateField = (typeof GATE_FIELDS)[number];

const GATE_SEMANTICS: Readonly<Record<GateField, Readonly<Pick<NumericSelectionGate, "direction" | "comparison">>>> = {
  minimumAggregateImprovement: { direction: "MINIMUM", comparison: "AT_LEAST" },
  minimumImprovedValidationFolds: { direction: "MINIMUM", comparison: "AT_LEAST" },
  catastrophicFoldLimit: { direction: "MAXIMUM", comparison: "AT_MOST" },
  minimumNetExpectancy: { direction: "MINIMUM", comparison: "AT_LEAST" },
  minimumProfitFactor: { direction: "MINIMUM", comparison: "AT_LEAST" },
  maximumSymbolConcentration: { direction: "MAXIMUM", comparison: "AT_MOST" },
  maximumSingleTradeConcentration: { direction: "MAXIMUM", comparison: "AT_MOST" },
  maximumFeeBurdenRatio: { direction: "MAXIMUM", comparison: "AT_MOST" },
  requiredRedundancyImprovement: { direction: "MINIMUM", comparison: "AT_LEAST" },
  minimumFormalSignals: { direction: "MINIMUM", comparison: "AT_LEAST" },
  minimumExecutedTrades: { direction: "MINIMUM", comparison: "AT_LEAST" },
  // Maximum allowed complexity delta for the simpler-candidate tie; value is supplied by a round record.
  complexityTieThreshold: { direction: "MAXIMUM", comparison: "AT_MOST" },
};

function validateNumericGate(gate: NumericSelectionGate, field: GateField): NumericSelectionGate {
  requireFiniteNumber(gate.value, `${field}.value`);
  if (gate.unit.trim().length === 0) throw new Error(`${field}.unit must be non-empty.`);
  if (gate.denominator.trim().length === 0) throw new Error(`${field}.denominator must be non-empty.`);
  const semantics = GATE_SEMANTICS[field];
  if (gate.direction !== semantics.direction) throw new Error(`${field}.direction must be ${semantics.direction}.`);
  if (gate.comparison !== semantics.comparison) throw new Error(`${field}.comparison must be ${semantics.comparison}.`);
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
  if (new Set(input.simplerCandidateRule.tieBreakOrder).size !== input.simplerCandidateRule.tieBreakOrder.length) {
    throw new Error("simplerCandidateRule.tieBreakOrder contains duplicate values.");
  }
  return deepFreeze({
    ...input,
    simplerCandidateRule: {
      rule: input.simplerCandidateRule.rule,
      tieBreakOrder: Object.freeze([...input.simplerCandidateRule.tieBreakOrder]),
    },
  });
}
