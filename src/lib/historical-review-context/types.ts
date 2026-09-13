import type { ResearchSymbol } from "../config/constants.ts";
import type { AdvisoryDirection, SignalAdvisory } from "../signal-advisory/types.ts";

export const HISTORICAL_REVIEW_CONTEXT_REGISTRY_TABLE =
  "tp_historical_review_context_registry" as const;
export const R22_HISTORICAL_CONTEXT_FEATURE_SNAPSHOT_VERSION =
  "r22-historical-identity-v1" as const;
export const R22_HISTORICAL_CONTEXT_APPROVAL_REF =
  "ROUND-022-R5-IDENTITY-ONLY-CONTEXT-V1" as const;

export type HistoricalIdentityFeatureSnapshot = Readonly<{
  signalId: string;
  symbol: ResearchSymbol;
  direction: AdvisoryDirection;
  signalTime: string;
  strategyId: string;
  strategyVersion: string;
}>;

export type HistoricalReviewContext = Readonly<{
  contextId: string;
  sourceSignalId: string;
  symbol: ResearchSymbol;
  timeframe: "1h";
  sourceEventTime: string;
  availableAt: string;
  featureSnapshotVersion: typeof R22_HISTORICAL_CONTEXT_FEATURE_SNAPSHOT_VERSION;
  preprocessingHash: string;
  sourceIds: readonly string[];
  featureSnapshot: HistoricalIdentityFeatureSnapshot;
  approvalRef: typeof R22_HISTORICAL_CONTEXT_APPROVAL_REF;
}>;

export type HistoricalReviewContextDraft = Omit<HistoricalReviewContext, "availableAt">;

export type HistoricalReviewContextPublication = Readonly<{
  advisory: SignalAdvisory;
  sourceIds: readonly string[];
}>;

export type HistoricalReviewContextLookup =
  | Readonly<{ status: "FOUND"; context: HistoricalReviewContext }>
  | Readonly<{
      status: "MISSING";
      reason: "NO_APPROVED_PRIOR_CONTEXT";
    }>
  | Readonly<{
      status: "NOT_EVALUABLE";
      reason:
        | "AMBIGUOUS_MAX_AVAILABLE_CONTEXT"
        | "INVALID_CONTEXT_RECORD"
        | "CONTEXT_REGISTRY_QUERY_FAILED";
    }>;

export type HistoricalReviewContextPublishResult = Readonly<{
  status: "APPENDED" | "IDEMPOTENT_REPLAY";
  context: HistoricalReviewContext;
}>;

export type HistoricalReviewContextRegistry = Readonly<{
  findPriorContext(input: Readonly<{
    currentSignalId: string;
    symbol: ResearchSymbol;
    signalTime: string;
  }>): Promise<HistoricalReviewContextLookup>;
  publishContext(
    input: HistoricalReviewContextPublication,
  ): Promise<HistoricalReviewContextPublishResult>;
}>;
