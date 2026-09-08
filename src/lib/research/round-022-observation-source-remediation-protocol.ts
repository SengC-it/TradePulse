export const R22_SOURCE_REMEDIATION_SCHEMA_VERSION =
  "m3-r22-observation-source-remediation-design-001" as const;
export const R22_SOURCE_REMEDIATION_ROUND_ID = "baseline-002-research-round-022" as const;
export const R22_SOURCE_REMEDIATION_PHASE = "SOURCE_REMEDIATION_DESIGN_ONLY" as const;
export const R22_SOURCE_REMEDIATION_ACCEPTED_SOURCE =
  "f2d563467a2249bd7cbcb9ae8b9995ccdf1ae036" as const;
export const R22_SOURCE_REMEDIATION_BASE_BRANCH =
  "research/round-015-beta-alpha-decomposition" as const;
export const R22_SOURCE_REMEDIATION_BRANCH =
  "research/round-022-observation-source-remediation-design" as const;
export const R22_SOURCE_REMEDIATION_CONTRACT_PATH =
  "docs/research/round-022-observation-source-remediation-contract.json" as const;
export const R22_SOURCE_REMEDIATION_DESIGN_PATH =
  "docs/research/round-022-observation-source-remediation-design.md" as const;

export const R22_SOURCE_REMEDIATION_NODE_IDS = Object.freeze([
  "P01",
  "S01",
  "S02",
  "S03",
  "S04",
  "S05",
  "S06",
  "P02",
  "S07",
  "S08",
  "S09",
  "S10",
] as const);
export type R22SourceRemediationNodeId = (typeof R22_SOURCE_REMEDIATION_NODE_IDS)[number];

export const R22_SOURCE_REMEDIATION_ARTIFACT_TYPES = Object.freeze([
  "QUALITY_SNAPSHOT",
  "MARKET_CONTEXT",
  "RISK_ADVISORY",
  "HISTORICAL_REVIEW_METADATA",
  "ALERT_INTELLIGENCE",
  "PRESENTATION",
] as const);
export type R22SourceRemediationArtifactType =
  (typeof R22_SOURCE_REMEDIATION_ARTIFACT_TYPES)[number];

export const R22_SOURCE_REMEDIATION_GATE_IDS = Object.freeze([
  "R01",
  "R02",
  "R03",
  "R04",
  "R05",
  "R06",
  "R07",
  "R08",
  "R09",
  "R10",
  "R11",
  "R12",
] as const);
export type R22SourceRemediationGateId = (typeof R22_SOURCE_REMEDIATION_GATE_IDS)[number];

export const R22_SOURCE_REMEDIATION_STAGE_IDS = Object.freeze([
  "R1",
  "R2",
  "R3",
  "R4",
  "R5",
  "R6",
  "R7",
  "R8",
  "R9",
  "R10",
] as const);
export type R22SourceRemediationStageId = (typeof R22_SOURCE_REMEDIATION_STAGE_IDS)[number];

export type R22SourceRemediationNode = Readonly<{
  id: R22SourceRemediationNodeId;
  currentStatus: "SOURCE_READY" | "FAIL";
  requiredFutureProducer: string;
  requiredRuntimeCallSite: string;
  authoritativeIdentitySource: string;
  informationAsOfSource: string;
  capturedAtSource: string;
  persistenceRequirement: string;
  appendOnlyOrIdempotencyRequirement: string;
  causalTimestampConstraints: readonly string[];
  upstreamDependencies: readonly R22SourceRemediationNodeId[];
  downstreamConsumers: readonly R22SourceRemediationNodeId[];
  implementationOrder: R22SourceRemediationStageId | "CURRENT";
  acceptanceEvidence: string;
  failureMode: string;
}>;

const node = (value: R22SourceRemediationNode): R22SourceRemediationNode => Object.freeze(value);

