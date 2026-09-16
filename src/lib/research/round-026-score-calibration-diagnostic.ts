import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createInterface } from "node:readline";
import path from "node:path";

import { getResearchFoldRoleRange } from "./folds.ts";
import {
  fitR25CandidateModel,
  predictR25Candidate,
  R25_LONG_CANDIDATE_CONFIGURATIONS,
  R25_SHORT_CANDIDATE_CONFIGURATIONS,
  type R25CandidateConfiguration,
  type R25FitExample,
  type R25ModelArtifact,
} from "./round-025-candidate-model.ts";
import {
  R25_FOLD_IDS,
  R25_PURGE_EMBARGO_HOURS,
  R25_SYMBOLS,
  type R25Direction,
  type R25FoldId,
  type R25Symbol,
} from "./round-025-protocol.ts";
import {
  buildR26ScoreDistribution,
  buildR26ThresholdDiagnostics,
  classifyR26Direction,
  R26_ALLOWED_VALIDATION_FIELDS,
  R26_BASE_BRANCH,
  R26_BASE_SHA,
  R26_BRANCH,
  R26_FORBIDDEN_VALIDATION_FIELDS,
  R26_GOVERNANCE,
  R26_PHASE,
  R26_RESEARCH_ROUND_ID,
  R26_SOURCE,
  recommendedR26NextDesign,
  type R26CandidateDiagnostics,
  type R26DiagnosticClassification,
  type R26DiagnosticResult,
  type R26FoldDiagnostics,
  type R26ModelScaleDrift,
} from "./round-026-score-calibration-protocol.ts";
import { stableStringify } from "./utils.ts";

export const R26_ACCEPTED_R25_RESULT_PATH = "docs/research/round-025-directional-development-result.json" as const;
export const R26_SOURCE_ENVIRONMENT_VARIABLE = "TRADEPULSE_R26_SOURCE_OBSERVATION_FILE" as const;
export const R26_PURPOSE = "DIAGNOSTIC_SCORE_DISTRIBUTIONS_ONLY" as const;

type JsonRecord = Record<string, unknown>;

export type R26DiagnosticRow = Readonly<{
  observationId: string;
  decisionTime: number;
  symbol: R25Symbol;
  direction: R25Direction;
  features: Readonly<Record<string, number>>;
  researchTargetNetR: number | null;
}>;

export type R26SourceLoad = Readonly<{
  sourcePath: string;
  rows: readonly R26DiagnosticRow[];
  observationDataBytes: number;
  observationDataSha256: string;
  observationCount: number;
}>;

type AcceptedR25FoldMetadata = Readonly<{
  foldId: R25FoldId;
  trainingExamples: number;
  modelIdentitySha256: string;
}>;

type AcceptedR25CandidateMetadata = Readonly<{
  candidateConfigurationId: string;
  selectedAlerts: number;
  modelProvenance: readonly AcceptedR25FoldMetadata[];
}>;

type Prediction = Readonly<{
  row: R26DiagnosticRow;
  prediction: number | null;
}>;

type FoldInput = Readonly<{
  config: R25CandidateConfiguration;
  foldId: R25FoldId;
  trainingRows: readonly R26DiagnosticRow[];
  validationRows: readonly R26DiagnosticRow[];
  expectedTrainingExamples: number;
  expectedModelIdentitySha256: string;
}>;

function asRecord(value: unknown, label: string): JsonRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error(`${label} must be a JSON object.`);
  return value as JsonRecord;
}

function requiredString(record: JsonRecord, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label}.${key} must be a non-empty string.`);
  return value;
}

function requiredSafeInteger(record: JsonRecord, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`${label}.${key} must be a non-negative safe integer.`);
  return value;
}

function requiredFiniteNumber(record: JsonRecord, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label}.${key} must be finite.`);
  return value;
}

function inFoldRole(decisionTime: number, foldId: R25FoldId, role: "RESEARCH" | "VALIDATION"): boolean {
  const range = getResearchFoldRoleRange(foldId, role);
  return decisionTime >= range.startTime && decisionTime <= range.endTime;
}

