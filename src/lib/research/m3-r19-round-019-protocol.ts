import { createHash } from "node:crypto";

export const ROUND_019_RESEARCH_ROUND_ID = "baseline-002-research-round-019" as const;
export const ROUND_019_PHASE = "DESIGN_ONLY" as const;
export const ROUND_019_ACCEPTED_SOURCE = "c5abf95b199faa6fc8530fc356c03528aceb5c95" as const;
export const ROUND_019_ACCEPTED_SOURCE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const ROUND_019_RESEARCH_START_ISO = "2023-01-01T00:00:00.000Z" as const;
export const ROUND_019_RESEARCH_END_ISO = "2026-08-15T23:59:59.999Z" as const;
export const ROUND_019_DESIGN_PATH = "docs/research/round-019-design.json" as const;
export const ROUND_019_PERFORMANCE_LEDGER_PATH = "docs/research/round-019-performance-ledger.json" as const;
export const ROUND_019_PERFORMANCE_LOCK = "ROUND-019-FIRST-RESULT-LOCK" as const;
export const ROUND_019_MAX_AUTHORITATIVE_PERFORMANCE_EXECUTIONS = 1 as const;
export const ROUND_019_PRIMARY_HORIZON_HOURS = 4 as const;
export const ROUND_019_BACKTEST_POLICY_VERSION = "bt-policy-003" as const;

export const R19_SYMBOLS = Object.freeze([
  "BTCUSDT",
  "ETHUSDT",
  "SOLUSDT",
  "XRPUSDT",
  "BNBUSDT",
] as const);
export type R19Symbol = (typeof R19_SYMBOLS)[number];

export const R19_DIRECTIONS = Object.freeze(["LONG", "SHORT"] as const);
export type R19Direction = (typeof R19_DIRECTIONS)[number];

export const R19_FOLD_IDS = Object.freeze(["F1", "F2", "F3", "F4", "F5", "F6"] as const);
export type R19FoldId = (typeof R19_FOLD_IDS)[number];

export const R19_REGIMES = Object.freeze([
  "BTC_STRONG_BULL",
  "BTC_NEUTRAL",
  "BTC_STRONG_BEAR",
] as const);

export type R19Range = Readonly<{ start: string; end: string }>;
export type R19FoldBoundary = Readonly<{ research: R19Range; validation: R19Range }>;

export const R19_FROZEN_FOLD_BOUNDARIES: Readonly<Record<R19FoldId, R19FoldBoundary>> = Object.freeze({
  F1: { research: { start: "2023-01-01T00:00:00.000Z", end: "2023-12-31T23:59:59.999Z" }, validation: { start: "2024-01-01T00:00:00.000Z", end: "2024-06-30T23:59:59.999Z" } },
  F2: { research: { start: "2023-01-01T00:00:00.000Z", end: "2024-06-30T23:59:59.999Z" }, validation: { start: "2024-07-01T00:00:00.000Z", end: "2024-12-31T23:59:59.999Z" } },
  F3: { research: { start: "2023-01-01T00:00:00.000Z", end: "2024-12-31T23:59:59.999Z" }, validation: { start: "2025-01-01T00:00:00.000Z", end: "2025-06-30T23:59:59.999Z" } },
  F4: { research: { start: "2023-01-01T00:00:00.000Z", end: "2025-06-30T23:59:59.999Z" }, validation: { start: "2025-07-01T00:00:00.000Z", end: "2025-12-31T23:59:59.999Z" } },
  F5: { research: { start: "2023-01-01T00:00:00.000Z", end: "2025-12-31T23:59:59.999Z" }, validation: { start: "2026-01-01T00:00:00.000Z", end: "2026-03-31T23:59:59.999Z" } },
  F6: { research: { start: "2023-01-01T00:00:00.000Z", end: "2026-03-31T23:59:59.999Z" }, validation: { start: "2026-04-01T00:00:00.000Z", end: ROUND_019_RESEARCH_END_ISO } },
});

export const ROUND_019_ACTIVE_HYPOTHESIS_ID = null;
export const ROUND_019_MECHANISM_FAMILY = "NO_ADMISSIBLE_NOVEL_HYPOTHESIS" as const;
export const ROUND_019_CONTROL_ID = "R19-CONTROL-ALL-R14-NATIVE-BASELINE-001-FORMAL" as const;
export const ROUND_019_CANDIDATE_ID = null;
export const ROUND_019_CANDIDATE_RULE_ID = null;
export const ROUND_019_DESIGN_DECISION = "ROUND-019 NO ADMISSIBLE NOVEL HYPOTHESIS" as const;

export const ROUND_019_FORMAL_PREDICATE = "candidate?.formalSignal && candidate.totalScore >= 70" as const;

export const ROUND_019_FORMAL_PROVENANCE = Object.freeze({
  path: "src/lib/backtest/runner.ts",
  gitBlobSha: "dad472de8d2e7e4b0f0a0943b51e257afaec8ac9",
  sha256: "2f6bc2d733ef081cc2aea4b92165dc80f7f1754f1da1d4d09c03d32cc0ca4208",
  anchors: Object.freeze([
    "formalCandidates",
    "candidate?.formalSignal && candidate.totalScore >= 70",
  ]),
} as const);

export type Round019DesignOnlyStatus = Readonly<{
  phase: typeof ROUND_019_PHASE;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  performanceExecuted: false;
  selectionExecuted: false;
  economicValuesRead: false;
  economicValuesCalculated: false;
  economicValuesInspected: false;
  newMarketDataFetched: false;
  productionUnchanged: true;
  baseline001Unchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  automaticTrading: false;
}>;

export function isRound019DesignOnlyStatus(status: Round019DesignOnlyStatus): boolean {
  return status.phase === ROUND_019_PHASE
    && status.performanceExecutionCount === 0
    && status.performanceLedgerPresent === false
    && status.performanceExecuted === false
    && status.selectionExecuted === false
    && status.economicValuesRead === false
    && status.economicValuesCalculated === false
    && status.economicValuesInspected === false
    && status.newMarketDataFetched === false
    && status.productionUnchanged === true
    && status.baseline001Unchanged === true
    && status.baseline002Status === "NOT_FROZEN"
    && status.m3JStatus === "BLOCKED"
    && status.m4Status === "NOT_STARTED"
    && status.automaticTrading === false;
}

export function r19HashBytes(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}