export const R22_SOURCE_REMEDIATION_DAG: readonly R22SourceRemediationNode[] = Object.freeze([
  node({
    id: "P01",
    currentStatus: "SOURCE_READY",
    requiredFutureProducer: "Existing runSignalAdvisoryScan -> buildAdvisory -> claimSignal",
    requiredRuntimeCallSite: "src/app/api/cron/signal-advisory/route.ts -> runSignalAdvisoryScan",
    authoritativeIdentitySource: "buildDeterministicSignalId(symbol,direction,signalTime,strategyVersion) and tp_signal_advisories.signal_id",
    informationAsOfSource: "Closed-candle signalTime from src/lib/signal-advisory/scan.ts; source cutoff must be no later than signalTime for future snapshots",
    capturedAtSource: "Server persistence created_at for the advisory row; never backdated",
    persistenceRequirement: "Existing public.tp_signal_advisories service-side registry; this is a prerequisite, not observation evidence",
    appendOnlyOrIdempotencyRequirement: "signal_id primary key and existing claim/retry compare-and-set; delivery fields remain outside the new snapshot contract",
    causalTimestampConstraints: ["signalTime <= advisoryCreationTime"],
    upstreamDependencies: [],
    downstreamConsumers: ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"],
    implementationOrder: "CURRENT",
    acceptanceEvidence: "Accepted source contains scan route, deterministic identity, closed-candle signalTime, and advisory persistence call sites.",
    failureMode: "Missing signal identity or signalTime makes every dependent source NOT_EVALUABLE.",
  }),
  node({
    id: "S01",
    currentStatus: "FAIL",
    requiredFutureProducer: "Future buildQualitySnapshotFromAdvisoryInputs producer at the scan decision boundary",
    requiredRuntimeCallSite: "Future runSignalAdvisoryScan -> buildAdvisory -> buildQualitySnapshot, before notification/presentation",
    authoritativeIdentitySource: "P01 signalId plus the full immutable advisory identity tuple",
    informationAsOfSource: "Versioned closed-candle/strategy inputs used by evaluateSignalQuality, cut off at or before signalTime; sourceRef and hash are required",
    capturedAtSource: "Server wall-clock time at append; capturedAt may follow signalTime and is never derived from it",
    persistenceRequirement: "Future append-only observation evidence row with artifactType=QUALITY_SNAPSHOT",
    appendOnlyOrIdempotencyRequirement: "evidence_id is the physical key; artifact_id and idempotency_key are immutable and retries replay the same logical snapshot",
    causalTimestampConstraints: ["informationAsOf <= signalTime", "signalTime <= capturedAt"],
    upstreamDependencies: ["P01"],
    downstreamConsumers: ["S05", "S06", "P02"],
    implementationOrder: "R2",
    acceptanceEvidence: "A runtime call site emits an identity-linked snapshot with sourceRef, informationAsOf, contentHash, evidenceHash, and a persistence acknowledgement.",
    failureMode: "No producer-owned identity, missing PIT cutoff, or missing append acknowledgement is NOT_EVALUABLE; no caller-supplied fallback qualifies.",
  }),
  node({
    id: "S02",
    currentStatus: "FAIL",
    requiredFutureProducer: "Future buildMarketContextSnapshotFromClosedCandleInputs producer",
    requiredRuntimeCallSite: "Future runSignalAdvisoryScan -> buildMarketContextSnapshot, after P01 and before S05",
    authoritativeIdentitySource: "P01 signalId plus source identity for the BTC/symbol regime inputs",
    informationAsOfSource: "Closed-candle regime inputs and their source manifest as of a cutoff no later than signalTime",
    capturedAtSource: "Server wall-clock time at observation append",
    persistenceRequirement: "Future append-only observation evidence row with artifactType=MARKET_CONTEXT",
    appendOnlyOrIdempotencyRequirement: "Same snapshot contract and stable idempotency key as S01; no overwrite or latest-value substitution",
    causalTimestampConstraints: ["informationAsOf <= signalTime", "signalTime <= capturedAt"],
    upstreamDependencies: ["P01"],
    downstreamConsumers: ["S05", "S06", "P02"],
    implementationOrder: "R3",
    acceptanceEvidence: "A non-test producer records the exact context source identity and cutoff with a durable immutable snapshot.",
    failureMode: "Context supplied without authoritative source identity or PIT cutoff is NOT_EVALUABLE.",
  }),
  node({
    id: "S03",
    currentStatus: "FAIL",
    requiredFutureProducer: "Future buildRiskAdvisorySnapshotFromAdvisoryGeometry producer",
    requiredRuntimeCallSite: "Future runSignalAdvisoryScan -> buildRiskAdvisorySnapshot, after P01 and before S05",
    authoritativeIdentitySource: "P01 signalId and immutable advisory entry/stop/target geometry",
    informationAsOfSource: "The decision-time advisory geometry and source snapshot, with a cutoff no later than signalTime",
    capturedAtSource: "Server wall-clock time at observation append",
    persistenceRequirement: "Future append-only observation evidence row with artifactType=RISK_ADVISORY",
    appendOnlyOrIdempotencyRequirement: "Hash and idempotency semantics are shared with all snapshots; a retry cannot replace a prior risk artifact",
    causalTimestampConstraints: ["informationAsOf <= signalTime", "signalTime <= capturedAt"],
    upstreamDependencies: ["P01"],
    downstreamConsumers: ["S05", "S06", "P02"],
    implementationOrder: "R4",
    acceptanceEvidence: "A producer-owned risk snapshot links to P01 and persists a finite, identity-bound, PIT-safe payload.",
    failureMode: "Caller-only risk fields, missing source cutoff, or invalid geometry yields NOT_EVALUABLE and no inferred risk conclusion.",
  }),
  node({
    id: "S04",
    currentStatus: "FAIL",
    requiredFutureProducer: "Future buildProspectiveHistoricalReviewMetadata producer; never historical-review-protocol.ts as a runtime substitute",
    requiredRuntimeCallSite: "Future scan boundary after P01 and before S05, reading only an approved pre-signal context registry",
    authoritativeIdentitySource: "P01 signalId plus exact prior-reference identity keys; no fuzzy or nearest-time matching",
    informationAsOfSource: "Only prior identity/context metadata with source event time <= signalTime; the cutoff is signalTime and is persisted",
    capturedAtSource: "Server wall-clock time when the prospective metadata snapshot is appended",
    persistenceRequirement: "Future append-only observation evidence row with artifactType=HISTORICAL_REVIEW_METADATA",
    appendOnlyOrIdempotencyRequirement: "The reference set, sourceRef, and hashes are immutable; missing input remains NOT_EVALUABLE rather than fabricated",
    causalTimestampConstraints: ["informationAsOf <= signalTime", "signalTime <= capturedAt"],
    upstreamDependencies: ["P01"],
    downstreamConsumers: ["S05", "S06", "P02"],
    implementationOrder: "R5",
    acceptanceEvidence: "The future producer has an approved input registry, PIT cutoff, exact identity matching, output schema, missing behavior, and append evidence tests.",
    failureMode: "No prospective source, any future/outcome/PnL field, backfill, or signal-review settlement substitution is DESIGN_INELIGIBLE/NOT_EVALUABLE.",
  }),
  node({
    id: "S05",
    currentStatus: "FAIL",
    requiredFutureProducer: "Future buildAlertIntelligenceSnapshot producer using complete S01-S04 snapshots",
    requiredRuntimeCallSite: "Future scan boundary after S01, S02, S03, and S04; before mail/dashboard presentation",
    authoritativeIdentitySource: "P01 signalId plus exact artifact identities for S01-S04",
    informationAsOfSource: "The maximum validated source cutoff of the consumed S01-S04 inputs, which must remain <= signalTime",
    capturedAtSource: "Server wall-clock time at append, after the builder completes",
    persistenceRequirement: "Future append-only observation evidence row with artifactType=ALERT_INTELLIGENCE",
    appendOnlyOrIdempotencyRequirement: "Input artifact hashes and stable snapshot idempotency key are persisted; no recomputation from a future result",
    causalTimestampConstraints: ["all consumed informationAsOf <= signalTime", "signalTime <= capturedAt"],
    upstreamDependencies: ["P01", "S01", "S02", "S03", "S04"],
    downstreamConsumers: ["S06", "P02"],
    implementationOrder: "R6",
    acceptanceEvidence: "Production invocation and durable snapshot show all four authoritative input identities; incomplete input cannot be labelled complete.",
    failureMode: "A helper or fallback without S01-S04 evidence is NOT_EVALUABLE; S05 cannot make missing upstream sources pass.",
  }),
  node({
    id: "S06",
    currentStatus: "FAIL",
    requiredFutureProducer: "Future buildPresentationSnapshot producer around the exact mail/web payload before rendering",
    requiredRuntimeCallSite: "Future signal-advisory presentation boundary before renderSignalAdvisoryEmail and dashboard serialization",
    authoritativeIdentitySource: "P01 signalId plus S01-S05 artifact identities and exact serialized presentation payload",
    informationAsOfSource: "Referenced source artifacts only; presentation adds no future or economic information",
    capturedAtSource: "Server wall-clock time at presentation evidence append",
    persistenceRequirement: "Future append-only observation evidence row with artifactType=PRESENTATION; rendering alone is not evidence",
    appendOnlyOrIdempotencyRequirement: "Exact payload hash and stable idempotency key; retries replay rather than overwrite presentation evidence",
    causalTimestampConstraints: ["referenced informationAsOf <= signalTime", "signalTime <= capturedAt"],
    upstreamDependencies: ["P01", "S01", "S02", "S03", "S04", "S05"],
    downstreamConsumers: ["P02"],
    implementationOrder: "R7",
    acceptanceEvidence: "Mail and web payloads are captured as immutable, identity-linked evidence before their respective render/response boundaries.",
    failureMode: "A rendered mail or UI row without an evidence append is NOT_EVALUABLE and does not imply source readiness.",
  }),
  node({
    id: "P02",
    currentStatus: "FAIL",
    requiredFutureProducer: "Future advisory-evaluation runner consuming completed evidence only",
    requiredRuntimeCallSite: "Future review/evaluation job after S01-S06 and human-review events; no current non-test call site",
    authoritativeIdentitySource: "The completed evidence identities and their advisory linkage",
    informationAsOfSource: "Inherited source cutoffs from evidence; no new market or outcome input",
    capturedAtSource: "Evaluation-run server time, separate from source artifact capturedAt",
    persistenceRequirement: "Future evaluation report is a downstream read artifact; it cannot substitute for missing S01-S06 evidence",
    appendOnlyOrIdempotencyRequirement: "Evaluation run identity is independent from source evidence identities; no feedback into signal generation",
    causalTimestampConstraints: ["evaluation cannot alter signalTime or source capturedAt"],
    upstreamDependencies: ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"],
    downstreamConsumers: [],
    implementationOrder: "R10",
    acceptanceEvidence: "A downstream-only evaluation run proves complete evidence coverage without reading PnL, forward return, or future outcome fields.",
    failureMode: "Incomplete evidence produces NOT_EVALUABLE; P02 never substitutes for or backfills an upstream source.",
  }),
  node({
    id: "S07",
    currentStatus: "FAIL",
    requiredFutureProducer: "Future shared timestamp validator at every snapshot, notification, and review append boundary",
    requiredRuntimeCallSite: "All R2-R9 producers and the evidence writer",
    authoritativeIdentitySource: "The event/artifact identity carrying signalTime",
    informationAsOfSource: "Each artifact's own decision-time source cutoff",
    capturedAtSource: "Server wall-clock capture at append; notification uses server observedAt and review uses server review timestamps",
    persistenceRequirement: "Persist causal timestamps with each append and reject inversion",
    appendOnlyOrIdempotencyRequirement: "Invalid timestamps are rejected; no silent correction or backdating",
    causalTimestampConstraints: ["informationAsOf <= signalTime <= capturedAt", "signalTime <= advisoryCreationTime", "signalTime <= notificationObservedAt", "signalTime <= reviewStartedAt <= reviewSubmittedAt"],
    upstreamDependencies: ["P01"],
    downstreamConsumers: ["S01", "S02", "S03", "S04", "S05", "S06", "S08", "S09", "P02"],
    implementationOrder: "R8",
    acceptanceEvidence: "Synthetic inversion tests and persisted server-authoritative timestamps prove fail-closed causal validation.",
    failureMode: "Any inversion is NOT_EVALUABLE; it cannot be repaired using a guessed or backdated timestamp.",
  }),
  node({
    id: "S08",
    currentStatus: "FAIL",
    requiredFutureProducer: "Future server-side REVIEW_STARTED handler",
    requiredRuntimeCallSite: "Future human-review start action, separate from submit",
    authoritativeIdentitySource: "reviewObservationId plus advisory identity and eventType=REVIEW_STARTED",
    informationAsOfSource: "The linked advisory/source evidence; review start adds no market or outcome input",
    capturedAtSource: "Server reviewStartedAt at the accepted start request",
    persistenceRequirement: "Append-only REVIEW_STARTED evidence row",
    appendOnlyOrIdempotencyRequirement: "REVIEW|reviewObservationId|START is the idempotency key; duplicate replay is immutable",
    causalTimestampConstraints: ["signalTime <= reviewStartedAt"],
    upstreamDependencies: ["P01", "S07"],
    downstreamConsumers: ["S09", "P02"],
    implementationOrder: "R9",
    acceptanceEvidence: "A server-owned start event, exact identity, replay rule, and inversion test exist in a future runtime implementation.",
    failureMode: "Client timestamp, synthetic start, or pre-signal start is NOT_EVALUABLE.",
  }),
  node({
    id: "S09",
    currentStatus: "FAIL",
    requiredFutureProducer: "Future server-side REVIEW_SUBMITTED handler",
    requiredRuntimeCallSite: "Future human-review submit action after a REVIEW_STARTED event",
    authoritativeIdentitySource: "reviewObservationId plus advisory identity and eventType=REVIEW_SUBMITTED",
    informationAsOfSource: "The linked advisory/source evidence and user labels only; no future outcome input",
    capturedAtSource: "Server reviewSubmittedAt at the accepted submit request",
    persistenceRequirement: "Append-only REVIEW_SUBMITTED evidence row, separate from REVIEW_STARTED",
    appendOnlyOrIdempotencyRequirement: "REVIEW|reviewObservationId|SUBMIT is independent from START; replay never overwrites a different event",
    causalTimestampConstraints: ["signalTime <= reviewStartedAt <= reviewSubmittedAt"],
    upstreamDependencies: ["P01", "S07", "S08"],
    downstreamConsumers: ["P02"],
    implementationOrder: "R9",
    acceptanceEvidence: "Server-owned submit event, separate identity, labels-only payload, and ordering/replay tests exist in a future runtime implementation.",
    failureMode: "Pre-signal submit, missing start, client timestamp, or fabricated submission is NOT_EVALUABLE.",
  }),
  node({
    id: "S10",
    currentStatus: "FAIL",
    requiredFutureProducer: "Future shared evidence identity/PIT validator and append-only writer",
    requiredRuntimeCallSite: "Every R2-R9 producer immediately before persistence",
    authoritativeIdentitySource: "P01 identity, artifact/event type, exact sourceRef, and immutable logical idempotency key",
    informationAsOfSource: "Producer-specific source manifest/cutoff; no nearest, fuzzy, reconstructed, or future-derived source",
    capturedAtSource: "Server wall-clock timestamp supplied by the writer, never caller-backdated",
    persistenceRequirement: "Future service-side append-only observation evidence table with evidence_id primary key and RLS/service-only access",
    appendOnlyOrIdempotencyRequirement: "contentHash/evidenceHash/idempotencyKey are server-validated; conflicts are NOT_EVALUABLE, never UPDATE/last-write-wins",
    causalTimestampConstraints: ["informationAsOf <= signalTime <= capturedAt", "event-specific notification and human-review ordering"],
    upstreamDependencies: ["P01"],
    downstreamConsumers: ["P02"],
    implementationOrder: "R1",
    acceptanceEvidence: "Identity, hash, PIT, append-only, access-control, conflict, and no-economic-field tests pass in the future implementation.",
    failureMode: "Missing identity, hash, source provenance, or causal timestamp is NOT_EVALUABLE; evidence is not fabricated or backfilled.",
  }),
] as const);