function needsResearchTarget(decisionTime: number): boolean {
  return R25_FOLD_IDS.some((foldId) => inFoldRole(decisionTime, foldId, "RESEARCH"));
}

function parseFeatures(value: unknown, label: string): Readonly<Record<string, number>> {
  const features = asRecord(value, `${label}.features`);
  const parsed = Object.fromEntries(Object.entries(features).map(([name, featureValue]) => {
    if (typeof featureValue !== "number" || !Number.isFinite(featureValue)) throw new Error(`${label}.features.${name} must be finite.`);
    return [name, featureValue];
  })) as Record<string, number>;
  if (Object.keys(parsed).length === 0) throw new Error(`${label}.features must not be empty.`);
  return Object.freeze(parsed);
}

function parseResearchTarget(record: JsonRecord, label: string, readTarget: boolean): number | null {
  if (!readTarget) return null;
  const labels = record.labels;
  if (typeof labels !== "object" || labels === null || Array.isArray(labels)) return null;
  const primary = (labels as JsonRecord)["4"];
  if (typeof primary !== "object" || primary === null || Array.isArray(primary)) return null;
  const primaryRecord = primary as JsonRecord;
  if (primaryRecord.status !== "EXECUTED") return null;
  const target = primaryRecord.netForwardAtr;
  return typeof target === "number" && Number.isFinite(target) ? target : null;
}

function parseObservation(line: string, lineNumber: number): R26DiagnosticRow {
  const label = `observation line ${lineNumber}`;
  const record = asRecord(JSON.parse(line), label);
  const observationId = requiredString(record, "observationId", label);
  const decisionTime = requiredSafeInteger(record, "decisionTime", label);
  const symbol = requiredString(record, "symbol", label) as R25Symbol;
  const direction = requiredString(record, "direction", label) as R25Direction;
  if (!R25_SYMBOLS.includes(symbol)) throw new Error(`${label}.symbol is outside the frozen R25 universe.`);
  if (direction !== "LONG" && direction !== "SHORT") throw new Error(`${label}.direction is outside the frozen R25 directions.`);
  const features = parseFeatures(record.features, label);
  return Object.freeze({
    observationId,
    decisionTime,
    symbol,
    direction,
    features,
    researchTargetNetR: parseResearchTarget(record, label, needsResearchTarget(decisionTime)),
  });
}

function sourceCandidates(root: string): readonly string[] {
  return [
    process.env[R26_SOURCE_ENVIRONMENT_VARIABLE],
    path.join(root, R26_SOURCE.canonicalObservationPath),
    path.resolve(root, "..", "round-014-r13-execution-replay", R26_SOURCE.canonicalObservationPath),
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0);
}

export function resolveR26Source(root = process.cwd()): string {
  const source = sourceCandidates(path.resolve(root)).find((candidate) => existsSync(candidate));
  if (!source) throw new Error("R26 source is unavailable; network acquisition is forbidden.");
  return path.resolve(source);
}

export async function loadR26MetadataOnlySource(sourcePath: string): Promise<R26SourceLoad> {
  const resolvedPath = path.resolve(sourcePath);
  if (!existsSync(resolvedPath)) throw new Error("R26 source is unavailable; network acquisition is forbidden.");
  const hash = createHash("sha256");
  const stream = createReadStream(resolvedPath, { encoding: "utf8" });
  stream.on("data", (chunk: string) => hash.update(chunk, "utf8"));
  const reader = createInterface({ input: stream, crlfDelay: Infinity });
  const rows: R26DiagnosticRow[] = [];
  const observationIds = new Set<string>();
  let lineNumber = 0;
  let previousDecisionTime = -1;
  for await (const line of reader) {
    lineNumber += 1;
    if (line.trim().length === 0) continue;
    const row = parseObservation(line, lineNumber);
    if (observationIds.has(row.observationId)) throw new Error(`Duplicate R26 observationId: ${row.observationId}`);
    if (row.decisionTime < previousDecisionTime) throw new Error("R26 source chronology is not nondecreasing.");
    previousDecisionTime = row.decisionTime;
    observationIds.add(row.observationId);
    rows.push(row);
  }
  const observationDataBytes = statSync(resolvedPath).size;
  const observationDataSha256 = hash.digest("hex");
  if (observationDataBytes !== R26_SOURCE.observationDataBytes || observationDataSha256 !== R26_SOURCE.observationDataSha256 || rows.length !== R26_SOURCE.observationCount) {
    throw new Error("R26 source does not match the accepted immutable R14 observation identity.");
  }
  return Object.freeze({ sourcePath: resolvedPath, rows: Object.freeze(rows), observationDataBytes, observationDataSha256, observationCount: rows.length });
}

