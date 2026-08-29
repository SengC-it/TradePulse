import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { BACKTEST_POLICY } from "../backtest/constants.ts";
import { RESEARCH_FOLDS } from "./folds.ts";
import { RESEARCH_FOLD_IDS } from "./constants.ts";
import { deepFreeze } from "./utils.ts";

export const M3_R12_RESEARCH_ROUND_ID = "baseline-002-research-round-012" as const;
export const M3_R12_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const M3_R12_RESEARCH_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const M3_R12_RESEARCH_RANGE = Object.freeze({
  startTime: Date.parse(M3_R12_RESEARCH_START_ISO),
  endTime: Date.parse(M3_R12_RESEARCH_END_ISO),
  classification: "RESEARCH_AVAILABLE_SEEN_DATA",
} as const);
export const M3_R12_PROTOCOL_VERSION = "m3-r12-round-012-thesis-deduplication-001" as const;
export const M3_R12_PERFORMANCE_LOCK = "FIRST_M3_R12_PERFORMANCE_RESULT_GENERATED" as const;
export const M3_R12_BASE_SOURCE_SHA = "8c38c3eb9a97e9f92654fc4f211c5a8aad96c225" as const;
export const M3_R12_CONTROL_ID = "R12-CONTROL-BASELINE-001" as const;
export const M3_R12_POLICY_VERSION = "bt-policy-003" as const;
export const M3_R12_NO_CANDIDATE_OUTCOME = "NO THESIS-DEDUP CANDIDATE — ROUND-012" as const;

export const R12_SYMBOLS = Object.freeze([...RESEARCH_SYMBOLS]) as readonly ResearchSymbol[];
export const R12_FROZEN_FOLD_IDS = Object.freeze([...RESEARCH_FOLD_IDS]);
export const R12_FROZEN_FOLDS = RESEARCH_FOLDS;

export const M3_R12_CANDIDATE_IDS = Object.freeze([
  "R12-D1-FIRST-ONLY",
  "R12-D2-FIRST-PLUS-ONE",
] as const);
export type R12CandidateId = (typeof M3_R12_CANDIDATE_IDS)[number];
export type R12Direction = "LONG" | "SHORT";
export type R12Cohort = "FIRST" | "FOLLOWUP_1" | "FOLLOWUP_2_PLUS";

export type R12ComplexityTuple = Readonly<{
  newRules: number;
  newTunableThresholds: number;
  modifiedBaselineRules: number;
  mechanismFamiliesUsed: number;
}>;

export type R12CandidateDefinition = Readonly<{
  candidateId: R12CandidateId;
  variantId: string;
  mechanismFamily: "THESIS_DEDUPLICATION";
  kind: "FILTER";
  parameters: Readonly<Record<string, never>>;
  signalRule: string;
  dataRule: string;
  composition: "SINGLE_MECHANISM";
}>;

export const R12_CANDIDATE_REGISTRY: readonly R12CandidateDefinition[] = deepFreeze<R12CandidateDefinition[]>([
  {
    candidateId: "R12-D1-FIRST-ONLY",
    variantId: "R12-D1-V1",
    mechanismFamily: "THESIS_DEDUPLICATION",
    kind: "FILTER",
    parameters: {},
    signalRule: "RETAIN_ONLY_THE_FIRST_FORMAL_BASELINE_ADVISORY_PER_ACTIVE_SYMBOL_DIRECTION_THESIS",
    dataRule: "CHRONOLOGICAL_DECISION_TIME_STATE_MACHINE;NO_OUTCOME_LOOKAHEAD;REUSE_EXACT_CONTROL_SETTLEMENT",
    composition: "SINGLE_MECHANISM",
  },
  {
    candidateId: "R12-D2-FIRST-PLUS-ONE",
    variantId: "R12-D2-V1",
    mechanismFamily: "THESIS_DEDUPLICATION",
    kind: "FILTER",
    parameters: {},
    signalRule: "RETAIN_THE_FIRST_AND_FIRST_SUBSEQUENT_FORMAL_BASELINE_ADVISORIES_PER_ACTIVE_SYMBOL_DIRECTION_THESIS",
    dataRule: "CHRONOLOGICAL_DECISION_TIME_STATE_MACHINE;NO_OUTCOME_LOOKAHEAD;REUSE_EXACT_CONTROL_SETTLEMENT",
    composition: "SINGLE_MECHANISM",
  },
]);