export type R22SnapshotContractInput = Readonly<{
  evidenceId: string;
  artifactId: string;
  artifactType: R22SourceRemediationArtifactType;
  schemaVersion: string;
  advisoryIdentity: string;
  signalId: string;
  signalTime: string;
  informationAsOf: string;
  capturedAt: string;
  sourceRef: string;
  payload: Readonly<Record<string, unknown>>;
  contentHash: string;
  evidenceHash: string;
  idempotencyKey: string;
}>;

export type R22CausalValidation = Readonly<{
  status: "VALID" | "NOT_EVALUABLE";
  reasons: readonly string[];
}>;

export type R22ReviewEventInput = Readonly<{
  eventType: "REVIEW_STARTED" | "REVIEW_SUBMITTED";
  reviewObservationId: string;
  advisoryIdentity: string;
  signalTime: string;
  reviewStartedAt: string;
  reviewSubmittedAt?: string;
  idempotencyKey: string;
}>;

export const R22_SNAPSHOT_REQUIRED_FIELDS = Object.freeze([
  "evidenceId",
  "artifactId",
  "artifactType",
  "schemaVersion",
  "advisoryIdentity",
  "signalId",
  "informationAsOf",
  "capturedAt",
  "sourceRef",
  "payload",
  "contentHash",
  "evidenceHash",
  "idempotencyKey",
] as const);