function readAcceptedR25Metadata(root: string): readonly AcceptedR25CandidateMetadata[] {
  const resultPath = path.join(path.resolve(root), R26_ACCEPTED_R25_RESULT_PATH);
  const document = asRecord(JSON.parse(readFileSync(resultPath, "utf8")), "accepted R25 result");
  const candidates = document.candidateResults;
  if (!Array.isArray(candidates)) throw new Error("Accepted R25 result candidateResults must be an array.");
  return Object.freeze(candidates.map((candidateValue, candidateIndex) => {
    const candidate = asRecord(candidateValue, `accepted R25 candidate ${candidateIndex}`);
    const provenance = candidate.modelProvenance;
    if (!Array.isArray(provenance)) throw new Error(`Accepted R25 candidate ${candidateIndex} modelProvenance must be an array.`);
    const modelProvenance = Object.freeze(provenance.map((foldValue, foldIndex) => {
      const fold = asRecord(foldValue, `accepted R25 candidate ${candidateIndex} fold ${foldIndex}`);
      return Object.freeze({
        foldId: requiredString(fold, "foldId", "accepted R25 provenance") as R25FoldId,
        trainingExamples: requiredSafeInteger(fold, "trainingExamples", "accepted R25 provenance"),
        modelIdentitySha256: requiredString(fold, "modelIdentitySha256", "accepted R25 provenance"),
      });
    }));
    return Object.freeze({
      candidateConfigurationId: requiredString(candidate, "candidateConfigurationId", `accepted R25 candidate ${candidateIndex}`),
      selectedAlerts: requiredSafeInteger(candidate, "selectedAlerts", `accepted R25 candidate ${candidateIndex}`),
      modelProvenance,
    });
  }));
}

function crossSectionalNormalize(rows: readonly R26DiagnosticRow[]): readonly R26DiagnosticRow[] {
  const grouped = new Map<number, R26DiagnosticRow[]>();
  for (const row of rows) grouped.set(row.decisionTime, [...(grouped.get(row.decisionTime) ?? []), row]);
  const normalized: R26DiagnosticRow[] = [];
  for (const row of rows) {
    const peers = grouped.get(row.decisionTime) ?? [row];
    const featureNames = Object.keys(row.features);
    const features = Object.fromEntries(featureNames.map((name) => {
      const values = peers.map((peer) => peer.features[name]!);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / values.length;
      const deviation = Math.sqrt(variance) || 1;
      return [name, (row.features[name]! - average) / deviation];
    })) as Record<string, number>;
    normalized.push(Object.freeze({ ...row, features: Object.freeze(features) }));
  }
  return Object.freeze(normalized);
}

function normalizedRows(rows: readonly R26DiagnosticRow[], config: R25CandidateConfiguration): readonly R26DiagnosticRow[] {
  if (config.normalization !== "CROSS_SECTIONAL_ZSCORE_PER_DECISION_TIME") throw new Error("R25 normalization is not frozen.");
  return crossSectionalNormalize(rows);
}

function symbolOrder(symbol: R25Symbol): number {
  const index = R25_SYMBOLS.indexOf(symbol);
  if (index < 0) throw new Error(`Unknown R25 symbol: ${symbol}`);
  return index;
}

function comparePrediction(left: Prediction, right: Prediction): number {
  if (left.prediction === null && right.prediction === null) return 0;
  if (left.prediction === null) return 1;
  if (right.prediction === null) return -1;
  return right.prediction - left.prediction
    || symbolOrder(left.row.symbol) - symbolOrder(right.row.symbol)
    || left.row.observationId.localeCompare(right.row.observationId);
}

