export const R22_OBSERVATION_SCHEMA_VERSION = "m3-r22-observation-design-001" as const;
export const R22_OBSERVATION_ROUND_ID = "baseline-002-research-round-022" as const;
export const R22_OBSERVATION_PHASE = "OBSERVATION_DESIGN_ONLY" as const;
export const R22_OBSERVATION_ACCEPTED_SOURCE = "60b003a80e231ace69e4fc4d4217a7d22724ce1b" as const;
export const R22_OBSERVATION_BASE_BRANCH = "research/round-015-beta-alpha-decomposition" as const;
export const R22_OBSERVATION_BRANCH = "research/round-022-observation-design" as const;
export const R22_OBSERVATION_WINDOW_DAYS = 30 as const;
export const R22_OBSERVATION_WINDOW_MS = R22_OBSERVATION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

export const R22_OBSERVATION_DIRECTIONS = Object.freeze([
  "LONG",
  "SHORT",
  "NO_SIGNAL",
] as const);
export type R22ObservationDirection = (typeof R22_OBSERVATION_DIRECTIONS)[number];

export const R22_OBSERVATION_COHORTS = Object.freeze([
  "ADVISORY",
  "NOTIFICATION",
  "HUMAN_REVIEW",
] as const);
export type R22ObservationCohort = (typeof R22_OBSERVATION_COHORTS)[number];

export const R22_NOTIFICATION_DISPOSITIONS = Object.freeze([
  "DELIVERED",
  "IGNORED",
  "SUPPRESSED",
  "DUPLICATE_SKIPPED",
] as const);
export type R22NotificationDisposition = (typeof R22_NOTIFICATION_DISPOSITIONS)[number];

export const R22_OBSERVATION_GATE_STATUSES = Object.freeze([
  "PASS",
  "INSTRUMENTATION_REQUIRED",
  "FAIL",
] as const);
export type R22ObservationGateStatus = (typeof R22_OBSERVATION_GATE_STATUSES)[number];

export type R22SnapshotProvenance = Readonly<{
  sourceRef: string | null;
  sourceHash: string | null;
  snapshotTime: string | null;
  provenanceStatus: "VERIFIED" | "MISSING";
  mutability: "IMMUTABLE" | "MUTABLE" | "UNKNOWN";
}>;

export type R22NotificationObservation = Readonly<{
  notificationObservationId: string | null;
  observedAt: string | null;
  disposition: R22NotificationDisposition | null;
}>;

export type R22HumanReviewObservation = Readonly<{
  reviewObservationId: string | null;
  reviewStartedAt: string | null;
  reviewSubmittedAt: string | null;
  reviewComplete: boolean | null;
  informationSufficient: boolean | null;
  unnecessaryAlert: boolean | null;
}>;

export type R22ObservationRecord = Readonly<{
  cohort: R22ObservationCohort;
  identityKey: string | null;
  direction: R22ObservationDirection;
  signalTime: string | null;
  advisoryCreationTime: string | null;
  snapshots: Readonly<{
    quality: R22SnapshotProvenance;
    marketContext: R22SnapshotProvenance;
    riskAdvisory: R22SnapshotProvenance;
    historicalReview: R22SnapshotProvenance;
    alertIntelligence: R22SnapshotProvenance;
    presentation: R22SnapshotProvenance;
  }>;
  notification: R22NotificationObservation | null;
  humanReview: R22HumanReviewObservation | null;
}>;

export type R22ObservationFailureReason =
  | "NONE"
  | "NO_SIGNAL_NOT_AN_ALERT"
  | "MISSING_IDENTITY"
  | "MISSING_TIMESTAMP_PROVENANCE"
  | "MISSING_SNAPSHOT_PROVENANCE"
  | "MISSING_NOTIFICATION_PROVENANCE"
  | "MISSING_HUMAN_REVIEW_PROVENANCE"
  | "REVIEW_TIMESTAMP_INVERSION"
  | "INVALID_TIMESTAMP";

export type R22ObservationValidation = Readonly<{
  status: "OBSERVABLE" | "NOT_EVALUABLE";
  cohort: R22ObservationCohort;
  identityKey: string | null;
  direction: R22ObservationDirection;
  reason: R22ObservationFailureReason;
  noSignalExcluded: boolean;
  humanDecisionRequired: true;
  automaticTrading: false;
}>;