export const R22_FORBIDDEN_RUNTIME_INPUTS = Object.freeze([
  "PnL",
  "forwardReturn",
  "futurePrice",
  "futureCandle",
  "profitFactor",
  "drawdown",
  "realizedPnL",
  "unrealizedPnL",
  "tradeOutcome",
  "historicalBackfill",
  "newMarketData",
] as const);

export const R22_SNAPSHOT_HASHING_CONTRACT = Object.freeze({
  algorithm: "SHA-256",
  canonicalSerialization: "existing src/lib/research/utils.ts stableStringify semantics",
  contentHashPreimage: "schemaVersion + artifactType + advisoryIdentity + informationAsOf + sourceRef + payload",
  evidenceHashPreimage: "contentHash + capturedAt + timestampAuthority + artifactId",
  capturedAtExcludedFromContentHash: true,
  artifactIdExcludedFromContentHash: true,
  idempotencyKey: "SHA-256(SNAPSHOT|signalId|artifactType|schemaVersion|informationAsOf|contentHash)",
} as const);

export const R22_SOURCE_REMEDIATION_GATES = Object.freeze([
  { id: "R01", status: "PASS", rule: "Frozen S01-S10 mapping is complete and current readiness is not rewritten." },
  { id: "R02", status: "PASS", rule: "Every dependency, consumer, producer boundary, and failure mode is explicit." },
  { id: "R03", status: "PASS", rule: "Every missing source has a concrete future producer or an explicit DESIGN_INELIGIBLE rule." },
  { id: "R04", status: "PASS", rule: "Every future artifact has an advisory-linked identity and exact source reference." },
  { id: "R05", status: "PASS", rule: "informationAsOf is source-owned and cannot exceed signalTime." },
  { id: "R06", status: "PASS", rule: "capturedAt is server wall-clock time and all causal inversions fail closed." },
  { id: "R07", status: "PASS", rule: "Historical Review has a prospective identity-only producer design with explicit prohibited inputs." },
  { id: "R08", status: "PASS", rule: "REVIEW_STARTED and REVIEW_SUBMITTED are separate server-authoritative events." },
  { id: "R09", status: "PASS", rule: "Accepted O05 notification identity and terminal semantics remain unchanged." },
  { id: "R10", status: "PASS", rule: "R1-R10 are independently reviewable and separately authorized future stages." },
  { id: "R11", status: "PASS", rule: "No economic, performance, selection, outcome, or market-data acquisition path is designed as executable code." },
  { id: "R12", status: "PASS", rule: "Design-only governance is frozen and runtime implementation remains unauthorized." },
] as const);

