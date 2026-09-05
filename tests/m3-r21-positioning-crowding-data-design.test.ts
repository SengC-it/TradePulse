import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  R21_ACCEPTED_HYPOTHESIS_PATH,
  R21_DATA_DESIGN_ACCEPTED_SOURCE,
  R21_DATA_DESIGN_ACCEPTED_SOURCE_BRANCH,
  R21_DATA_DESIGN_GATE_IDS,
  R21_DATA_DESIGN_GOVERNANCE,
  R21_DATA_DESIGN_HYPOTHESIS_ID,
  R21_DATA_DESIGN_INPUTS,
  R21_DATA_DESIGN_JSON_PATH,
  R21_DATA_DESIGN_LONG_PREDICATE,
  R21_DATA_DESIGN_MARKDOWN_PATH,
  R21_DATA_DESIGN_MECHANISM_FAMILY,
  R21_DATA_DESIGN_PHASE,
  R21_DATA_DESIGN_SHORT_PREDICATE,
  R21_DATA_DESIGN_SOURCE_FAMILY,
  R21_DATA_DESIGN_SYMBOLS,
  R21_DATA_DESIGN_START_ISO,
  R21_DATA_DESIGN_END_ISO,
  classifyR21MetricRow,
  evaluateR21DataDesignGates,
  isR21CadenceEligible,
  isR21DataDesignOnlyGovernance,
} from "@/lib/research/m3-r21-positioning-crowding-data-design-protocol";

type JsonRecord = Record<string, unknown>;

const DESIGN_PATH = path.join(process.cwd(), R21_DATA_DESIGN_JSON_PATH);
const MARKDOWN_PATH = path.join(process.cwd(), R21_DATA_DESIGN_MARKDOWN_PATH);

function record(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected JSON object");
  }
  return value as JsonRecord;
}

function records(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) throw new Error("Expected JSON array");
  return value.map(record);
}

function loadDesign(): JsonRecord {
  return JSON.parse(readFileSync(DESIGN_PATH, "utf8")) as JsonRecord;
}

