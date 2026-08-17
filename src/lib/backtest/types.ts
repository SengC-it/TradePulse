import type { ResearchSymbol } from "../config/constants.ts";
import type { MarketTimeframe } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import type {
  HistoricalFundingRecord,
  HistoricalManifest,
  HistoricalMarkPriceCandle,
} from "../historical-data/types.ts";
import type {
  BTCRegime,
  SignalGrade,
  StrategyDirection,
  StrategyEngineResult,
  StrategyEvaluation,
  SymbolRegime,
} from "../strategy/types.ts";
import type { BacktestPeriod, BacktestPolicyVersion } from "./constants.ts";

export type BacktestDataset = Readonly<{
  candles1h: readonly Candle[];
  candles4h: readonly Candle[];
}>;

export type BacktestData = Readonly<{
  datasets: Readonly<Record<ResearchSymbol, BacktestDataset>>;
  funding: Readonly<Record<ResearchSymbol, readonly HistoricalFundingRecord[]>>;
  markPrice?: Readonly<Record<ResearchSymbol, readonly HistoricalMarkPriceCandle[] | undefined>>;
  manifests: readonly HistoricalManifest[];
  serverTime?: number;
}>;

export type BacktestSignalSnapshot = Readonly<{
  strategyVersion: "baseline-001";
  backtestPolicyVersion: BacktestPolicyVersion;
  signalTime: number;
  symbol: ResearchSymbol;
  direction: StrategyDirection;
  symbolRegime: SymbolRegime;
  btcRegime: BTCRegime;
  entryReference: number;
  stopReference: number;
  takeProfitReference: number;
  stopDistance: number;
  stopAtr: number;
  breakdown: Readonly<{
    trendStrength: number;
    pullbackQuality: number;
    breakoutStrength: number;
    volumeScore: number;
    riskRewardScore: number;
  }>;
  totalScore: number;
  grade: SignalGrade | null;
}>;

export type BacktestSignalStatus =
  | "PERIOD_END_CENSORED"
  | "ENTRY_OUTSIDE_BRACKET"
  | "EXECUTED"
  | "DATA_INCOMPLETE"
  | "SETTLEMENT_AMBIGUOUS";

export type BacktestFundingCharge = Readonly<{
  fundingTime: number;
  fundingRate: number;
  markPrice: number;
  /** Present for bt-policy-002; omitted to preserve the legacy report schema. */
  markPriceSource?: "FUNDING_RATE_HISTORY" | "MARK_PRICE_KLINE_PRE_EVENT_CLOSE";
  fundingPnL: number;
}>;

export type BacktestSignalResult = Readonly<{
  snapshot: BacktestSignalSnapshot;
  status: BacktestSignalStatus;
  entryTime: number | null;
  rawEntryPrice: number | null;
  entryFill: number | null;
  exitTime: number | null;
  rawExitPrice: number | null;
  exitFill: number | null;
  heldCandleNumber: number | null;
  exitReason: "TP" | "SL" | "TIME_EXIT" | null;
  fundingCharges: readonly BacktestFundingCharge[];
  fundingPnL: number;
  priceR: number | null;
  feeR: number | null;
  fundingR: number | null;
  grossR: number | null;
  netR: number | null;
  diagnostic?: string;
}>;

export type BacktestEvaluation = Readonly<{
  period: "DEV" | "OOS";
  evaluationTime: number;
  engineResult: StrategyEngineResult;
  evaluations: readonly StrategyEvaluation[];
  formalSignalCount: number;
}>;

export type BacktestRunStatus = "PASS" | "FAIL" | "INCOMPLETE" | "INSUFFICIENT_SAMPLE";
export type ProfitFactorStatus = "NORMAL" | "NO_TRADES" | "NO_LOSSES";

export type BacktestMetrics = Readonly<{
  totalEvaluations: number;
  totalFormalSignals: number;
  executedTrades: number;
  entryOutsideBracket: number;
  periodEndCensored: number;
  settlementAmbiguous: number;
  dataIncomplete: number;
  eligibleExecutionSignals: number;
  executionFillRate: number | null;
  tpCount: number;
  slCount: number;
  timeExitCount: number;
  grossR: number;
  netR: number;
  wins: number;
  losses: number;
  breakevens: number;
  winRate: number | null;
  lossRate: number | null;
  breakevenRate: number | null;
  profitFactor: number | null;
  profitFactorStatus: ProfitFactorStatus;
  expectancyR: number | null;
  medianR: number | null;
  averageWinR: number | null;
  averageLossR: number | null;
  bestTradeR: number | null;
  worstTradeR: number | null;
  cumulativeFeeR: number;
  cumulativeFundingR: number;
  signalSequenceMaxDrawdownR: number | null;
  overlappingTradeCount: number;
  overlappingSignalRate: number | null;
  totalPositiveNetR: number;
  topSymbolShareOfPositiveNetR: number | null;
  largestSingleTradeShareOfPositiveNetR: number | null;
  concentrationStatus: "NORMAL" | "NO_TRADES" | "NO_POSITIVE_R";
}>;