export const R22_SOURCE_REMEDIATION_GOVERNANCE = Object.freeze({
  designOnly: true,
  observationInstrumentationImplemented: false,
  observationAuthorized: false,
  observationExecuted: false,
  performanceAuthorized: false,
  performanceExecutionCount: 0,
  performanceLedgerPresent: false,
  economicValuesRead: false,
  forwardReturnRead: false,
  newMarketDataFetched: false,
  historicalBackfillExecuted: false,
  productionUnchanged: true,
  baseline002Status: "NOT_FROZEN",
  m3JStatus: "BLOCKED",
  m4Status: "NOT_STARTED",
  humanDecisionRequired: true,
  automaticTrading: false,
} as const);

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function canonicalUtc(value: string): boolean {
  if (!nonEmpty(value) || !value.endsWith("Z")) return false;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
}

function sha256Hex(value: string): boolean {
  return /^[a-f0-9]{64}$/i.test(value);
}

export function validateR22CausalTimestamps(input: Readonly<{
  informationAsOf: string;
  signalTime: string;
  capturedAt: string;
  advisoryCreationTime?: string;
  notificationObservedAt?: string;
  reviewStartedAt?: string;
  reviewSubmittedAt?: string;
}>): R22CausalValidation {
  const reasons: string[] = [];
  const timestamps = [
    ["informationAsOf", input.informationAsOf],
    ["signalTime", input.signalTime],
    ["capturedAt", input.capturedAt],
  ] as const;
  if (timestamps.some(([, value]) => !canonicalUtc(value))) {
    reasons.push("NON_CANONICAL_TIMESTAMP");
  }
  const informationAsOf = Date.parse(input.informationAsOf);
  const signalTime = Date.parse(input.signalTime);
  const capturedAt = Date.parse(input.capturedAt);
  if (Number.isFinite(informationAsOf) && Number.isFinite(signalTime) && informationAsOf > signalTime) {
    reasons.push("INFORMATION_AS_OF_AFTER_SIGNAL");
  }
  if (Number.isFinite(signalTime) && Number.isFinite(capturedAt) && capturedAt < signalTime) {
    reasons.push("CAPTURE_BEFORE_SIGNAL");
  }
  if (Number.isFinite(capturedAt) && Number.isFinite(informationAsOf) && capturedAt < informationAsOf) {
    reasons.push("CAPTURE_BEFORE_INFORMATION_AS_OF");
  }

  const optionalAfterSignal: readonly [string, string | undefined][] = [
    ["ADVISORY_CREATION_BEFORE_SIGNAL", input.advisoryCreationTime],
    ["NOTIFICATION_BEFORE_SIGNAL", input.notificationObservedAt],
    ["REVIEW_BEFORE_SIGNAL", input.reviewStartedAt],
  ];
  for (const [reason, value] of optionalAfterSignal) {
    if (value === undefined) continue;
    if (!canonicalUtc(value)) {
      reasons.push("NON_CANONICAL_TIMESTAMP");
      continue;
    }
    if (Number.isFinite(signalTime) && Date.parse(value) < signalTime) reasons.push(reason);
  }
  if (input.reviewSubmittedAt !== undefined) {
    if (!canonicalUtc(input.reviewSubmittedAt)) {
      reasons.push("NON_CANONICAL_TIMESTAMP");
    } else if (
      Number.isFinite(Date.parse(input.reviewStartedAt ?? ""))
      && Date.parse(input.reviewSubmittedAt) < Date.parse(input.reviewStartedAt ?? "")
    ) {
      reasons.push("REVIEW_SUBMITTED_BEFORE_STARTED");
    }
  }
  return {
    status: reasons.length === 0 ? "VALID" : "NOT_EVALUABLE",
    reasons: Array.from(new Set(reasons)),
  };
}

