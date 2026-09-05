import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  R21_DIRECTIONS,
  R21_EXCLUDED_PRIOR_INFORMATION_FAMILIES,
  R21_LONG_CROWD_PREDICATE,
  R21_PRIMARY_HOLDING_HORIZON,
  R21_PUBLICATION_PROVENANCE_STATUS,
  R21_SIGNAL_INPUTS,
  R21_SHORT_CROWD_PREDICATE,
  R21_SOURCE_FAMILY,
  R21_SOURCE_FIELD_MAPPING_STATUS,
  R21_SYMBOLS,
  ROUND_021_ACCEPTED_SOURCE,
  ROUND_021_ACCEPTED_SOURCE_BRANCH,
  ROUND_021_DESIGN_JSON_PATH,
  ROUND_021_DESIGN_MARKDOWN_PATH,
  ROUND_021_DIRECTIONAL_THESIS,
  ROUND_021_HYPOTHESIS_ID,
  ROUND_021_MECHANISM_FAMILY,
  ROUND_021_PHASE,
  ROUND_021_RESEARCH_END_ISO,
  ROUND_021_RESEARCH_ROUND_ID,
  ROUND_021_RESEARCH_START_ISO,
  R21_DECISION_CADENCE,
  R21_DESIGN_GATE_IDS,
  R21_DESIGN_GOVERNANCE,
  classifyR21PositionCrowding,
  evaluateR21DesignGates,
  isR21DesignOnlyGovernance,
} from "@/lib/research/m3-r21-positioning-crowding-design-protocol";

// JSON fixture assertions intentionally keep nested fixture fields open-ended.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonRecord = Record<string, any>;

