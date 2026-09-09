import type { ResearchSymbol } from "../config/constants.ts";
import type { MarketSnapshot } from "../market-data/types.ts";
import type { BTCRegime, SymbolRegime } from "../strategy/types.ts";
import type { SignalEvaluationRecord } from "./evaluations.ts";
import type { NotificationEvidenceObserver } from "./notification-evidence.ts";
import type {
  ObservationEvidenceAppendResult,
  ObservationEvidenceCandidate,
} from "../observation-evidence/types.ts";
import type { HistoricalReviewContextRegistry } from "../historical-review-context/types.ts";

export type { SignalEvaluationRecord } from "./evaluations.ts";

export const SIGNAL_ADVISORY_STRATEGY_ID = "baseline-001" as const;

export type AdvisoryDirection = "LONG" | "SHORT";

export type DeliveryStatus = "PENDING" | "SENT" | "FAILED";

export type SignalClaimResult =
  | "CLAIMED"
  | "RETRY_CLAIMED"
  | "SKIPPED_DUPLICATE"
  | "SKIPPED_EXPIRED";

export type SignalAdvisory = Readonly<{
  signalId: string;
  symbol: ResearchSymbol;
  direction: AdvisoryDirection;
  strategyId: typeof SIGNAL_ADVISORY_STRATEGY_ID;
  strategyVersion: string;
  signalTime: string;
  signalValidUntil: string;
  currentReferencePrice: number;
  suggestedEntryReference: number;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  score: number;
  grade: "A" | "B" | "C";
  marketRegime: Readonly<{
    btcRegime: BTCRegime;
    symbolRegime: SymbolRegime;
  }>;
  dataFreshness: Readonly<{
    status: "FRESH";
    sourceServerTime: string;
    candleCloseTime: string;
    ageMs: number;
  }>;
  recipient: string;
  scanRunKey: string;
}>;

export type ScanRunBeginResult =
  | Readonly<{ action: "RUN"; scanId: string }>
  | Readonly<{
      action: "SKIP_COMPLETED" | "SKIP_IN_PROGRESS";
      scanId: string;
    }>;

export type ScanRunCompletion = Readonly<{
  scanId: string;
  status: "SUCCEEDED" | "PARTIAL" | "FAILED";
  symbolsRequested: number;
  symbolsCompleted: number;
  signalsGenerated: number;
  signalsSent: number;
  signalsSkipped: number;
  errorCode?: string;
  errorMessage?: string;
  completedAt: string;
}>;

export type SystemEventInput = Readonly<{
  level: "INFO" | "WARN" | "ERROR";
  operation: string;
  status: string;
  errorCode?: string;
  scanId?: string;
  symbol?: ResearchSymbol;
  message?: string;
  metadata?: Record<string, unknown>;
}>;

export type AdvisoryHealth = Readonly<{
  lastSuccessfulScan: string | null;
  lastEmailSent: string | null;
  lastError: string | null;
  strategyVersion: string;
}>;

export type SignalAdvisoryStore = Readonly<{
  beginScanRun(input: {
    runKey: string;
    scheduledFor: string;
    now: string;
  }): Promise<ScanRunBeginResult>;
  completeScanRun(input: ScanRunCompletion): Promise<void>;
  claimSignal(advisory: SignalAdvisory, scanId: string, now: string): Promise<SignalClaimResult>;
  markSignalSent(input: {
    signalId: string;
    sentAt: string;
    emailMessageId: string;
  }): Promise<void>;
  markSignalFailed(input: {
    signalId: string;
    failedAt: string;
    failureReason: string;
  }): Promise<void>;
  recordStrategyEvaluations(rows: readonly SignalEvaluationRecord[]): Promise<void>;
  recordSystemEvent(input: SystemEventInput): Promise<void>;
  getHealth(): Promise<AdvisoryHealth>;
}>;

export type SignalAdvisoryScanDependencies = Readonly<{
  marketData: {
    getMarketSnapshot(): Promise<MarketSnapshot>;
  };
  store: SignalAdvisoryStore;
  observationEvidenceStore: Readonly<{
    appendEvidence(candidate: ObservationEvidenceCandidate): Promise<ObservationEvidenceAppendResult>;
  }>;
  historicalReviewContextRegistry?: HistoricalReviewContextRegistry;
  sendSignalEmail(advisory: SignalAdvisory): Promise<{ emailMessageId: string }>;
  observeNotificationEvidence?: NotificationEvidenceObserver;
  now?: () => number;
  recipient: string;
}>;

export type SignalAdvisoryScanResult = Readonly<{
  outcome: "SUCCESS" | "NO_SIGNAL" | "PARTIAL" | "FAILED" | "SKIPPED";
  scanId: string | null;
  runKey: string;
  strategyVersion: string;
  symbolsScanned: number;
  signalsGenerated: number;
  signalsSent: number;
  signalsSkipped: number;
  errors: readonly string[];
  dataFreshness: "FRESH" | "NO_SIGNAL" | "UNKNOWN";
}>;