export function validateR22SnapshotContract(input: R22SnapshotContractInput): R22CausalValidation {
  const missing = R22_SNAPSHOT_REQUIRED_FIELDS.filter((field) => {
    const value = input[field];
    return value === undefined || value === null || (typeof value === "string" && !nonEmpty(value));
  });
  const reasons = missing.map((field) => `MISSING_${field}`);
  if (!R22_SOURCE_REMEDIATION_ARTIFACT_TYPES.includes(input.artifactType)) {
    reasons.push("UNKNOWN_ARTIFACT_TYPE");
  }
  if (!sha256Hex(input.contentHash) || !sha256Hex(input.evidenceHash)) {
    reasons.push("INVALID_HASH");
  }
  const causal = validateR22CausalTimestamps({
    informationAsOf: input.informationAsOf,
    signalTime: input.signalTime,
    capturedAt: input.capturedAt,
  });
  reasons.push(...causal.reasons);
  return {
    status: reasons.length === 0 ? "VALID" : "NOT_EVALUABLE",
    reasons: Array.from(new Set(reasons)),
  };
}

export function validateR22ReviewEvent(input: R22ReviewEventInput): R22CausalValidation {
  const reasons: string[] = [];
  if (!nonEmpty(input.reviewObservationId) || !nonEmpty(input.advisoryIdentity) || !nonEmpty(input.idempotencyKey)) {
    reasons.push("MISSING_REVIEW_IDENTITY");
  }
  if (!canonicalUtc(input.signalTime) || !canonicalUtc(input.reviewStartedAt)) {
    reasons.push("NON_CANONICAL_TIMESTAMP");
  }
  const signalTime = Date.parse(input.signalTime);
  const reviewStartedAt = Date.parse(input.reviewStartedAt);
  if (Number.isFinite(signalTime) && Number.isFinite(reviewStartedAt) && reviewStartedAt < signalTime) {
    reasons.push("REVIEW_BEFORE_SIGNAL");
  }
  if (input.eventType === "REVIEW_SUBMITTED") {
    if (input.reviewSubmittedAt === undefined || !canonicalUtc(input.reviewSubmittedAt)) {
      reasons.push("MISSING_OR_NON_CANONICAL_SUBMISSION_TIME");
    } else if (Date.parse(input.reviewSubmittedAt) < reviewStartedAt) {
      reasons.push("REVIEW_SUBMITTED_BEFORE_STARTED");
    }
  }
  return {
    status: reasons.length === 0 ? "VALID" : "NOT_EVALUABLE",
    reasons: Array.from(new Set(reasons)),
  };
}