export type R22ProspectiveWindowValidation = Readonly<{
  status: "IN_WINDOW" | "OUT_OF_WINDOW" | "NOT_EVALUABLE";
  t0Configured: boolean;
  t0: string | null;
  windowEndExclusive: string | null;
  durationDays: 30;
  reason: "NONE" | "T0_NOT_CONFIGURED" | "INVALID_TIMESTAMP" | "WINDOW_EXPIRED" | "BEFORE_T0";
  historicalBackfillAllowed: false;
  retrospectiveSamplingAllowed: false;
  resultBasedExtensionAllowed: false;
  earlyStoppingAllowed: false;
}>;

export type R22IdentityUniquenessResult = Readonly<{
  status: "PASS" | "FAIL";
  advisoryRecordCount: number;
  missingIdentityCount: number;
  duplicateIdentityKeys: readonly string[];
}>;

export type R22ReviewLatencyResult = Readonly<{
  status: "OBSERVABLE" | "NOT_EVALUABLE";
  decisionLatencyProxyMs: number | null;
  reason: "NONE" | "MISSING_REVIEW_TIMESTAMP" | "REVIEW_TIMESTAMP_INVERSION" | "INVALID_TIMESTAMP";
}>;

export type R22ObservationGate = Readonly<{
  id: "O01" | "O02" | "O03" | "O04" | "O05" | "O06" | "O07" | "O08" | "O09";
  status: R22ObservationGateStatus;
  rule: string;
  evidence: string;
}>;

export type R22ObservationGovernance = Readonly<{
  designOnly: true;
  observationExecuted: false;
  historicalBackfillExecuted: false;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  economicValuesRead: false;
  forwardReturnRead: false;
  newMarketDataFetched: false;
  productionUnchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  humanDecisionRequired: true;
  automaticTrading: false;
}>;

export const R22_OBSERVATION_GOVERNANCE: R22ObservationGovernance = Object.freeze({
  designOnly: true,
  observationExecuted: false,
  historicalBackfillExecuted: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  economicValuesRead: false,
  forwardReturnRead: false,
  newMarketDataFetched: false,
  productionUnchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  humanDecisionRequired: true,
  automaticTrading: false,
});

export const R22_OBSERVATION_GATES: readonly R22ObservationGate[] = Object.freeze([
  {
    id: "O01",
    status: "PASS",
    rule: "Accepted source SHA must equal the frozen accepted research source.",
    evidence: R22_OBSERVATION_ACCEPTED_SOURCE,
  },
  {
    id: "O02",
    status: "PASS",
    rule: "A directional advisory must have one stable identity key.",
    evidence: "tp_signal_advisories.signal_id primary key; signal-advisory/identity.ts",
  },
  {
    id: "O03",
    status: "INSTRUMENTATION_REQUIRED",
    rule: "Signal, advisory, notification, and review timestamps must be provable.",
    evidence: "Signal/advisory timestamps exist; review timestamp capture is not yet persisted.",
  },
  {
    id: "O04",
    status: "INSTRUMENTATION_REQUIRED",
    rule: "Every required advisory snapshot must have immutable point-in-time provenance.",
    evidence: "Quality/context/risk/intelligence/presentation snapshots are not persisted with capture identity.",
  },
  {
    id: "O05",
    status: "INSTRUMENTATION_REQUIRED",
    rule: "Every notification observation must retain its disposition, including duplicates.",
    evidence: "Current delivery registry does not persist the complete notification disposition vocabulary.",
  },
  {
    id: "O06",
    status: "INSTRUMENTATION_REQUIRED",
    rule: "Human review timestamps and labels must come from human review metadata.",
    evidence: "No R22 human-review observation source is currently persisted.",
  },
  {
    id: "O07",
    status: "PASS",
    rule: "Observation schema has no economic outcome field and is identity/metadata only.",
    evidence: "Protocol output contains no economic or future-result value.",
  },
  {
    id: "O08",
    status: "PASS",
    rule: "Advisory, notification, and human-review denominators remain separate.",
    evidence: "The denominator contract is frozen below.",
  },
  {
    id: "O09",
    status: "PASS",
    rule: "Observation is one fixed prospective 30-calendar-day window.",
    evidence: "Window validator uses inclusive T0 and exclusive T0 plus 30 days.",
  },
]);