export type BacktestBreakdown = Readonly<{
  bySymbol: Readonly<Record<ResearchSymbol, Readonly<{ formalSignals: number; executedTrades: number; netR: number }>>>;
  byDirection: Readonly<Record<"LONG" | "SHORT", Readonly<{ formalSignals: number; executedTrades: number; netR: number }>>>;
  byGrade: Readonly<Record<"A" | "B" | "C", Readonly<{ formalSignals: number; executedTrades: number; netR: number }>>>;
  byBtcRegime: Readonly<Record<BTCRegime, Readonly<{ formalSignals: number; executedTrades: number; netR: number }>>>;
  byUtcSignalMonth: Readonly<Record<string, Readonly<{ formalSignals: number; executedTrades: number; netR: number }>>>;
}>;

export type BacktestAcceptance = Readonly<{
  status: "DESCRIPTIVE" | "PASS" | "FAIL" | "INCOMPLETE" | "INSUFFICIENT_SAMPLE";
  reasons: readonly string[];
  checks: Readonly<Record<string, boolean | null>>;
}>;

type BacktestReportCore = Readonly<{
  strategyVersion: "baseline-001";
  period: BacktestPeriod;
  periods: Readonly<Record<"DEV" | "OOS", Readonly<{ startTime: number; endTime: number }>>>;
  symbols: readonly ResearchSymbol[];
  timeframes: readonly MarketTimeframe[];
  policy: Readonly<Record<string, number | string>>;
  manifests: readonly HistoricalManifest[];
  status: BacktestRunStatus;
  acceptance: BacktestAcceptance;
  /** Compatibility alias: the acceptance for the selected report period only. */
  selectedPeriodAcceptance: BacktestAcceptance;
  /** The formal decision for this report period, including the OOS requirement. */
  overallAcceptance: BacktestAcceptance;
  metrics: BacktestMetrics;
  metricsByPeriod: Readonly<Record<"DEV" | "OOS" | "COMBINED", BacktestMetrics | null>>;
  acceptanceByPeriod: Readonly<Record<"DEV" | "OOS" | "COMBINED", BacktestAcceptance | null>>;
  breakdowns: BacktestBreakdown;
  evaluations: readonly BacktestEvaluation[];
  signalResults: readonly BacktestSignalResult[];
  diagnostics: readonly string[];
  disclaimer: string;
}>;

export type BacktestFundingAudit = Readonly<{
  fundingEventsTotal: number;
  fundingEventsDirectMarkPrice: number;
  fundingEventsFallbackMarkPrice: number;
  fundingFallbackRate: number | null;
  fundingFallbackBySymbol: Readonly<Record<ResearchSymbol, number>>;
  fundingFallbackByUtcYear: Readonly<Record<string, number>>;
}>;

export type LegacyBacktestReport = BacktestReportCore & Readonly<{
  schemaVersion: "m3-b-report-001";
  backtestPolicyVersion: "bt-policy-001";
}>;

export type CompatibilityBacktestReport = BacktestReportCore & BacktestFundingAudit & Readonly<{
  schemaVersion: "m3-b-report-002";
  backtestPolicyVersion: "bt-policy-002";
}>;

export type BacktestReport = LegacyBacktestReport | CompatibilityBacktestReport;

export type BacktestRunInput = Readonly<{
  period: BacktestPeriod;
  data: BacktestData;
  /** Library callers retain legacy compatibility; the formal CLI requires it. */
  policy?: BacktestPolicyVersion;
}>;

export type SettlementInput = Readonly<{
  snapshot: BacktestSignalSnapshot;
  signalCandle: Candle;
  heldCandles: readonly Candle[];
  funding: readonly HistoricalFundingRecord[];
  markPriceCandles?: readonly HistoricalMarkPriceCandle[];
  policy?: BacktestPolicyVersion;
  period: Exclude<BacktestPeriod, "COMBINED">;
  periodEndTime: number;
}>;