export function isR22SourceRemediationDesignOnlyGovernance(
  governance: typeof R22_SOURCE_REMEDIATION_GOVERNANCE,
): boolean {
  return governance.designOnly
    && governance.observationInstrumentationImplemented === false
    && governance.observationAuthorized === false
    && governance.observationExecuted === false
    && governance.performanceAuthorized === false
    && governance.performanceExecutionCount === 0
    && governance.performanceLedgerPresent === false
    && governance.economicValuesRead === false
    && governance.forwardReturnRead === false
    && governance.newMarketDataFetched === false
    && governance.historicalBackfillExecuted === false
    && governance.productionUnchanged
    && governance.baseline002Status === "NOT_FROZEN"
    && governance.m3JStatus === "BLOCKED"
    && governance.m4Status === "NOT_STARTED"
    && governance.humanDecisionRequired
    && governance.automaticTrading === false;
}

export function validateR22SourceRemediationDesign(): readonly string[] {
  const errors: string[] = [];
  const ids = R22_SOURCE_REMEDIATION_DAG.map((entry) => entry.id);
  if (ids.length !== R22_SOURCE_REMEDIATION_NODE_IDS.length) errors.push("NODE_COUNT_MISMATCH");
  if (new Set(ids).size !== ids.length) errors.push("DUPLICATE_NODE_ID");
  for (const required of R22_SOURCE_REMEDIATION_NODE_IDS) {
    const entry = R22_SOURCE_REMEDIATION_DAG.find((candidate) => candidate.id === required);
    if (!entry) {
      errors.push(`MISSING_NODE_${required}`);
      continue;
    }
    if (!nonEmpty(entry.requiredFutureProducer)
      || !nonEmpty(entry.requiredRuntimeCallSite)
      || !nonEmpty(entry.authoritativeIdentitySource)
      || !nonEmpty(entry.informationAsOfSource)
      || !nonEmpty(entry.capturedAtSource)
      || !nonEmpty(entry.persistenceRequirement)
      || !nonEmpty(entry.appendOnlyOrIdempotencyRequirement)
      || entry.causalTimestampConstraints.length === 0
      || !nonEmpty(entry.acceptanceEvidence)
      || !nonEmpty(entry.failureMode)) {
      errors.push(`INCOMPLETE_NODE_${required}`);
    }
  }
  if (R22_SOURCE_REMEDIATION_GATES.length !== R22_SOURCE_REMEDIATION_GATE_IDS.length) {
    errors.push("GATE_COUNT_MISMATCH");
  }
  if (!isR22SourceRemediationDesignOnlyGovernance(R22_SOURCE_REMEDIATION_GOVERNANCE)) {
    errors.push("GOVERNANCE_INVALID");
  }
  return errors;
}
