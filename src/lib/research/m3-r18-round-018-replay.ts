import type { ResearchSymbol } from "../config/constants.ts";
import { getResearchFoldRoleRange } from "./folds.ts";
import type { ResearchFoldId } from "./constants.ts";
import {
  ROUND_018_CANDIDATE_RULE,
  ROUND_018_CANDIDATE_RULE_ID,
  ROUND_018_FOLDS,
  ROUND_018_GRADE_C_THRESHOLD,
  ROUND_018_REPLAY_STATUSES,
  ROUND_018_SCORE_COMPONENTS,
  ROUND_018_ACCEPTED_SOURCE,
} from "./m3-r18-round-018-protocol.ts";
import type {
  BTCRegime,
  StrategyCandidate,
  StrategyEvaluation,
  StrategyEngineResult,
  StrategyScoreBreakdown,
} from "../strategy/types.ts";

export type R18Direction = "LONG" | "SHORT";
export type R18LabelStatus = "EXECUTED" | "NO_ENTRY" | "DATA_INCOMPLETE" | "PERIOD_END_CENSORED";
export type R18ReplayStatus = (typeof ROUND_018_REPLAY_STATUSES)[number];

export type R18ObservationMetadata = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R18Direction;
  canonicalIdentityValid: boolean;
  formalSourceStatus: "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE" | "INCOMPLETE";
  formalSourcePath: string;
  formalSourceSha256: string;
  h4LabelIdentityPresent: boolean;
  h4LabelStatus: R18LabelStatus | "MISSING";
  labelSourceStatus: "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE" | "INCOMPLETE";
  labelSourcePath: string;
  labelSourceSha256: string;
  metadataParseValid: boolean;
}>;

export type R18ReplayProvenance = Readonly<{
  acceptedSourceCommit: typeof ROUND_018_ACCEPTED_SOURCE;
  acceptedSourceEngineSha256: string;
  r14ObservationDataSha256: string;
  acceptedSourceProvenanceValid: boolean;
  canonicalIdentityValid: boolean;
  formalSourceStatus: R18ObservationMetadata["formalSourceStatus"];
  labelIdentityValid: boolean;
}>;

export type R18ReplayDecision = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R18Direction;
  status: R18ReplayStatus;
  formalPredicatePassed: boolean;
  candidateRulePassed: boolean;
  candidate: StrategyCandidate | null;
  btcRegime: BTCRegime | null;
  foldId: ResearchFoldId | null;
  h4LabelStatus: R18LabelStatus | "MISSING";
  provenance: R18ReplayProvenance;
  anomalyCode: string | null;
}>;

export type R18StructuralObservationRecord = Readonly<{
  schemaVersion: "m3-r18-round-018-structural-observation-001";
  observationId: string;
  decisionTime: number;
  symbol: ResearchSymbol;
  direction: R18Direction;
  replayStatus: "BASELINE_FORMAL";
  totalScore: number;
  scoreBreakdown: StrategyScoreBreakdown;
  controlIncluded: true;
  candidateIncluded: boolean;
  candidateRuleId: typeof ROUND_018_CANDIDATE_RULE_ID;
  foldId: ResearchFoldId | null;
  btcRegime: BTCRegime;
  h4LabelStatus: R18LabelStatus;
  formalSource: Readonly<{
    acceptedSourceCommit: typeof ROUND_018_ACCEPTED_SOURCE;
    sourcePath: string;
    sourceSha256: string;
  }>;
  labelSource: Readonly<{
    sourceStatus: "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE";
    sourcePath: string;
    sourceSha256: string;
  }>;
}>;

export type R18ReplayContext = Readonly<{
  acceptedSourceProvenanceValid: boolean;
  acceptedSourceEngineSha256: string;
  r14ObservationDataSha256: string;
}>;

export function canonicalR18Identity(
  decisionTime: number,
  symbol: ResearchSymbol,
  direction: R18Direction,
): string {
  return `${decisionTime}|${symbol}|${direction}`;
}

export function isCompleteFiniteScoreBreakdown(
  breakdown: StrategyScoreBreakdown | null | undefined,
): breakdown is StrategyScoreBreakdown {
  return breakdown !== null
    && breakdown !== undefined
    && ROUND_018_SCORE_COMPONENTS.every((component) => {
      const value = breakdown[component];
      return typeof value === "number" && Number.isFinite(value);
    });
}

export function isR18ConsensusCandidate(candidate: StrategyCandidate | null): boolean {
  return candidate !== null
    && ROUND_018_SCORE_COMPONENTS.every((component) => candidate.breakdown[component] > 0)
    && Object.entries(ROUND_018_CANDIDATE_RULE).every(([component, rule]) => {
      if (rule !== "> 0") return false;
      return candidate.breakdown[component as keyof StrategyScoreBreakdown] > 0;
    });
}

export function foldForR18DecisionTime(decisionTime: number): ResearchFoldId | null {
  for (const foldId of ROUND_018_FOLDS) {
    const range = getResearchFoldRoleRange(foldId, "VALIDATION");
    if (decisionTime >= range.startTime && decisionTime <= range.endTime) return foldId;
  }
  return null;
}

function identitiesMatch(
  metadata: R18ObservationMetadata,
  evaluation: StrategyEvaluation,
  candidate: StrategyCandidate | null,
): boolean {
  return evaluation.strategyVersion === "baseline-001"
    && evaluation.symbol === metadata.symbol
    && evaluation.direction === metadata.direction
    && (candidate === null || (candidate.symbol === metadata.symbol && candidate.direction === metadata.direction));
}