function modelScale(model: R25ModelArtifact) {
  const coefficients = Object.values(model.coefficients);
  return Object.freeze({
    intercept: model.intercept,
    coefficientL1Norm: coefficients.reduce((sum, value) => sum + Math.abs(value), 0),
    coefficientL2Norm: Math.sqrt(coefficients.reduce((sum, value) => sum + value ** 2, 0)),
    maximumAbsCoefficient: coefficients.length === 0 ? 0 : Math.max(...coefficients.map((value) => Math.abs(value))),
  });
}

export function diagnoseR26CandidateFold(input: FoldInput): R26FoldDiagnostics {
  const trainingNormalized = normalizedRows(input.trainingRows, input.config);
  const examples = trainingNormalized.map((row): R25FitExample => {
    if (row.researchTargetNetR === null) throw new Error("R26 training row is missing its research-only target.");
    return { features: row.features, targetNetR: row.researchTargetNetR };
  });
  const model = fitR25CandidateModel(examples, input.config);
  const validationNormalized = normalizedRows(input.validationRows, input.config);
  const predictions: Prediction[] = [];
  for (const row of validationNormalized) {
    try {
      const prediction = predictR25Candidate(model, row.features);
      predictions.push(Object.freeze({ row, prediction: Number.isFinite(prediction) ? prediction : null }));
    } catch {
      predictions.push(Object.freeze({ row, prediction: null }));
    }
  }
  const byDecisionTime = new Map<number, Prediction[]>();
  for (const prediction of predictions) byDecisionTime.set(prediction.row.decisionTime, [...(byDecisionTime.get(prediction.row.decisionTime) ?? []), prediction]);
  const topScores: number[] = [];
  const peerCounts = [...byDecisionTime.values()].map((rows) => rows.length);
  for (const rows of byDecisionTime.values()) {
    const top = [...rows].sort(comparePrediction)[0];
    if (top?.prediction !== null && top?.prediction !== undefined) topScores.push(top.prediction);
  }
  const peerCountMin = peerCounts.length === 0 ? null : Math.min(...peerCounts);
  const peerCountMax = peerCounts.length === 0 ? null : Math.max(...peerCounts);
  return Object.freeze({
    foldId: input.foldId,
    predictionDistribution: buildR26ScoreDistribution(predictions.flatMap((prediction) => prediction.prediction === null ? [] : [prediction.prediction])),
    topPredictionDistribution: buildR26ScoreDistribution(topScores),
    thresholdDiagnostics: buildR26ThresholdDiagnostics(input.config.threshold, topScores),
    modelScale: modelScale(model),
    pipeline: Object.freeze({
      trainingExamples: examples.length,
      expectedTrainingExamples: input.expectedTrainingExamples,
      modelIdentitySha256: model.modelIdentitySha256,
      expectedModelIdentitySha256: input.expectedModelIdentitySha256,
      modelIdentityMatched: model.modelIdentitySha256 === input.expectedModelIdentitySha256,
      validationDecisionTimeCount: byDecisionTime.size,
      validationRowCount: validationNormalized.length,
      peerCountMin,
      peerCountMax,
      peerCountsValid: peerCounts.every((count) => count === R25_SYMBOLS.length),
      nonFinitePredictionCount: predictions.filter((prediction) => prediction.prediction === null).length,
    }),
  });
}

function modelScaleDrift(folds: readonly R26FoldDiagnostics[]): readonly R26ModelScaleDrift[] {
  const first = folds.find((fold) => fold.foldId === "F1") ?? folds[0];
  if (!first) return Object.freeze([]);
  return Object.freeze(folds.map((fold) => Object.freeze({
    foldId: fold.foldId,
    interceptDeltaFromF1: fold.modelScale.intercept - first.modelScale.intercept,
    coefficientL1DeltaFromF1: fold.modelScale.coefficientL1Norm - first.modelScale.coefficientL1Norm,
    coefficientL2DeltaFromF1: fold.modelScale.coefficientL2Norm - first.modelScale.coefficientL2Norm,
    maximumAbsCoefficientDeltaFromF1: fold.modelScale.maximumAbsCoefficient - first.modelScale.maximumAbsCoefficient,
  })));
}

