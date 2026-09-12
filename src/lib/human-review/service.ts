import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import type { AdvisoryDirection } from "../signal-advisory/types.ts";
import { createSupabaseAdminClient } from "../supabase/admin.ts";
import {
  buildR22ReviewStartedCandidate,
  buildR22ReviewSubmittedCandidate,
  calculateR22ReviewObservationId,
  validateR22HumanReviewCandidate,
  type R22HumanReviewAdvisoryIdentity,
  type R22HumanReviewLabels,
} from "../observation-evidence/human-review.ts";
import type {
  ObservationEvidenceAppendResult,
  ObservationEvidenceCandidate,
} from "../observation-evidence/types.ts";
import {
  SupabaseObservationEvidenceStore,
  type ObservationEvidenceClient,
} from "../observation-evidence/store.ts";
import { validateObservationAdvisoryIdentity } from "../observation-evidence/validator.ts";

export type R22HumanReviewAdvisoryIdentityStore = Readonly<{
  findBySignalId(signalId: string): Promise<R22HumanReviewAdvisoryIdentity | null>;
}>;

export type R22HumanReviewEvidenceStore = Readonly<{
  appendEvidence(candidate: ObservationEvidenceCandidate): Promise<ObservationEvidenceAppendResult>;
  findReviewEvent(input: Readonly<{
    reviewObservationId: string;
    eventType: "REVIEW_STARTED" | "REVIEW_SUBMITTED";
  }>): Promise<ObservationEvidenceCandidate | null>;
}>;

export type R22HumanReviewDependencies = Readonly<{
  advisoryIdentityStore: R22HumanReviewAdvisoryIdentityStore;
  evidenceStore: R22HumanReviewEvidenceStore;
  now: () => string;
}>;

export type R22HumanReviewOperationResult = Readonly<{
  status: "APPENDED" | "IDEMPOTENT_REPLAY" | "NOT_EVALUABLE";
  eventType: "REVIEW_STARTED" | "REVIEW_SUBMITTED";
  reviewObservationId: string | null;
  evidenceId: string | null;
  reason:
    | "NONE"
    | "INVALID_REQUEST"
    | "ADVISORY_NOT_FOUND"
    | "START_NOT_FOUND"
    | "START_INVALID"
    | "IDENTITY_MISMATCH"
    | "INVALID_CANDIDATE"
    | "EVIDENCE_APPEND_REJECTED"
    | "SUBMIT_FIELDS_REQUIRED";
}>;

type AdvisoryIdentityClient = ReturnType<typeof createSupabaseAdminClient>;