function acceptedText(sourcePath: string): string {
  return execFileSync("git", ["show", `${R21_DATA_DESIGN_ACCEPTED_SOURCE}:${sourcePath}`], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function acceptedObject(sourcePath: string): JsonRecord {
  return JSON.parse(acceptedText(sourcePath)) as JsonRecord;
}

function baselineGateInput() {
  return {
    acceptedSourceCommit: R21_DATA_DESIGN_ACCEPTED_SOURCE,
    sourceFamily: R21_DATA_DESIGN_SOURCE_FAMILY,
    officialFieldMappingProven: false,
    usdMDocumentationProven: false,
    contemporaneousAvailabilityProven: false,
    nativeCadenceMinutes: null,
    nativeCadenceProven: false,
    symbolUniverseComplete: true,
    observationContractComplete: true,
    duplicateContractComplete: true,
    coverageContractComplete: true,
    reproducibilityContractComplete: true,
    governance: R21_DATA_DESIGN_GOVERNANCE,
  } as const;
}

describe("Round-021 positioning crowding data-acquisition design", () => {
  it("binds this stage to the exact accepted research source", () => {
    const design = loadDesign();
    expect(design.phase).toBe(R21_DATA_DESIGN_PHASE);
    expect(design.acceptedResearchSource).toEqual({
      branch: R21_DATA_DESIGN_ACCEPTED_SOURCE_BRANCH,
      commit: R21_DATA_DESIGN_ACCEPTED_SOURCE,
      requiredBaseHead: R21_DATA_DESIGN_ACCEPTED_SOURCE,
    });
    expect(execFileSync("git", ["cat-file", "-t", R21_DATA_DESIGN_ACCEPTED_SOURCE], { encoding: "utf8" }).trim()).toBe("commit");
  });

  it("preserves the accepted R21 hypothesis without creating a new hypothesis", () => {
    const design = loadDesign();
    const accepted = acceptedObject(R21_ACCEPTED_HYPOTHESIS_PATH);
    const identity = record(design.hypothesisIdentity);
    const inventory = records(accepted.hypothesisInventory);
    const active = inventory.filter((item) => item.status === "ACTIVE");

    expect(inventory).toHaveLength(1);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      id: R21_DATA_DESIGN_HYPOTHESIS_ID,
      mechanismFamily: R21_DATA_DESIGN_MECHANISM_FAMILY,
      directionalThesis: "CONTRARIAN CROWD-UNWIND",
    });
    expect(identity).toMatchObject({
      acceptedArtifactCommit: R21_DATA_DESIGN_ACCEPTED_SOURCE,
      hypothesisId: R21_DATA_DESIGN_HYPOTHESIS_ID,
      mechanismFamily: R21_DATA_DESIGN_MECHANISM_FAMILY,
    });
  });

  it("freezes the exact three primitives and directional predicates", () => {
    const identity = record(loadDesign().hypothesisIdentity);
    expect(identity.primitiveInputs).toEqual([...R21_DATA_DESIGN_INPUTS]);
    expect(identity.predicates).toMatchObject({
      longCrowd: R21_DATA_DESIGN_LONG_PREDICATE,
      shortCrowd: R21_DATA_DESIGN_SHORT_PREDICATE,
      longCrowdAdvisoryDirection: "SHORT",
      shortCrowdAdvisoryDirection: "LONG",
      otherwise: "NO_SIGNAL",
    });
  });

  it("freezes the exact five-symbol boundary and authoritative time range", () => {
    const boundary = record(loadDesign().researchBoundary);
    expect(boundary.symbols).toEqual([...R21_DATA_DESIGN_SYMBOLS]);
    expect(boundary.symbols).toHaveLength(5);
    expect(boundary.start).toBe(R21_DATA_DESIGN_START_ISO);
    expect(boundary.end).toBe(R21_DATA_DESIGN_END_ISO);
    expect(boundary.timezoneArithmetic).toBe("UTC_EPOCH_MILLISECONDS_ONLY");
  });

  it("uses one source family and fails closed on unproven official mapping", () => {
    const design = loadDesign();
    const source = record(design.sourceContract);
    expect(source.sourceFamily).toBe(R21_DATA_DESIGN_SOURCE_FAMILY);
    expect(source.alternativeProvidersAllowed).toBe(false);
    expect(source.mappingMayNotBeInferredFromFieldName).toBe(true);
    expect(source.sourceFieldMappingStatus).toBe("UNPROVEN_FAIL_CLOSED");
    expect(source.officialMappingEvidence).toEqual([]);
    expect(source.networkAcquired).toBe(false);
    expect(source.marketDataPayloadDownloaded).toBe(false);
  });

  it("requires market-specific USD-M proof and rejects Coin-M substitution", () => {
    const usdM = record(loadDesign().usdMContract);
    expect(usdM.requiredMarket).toBe("USD-M / USDS-M Futures");
    expect(usdM.usdMDocumentationStatus).toBe("UNPROVEN_FAIL_CLOSED");
    expect(usdM.coinMDocumentationStatus).toBe("ANALOGOUS_REFERENCE_ONLY");
    expect(usdM.coinMDocsMaySubstitute).toBe(false);
    expect(usdM.proofMustBeMarketSpecific).toBe(true);
  });

  it("freezes PIT rules without treating current metadata as historical proof", () => {
    const pit = record(loadDesign().pointInTimeContract);
    expect(pit.sourceObservationTimeRule).toBe("sourceObservationTime <= decisionTime");
    expect(pit.publicationAvailableTimeRule).toBe("publicationAvailableTime <= decisionTime");
    expect(pit.contemporaneousPublicAvailabilityStatus).toBe("UNPROVEN_FAIL_CLOSED");
    expect(pit.currentDownloadTimeProvesHistoricalAvailability).toBe(false);
    expect(pit.currentLastModifiedProvesHistoricalAvailability).toBe(false);
    expect(pit.currentObjectExistenceProvesHistoricalAvailability).toBe(false);
    expect(pit.missingObservationResult).toBe("NO_OBSERVATION");
    expect(pit.forbiddenMethods).toEqual(expect.arrayContaining([
      "FORWARD_FILL",
      "BACKFILL",
      "INTERPOLATION",
      "NEAREST_TIMESTAMP",
      "CROSS_FILE_JOIN",
      "CARRY_FORWARD",
    ]));
  });

  it("keeps daily/monthly archive release semantics separate from PIT availability", () => {
    const release = record(loadDesign().archiveReleaseSemantics);
    expect(release.dailyArchiveRelease).toBe("NEXT_DAY");
    expect(release.monthlyArchiveRelease).toBe("FIRST_MONDAY_OF_MONTH");
    expect(release.archiveReleaseIsNotMetricAvailability).toBe(true);
    expect(release.archiveReleaseDoesNotProveContemporaneousPIT).toBe(true);
  });

  it("does not freeze cadence or horizon without authoritative cadence evidence", () => {
    const cadence = record(loadDesign().cadenceAndHorizonContract);
    expect(cadence.nativeCadenceEvidenceStatus).toBe("UNPROVEN_FAIL_CLOSED");
    expect(cadence.nativeCadenceMinutes).toBeNull();
    expect(cadence.decisionCadence).toBeNull();
    expect(cadence.primaryHoldingHorizon).toBeNull();
    expect(cadence.conditionalFreezeIfAuthoritativelyProven).toEqual({
      decisionCadence: "1h",
      primaryHoldingHorizon: "4h",
    });
    expect(cadence.horizonSweep).toBe(false);
    expect(isR21CadenceEligible(60, true)).toBe(true);
    expect(isR21CadenceEligible(60, false)).toBe(false);
    expect(isR21CadenceEligible(61, true)).toBe(false);
  });

  it("freezes metadata-only object matrix fields and forbids payload reads", () => {
    const matrix = record(loadDesign().futureObjectMatrixContract);
    expect(matrix.payloadReadAllowedNow).toBe(false);
    expect(matrix.bodyGetAllowedNow).toBe(false);
    expect(matrix.rangeGetAllowedNow).toBe(false);
    expect(matrix.allowedMetadataMethods).toEqual(["OFFICIAL_LISTING_METADATA", "HEAD"]);
    expect(matrix.fields).toEqual([
      "symbol",
      "utcDate",
      "expectedObjectKey",
      "objectExists",
      "checksumObjectExists",
      "contentLength",
      "etag",
      "lastModified",
    ]);
  });

  it("freezes checksum identity and revision handling", () => {
    const identity = record(loadDesign().acquisitionIdentityContract);
    const revision = record(loadDesign().revisionPolicy);
    expect(identity.objectAndChecksumEqualityRequired).toBe(true);
    expect(identity.manifestSha256Required).toBe(true);
    expect(revision.checksumChangeStatus).toBe("ARCHIVE_REVISION_DETECTED");
    expect(revision.silentOverwriteAllowed).toBe(false);
    expect(revision.preserveOldAndNewIdentity).toBe(true);
    expect(revision.revisionHandling).toBe("FAIL_CLOSED_UNTIL_EXPLICIT_AUDIT");
  });

  it("classifies exact, conflicting, missing, and invalid rows deterministically", () => {
    const row = {
      timestamp: 1_700_000_000_000,
      topTraderAccountLongShortRatio: 1.2,
      topTraderPositionLongShortRatio: 1.5,
      globalAccountLongShortRatio: 1.1,
    } as const;
    expect(classifyR21MetricRow([], row)).toBe("PRESENT_UNIQUE");
    expect(classifyR21MetricRow([row], row)).toBe("EXACT_DUPLICATE");
    expect(classifyR21MetricRow([row], { ...row, topTraderPositionLongShortRatio: 1.6 })).toBe("CONFLICTING_DUPLICATE");
    expect(classifyR21MetricRow([row], null)).toBe("MISSING");
    expect(classifyR21MetricRow([row], { ...row, globalAccountLongShortRatio: 0 })).toBe("INVALID_ROW");
  });

  it("freezes the coverage thresholds and known continuity risk as non-authoritative", () => {
    const coverage = record(loadDesign().coverageContract);
    const risk = record(loadDesign().knownContinuityRisk);
    expect(coverage.overallValidDecisionCoveragePerSymbolMinimum).toBe(0.98);
    expect(coverage.calendarMonthValidDecisionCoveragePerSymbolMinimum).toBe(0.9);
    expect(coverage.maximumContiguousMissingWindowHours).toBe(24);
    expect(coverage.conflictingDuplicateCountMustEqual).toBe(0);
    expect(coverage.anySymbolFailureFailsEntireRound).toBe(true);
    expect(risk.id).toBe("BINANCE_USDM_METRICS_ARCHIVE_KNOWN_CONTINUITY_RISK");
    expect(risk.sourceClassification).toBe("NON_AUTHORITATIVE_ISSUE_REPORT");
    expect(risk.doesNotAuthorizePayloadRead).toBe(true);
  });

  it("evaluates A01-A09 fail-closed before any acquisition", () => {
    const evaluation = evaluateR21DataDesignGates(baselineGateInput());
    expect(evaluation.gateResults.map((gate) => gate.id)).toEqual([...R21_DATA_DESIGN_GATE_IDS]);
    expect(evaluation.gateResults.find((gate) => gate.id === "A03_OFFICIAL_FIELD_MAPPING")?.status).toBe("FAIL");
    expect(evaluation.gateResults.find((gate) => gate.id === "A04_CONTEMPORANEOUS_PIT_AVAILABILITY")?.status).toBe("FAIL");
    expect(evaluation.gateResults.find((gate) => gate.id === "A05_NATIVE_CADENCE_AND_HORIZON")?.status).toBe("FAIL");
    expect(evaluation.finalDecision).toBe("ROUND-021 DATA ACQUISITION DESIGN INELIGIBLE");
    expect(evaluation.nextStage).toBe("STOP");
    expect(evaluation.performanceAuthorized).toBe(false);
    expect(evaluation.selectionAuthorized).toBe(false);
  });

  it("shows that a fully proven future contract is deterministic without running it", () => {
    const evaluation = evaluateR21DataDesignGates({
      ...baselineGateInput(),
      officialFieldMappingProven: true,
      usdMDocumentationProven: true,
      contemporaneousAvailabilityProven: true,
      nativeCadenceMinutes: 60,
      nativeCadenceProven: true,
    });
    expect(evaluation.gateResults.every((gate) => gate.status === "PASS")).toBe(true);
    expect(evaluation.finalDecision).toBe("ROUND-021 DATA ACQUISITION DESIGN ACCEPTED");
    expect(evaluation.nextStage).toBe("DATA_ACQUISITION_PREFLIGHT");
  });

  it("keeps the future preflight checks explicit and does not create an acquisition runner", () => {
    const plan = record(loadDesign().futurePreflightPlan);
    expect(plan.checks).toEqual([
      "P01_OFFICIAL_OBJECT_MATRIX",
      "P02_CHECKSUM_IDENTITY",
      "P03_USDM_FIELD_MAPPING",
      "P04_PIT_PUBLICATION_AVAILABILITY",
      "P05_NATIVE_CADENCE",
      "P06_ROW_SHAPE_AND_DUPLICATES",
      "P07_COVERAGE_AND_CONTINUITY",
      "P08_MANIFEST_REPRODUCIBILITY",
    ]);
    expect(plan.noAcquisitionInThisStage).toBe(true);
    expect(plan.noPayloadReadInThisStage).toBe(true);
    for (const forbidden of [
      "scripts/m3-r21-positioning-crowding-acquire.ts",
      "scripts/m3-r21-positioning-crowding-preflight.ts",
      "scripts/m3-r21-positioning-crowding-performance.ts",
    ]) {
      expect(existsSync(path.join(process.cwd(), forbidden)), forbidden).toBe(false);
    }
  });

  it("records the fail-closed final decision and all design governance flags", () => {
    const design = loadDesign();
    const decision = record(design.decision);
    const governance = record(design.governance);
    const gates = records(design.designGates);

    expect(gates.map((gate) => gate.status)).toEqual([
      "PASS",
      "PASS",
      "FAIL",
      "FAIL",
      "FAIL",
      "PASS",
      "PASS",
      "PASS",
      "PASS",
    ]);
    expect(decision.finalDecision).toBe("ROUND-021 DATA ACQUISITION DESIGN INELIGIBLE");
    expect(decision.nextStage).toBe("STOP");
    expect(decision.dataAcquisitionAuthorized).toBe(false);
    expect(decision.performanceAuthorized).toBe(false);
    expect(decision.selectionAuthorized).toBe(false);
    expect(governance).toEqual(R21_DATA_DESIGN_GOVERNANCE);
    expect(isR21DataDesignOnlyGovernance(R21_DATA_DESIGN_GOVERNANCE)).toBe(true);
  });

  it("does not expose economic result fields or create performance/selection outputs", () => {
    const design = loadDesign();
    const serialized = JSON.stringify(design);
    const forbiddenResultFields = [
      '"netR"',
      '"profitFactor"',
      '"maxDrawdown"',
      '"pnl"',
      '"forwardReturnValue"',
      '"winLoss"',
    ];
    for (const field of forbiddenResultFields) expect(serialized).not.toContain(field);
    expect(record(design.evidenceOutputs)).toMatchObject({
      dataAcquisition: "NOT_CREATED",
      preflight: "NOT_CREATED",
      performance: "NOT_CREATED",
      selection: "NOT_CREATED",
      performanceLedger: "ABSENT",
      selectionLedger: "ABSENT",
    });
    expect(record(design.governance)).toMatchObject({
      economicValuesRead: false,
      forwardReturnsRead: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
    });
  });

  it("keeps the protocol metadata-only and free of network or execution runners", () => {
    const protocol = readFileSync(
      path.join(process.cwd(), "src/lib/research/m3-r21-positioning-crowding-data-design-protocol.ts"),
      "utf8",
    );
    expect(protocol).not.toMatch(/fetch\s*\(/);
    expect(protocol).not.toMatch(/WebSocket|axios|child_process|execFile/);
    expect(protocol).not.toMatch(/run.*(?:performance|preflight|acquisition|selection)/i);
  });

  it("keeps the required artifacts and documentation stage visible", () => {
    expect(existsSync(DESIGN_PATH)).toBe(true);
    expect(existsSync(MARKDOWN_PATH)).toBe(true);
    const markdown = readFileSync(MARKDOWN_PATH, "utf8");
    expect(markdown).toContain("DATA_ACQUISITION_DESIGN_ONLY");
    expect(markdown).toContain("BINANCE_VISION_USDM_METRICS_ARCHIVE");
    expect(markdown).toContain("ROUND-021 DATA ACQUISITION DESIGN INELIGIBLE");
    expect(markdown).toContain("UNPROVEN_FAIL_CLOSED");
  });

  it("does not change Production or the research milestone boundaries", () => {
    const governance = record(loadDesign().governance);
    expect(governance.productionUnchanged).toBe(true);
    expect(governance.baseline002Status).toBe("NOT_FROZEN");
    expect(governance.m3JStatus).toBe("BLOCKED");
    expect(governance.m4Status).toBe("NOT_STARTED");
    expect(governance.automaticTrading).toBe(false);
  });
});