function buildCandidateDiagnostics(
  config: R25CandidateConfiguration,
  folds: readonly R26FoldDiagnostics[],
  accepted: AcceptedR25CandidateMetadata,
): R26CandidateDiagnostics {
  const thresholdExceedancesByFold = Object.fromEntries(folds.map((fold) => [fold.foldId, fold.thresholdDiagnostics.thresholdExceedanceCount])) as Record<R25FoldId, number>;
  const reproducedR25SelectedAlertCount = Object.values(thresholdExceedancesByFold).reduce((sum, value) => sum + value, 0);
  const totalExceedances = reproducedR25SelectedAlertCount;
  const largestFold = Math.max(0, ...Object.values(thresholdExceedancesByFold));
  return Object.freeze({
    candidateConfigurationId: config.candidateConfigurationId,
    family: config.family,
    direction: config.direction,
    threshold: config.threshold,
    folds,
    thresholdExceedancesByFold: Object.freeze(thresholdExceedancesByFold),
    shareOfExceedancesInLargestFold: totalExceedances === 0 ? 0 : largestFold / totalExceedances,
    foldsWithZeroThresholdExceedances: folds.filter((fold) => fold.thresholdDiagnostics.thresholdExceedanceCount === 0).length,
    foldsThresholdAboveP99: folds.filter((fold) => fold.thresholdDiagnostics.thresholdAboveTopP99).length,
    foldsThresholdAboveMax: folds.filter((fold) => fold.thresholdDiagnostics.thresholdAboveTopMax).length,
    modelScaleDriftByFold: modelScaleDrift(folds),
    reproducedR25SelectedAlertCount,
    acceptedR25SelectedAlertCount: accepted.selectedAlerts,
    selectedAlertCountReproduced: reproducedR25SelectedAlertCount === accepted.selectedAlerts,
  });
}

function acceptedCandidateMetadata(
  accepted: readonly AcceptedR25CandidateMetadata[],
  configurationId: string,
): AcceptedR25CandidateMetadata {
  const candidate = accepted.find((item) => item.candidateConfigurationId === configurationId);
  if (!candidate) throw new Error(`Accepted R25 metadata is missing ${configurationId}.`);
  return candidate;
}

function acceptedFoldMetadata(candidate: AcceptedR25CandidateMetadata, foldId: R25FoldId): AcceptedR25FoldMetadata {
  const fold = candidate.modelProvenance.find((item) => item.foldId === foldId);
  if (!fold) throw new Error(`Accepted R25 metadata is missing ${candidate.candidateConfigurationId} ${foldId}.`);
  return fold;
}

function directionResult(candidates: readonly R26CandidateDiagnostics[], direction: R25Direction): readonly R26CandidateDiagnostics[] {
  return Object.freeze(candidates.filter((candidate) => candidate.direction === direction));
}