function notEvaluable(
  eventType: R22HumanReviewOperationResult["eventType"],
  reason: Exclude<R22HumanReviewOperationResult["reason"], "NONE">,
  reviewObservationId: string | null = null,
): R22HumanReviewOperationResult {
  return {
    status: "NOT_EVALUABLE",
    eventType,
    reviewObservationId,
    evidenceId: null,
    reason,
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function advisoryIdentityFromRow(row: Record<string, unknown>): R22HumanReviewAdvisoryIdentity | null {
  const symbol = RESEARCH_SYMBOLS.includes(row.symbol as ResearchSymbol)
    ? row.symbol as ResearchSymbol
    : null;
  const direction: AdvisoryDirection | null = row.direction === "LONG" || row.direction === "SHORT"
    ? row.direction
    : null;
  const signalId = stringValue(row.signal_id);
  const signalTime = stringValue(row.signal_time);
  const strategyId = stringValue(row.strategy_id);
  const strategyVersion = stringValue(row.strategy_version);
  if (!signalId || !symbol || !direction || !signalTime || !strategyId || !strategyVersion) return null;
  const identity = { signalId, symbol, direction, signalTime, strategyId, strategyVersion };
  return validateObservationAdvisoryIdentity(identity) ? identity : null;
}

export function createR22HumanReviewAdvisoryIdentityStore(
  client: AdvisoryIdentityClient = createSupabaseAdminClient(),
): R22HumanReviewAdvisoryIdentityStore {
  return {
    async findBySignalId(signalId: string): Promise<R22HumanReviewAdvisoryIdentity | null> {
      const result = await client
        .from("tp_signal_advisories")
        .select("signal_id,symbol,direction,signal_time,strategy_id,strategy_version")
        .eq("signal_id", signalId)
        .maybeSingle();
      if (result.error) throw result.error;
      return result.data ? advisoryIdentityFromRow(result.data as Record<string, unknown>) : null;
    },
  };
}

export function createDefaultR22HumanReviewDependencies(): R22HumanReviewDependencies {
  return {
    advisoryIdentityStore: createR22HumanReviewAdvisoryIdentityStore(),
    evidenceStore: new SupabaseObservationEvidenceStore(
      createSupabaseAdminClient() as unknown as ObservationEvidenceClient,
    ),
    now: () => new Date().toISOString(),
  };
}

function sameAdvisoryIdentity(
  left: R22HumanReviewAdvisoryIdentity,
  right: R22HumanReviewAdvisoryIdentity,
): boolean {
  return left.signalId === right.signalId
    && left.symbol === right.symbol
    && left.direction === right.direction
    && left.signalTime === right.signalTime
    && left.strategyId === right.strategyId
    && left.strategyVersion === right.strategyVersion;
}

function isHumanReviewLabels(value: unknown): value is R22HumanReviewLabels {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const labels = value as Record<string, unknown>;
  return typeof labels.reviewComplete === "boolean"
    && typeof labels.informationSufficient === "boolean"
    && typeof labels.unnecessaryAlert === "boolean";
}

function appendResult(
  eventType: R22HumanReviewOperationResult["eventType"],
  reviewObservationId: string,
  result: ObservationEvidenceAppendResult,
): R22HumanReviewOperationResult {
  if (result.status === "APPENDED" || result.status === "IDEMPOTENT_REPLAY") {
    return {
      status: result.status,
      eventType,
      reviewObservationId,
      evidenceId: result.evidenceId,
      reason: "NONE",
    };
  }
  return notEvaluable(eventType, "EVIDENCE_APPEND_REJECTED", reviewObservationId);
}

export async function startHumanReview(input: Readonly<{
  signalId: string;
  dependencies: R22HumanReviewDependencies;
}>): Promise<R22HumanReviewOperationResult> {
  if (!input.signalId.trim()) return notEvaluable("REVIEW_STARTED", "INVALID_REQUEST");

  const advisory = await input.dependencies.advisoryIdentityStore.findBySignalId(input.signalId);
  if (advisory === null) return notEvaluable("REVIEW_STARTED", "ADVISORY_NOT_FOUND");

  const reviewObservationId = calculateR22ReviewObservationId(advisory.signalId);
  const reviewStartedAt = input.dependencies.now();
  const candidate = buildR22ReviewStartedCandidate({
    advisory,
    reviewStartedAt,
    capturedAt: input.dependencies.now(),
  });
  if (validateR22HumanReviewCandidate(candidate).status !== "OBSERVABLE") {
    return notEvaluable("REVIEW_STARTED", "INVALID_CANDIDATE", reviewObservationId);
  }
  return appendResult(
    "REVIEW_STARTED",
    reviewObservationId,
    await input.dependencies.evidenceStore.appendEvidence(candidate),
  );
}

export async function submitHumanReview(input: Readonly<{
  signalId: string;
  labels: unknown;
  dependencies: R22HumanReviewDependencies;
}>): Promise<R22HumanReviewOperationResult> {
  if (!input.signalId.trim()) return notEvaluable("REVIEW_SUBMITTED", "INVALID_REQUEST");
  if (!isHumanReviewLabels(input.labels)) return notEvaluable("REVIEW_SUBMITTED", "SUBMIT_FIELDS_REQUIRED");

  const advisory = await input.dependencies.advisoryIdentityStore.findBySignalId(input.signalId);
  if (advisory === null) return notEvaluable("REVIEW_SUBMITTED", "ADVISORY_NOT_FOUND");

  const reviewObservationId = calculateR22ReviewObservationId(advisory.signalId);
  const start = await input.dependencies.evidenceStore.findReviewEvent({
    reviewObservationId,
    eventType: "REVIEW_STARTED",
  });
  if (start === null) return notEvaluable("REVIEW_SUBMITTED", "START_NOT_FOUND", reviewObservationId);

  const startValidation = validateR22HumanReviewCandidate(start);
  if (startValidation.status !== "OBSERVABLE" || start.eventType !== "REVIEW_STARTED") {
    return notEvaluable("REVIEW_SUBMITTED", "START_INVALID", reviewObservationId);
  }
  if (start.signalId !== advisory.signalId || !sameAdvisoryIdentity(
    {
      signalId: start.signalId,
      symbol: start.symbol,
      direction: start.direction,
      signalTime: start.signalTime,
      strategyId: start.strategyId,
      strategyVersion: start.strategyVersion,
    },
    advisory,
  ) || start.reviewStartedAt === null) {
    return notEvaluable("REVIEW_SUBMITTED", "IDENTITY_MISMATCH", reviewObservationId);
  }

  const reviewSubmittedAt = input.dependencies.now();
  const candidate = buildR22ReviewSubmittedCandidate({
    advisory,
    reviewObservationId,
    reviewStartedAt: start.reviewStartedAt,
    reviewSubmittedAt,
    capturedAt: input.dependencies.now(),
    labels: input.labels,
  });
  if (validateR22HumanReviewCandidate(candidate).status !== "OBSERVABLE") {
    return notEvaluable("REVIEW_SUBMITTED", "INVALID_CANDIDATE", reviewObservationId);
  }
  return appendResult(
    "REVIEW_SUBMITTED",
    reviewObservationId,
    await input.dependencies.evidenceStore.appendEvidence(candidate),
  );
}