export const R22_OBSERVATION_FORBIDDEN_FIELD_NAMES = Object.freeze([
  "PnL",
  "profit",
  "loss",
  "return",
  "forwardReturn",
  "futurePrice",
  "futureCandle",
  "takeProfitHit",
  "stopLossHit",
  "win",
  "lossLabel",
  "winRate",
  "profitFactor",
  "drawdown",
  "Sharpe",
  "Calmar",
  "expectedReturn",
  "economicOutcome",
  "tradeOutcome",
  "realizedPnL",
  "unrealizedPnL",
] as const);

export const R22_OBSERVATION_DENOMINATOR_CONTRACT = Object.freeze({
  advisory: "unique valid ADVISORY records with LONG or SHORT direction",
  notification: "every valid NOTIFICATION record, including duplicate notifications",
  humanReview: "every valid HUMAN_REVIEW record with a human-supplied review label",
  noSignal: "NO_SIGNAL is pipeline metadata only and is excluded from all alert denominators",
  missing: "NOT_EVALUABLE records are excluded and never imputed as zero",
});

function nonEmpty(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

function canonicalIsoTimestamp(value: string | null): value is string {
  if (!nonEmpty(value) || !value.endsWith("Z")) {
    return false;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function timestampAtOrBefore(value: string, upperBound: string): boolean {
  return Date.parse(value) <= Date.parse(upperBound);
}

function snapshotIsPITSafe(snapshot: R22SnapshotProvenance, record: R22ObservationRecord): boolean {
  return snapshot.provenanceStatus === "VERIFIED"
    && snapshot.mutability === "IMMUTABLE"
    && nonEmpty(snapshot.sourceRef)
    && nonEmpty(snapshot.sourceHash)
    && canonicalIsoTimestamp(snapshot.snapshotTime)
    && canonicalIsoTimestamp(record.signalTime)
    && canonicalIsoTimestamp(record.advisoryCreationTime)
    && timestampAtOrBefore(snapshot.snapshotTime, record.signalTime)
    && timestampAtOrBefore(snapshot.snapshotTime, record.advisoryCreationTime);
}

function notEvaluable(
  record: R22ObservationRecord,
  reason: Exclude<R22ObservationFailureReason, "NONE">,
  noSignalExcluded = false,
): R22ObservationValidation {
  return {
    status: "NOT_EVALUABLE",
    cohort: record.cohort,
    identityKey: record.identityKey,
    direction: record.direction,
    reason,
    noSignalExcluded,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export function validateR22ObservationRecord(
  record: R22ObservationRecord,
): R22ObservationValidation {
  if (record.direction === "NO_SIGNAL") {
    return notEvaluable(record, "NO_SIGNAL_NOT_AN_ALERT", true);
  }
  if (!nonEmpty(record.identityKey)) {
    return notEvaluable(record, "MISSING_IDENTITY");
  }
  if (!canonicalIsoTimestamp(record.signalTime) || !canonicalIsoTimestamp(record.advisoryCreationTime)) {
    return notEvaluable(record, "MISSING_TIMESTAMP_PROVENANCE");
  }

  const snapshots = Object.values(record.snapshots);
  if (snapshots.some((snapshot) => !snapshotIsPITSafe(snapshot, record))) {
    return notEvaluable(record, "MISSING_SNAPSHOT_PROVENANCE");
  }

  if (record.cohort === "NOTIFICATION") {
    if (
      record.notification === null
      || !nonEmpty(record.notification.notificationObservationId)
      || !canonicalIsoTimestamp(record.notification.observedAt)
      || record.notification.disposition === null
    ) {
      return notEvaluable(record, "MISSING_NOTIFICATION_PROVENANCE");
    }
  }

  if (record.cohort === "HUMAN_REVIEW") {
    if (
      record.humanReview === null
      || !nonEmpty(record.humanReview.reviewObservationId)
      || record.humanReview.reviewComplete === null
      || record.humanReview.informationSufficient === null
      || record.humanReview.unnecessaryAlert === null
    ) {
      return notEvaluable(record, "MISSING_HUMAN_REVIEW_PROVENANCE");
    }
    const latency = deriveR22ReviewLatencyProxyMs(record.humanReview);
    if (latency.status === "NOT_EVALUABLE") {
      return notEvaluable(record, latency.reason === "REVIEW_TIMESTAMP_INVERSION"
        ? "REVIEW_TIMESTAMP_INVERSION"
        : "MISSING_HUMAN_REVIEW_PROVENANCE");
    }
  }

  return {
    status: "OBSERVABLE",
    cohort: record.cohort,
    identityKey: record.identityKey,
    direction: record.direction,
    reason: "NONE",
    noSignalExcluded: false,
    humanDecisionRequired: true,
    automaticTrading: false,
  };
}

export function validateR22ProspectiveWindow(
  t0: string | null,
  observedAt: string,
): R22ProspectiveWindowValidation {
  const base = {
    durationDays: 30 as const,
    historicalBackfillAllowed: false as const,
    retrospectiveSamplingAllowed: false as const,
    resultBasedExtensionAllowed: false as const,
    earlyStoppingAllowed: false as const,
  };
  if (t0 === null) {
    return {
      ...base,
      status: "NOT_EVALUABLE",
      t0Configured: false,
      t0: null,
      windowEndExclusive: null,
      reason: "T0_NOT_CONFIGURED",
    };
  }
  if (!canonicalIsoTimestamp(t0) || !canonicalIsoTimestamp(observedAt)) {
    return {
      ...base,
      status: "NOT_EVALUABLE",
      t0Configured: false,
      t0: null,
      windowEndExclusive: null,
      reason: "INVALID_TIMESTAMP",
    };
  }

  const windowEndExclusive = new Date(Date.parse(t0) + R22_OBSERVATION_WINDOW_MS).toISOString();
  if (observedAt < t0) {
    return {
      ...base,
      status: "OUT_OF_WINDOW",
      t0Configured: true,
      t0,
      windowEndExclusive,
      reason: "BEFORE_T0",
    };
  }
  if (observedAt >= windowEndExclusive) {
    return {
      ...base,
      status: "OUT_OF_WINDOW",
      t0Configured: true,
      t0,
      windowEndExclusive,
      reason: "WINDOW_EXPIRED",
    };
  }
  return {
    ...base,
    status: "IN_WINDOW",
    t0Configured: true,
    t0,
    windowEndExclusive,
    reason: "NONE",
  };
}

export function validateR22AdvisoryIdentityUniqueness(
  records: readonly R22ObservationRecord[],
): R22IdentityUniquenessResult {
  const directionalAdvisories = records.filter(
    (record) => record.cohort === "ADVISORY" && record.direction !== "NO_SIGNAL",
  );
  const missingIdentityCount = directionalAdvisories.filter(
    (record) => !nonEmpty(record.identityKey),
  ).length;
  const counts = new Map<string, number>();
  for (const record of directionalAdvisories) {
    if (nonEmpty(record.identityKey)) {
      counts.set(record.identityKey, (counts.get(record.identityKey) ?? 0) + 1);
    }
  }
  const duplicateIdentityKeys = Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([identityKey]) => identityKey)
    .sort();
  return {
    status: missingIdentityCount === 0 && duplicateIdentityKeys.length === 0 ? "PASS" : "FAIL",
    advisoryRecordCount: directionalAdvisories.length,
    missingIdentityCount,
    duplicateIdentityKeys,
  };
}

export function deriveR22ReviewLatencyProxyMs(
  review: Pick<R22HumanReviewObservation, "reviewStartedAt" | "reviewSubmittedAt">,
): R22ReviewLatencyResult {
  if (review.reviewStartedAt === null || review.reviewSubmittedAt === null) {
    return {
      status: "NOT_EVALUABLE",
      decisionLatencyProxyMs: null,
      reason: "MISSING_REVIEW_TIMESTAMP",
    };
  }
  if (!canonicalIsoTimestamp(review.reviewStartedAt) || !canonicalIsoTimestamp(review.reviewSubmittedAt)) {
    return {
      status: "NOT_EVALUABLE",
      decisionLatencyProxyMs: null,
      reason: "INVALID_TIMESTAMP",
    };
  }
  const decisionLatencyProxyMs = Date.parse(review.reviewSubmittedAt) - Date.parse(review.reviewStartedAt);
  if (decisionLatencyProxyMs < 0) {
    return {
      status: "NOT_EVALUABLE",
      decisionLatencyProxyMs: null,
      reason: "REVIEW_TIMESTAMP_INVERSION",
    };
  }
  return { status: "OBSERVABLE", decisionLatencyProxyMs, reason: "NONE" };
}

export function isR22ObservationDesignEligible(): boolean {
  return R22_OBSERVATION_GATES.every((gate) => gate.status === "PASS");
}