function statusForNoCandidate(evaluation: StrategyEvaluation): boolean {
  return evaluation.status === "NO_ELIGIBLE_CANDIDATE" && evaluation.candidate === null;
}

export function classifyR18ReplayEvaluation(
  metadata: R18ObservationMetadata,
  evaluation: StrategyEvaluation | null,
  context: R18ReplayContext,
): R18ReplayDecision {
  const candidate = evaluation?.candidate ?? null;
  const provenance: R18ReplayProvenance = Object.freeze({
    acceptedSourceCommit: ROUND_018_ACCEPTED_SOURCE,
    acceptedSourceEngineSha256: context.acceptedSourceEngineSha256,
    r14ObservationDataSha256: context.r14ObservationDataSha256,
    acceptedSourceProvenanceValid: context.acceptedSourceProvenanceValid,
    canonicalIdentityValid: metadata.canonicalIdentityValid,
    formalSourceStatus: metadata.formalSourceStatus,
    labelIdentityValid: metadata.h4LabelIdentityPresent
      && metadata.labelSourceStatus === "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE",
  });
  const base = {
    observationId: metadata.observationId,
    decisionTime: metadata.decisionTime,
    symbol: metadata.symbol,
    direction: metadata.direction,
    candidate,
    btcRegime: evaluation?.btcRegime ?? null,
    foldId: foldForR18DecisionTime(metadata.decisionTime),
    h4LabelStatus: metadata.h4LabelStatus,
    provenance,
  } as const;

  if (!metadata.canonicalIdentityValid
    || !context.acceptedSourceProvenanceValid
    || metadata.formalSourceStatus !== "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE"
    || !metadata.h4LabelIdentityPresent
    || metadata.labelSourceStatus !== "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE"
    || !evaluation
    || !identitiesMatch(metadata, evaluation, candidate)) {
    return Object.freeze({
      ...base,
      status: "PROVENANCE_INCOMPLETE",
      formalPredicatePassed: false,
      candidateRulePassed: false,
      anomalyCode: "R18_ACCEPTED_SOURCE_OR_IDENTITY_PROVENANCE_INCOMPLETE",
    });
  }

  if (statusForNoCandidate(evaluation)) {
    return Object.freeze({
      ...base,
      status: "NO_BASELINE_CANDIDATE",
      formalPredicatePassed: false,
      candidateRulePassed: false,
      anomalyCode: null,
    });
  }

  const formalPredicatePassed = candidate?.formalSignal === true
    && candidate.totalScore >= ROUND_018_GRADE_C_THRESHOLD;
  if (!formalPredicatePassed) {
    return Object.freeze({
      ...base,
      status: "BASELINE_CANDIDATE_NON_FORMAL",
      formalPredicatePassed: false,
      candidateRulePassed: false,
      anomalyCode: null,
    });
  }

  if (candidate === null
    || !Number.isFinite(candidate.totalScore)
    || !isCompleteFiniteScoreBreakdown(candidate.breakdown)) {
    return Object.freeze({
      ...base,
      status: "PROVENANCE_INCOMPLETE",
      formalPredicatePassed: true,
      candidateRulePassed: false,
      anomalyCode: "FORMAL_SCORE_BREAKDOWN_INCOMPLETE",
    });
  }

  return Object.freeze({
    ...base,
    status: "BASELINE_FORMAL",
    formalPredicatePassed: true,
    candidateRulePassed: isR18ConsensusCandidate(candidate),
    anomalyCode: null,
  });
}

export function structuralRecordFromReplay(
  decision: R18ReplayDecision,
): R18StructuralObservationRecord {
  if (decision.status !== "BASELINE_FORMAL"
    || decision.candidate === null
    || !decision.btcRegime
    || decision.h4LabelStatus === "MISSING"
    || !decision.provenance.acceptedSourceProvenanceValid
    || !decision.provenance.canonicalIdentityValid
    || !decision.provenance.labelIdentityValid
    || !isCompleteFiniteScoreBreakdown(decision.candidate.breakdown)) {
    throw new Error("Only complete formal R18 replay decisions can enter the structural freeze.");
  }
  return Object.freeze({
    schemaVersion: "m3-r18-round-018-structural-observation-001",
    observationId: decision.observationId,
    decisionTime: decision.decisionTime,
    symbol: decision.symbol,
    direction: decision.direction,
    replayStatus: "BASELINE_FORMAL",
    totalScore: decision.candidate.totalScore,
    scoreBreakdown: decision.candidate.breakdown,
    controlIncluded: true,
    candidateIncluded: decision.candidateRulePassed,
    candidateRuleId: ROUND_018_CANDIDATE_RULE_ID,
    foldId: decision.foldId,
    btcRegime: decision.btcRegime,
    h4LabelStatus: decision.h4LabelStatus,
    formalSource: Object.freeze({
      acceptedSourceCommit: ROUND_018_ACCEPTED_SOURCE,
      sourcePath: "src/lib/strategy/engine.ts",
      sourceSha256: decision.provenance.acceptedSourceEngineSha256,
    }),
    labelSource: Object.freeze({
      sourceStatus: "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE",
      sourcePath: "docs/research/round-014-observation-freeze.json",
      sourceSha256: decision.provenance.r14ObservationDataSha256,
    }),
  });
}

export type R18EngineResultByIdentity = ReadonlyMap<string, StrategyEvaluation>;

export function indexR18EngineEvaluations(result: StrategyEngineResult): R18EngineResultByIdentity {
  const indexed = new Map<string, StrategyEvaluation>();
  for (const evaluation of result.evaluations) {
    indexed.set(`${evaluation.symbol}|${evaluation.direction}`, evaluation);
  }
  return indexed;
}