export const R12_COMPLEXITY_TUPLES: Readonly<Record<R12CandidateId, R12ComplexityTuple>> = deepFreeze({
  "R12-D1-FIRST-ONLY": { newRules: 1, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
  "R12-D2-FIRST-PLUS-ONE": { newRules: 1, newTunableThresholds: 0, modifiedBaselineRules: 0, mechanismFamiliesUsed: 1 },
});

export const R12_THESIS_CONTRACT = deepFreeze({
  key: "symbol|direction",
  ordering: "CHRONOLOGICAL_SIGNAL_TIME_WITH_TERMINAL_BEFORE_SIGNAL_AT_EQUAL_TIME",
  first: "NO_ACTIVE_ANCHOR_CREATES_FIRST_AND_ANCHORS_THESIS",
  activeUntil: "ANCHOR_THEORETICAL_LIFECYCLE_TERMINAL_ONLY",
  tpOrSl: "SETTLEMENT_EXIT_TIMESTAMP",
  noEntry: "CANONICAL_SIGNAL_VALIDITY_EXPIRATION_OR_NO_ENTRY_TERMINAL_TIME",
  periodEndCensored: "REMAINS_ACTIVE_THROUGH_RESEARCH_BOUNDARY",
  ambiguousOrIncomplete: "FAIL_CLOSED_USING_EXISTING_INTEGRITY_SEMANTICS",
  followupsDoNotExtendAnchor: true,
  oppositeDirectionsSeparate: true,
  diagnosticsOnly: [
    "thesisId",
    "thesisOrdinal",
    "cohort",
    "anchorSignalId",
    "timeSinceFirstHours",
    "directionAdjustedPriceExtensionFromFirstAtr",
    "distanceFromEma20Atr",
    "scoreDeltaFromFirst",
  ],
});

export const R12_DATA_CONTRACT = deepFreeze({
  provider: "binance-usdm-public",
  symbols: R12_SYMBOLS,
  timeframes: ["1h", "4h", "1m-settlement"] as const,
  researchStartIso: M3_R12_RESEARCH_START_ISO,
  researchEndIso: M3_R12_RESEARCH_END_ISO,
  sourceStream: "EXACT_BASELINE_001_FORMAL_SIGNAL_STREAM",
  decisionTime: "SIGNAL_CANDLE_CLOSE_TIME;CLOSED_CANDLES_ONLY",
  missingOrMalformedData: "FAIL_CLOSED_AS_INCOMPLETE_EVIDENCE",
  productionAfterBoundary: "SEEN_HYPOTHESIS_GENERATING_DIAGNOSTIC_ONLY;EXCLUDED_FROM_GATE_TRAINING_SELECTION",
  cachePolicy: "REUSE_ACCEPTED_COMPLETE_CONTROL_CACHE_WHERE_IDENTITY_MATCHES",
});

export const R12_EXECUTION_CONTRACT = deepFreeze({
  strategyVersion: "baseline-001",
  backtestPolicyVersion: M3_R12_POLICY_VERSION,
  feeRate: BACKTEST_POLICY.feeRate,
  slippageRate: BACKTEST_POLICY.slippageRate,
  funding: "EXISTING_BT_POLICY_003_FUNDING_RATE_AND_MARK_PRICE_SEMANTICS",
  settlement: "EXACT_CONTROL_SETTLEMENT_REUSED_FOR_RETAINED_SIGNALS",
  noCandidateSettlementRerun: true,
  noProductionExecution: true,
});

export const R12_GOVERNANCE = deepFreeze({
  noPrivateBinanceApi: true,
  noAutomaticTrading: true,
  noOutcomeLookahead: true,
  noOptimizer: true,
  noSweep: true,
  noNewSymbols: true,
  diagnosticsDoNotAffectSelection: true,
  performanceExactlyOnceAfterLock: true,
  postLockMarketFetchPossible: false,
  productionDataUse: "SEEN_HYPOTHESIS_GENERATING_DIAGNOSTIC_ONLY",
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
});

export const R12_PROTOCOL_MACHINE_RECORD = deepFreeze({
  protocolVersion: M3_R12_PROTOCOL_VERSION,
  researchRoundId: M3_R12_RESEARCH_ROUND_ID,
  baseSourceSha: M3_R12_BASE_SOURCE_SHA,
  sourceIdentity: {
    acceptedR11SourceSha: M3_R12_BASE_SOURCE_SHA,
    identityRule: "R12_IS_STACKED_FROM_THE_ACCEPTED_R11_SOURCE",
  },
  universe: M3_R12_RESEARCH_RANGE,
  symbols: R12_SYMBOLS,
  folds: R12_FROZEN_FOLDS,
  candidateIds: M3_R12_CANDIDATE_IDS,
  candidateRegistry: R12_CANDIDATE_REGISTRY,
  complexityTuples: R12_COMPLEXITY_TUPLES,
  thesis: R12_THESIS_CONTRACT,
  dataContract: R12_DATA_CONTRACT,
  executionContract: R12_EXECUTION_CONTRACT,
  governance: R12_GOVERNANCE,
  performanceExecutionSourceSha: null,
});

export const R12_REQUIRED_CANDLE_INTERVALS = Object.freeze({ oneHour: 3_600_000, fourHour: 14_400_000 });