export async function runR26ScoreCalibrationDiagnostic(options: Readonly<{ root?: string; sourcePath?: string }> = {}): Promise<R26DiagnosticResult> {
  const root = path.resolve(options.root ?? process.cwd());
  const sourcePath = options.sourcePath ?? resolveR26Source(root);
  const source = await loadR26MetadataOnlySource(sourcePath);
  const accepted = readAcceptedR25Metadata(root);
  const configurations = [...R25_LONG_CANDIDATE_CONFIGURATIONS, ...R25_SHORT_CANDIDATE_CONFIGURATIONS];
  const candidates: R26CandidateDiagnostics[] = [];
  for (const config of configurations) {
    const acceptedCandidate = acceptedCandidateMetadata(accepted, config.candidateConfigurationId);
    const folds: R26FoldDiagnostics[] = [];
    for (const foldId of R25_FOLD_IDS) {
      const acceptedFold = acceptedFoldMetadata(acceptedCandidate, foldId);
      const validationStart = getResearchFoldRoleRange(foldId, "VALIDATION").startTime;
      const trainingRows = source.rows.filter((row) => row.direction === config.direction
        && inFoldRole(row.decisionTime, foldId, "RESEARCH")
        && row.decisionTime < validationStart - R25_PURGE_EMBARGO_HOURS * 60 * 60 * 1_000
        && row.researchTargetNetR !== null);
      const validationRows = source.rows.filter((row) => row.direction === config.direction && inFoldRole(row.decisionTime, foldId, "VALIDATION"));
      folds.push(diagnoseR26CandidateFold({
        config,
        foldId,
        trainingRows,
        validationRows,
        expectedTrainingExamples: acceptedFold.trainingExamples,
        expectedModelIdentitySha256: acceptedFold.modelIdentitySha256,
      }));
    }
    candidates.push(buildCandidateDiagnostics(config, folds, acceptedCandidate));
  }
  const longCandidates = directionResult(candidates, "LONG");
  const shortCandidates = directionResult(candidates, "SHORT");
  const allFolds = candidates.flatMap((candidate) => candidate.folds);
  const candidateFoldExecutionCount = candidates.reduce<number>((sum, candidate) => sum + candidate.folds.length, 0);
  if (candidates.length !== 6 || candidateFoldExecutionCount !== 36) throw new Error("R26 diagnostic must evaluate exactly six candidates across six folds.");
  const modelIdentitiesMatched = allFolds.every((fold) => fold.pipeline.modelIdentityMatched);
  const peerCountsValid = allFolds.every((fold) => fold.pipeline.peerCountsValid);
  const nonFinitePredictions = allFolds.reduce((sum, fold) => sum + fold.pipeline.nonFinitePredictionCount, 0);
  const r25SelectedAlertCountsReproduced = candidates.every((candidate) => candidate.selectedAlertCountReproduced);
  const primaryLongClassification = classifyR26Direction(longCandidates);
  const primaryShortClassification = classifyR26Direction(shortCandidates);
  const recommendedNextDesign = recommendedR26NextDesign(primaryLongClassification, primaryShortClassification);
  return Object.freeze({
    schemaVersion: "m3-r26-score-calibration-diagnostic-001",
    researchRoundId: R26_RESEARCH_ROUND_ID,
    phase: R26_PHASE,
    base: Object.freeze({ branch: R26_BASE_BRANCH, sha: R26_BASE_SHA }),
    source: Object.freeze({
      canonicalObservationPath: R26_SOURCE.canonicalObservationPath,
      actualPath: source.sourcePath,
      manifestPath: R26_SOURCE.manifestPath,
      observationDataSha256: source.observationDataSha256,
      observationDataBytes: source.observationDataBytes,
      observationCount: source.observationCount,
      networkAcquired: false,
      classification: R26_SOURCE.classification,
    }),
    purpose: R26_PURPOSE,
    diagnosticOnly: true,
    economicEvaluationPerformed: false,
    validationEconomicValuesRead: false,
    historicalTrainingTargetValuesRead: true,
    validationFieldsRead: Object.freeze([...R26_ALLOWED_VALIDATION_FIELDS]),
    forbiddenValidationFields: Object.freeze([...R26_FORBIDDEN_VALIDATION_FIELDS]),
    scoreCalibrationDiagnosticExecutionCount: 1,
    developmentEconomicEvaluationExecutionCount: 1,
    candidateConfigurationsDefined: 6 as const,
    candidateConfigurationsEvaluated: 6 as const,
    candidateFoldExecutionCount: 36 as const,
    candidateDiagnostics: Object.freeze(candidates),
    pipelineIntegrity: Object.freeze({
      pipelineNormal: modelIdentitiesMatched && peerCountsValid && nonFinitePredictions === 0 && r25SelectedAlertCountsReproduced,
      modelIdentitiesMatched,
      peerCountsValid,
      nonFinitePredictions,
      deterministic: true,
      r25SelectedAlertCountsReproduced,
    }),
    primaryLongClassification,
    primaryShortClassification,
    recommendedNextDesign,
    forwardEconomicValuesRead: false,
    forwardReturnRead: false,
    performanceExecutionCount: 0,
    performanceLedgerPresent: false,
    automaticTrading: false,
    humanDecisionRequired: true,
    productionUnchanged: true,
    mainUnchanged: true,
    emailRestorationAuthorized: false,
    newMarketDataFetched: false,
    selectionExecuted: false,
    forwardValidationAuthorized: false,
    finalDecision: "ROUND-026 SCORE CALIBRATION DIAGNOSTIC COMPLETE",
    nextStage: recommendedNextDesign,
    governance: R26_GOVERNANCE,
  } as R26DiagnosticResult);
}

