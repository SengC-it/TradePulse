import type {
  ResearchBtcRegime,
  ResearchDataClassification,
  ResearchDirection,
  ResearchFoldId,
  ResearchFoldRole,
  ResearchGrade,
  ResearchHypothesisId,
  ResearchSignalStatus,
  ResearchSymbolRegime,
} from "./constants.ts";
import type { ResearchSymbol } from "../config/constants.ts";

export type ResearchRange = Readonly<{
  startTime: number;
  endTime: number;
}>;

export type ResearchFold = Readonly<{
  foldId: ResearchFoldId;
  research: ResearchRange;
  validation: ResearchRange;
}>;

export type NormalizedResearchSignal = Readonly<{
  signalTime: number;
  symbol: ResearchSymbol;
  direction: ResearchDirection;
  symbolRegime: ResearchSymbolRegime;
  btcRegime: ResearchBtcRegime;
  totalScore: number;
  grade: ResearchGrade | null;
  status: ResearchSignalStatus;
  entryTime: number | null;
  exitTime: number | null;
  grossR: number | null;
  feeR: number | null;
  fundingR: number | null;
  netR: number | null;
  researchRoundId?: string;
  experimentId?: string;
  variantId?: string;
}>;

export type ResearchProfitFactorStatus = "NORMAL" | "NO_TRADES" | "NO_LOSSES";

export type ResearchGroupMetrics = Readonly<{
  formalSignals: number;
  executedTrades: number;
  grossR: number;
  feeR: number;
  fundingR: number;
  netR: number;
  expectancyR: number | null;
  profitFactor: number | null;
  profitFactorStatus: ResearchProfitFactorStatus;
  winRate: number | null;
}>;

export type ResearchDiagnostics = Readonly<{
  range: ResearchRange;
  utcCalendarDays: number;
  formalSignals: number;
  executedTrades: number;
  signalsPerDay: number;
  signalsPerSymbol: Readonly<Record<ResearchSymbol, number>>;
  uniqueSignalHours: number;
  uniqueSignalHoursBySymbol: Readonly<Record<ResearchSymbol, number>>;
  repeatSignalsWithin6h: number;
  repeatSignalsWithin12h: number;
  repeatSignalsWithin24h: number;
  overlappingSignalCount: number;
  overlappingSignalRate: number | null;
  grossR: number;
  feeR: number;
  fundingR: number;
  netR: number;
  netRPerExecutedSignal: number | null;
  profitFactor: number | null;
  profitFactorStatus: ResearchProfitFactorStatus;
  expectancyR: number | null;
  winRate: number | null;
  feeBurdenRatio: number | null;
  totalPositiveNetR: number;
  topSymbolShareOfPositiveNetR: number | null;
  largestSingleTradeShareOfPositiveNetR: number | null;
  bySymbol: Readonly<Record<ResearchSymbol, ResearchGroupMetrics>>;
  byDirection: Readonly<Record<ResearchDirection, ResearchGroupMetrics>>;
  byGrade: Readonly<Record<string, ResearchGroupMetrics>>;
  byBtcRegime: Readonly<Record<ResearchBtcRegime, ResearchGroupMetrics>>;
  bySymbolRegime: Readonly<Record<ResearchSymbolRegime, ResearchGroupMetrics>>;
  byUtcSignalMonth: Readonly<Record<string, ResearchGroupMetrics>>;
  byUtcSignalYear: Readonly<Record<string, ResearchGroupMetrics>>;
}>;

export type ScoreBucketDefinition = Readonly<{
  id: string;
  minInclusive: number;
  maxExclusive: number | null;
}>;

export type ScoreBucketDiagnostics = ResearchGroupMetrics & Readonly<{
  bucket: ScoreBucketDefinition;
  feeBurdenRatio: number | null;
}>;

export type ScoreMonotonicityStatus =
  | "NON_DECREASING"
  | "NON_INCREASING"
  | "MIXED"
  | "INSUFFICIENT_DATA";

export type ScoreBucketReport = Readonly<{
  buckets: readonly ScoreBucketDiagnostics[];
  unassignedScoreCount: number;
  monotonicity: ScoreMonotonicityStatus;
}>;

export type ScalarParameterValue = string | number | boolean;

export type ExperimentDefinitionInput = Readonly<{
  researchRoundId: string;
  experimentId: string;
  variantId: string;
  hypothesisId: ResearchHypothesisId;
  exactChange: string;
  rationale: string;
  parametersTested: readonly string[];
  predeclaredParameterValues: Readonly<Record<string, readonly ScalarParameterValue[]>>;
}>;

export type ExperimentDefinition = ExperimentDefinitionInput;

export type ExperimentOutcome = Readonly<{
  definition: ExperimentDefinition;
  result: Readonly<Record<string, unknown>>;
  decision: string;
}>;

export type ResearchCandidateIdentity = Readonly<{
  experimentId: string;
  variantId: string;
  parameterValues?: Readonly<Record<string, ScalarParameterValue>>;
}>;

export type NumericSelectionGate = Readonly<{
  value: number;
  unit: string;
  direction: "MINIMUM" | "MAXIMUM";
  denominator: string;
  comparison: "AT_LEAST" | "AT_MOST" | "EQUAL";
}>;

export type SimplerCandidateRule = Readonly<{
  rule: string;
  tieBreakOrder: readonly string[];
}>;

export type SelectionGateSchema = Readonly<{
  researchRoundId: string;
  sourceSha: string;
  minimumAggregateImprovement: NumericSelectionGate;
  minimumImprovedValidationFolds: NumericSelectionGate;
  catastrophicFoldLimit: NumericSelectionGate;
  minimumNetExpectancy: NumericSelectionGate;
  minimumProfitFactor: NumericSelectionGate;
  maximumSymbolConcentration: NumericSelectionGate;
  maximumSingleTradeConcentration: NumericSelectionGate;
  requiredRedundancyImprovement: NumericSelectionGate;
  minimumFormalSignals: NumericSelectionGate;
  minimumExecutedTrades: NumericSelectionGate;
  complexityTieThreshold: NumericSelectionGate;
  simplerCandidateRule: SimplerCandidateRule;
}>;

export type ResearchDiagnosticsReport = Readonly<{
  schemaVersion: "m3-g-research-diagnostics-001";
  researchRoundId: string;
  experimentId: string;
  variantId: string;
  foldId: ResearchFoldId;
  foldRole: ResearchFoldRole;
  range: ResearchRange;
  dataClassification: ResearchDataClassification;
  backtestPolicyVersion: "bt-policy-003";
  studyServerTime: number;
  diagnostics: ResearchDiagnostics;
}>;
