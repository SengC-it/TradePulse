import { existsSync } from "node:fs";
import path from "node:path";

import {
  R23_BRANCH,
  R23_DEVELOPMENT_CLASSIFICATION,
  R23_DEVELOPMENT_NOT_EVALUABLE_DATA_UNAVAILABLE,
  R23_NO_VALID_PRE_OUTCOME_SOURCE_DECISION,
  R23_SOURCE_REMEDIATION_NEXT_STAGE,
  R23_SOURCE_UNAVAILABLE_DECISION,
  R23_PROTOCOL_OBJECT,
  R23_PROTOCOL_SHA256,
  R23_EXISTING_DATA_PATH,
  calculateR23CandidateConfigurationCount,
} from "./round-023-development-protocol.ts";

export type R23DevelopmentResult = Readonly<{
  schemaVersion: "m3-r23-development-result-001";
  branch: typeof R23_BRANCH;
  protocolSha256: string;
  developmentExecutionId: string;
  developmentExecutionCount: 1;
  classification: typeof R23_DEVELOPMENT_NOT_EVALUABLE_DATA_UNAVAILABLE;
  studyClassification: typeof R23_DEVELOPMENT_CLASSIFICATION;
  candidateConfigurationsDefined: number;
  candidateConfigurationsEvaluated: number;
  eligibleCandidates: null;
  selectedCandidateId: null;
  selectionExecuted: false;
  outcome: "NO_EXISTING_HISTORICAL_DEVELOPMENT_DATA_AVAILABLE";
  sourceAudit: Readonly<{
    requiredPath: typeof R23_EXISTING_DATA_PATH;
    validPreExistingSourceFound: false;
    repositoryPathExists: false;
    reachableAcceptedArtifactWithRequiredPath: false;
    compatibleExistingCacheFound: false;
    auditScope: "EXISTING_REPOSITORY_GIT_OBJECTS_AND_CACHE_METADATA_ONLY";
    pitCompatible: false;
    economicPayloadRead: false;
    finalStopDisposition: typeof R23_NO_VALID_PRE_OUTCOME_SOURCE_DECISION;
    reason: string;
  }>;
  developmentEconomicEvaluationExecutionCount: 0;
  historicalDevelopmentEconomicValuesRead: false;
  forwardEconomicValuesRead: false;
  forwardReturnRead: false;
  economicValuesCalculated: false;
  economicValuesInspected: false;
  newMarketDataFetched: false;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  automaticTrading: false;
  humanDecisionRequired: true;
  productionUnchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
  finalDecision: typeof R23_SOURCE_UNAVAILABLE_DECISION;
  nextStage: typeof R23_SOURCE_REMEDIATION_NEXT_STAGE;
}>;

export function runR23HistoricalDevelopment(input: Readonly<{ root?: string } > = {}): R23DevelopmentResult {
  const root = path.resolve(input.root ?? process.cwd());
  const expectedDataPath = path.join(root, R23_EXISTING_DATA_PATH);
  if (existsSync(expectedDataPath)) {
    throw new Error("R23 development data loader is intentionally not enabled by this freeze; an explicit reviewed loader is required before reading historical outcome values.");
  }

  return Object.freeze({
    schemaVersion: "m3-r23-development-result-001",
    branch: R23_BRANCH,
    protocolSha256: R23_PROTOCOL_SHA256,
    developmentExecutionId: `r23-development-${R23_PROTOCOL_SHA256.slice(0, 16)}`,
    developmentExecutionCount: 1,
    classification: R23_DEVELOPMENT_NOT_EVALUABLE_DATA_UNAVAILABLE,
    studyClassification: R23_DEVELOPMENT_CLASSIFICATION,
    candidateConfigurationsDefined: calculateR23CandidateConfigurationCount(),
    candidateConfigurationsEvaluated: 0,
    eligibleCandidates: null,
    selectedCandidateId: null,
    selectionExecuted: false,
    outcome: "NO_EXISTING_HISTORICAL_DEVELOPMENT_DATA_AVAILABLE",
    sourceAudit: {
      requiredPath: R23_EXISTING_DATA_PATH,
      validPreExistingSourceFound: false,
      repositoryPathExists: false,
      reachableAcceptedArtifactWithRequiredPath: false,
      compatibleExistingCacheFound: false,
      auditScope: "EXISTING_REPOSITORY_GIT_OBJECTS_AND_CACHE_METADATA_ONLY",
      pitCompatible: false,
      economicPayloadRead: false,
      finalStopDisposition: R23_NO_VALID_PRE_OUTCOME_SOURCE_DECISION,
      reason: "The required R15 historical development cache is absent from the worktree and no reachable accepted repository artifact with the required identity was found. Other round caches are not accepted substitutes.",
    } as const,
    developmentEconomicEvaluationExecutionCount: 0,
    historicalDevelopmentEconomicValuesRead: false,
    forwardEconomicValuesRead: false,
    forwardReturnRead: false,
    economicValuesCalculated: false,
    economicValuesInspected: false,
    newMarketDataFetched: false,
    performanceExecutionCount: 0,
    performanceLedgerPresent: false,
    automaticTrading: false,
    humanDecisionRequired: true,
    productionUnchanged: true,
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
    finalDecision: R23_SOURCE_UNAVAILABLE_DECISION,
    nextStage: R23_SOURCE_REMEDIATION_NEXT_STAGE,
  });
}

export function validateR23ProtocolIdentity(): void {
  if (R23_PROTOCOL_OBJECT.base.sha !== "6924783d26e377a543bfc0d438a2bf6e6c40ba8a") throw new Error("R23 base identity drift.");
}