function scoreCell(value: number | null): string {
  return value === null ? "null" : String(value);
}

export function renderR26DiagnosticMarkdown(result: R26DiagnosticResult): string {
  const lines = [
    "# Round-026 Directional Score Calibration Diagnostic",
    "",
    `- Phase: \`${result.phase}\``,
    `- Base: \`${result.base.branch}@${result.base.sha}\``,
    `- Purpose: \`${R26_PURPOSE}\``,
    `- Diagnostic only: \`${result.diagnosticOnly}\``,
    `- Economic evaluation performed: \`${result.economicEvaluationPerformed}\``,
    `- Validation economic values read: \`${result.validationEconomicValuesRead}\``,
    `- Historical training targets read only for research fitting: \`${result.historicalTrainingTargetValuesRead}\``,
    "",
    "## Immutable source",
    "",
    `- Canonical path: \`${result.source.canonicalObservationPath}\``,
    `- Source SHA256: \`${result.source.observationDataSha256}\``,
    `- Bytes: ${result.source.observationDataBytes}`,
    `- Observations: ${result.source.observationCount}`,
    `- Window: ${R26_SOURCE.windowStart} through ${R26_SOURCE.windowEnd}`,
    `- Classification: \`${result.source.classification}\``,
    `- Network acquired: \`${result.source.networkAcquired}\``,
    "",
    "## Pipeline integrity",
    "",
    `- Candidate-fold executions: ${result.candidateFoldExecutionCount}`,
    `- Model identities matched: \`${result.pipelineIntegrity.modelIdentitiesMatched}\``,
    `- Peer counts valid: \`${result.pipelineIntegrity.peerCountsValid}\``,
    `- Non-finite predictions: ${result.pipelineIntegrity.nonFinitePredictions}`,
    `- Accepted R25 threshold-count reproduction: \`${result.pipelineIntegrity.r25SelectedAlertCountsReproduced}\``,
    `- Deterministic: \`${result.pipelineIntegrity.deterministic}\``,
    "",
    "## Candidate-fold score diagnostics",
    "",
    "| Candidate | Fold | Train rows | Validation decision times | Validation rows | Peers min/max | Non-finite | Model match | Prediction count | Prediction min | Prediction mean | Prediction stddev | Prediction P50 | Prediction P75 | Prediction P90 | Prediction P95 | Prediction P99 | Prediction max | Top count | Top P50 | Top P75 | Top P90 | Top P95 | Top P99 | Top max | Threshold | Exceedances | Threshold > P99 | Threshold > max |",
    "| --- | --- | ---: | ---: | ---: | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
  ];
  for (const candidate of result.candidateDiagnostics) {
    for (const fold of candidate.folds) {
      const pipeline = fold.pipeline;
      const prediction = fold.predictionDistribution;
      const top = fold.topPredictionDistribution;
      const threshold = fold.thresholdDiagnostics;
      lines.push(`| ${candidate.candidateConfigurationId} | ${fold.foldId} | ${pipeline.trainingExamples} | ${pipeline.validationDecisionTimeCount} | ${pipeline.validationRowCount} | ${pipeline.peerCountMin ?? "null"}/${pipeline.peerCountMax ?? "null"} | ${pipeline.nonFinitePredictionCount} | ${pipeline.modelIdentityMatched} | ${prediction.count} | ${scoreCell(prediction.min)} | ${scoreCell(prediction.mean)} | ${scoreCell(prediction.stddev)} | ${scoreCell(prediction.p50)} | ${scoreCell(prediction.p75)} | ${scoreCell(prediction.p90)} | ${scoreCell(prediction.p95)} | ${scoreCell(prediction.p99)} | ${scoreCell(prediction.max)} | ${top.count} | ${scoreCell(top.p50)} | ${scoreCell(top.p75)} | ${scoreCell(top.p90)} | ${scoreCell(top.p95)} | ${scoreCell(top.p99)} | ${scoreCell(top.max)} | ${threshold.threshold} | ${threshold.thresholdExceedanceCount} | ${threshold.thresholdAboveTopP99} | ${threshold.thresholdAboveTopMax} |`);
    }
  }
  lines.push("", "## Candidate threshold-count reconciliation", "", "| Candidate | Reproduced accepted R25 selected-alert count | Accepted R25 count | Match | Largest-fold exceedance share | Zero-exceedance folds | Threshold-above-P99 folds | Threshold-above-max folds |", "| --- | ---: | ---: | --- | ---: | ---: | ---: | ---: |");
  for (const candidate of result.candidateDiagnostics) lines.push(`| ${candidate.candidateConfigurationId} | ${candidate.reproducedR25SelectedAlertCount} | ${candidate.acceptedR25SelectedAlertCount} | ${candidate.selectedAlertCountReproduced} | ${candidate.shareOfExceedancesInLargestFold} | ${candidate.foldsWithZeroThresholdExceedances} | ${candidate.foldsThresholdAboveP99} | ${candidate.foldsThresholdAboveMax} |`);
  lines.push("", "## Model scale and F1-relative drift", "", "| Candidate | Fold | Intercept | Coefficient L1 | Coefficient L2 | Max absolute coefficient | Δ intercept from F1 | Δ L1 from F1 | Δ L2 from F1 | Δ max coefficient from F1 |", "| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const candidate of result.candidateDiagnostics) {
    for (const [index, fold] of candidate.folds.entries()) {
      const drift = candidate.modelScaleDriftByFold[index]!;
      lines.push(`| ${candidate.candidateConfigurationId} | ${fold.foldId} | ${fold.modelScale.intercept} | ${fold.modelScale.coefficientL1Norm} | ${fold.modelScale.coefficientL2Norm} | ${fold.modelScale.maximumAbsCoefficient} | ${drift.interceptDeltaFromF1} | ${drift.coefficientL1DeltaFromF1} | ${drift.coefficientL2DeltaFromF1} | ${drift.maximumAbsCoefficientDeltaFromF1} |`);
    }
  }
  lines.push(
    "",
    "## Classification",
    "",
    `- LONG: \`${result.primaryLongClassification}\``,
    `- SHORT: \`${result.primaryShortClassification}\``,
    `- Recommended next design: \`${result.recommendedNextDesign}\``,
    `- Final decision: \`${result.finalDecision}\``,
    "",
    "## Governance",
    "",
    `- scoreCalibrationDiagnosticExecutionCount: ${result.scoreCalibrationDiagnosticExecutionCount}`,
    `- developmentEconomicEvaluationExecutionCount: ${result.developmentEconomicEvaluationExecutionCount}`,
    `- forwardEconomicValuesRead: ${result.forwardEconomicValuesRead}`,
    `- forwardReturnRead: ${result.forwardReturnRead}`,
    `- performanceExecutionCount: ${result.performanceExecutionCount}`,
    `- automaticTrading: ${result.automaticTrading}`,
    `- humanDecisionRequired: ${result.humanDecisionRequired}`,
    `- productionUnchanged: ${result.productionUnchanged}`,
    `- newMarketDataFetched: ${result.newMarketDataFetched}`,
    "",
    "No validation labels, settlement fields, returns, PnL, profit factor, drawdown, cost stress, latency outcome, selection, forward data, or economic result values are read by this diagnostic.",
  );
  return `${lines.join("\n")}\n`;
}

export function r26DiagnosticFingerprint(result: R26DiagnosticResult): string {
  return createHash("sha256").update(stableStringify(result), "utf8").digest("hex");
}

export function r26ClassificationValues(result: R26DiagnosticResult): readonly R26DiagnosticClassification[] {
  return Object.freeze([result.primaryLongClassification, result.primaryShortClassification]);
}