const DESIGN_PATH = path.join(process.cwd(), ROUND_021_DESIGN_JSON_PATH);
const MARKDOWN_PATH = path.join(process.cwd(), ROUND_021_DESIGN_MARKDOWN_PATH);

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
  return execFileSync("git", ["show", `${ROUND_021_ACCEPTED_SOURCE}:${sourcePath}`], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

function acceptedObject(sourcePath: string): JsonRecord {
  return JSON.parse(acceptedText(sourcePath)) as JsonRecord;
}

describe("Round-021 positioning crowding design-only protocol", () => {
  it("binds the design to the exact accepted research-chain source", () => {
    const design = loadDesign();
    expect(design.researchRoundId).toBe(ROUND_021_RESEARCH_ROUND_ID);
    expect(design.phase).toBe(ROUND_021_PHASE);
    expect(record(design.acceptedResearchSource)).toEqual({
      branch: ROUND_021_ACCEPTED_SOURCE_BRANCH,
      commit: ROUND_021_ACCEPTED_SOURCE,
      requiredBaseHead: ROUND_021_ACCEPTED_SOURCE,
    });
    expect(execFileSync("git", ["cat-file", "-t", ROUND_021_ACCEPTED_SOURCE], { encoding: "utf8" }).trim()).toBe("commit");
  });

  it("proves Round-020 closure exists in the accepted source and is not reopened", () => {
    const design = loadDesign();
    const closure = record(design.acceptedRound020Closure);
    const accepted = acceptedObject("docs/research/round-020-liquidation-data-preflight.json");

    expect(accepted.acceptedDesignMerge).toBe("bff63214c9a31c516816d8756e560475a86e1746");
    expect(accepted.preflightParentCommit).toBe("bff63214c9a31c516816d8756e560475a86e1746");
    expect(accepted.preflightExecutionCommit).toBe("a0fca0f86a53fbe989eed653aa31bdb25356134d");
    expect(accepted.branch).toBe("research/round-020-liquidation-data-preflight");
    expect(() =>
      execFileSync(
        "git",
        ["merge-base", "--is-ancestor", "0ebf4f04286a458ae434bc9aff837a5fd10a2f9e", ROUND_021_ACCEPTED_SOURCE],
        { cwd: process.cwd() },
      ),
    ).not.toThrow();

    expect(closure).toMatchObject({
      sourceCommit: ROUND_021_ACCEPTED_SOURCE,
      sourcePath: "docs/research/round-020-liquidation-data-preflight.json",
      finalDecision: "ROUND-020 DATA ACQUISITION INELIGIBLE",
      recommendedRepresentation: null,
      liquidationPayloadRead: false,
      closureStatus: "ACCEPTED_NEGATIVE_EVIDENCE_NO_REOPEN",
    });
    expect(accepted.finalDecision).toBe("ROUND-020 DATA ACQUISITION INELIGIBLE");
    expect(accepted.recommendedRepresentation).toBeNull();
    expect(accepted.governance.performanceExecutionCount).toBe(0);
  });

  it("freezes exactly one active hypothesis and one mechanism family", () => {
    const design = loadDesign();
    const inventory = records(design.hypothesisInventory);
    const active = inventory.filter((item) => item.status === "ACTIVE");

    expect(inventory).toHaveLength(1);
    expect(active).toHaveLength(1);
    expect(active[0]).toMatchObject({
      id: ROUND_021_HYPOTHESIS_ID,
      mechanismFamily: ROUND_021_MECHANISM_FAMILY,
      directionalThesis: ROUND_021_DIRECTIONAL_THESIS,
      falsifiable: true,
    });
    expect(design.decision).toMatchObject({
      finalDecision: "ROUND-021 POSITIONING CROWDING HYPOTHESIS DESIGN ACCEPTED",
      activeHypothesis: ROUND_021_HYPOTHESIS_ID,
      nextStage: "DATA_ACQUISITION_DESIGN",
      performanceAuthorized: false,
      selectionAuthorized: false,
    });
  });

  it("freezes the contrarian long-crowd and short-crowd directions", () => {
    expect(classifyR21PositionCrowding({
      topTraderAccountLongShortRatio: 2,
      topTraderPositionLongShortRatio: 3,
      globalAccountLongShortRatio: 1.1,
    })).toBe("SHORT");
    expect(classifyR21PositionCrowding({
      topTraderAccountLongShortRatio: 0.7,
      topTraderPositionLongShortRatio: 0.4,
      globalAccountLongShortRatio: 0.9,
    })).toBe("LONG");
    expect(classifyR21PositionCrowding({
      topTraderAccountLongShortRatio: 1,
      topTraderPositionLongShortRatio: 1,
      globalAccountLongShortRatio: 1,
    })).toBe("NO_SIGNAL");
  });

  it("rejects non-positive positioning ratios fail-closed", () => {
    expect(classifyR21PositionCrowding({
      topTraderAccountLongShortRatio: 0,
      topTraderPositionLongShortRatio: 2,
      globalAccountLongShortRatio: 1,
    })).toBe("NO_SIGNAL");
    expect(classifyR21PositionCrowding({
      topTraderAccountLongShortRatio: Number.NaN,
      topTraderPositionLongShortRatio: 2,
      globalAccountLongShortRatio: 1,
    })).toBe("NO_SIGNAL");
  });

  it("freezes the exact P/A/G equations and no tunable threshold", () => {
    const signal = record(loadDesign().signalDefinition);
    const transforms = record(signal.transforms);
    const predicates = record(signal.predicates);

    expect(signal.primitiveInputs).toEqual([...R21_SIGNAL_INPUTS]);
    expect(transforms).toEqual({
      A: "ln(topTraderAccountLongShortRatio)",
      P: "ln(topTraderPositionLongShortRatio)",
      G: "ln(globalAccountLongShortRatio)",
    });
    expect(record(predicates.LONG_CROWD)).toMatchObject({
      condition: R21_LONG_CROWD_PREDICATE,
      crowdedSide: "LONG",
      advisoryDirection: "SHORT",
    });
    expect(record(predicates.SHORT_CROWD)).toMatchObject({
      condition: R21_SHORT_CROWD_PREDICATE,
      crowdedSide: "SHORT",
      advisoryDirection: "LONG",
    });
    expect(signal.zeroTunedOrdinalStructure).toBe(true);
    expect(signal.tunableMagnitudeThreshold).toBeNull();
    expect(signal.scoreWeighting).toBeNull();
    expect(signal.percentile).toBeNull();
    expect(signal.topN).toBeNull();
    expect(signal.symbolSpecificThreshold).toBeNull();
    expect(signal.horizonRescue).toBeNull();
  });

  it("keeps the signal input contract to exactly three positioning primitives", () => {
    const inputs = record(loadDesign().signalDefinition).primitiveInputs as string[];
    expect(inputs).toHaveLength(3);
    expect(new Set(inputs).size).toBe(3);
    expect(inputs).toEqual([...R21_SIGNAL_INPUTS]);
    expect(R21_DIRECTIONS).toEqual(["LONG", "SHORT"]);
    expect(inputs).not.toContain("openInterest");
    expect(inputs).not.toContain("funding");
    expect(inputs).not.toContain("takerBuyVolume");
    expect(inputs).not.toContain("priceReturn");
    expect(inputs).not.toContain("liquidations");
  });

  it("documents mechanism-family independence from all prior excluded families", () => {
    const design = loadDesign();
    const exclusion = records(design.priorInformationFamilyExclusion);
    const excluded = new Set(exclusion.map((item) => item.family));

    for (const family of R21_EXCLUDED_PRIOR_INFORMATION_FAMILIES) {
      expect(excluded.has(family), family).toBe(true);
    }
    expect(record(design.mechanismFamilyReview)).toMatchObject({
      id: ROUND_021_MECHANISM_FAMILY,
      status: "NOVEL_AT_MECHANISM_FAMILY_LEVEL",
      activeHypothesisCount: 1,
      notAContinuationHypothesis: true,
    });
    expect(JSON.stringify(design.mechanismFamilyReview)).toMatch(/participant position-size distribution/i);
  });

  it("freezes the five-symbol target and authoritative boundary", () => {
    const boundary = record(loadDesign().researchBoundary);
    expect(boundary.venue).toBe("BINANCE_USDM");
    expect(boundary.market).toBe("USD_M_PERPETUALS");
    expect(boundary.symbols).toEqual([...R21_SYMBOLS]);
    expect(boundary.symbols).toHaveLength(5);
    expect(boundary.start).toBe(ROUND_021_RESEARCH_START_ISO);
    expect(boundary.end).toBe(ROUND_021_RESEARCH_END_ISO);
  });

  it("keeps archive mapping as an explicit future proof obligation", () => {
    const source = record(loadDesign().sourceContract);
    expect(source.preferredSourceFamily).toBe(R21_SOURCE_FAMILY);
    expect(source.candidateMetricNames).toEqual([
      "count_toptrader_long_short_ratio",
      "sum_toptrader_long_short_ratio",
      "count_long_short_ratio",
    ]);
    expect(source.sourceFieldMappingStatus).toBe(R21_SOURCE_FIELD_MAPPING_STATUS);
    expect(source.mappingMayNotBeInferredFromFieldName).toBe(true);
    expect(source.networkAcquired).toBe(false);
    expect(source.marketDataPayloadDownloaded).toBe(false);
  });

  it("freezes point-in-time rules and fails closed before provenance proof", () => {
    const pit = record(loadDesign().pointInTimeContract);
    expect(pit.sourceSnapshotTimeRule).toBe("sourceSnapshotTime <= decisionTime");
    expect(pit.publicationAvailableTimeRule).toBe("publicationAvailableTime <= decisionTime");
    expect(pit.publicationProvenanceStatus).toBe(R21_PUBLICATION_PROVENANCE_STATUS);
    expect(pit.currentDownloadTimeMayProveHistoricalAvailability).toBe(false);
    expect(pit.currentLastModifiedMayProveHistoricalAvailability).toBe(false);
    expect(pit.currentFileExistenceMayProveHistoricalAvailability).toBe(false);
    expect(pit.unprovenPublicationProvenance).toBe("FAIL_CLOSED_NO_PERFORMANCE");
  });

  it("does not preselect cadence or holding horizon", () => {
    const cadence = record(loadDesign().cadenceAndHorizon);
    expect(cadence.decisionCadence).toBe(R21_DECISION_CADENCE);
    expect(cadence.primaryHoldingHorizon).toBe(R21_PRIMARY_HOLDING_HORIZON);
    expect(cadence.freezeStage).toBe("BEFORE_FORWARD_OR_ECONOMIC_VALUE_READ");
    expect(cadence.primaryHorizonCount).toBeNull();
    expect(cadence.horizonSweep).toBe(false);
  });

  it("keeps D01-D07 exact and all design gates passing", () => {
    const design = loadDesign();
    const gates = records(design.designGates);
    expect(gates.map((gate) => gate.id)).toEqual([...R21_DESIGN_GATE_IDS]);
    expect(gates.every((gate) => gate.status === "PASS")).toBe(true);

    const evaluation = evaluateR21DesignGates({
      acceptedSourceCommit: ROUND_021_ACCEPTED_SOURCE,
      mechanismFamily: ROUND_021_MECHANISM_FAMILY,
      mechanismFamilyIndependent: true,
      activeHypothesisCount: 1,
      hypothesisId: ROUND_021_HYPOTHESIS_ID,
      directionalThesis: ROUND_021_DIRECTIONAL_THESIS,
      longPredicate: R21_LONG_CROWD_PREDICATE,
      shortPredicate: R21_SHORT_CROWD_PREDICATE,
      zeroTunedStructure: true,
      signalInputs: R21_SIGNAL_INPUTS,
      sourceFieldMappingStatus: R21_SOURCE_FIELD_MAPPING_STATUS,
      publicationProvenanceStatus: R21_PUBLICATION_PROVENANCE_STATUS,
      performanceAuthorized: false,
      governance: R21_DESIGN_GOVERNANCE,
    });
    expect(evaluation.gateResults.map((gate) => gate.status)).toEqual(new Array(7).fill("PASS"));
    expect(evaluation.finalDecision).toBe("ROUND-021 POSITIONING CROWDING HYPOTHESIS DESIGN ACCEPTED");
    expect(evaluation.nextStage).toBe("DATA_ACQUISITION_DESIGN");
  });

  it("keeps every design-only governance flag fail-closed", () => {
    const governance = loadDesign().governance;
    expect(governance).toEqual(R21_DESIGN_GOVERNANCE);
    expect(isR21DesignOnlyGovernance(governance)).toBe(true);
    expect(governance.performanceExecutionCount).toBe(0);
    expect(governance.performanceLedgerPresent).toBe(false);
    expect(governance.performanceAuthorized).toBe(false);
    expect(governance.preflightExecuted).toBe(false);
    expect(governance.selectionExecuted).toBe(false);
    expect(governance.economicValuesRead).toBe(false);
    expect(governance.economicValuesCalculated).toBe(false);
    expect(governance.economicValuesInspected).toBe(false);
    expect(governance.newMarketDataFetched).toBe(false);
    expect(governance.marketDataPayloadDownloaded).toBe(false);
    expect(governance.productionUnchanged).toBe(true);
    expect(governance.baseline002Status).toBe("NOT_FROZEN");
    expect(governance.m3JStatus).toBe("BLOCKED");
    expect(governance.m4Status).toBe("NOT_STARTED");
    expect(governance.automaticTrading).toBe(false);
  });

  it("keeps economics, forward values, performance, and selection out of the design", () => {
    const design = loadDesign();
    const serialized = JSON.stringify(design);
    const governance = record(design.governance);
    const operations = design.forbiddenOperations as string[];

    expect(serialized).not.toMatch(/netR|profitFactor|drawdown|forwardReturn|winLoss|pnl/i);
    expect(governance.economicValuesRead).toBe(false);
    expect(governance.economicValuesCalculated).toBe(false);
    expect(governance.economicValuesInspected).toBe(false);
    expect(operations).toEqual(expect.arrayContaining([
      "DATA_ACQUISITION",
      "DATA_ACQUISITION_PREFLIGHT",
      "BACKTEST",
      "PERFORMANCE",
      "SELECTION",
      "FORWARD_RETURN_JOIN",
    ]));
    expect(record(design.evidenceOutputs)).toMatchObject({
      preflightOutputs: "NOT_CREATED",
      performanceOutputs: "NOT_CREATED",
      selectionOutputs: "NOT_CREATED",
      ledgerClaim: "FORBIDDEN",
      performanceLedgerPresent: false,
    });
  });

  it("does not create acquisition, preflight, performance, or ledger artifacts", () => {
    const design = loadDesign();
    const forbidden = design.forbiddenArtifactsAtDesignStage as string[];
    for (const relativePath of forbidden) {
      expect(existsSync(path.join(process.cwd(), relativePath)), relativePath).toBe(false);
    }
    expect(existsSync(path.join(process.cwd(), "scripts/m3-r21-positioning-crowding-acquire.ts"))).toBe(false);
    expect(existsSync(path.join(process.cwd(), "scripts/m3-r21-positioning-crowding-performance.ts"))).toBe(false);
  });

  it("keeps the protocol pure and without network or execution runners", () => {
    const protocol = readFileSync(path.join(process.cwd(), "src/lib/research/m3-r21-positioning-crowding-design-protocol.ts"), "utf8");
    expect(protocol).not.toMatch(/fetch\s*\(/);
    expect(protocol).not.toMatch(/WebSocket/);
    expect(protocol).not.toMatch(/child_process|execFile|axios/);
    expect(protocol).not.toMatch(/run.*(?:performance|preflight|acquisition|selection)/i);
  });

  it("keeps the required design artifacts and documentation link", () => {
    expect(existsSync(DESIGN_PATH)).toBe(true);
    expect(existsSync(MARKDOWN_PATH)).toBe(true);
    const markdown = readFileSync(MARKDOWN_PATH, "utf8");
    expect(markdown).toContain("HYPOTHESIS_DESIGN_ONLY");
    expect(markdown).toContain("POSITIONING_CROWDING_STATE");
    expect(markdown).toContain("CONTRARIAN CROWD-UNWIND");
    expect(markdown).toContain("DATA_ACQUISITION_DESIGN");
  });

  it("keeps Production and milestone boundaries unchanged", () => {
    const governance = record(loadDesign().governance);
    expect(governance.productionUnchanged).toBe(true);
    expect(governance.baseline001Unchanged).toBe(true);
    expect(governance.baseline002Status).toBe("NOT_FROZEN");
    expect(governance.m3JStatus).toBe("BLOCKED");
    expect(governance.m4Status).toBe("NOT_STARTED");
    expect(governance.automaticTrading).toBe(false);
  });
});
