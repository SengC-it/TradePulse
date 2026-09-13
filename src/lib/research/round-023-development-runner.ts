import { existsSync } from "node:fs";
import path from "node:path";

import {
  R23_BRANCH,
  R23_DEVELOPMENT_CLASSIFICATION,
  R23_NO_FORWARD_CANDIDATE,
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
  classification: typeof R23_NO_FORWARD_CANDIDATE;
  studyClassification: typeof R23_DEVELOPMENT_CLASSIFICATION;
  candidateConfigurationsEvaluated: number;
  eligibleCandidates: readonly [];
  selectedCandidateId: null;
  outcome: "NO_EXISTING_HISTORICAL_DEVELOPMENT_DATA_AVAILABLE";
  historicalDevelopmentEconomicValuesRead: false;
  forwardEconomicValuesRead: false;
  forwardReturnRead: false;
  newMarketDataFetched: false;
  performanceExecutionCount: 0;
  performanceLedgerPresent: false;
  automaticTrading: false;
  humanDecisionRequired: true;
  productionUnchanged: true;
  baseline002Status: "NOT_FROZEN";
  m3JStatus: "BLOCKED";
  m4Status: "NOT_STARTED";
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
    classification: R23_NO_FORWARD_CANDIDATE,
    studyClassification: R23_DEVELOPMENT_CLASSIFICATION,
    candidateConfigurationsEvaluated: calculateR23CandidateConfigurationCount(),
    eligibleCandidates: [] as const,
    selectedCandidateId: null,
    outcome: "NO_EXISTING_HISTORICAL_DEVELOPMENT_DATA_AVAILABLE",
    historicalDevelopmentEconomicValuesRead: false,
    forwardEconomicValuesRead: false,
    forwardReturnRead: false,
    newMarketDataFetched: false,
    performanceExecutionCount: 0,
    performanceLedgerPresent: false,
    automaticTrading: false,
    humanDecisionRequired: true,
    productionUnchanged: true,
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
  });
}

export function validateR23ProtocolIdentity(): void {
  if (R23_PROTOCOL_OBJECT.base.sha !== "6924783d26e377a543bfc0d438a2bf6e6c40ba8a") throw new Error("R23 base identity drift.");
}
