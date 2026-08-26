import type { ResearchSymbol } from "../config/constants.ts";

export const DAILY_REVIEW_VERSION = "daily-review-001" as const;
export const REVIEW_ONE_MINUTE_MS = 60_000;

export type ReviewStatus =
  | "WAITING_ENTRY"
  | "OPEN"
  | "TP"
  | "SL"
  | "NO_ENTRY"
  | "AMBIGUOUS";

export type ReviewCandle = Readonly<{
  symbol: ResearchSymbol;
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  tradeCount: number;
  takerBuyBaseVolume: number;
  takerBuyQuoteVolume: number;
}>;

export type ReviewAdvisory = Readonly<{
  signalId: string;
  symbol: ResearchSymbol;
  direction: "LONG" | "SHORT";
  strategyVersion: string;
  signalTime: string;
  signalValidUntil: string;
  sentAt: string;
  suggestedEntryReference: number;
  stopLoss: number;
  takeProfit: number;
}>;

export type ReviewState = Readonly<{
  signalId: string;
  reviewVersion: string;
  status: ReviewStatus;
  entryCandleTime: string | null;
  exitCandleTime: string | null;
  exitReference: number | null;
  resultR: number | null;
  lastEvaluatedCandleTime: string | null;
  reason: string | null;
}>;

export type ReviewMarketDataProvider = Readonly<{
  getServerTime(): Promise<number>;
  getClosedCandles(
    symbol: ResearchSymbol,
    startTime: number,
    endTime: number,
    serverTime: number,
  ): Promise<readonly ReviewCandle[]>;
}>;

export type ReviewRunClaim = Readonly<{
  action: "RUN" | "SKIP_COMPLETED" | "SKIP_IN_PROGRESS";
  runId: string;
}>;

export type ReviewRunCompletion = Readonly<{
  runId: string;
  status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  advisoriesConsidered: number;
  reviewsCreated: number;
  reviewsUpdated: number;
  reviewsResolved: number;
  errorCode?: string;
  completedAt: string;
}>;

export type SignalReviewStore = Readonly<{
  claimDailyReviewRun(input: {
    runKey: string;
    scheduledFor: string;
    now: string;
    leaseExpiresAt: string;
  }): Promise<ReviewRunClaim>;
  completeDailyReviewRun(input: ReviewRunCompletion): Promise<void>;
  loadSentAdvisories(): Promise<readonly ReviewAdvisory[]>;
  ensureReviewRows(advisories: readonly ReviewAdvisory[]): Promise<number>;
  loadActiveReviews(): Promise<readonly ReviewState[]>;
  saveReviewState(state: ReviewState, updatedAt: string): Promise<void>;
}>;

export type SignalReviewRunDependencies = Readonly<{
  store: SignalReviewStore;
  marketData: ReviewMarketDataProvider;
  now?: () => number;
  timeZone?: string;
}>;

export type SignalReviewRunResult = Readonly<{
  ok: boolean;
  outcome: "SUCCEEDED" | "PARTIAL" | "FAILED" | "SKIPPED";
  runKey: string;
  considered: number;
  created: number;
  updated: number;
  resolved: number;
  errors: readonly string[];
}>;
