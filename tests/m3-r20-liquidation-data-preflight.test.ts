import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_DESIGN_MERGE,
  ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_RESEARCH_SOURCE,
  ROUND_020_LIQUIDATION_PREFLIGHT_BASE_BRANCH,
  ROUND_020_LIQUIDATION_PREFLIGHT_BRANCH,
  ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_JSON_PATH,
  ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_MARKDOWN_PATH,
  R20_LIQUIDATION_PREFLIGHT_GATE_IDS,
  R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS,
  R20_LIQUIDATION_PREFLIGHT_SYMBOLS,
  R20_LIQUIDATION_PREFLIGHT_EXCHANGE_ID,
  R20_LIQUIDATION_PREFLIGHT_SOURCE_ID,
  R20_LIQUIDATION_PREFLIGHT_END_ISO,
  R20_LIQUIDATION_PREFLIGHT_START_ISO,
  R20_LIQUIDATION_PREFLIGHT_VENUE,
  evaluateR20LiquidationPreflight,
  isR20LiquidationExactIdentityContractSatisfied,
  isR20LiquidationGapContractSatisfied,
  isR20LiquidationPointInTimeContractSatisfied,
  isR20LiquidationPreflightGovernanceSafe,
  isR20LiquidationPreflightMetadataOnly,
  isR20LiquidationSideSchemaContractSatisfied,
  isR20LiquidationTargetCoverageSatisfied,
  isR20LiquidationRevisionEntitlementContractSatisfied,
  type R20LiquidationMetadataCoverage,
  type R20LiquidationPreflightInput,
  type R20LiquidationRepresentationEvidence,
} from "@/lib/research/m3-r20-liquidation-data-preflight-protocol";

type R20PreflightReport = {
  acceptedResearchSource: { commit: string };
  acceptedDesignMerge: string;
  sourceId: string;
  representationEvaluated: string[];
  target: { venue: string; exchangeId: string; symbols: string[]; start: string; end: string };
  marketEventBodyRequests: number;
  marketEventBytesDownloaded: number;
  rawMarketEventsRead: boolean;
  identityContractSatisfied: boolean;
  pitContractSatisfied: boolean;
  coverageContractSatisfied: boolean;
  representationEvidence: R20LiquidationRepresentationEvidence[];
  gateResults: Array<{ id: string; status: string }>;
  finalDecision: string;
  recommendedRepresentation: string | null;
  governance: Record<string, unknown>;
};

const root = process.cwd();
const designPath = path.join(root, ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_JSON_PATH);
const markdownPath = path.join(root, ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_MARKDOWN_PATH);
const reportPath = path.join(root, "docs/research/round-020-liquidation-data-preflight.json");
const scriptPath = path.join(root, "scripts/m3-r20-liquidation-data-preflight.ts");
const protocolPath = path.join(root, "src/lib/research/m3-r20-liquidation-data-preflight-protocol.ts");

function loadReport(): R20PreflightReport {
  return JSON.parse(readFileSync(reportPath, "utf8")) as R20PreflightReport;
}

function acceptedPathUnchanged(relativePath: string): boolean {
  try {
    execFileSync("git", ["diff", "--quiet", ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_RESEARCH_SOURCE, "--", relativePath], {
      cwd: root,
      stdio: "ignore",
    });
    return true;
  } catch {
    return false;
  }
}

function validCoverage(overrides: Partial<R20LiquidationMetadataCoverage> = {}): R20LiquidationMetadataCoverage {
  return {
    exchangeId: R20_LIQUIDATION_PREFLIGHT_EXCHANGE_ID,
    datasetType: "liquidations",
    formats: ["csv"],
    exportedFrom: "2019-11-17T00:00:00.000Z",
    exportedUntil: "2026-09-05T00:00:00.000Z",
    targetSymbolAvailability: Object.fromEntries(R20_LIQUIDATION_PREFLIGHT_SYMBOLS.map((symbol) => [symbol, {
      availableSince: "2019-11-17T00:00:00.000Z",
      availableTo: null,
      liquidationDatasetAdvertised: true,
    }])),
    exactDailyFileMatrixProbed: false,
    ...overrides,
  };
}

function representation(
  name: R20LiquidationRepresentationEvidence["representation"],
  overrides: Partial<R20LiquidationRepresentationEvidence> = {},
): R20LiquidationRepresentationEvidence {
  return {
    representation: name,
    immutableEventIdentityProven: false,
    sourceSequenceProven: false,
    eventTimestampProven: false,
    publicationTimestampProven: false,
    fallbackTimestampRuleProven: false,
    dailySegmentationRuleProven: false,
    replayLeakageExcluded: false,
    gapEvidenceProven: false,
    sideMappingProven: false,
    quantityMappingProven: false,
    revisionPolicyProven: false,
    entitlementVerified: false,
    completenessStatus: "SAMPLED_EVENT_STREAM",
    normalizedIdMayBeEmpty: name === "TARDIS_NORMALIZED_LIQUIDATIONS_CSV",
    rawPayloadIdentityMayBeMissing: name === "TARDIS_RAW_BINANCE_FORCE_ORDER_REPLAY",
    ...overrides,
  };
}

function baseInput(overrides: Partial<R20LiquidationPreflightInput> = {}): R20LiquidationPreflightInput {
  return {
    acceptedSourceIntegrity: true,
    recommendedSourceUnchanged: true,
    candidateCreated: false,
    performanceExecutionCount: 0,
    coverage: validCoverage(),
    representations: R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS.map((name) => representation(name)),
    marketEventBodyRequests: 0,
    marketEventBytesDownloaded: 0,
    rawMarketEventsRead: false,
    performanceLedgerPresent: false,
    economicValuesRead: false,
    economicValuesCalculated: false,
    economicValuesInspected: false,
    newMarketDataFetched: false,
    productionUnchanged: true,
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
    automaticTrading: false,
    ...overrides,
  };
}

describe("Round-020 liquidation data acquisition preflight", () => {
  it("pins the exact accepted design source and parent merge", () => {
    const report = loadReport();
    expect(report.acceptedResearchSource.commit).toBe(ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_RESEARCH_SOURCE);
    expect(report.acceptedDesignMerge).toBe(ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_DESIGN_MERGE);
    expect(ROUND_020_LIQUIDATION_PREFLIGHT_BASE_BRANCH).toBe("research/round-015-beta-alpha-decomposition");
    expect(ROUND_020_LIQUIDATION_PREFLIGHT_BRANCH).toBe("research/round-020-liquidation-data-preflight");
  });

  it("keeps the design JSON and Markdown byte-identical to the accepted design source", () => {
    expect(acceptedPathUnchanged(ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_JSON_PATH)).toBe(true);
    expect(acceptedPathUnchanged(ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_MARKDOWN_PATH)).toBe(true);
    expect(existsSync(designPath)).toBe(true);
    expect(existsSync(markdownPath)).toBe(true);
    expect(createHash("sha256").update(readFileSync(designPath)).digest("hex")).toBe("ce4dfd1f49643b249fae0735f3693b3e208b9062f468b30fa63dee11aeaa6a21");
    expect(createHash("sha256").update(readFileSync(markdownPath)).digest("hex")).toBe("5973ebfe65e21c99497327fad66b447441ea2e394c2657b84f73b59917c3961a");
  });

  it("evaluates only the two frozen Tardis representations", () => {
    const report = loadReport();
    expect(report.sourceId).toBe(R20_LIQUIDATION_PREFLIGHT_SOURCE_ID);
    expect(report.representationEvaluated).toEqual([...R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS]);
    expect(report.representationEvaluated).toHaveLength(2);
    expect(new Set(report.representationEvaluated).size).toBe(2);
  });

  it("freezes the Binance USD-M target and date boundary", () => {
    const target = loadReport().target;
    expect(target.venue).toBe(R20_LIQUIDATION_PREFLIGHT_VENUE);
    expect(target.exchangeId).toBe(R20_LIQUIDATION_PREFLIGHT_EXCHANGE_ID);
    expect(target.symbols).toEqual([...R20_LIQUIDATION_PREFLIGHT_SYMBOLS]);
    expect(target.start).toBe(R20_LIQUIDATION_PREFLIGHT_START_ISO);
    expect(target.end).toBe(R20_LIQUIDATION_PREFLIGHT_END_ISO);
  });

  it("passes metadata target coverage when all five symbols and the full range are advertised", () => {
    expect(isR20LiquidationTargetCoverageSatisfied(validCoverage())).toBe(true);
  });

  it("fails target coverage when a required target day is unavailable", () => {
    expect(isR20LiquidationTargetCoverageSatisfied(validCoverage({
      exportedUntil: "2026-08-15T00:00:00.000Z",
    }))).toBe(false);
  });

  it("fails target coverage when a required symbol is absent", () => {
    const coverage = validCoverage();
    const symbols = { ...coverage.targetSymbolAvailability };
    delete symbols.BNBUSDT;
    expect(isR20LiquidationTargetCoverageSatisfied(validCoverage({ targetSymbolAvailability: symbols }))).toBe(false);
  });

  it("fails when publication-time provenance is missing", () => {
    expect(isR20LiquidationPointInTimeContractSatisfied([
      representation("TARDIS_NORMALIZED_LIQUIDATIONS_CSV", { eventTimestampProven: true }),
      representation("TARDIS_RAW_BINANCE_FORCE_ORDER_REPLAY", { eventTimestampProven: true }),
    ])).toBe(false);
  });

  it("fails when normalized id and raw source sequence are not proven", () => {
    expect(isR20LiquidationExactIdentityContractSatisfied([
      representation("TARDIS_NORMALIZED_LIQUIDATIONS_CSV"),
      representation("TARDIS_RAW_BINANCE_FORCE_ORDER_REPLAY"),
    ])).toBe(false);
    expect(loadReport().identityContractSatisfied).toBe(false);
  });

  it("does not weaken the frozen identity fallback", () => {
    const protocol = readFileSync(protocolPath, "utf8");
    expect(protocol).toContain("sourceSequenceProven");
    expect(protocol).not.toMatch(/rowNumber|fileOrder|nearest|fuzzy/i);
    expect(loadReport().representationEvidence.every((row: R20LiquidationRepresentationEvidence) => row.sourceSequenceProven === false)).toBe(true);
  });

  it("keeps sampled streams from being promoted to complete streams", () => {
    expect(isR20LiquidationGapContractSatisfied([
      representation("TARDIS_NORMALIZED_LIQUIDATIONS_CSV", { gapEvidenceProven: true }),
      representation("TARDIS_RAW_BINANCE_FORCE_ORDER_REPLAY", { gapEvidenceProven: true }),
    ])).toBe(true);
    expect(isR20LiquidationGapContractSatisfied([
      representation("TARDIS_NORMALIZED_LIQUIDATIONS_CSV", { gapEvidenceProven: true, completenessStatus: "COMPLETE_EVENT_STREAM" }),
      representation("TARDIS_RAW_BINANCE_FORCE_ORDER_REPLAY", { gapEvidenceProven: true, completenessStatus: "SAMPLED_EVENT_STREAM" }),
    ])).toBe(false);
  });

  it("fails the gap contract when disconnect evidence is absent", () => {
    expect(loadReport().gateResults.find((gate) => gate.id === "P05_COMPLETENESS_SNAPSHOT_GAP_SEMANTICS")?.status).toBe("FAIL");
    expect(loadReport().rawMarketEventsRead).toBe(false);
  });

  it("requires source-documented side and quantity mapping for both representations", () => {
    expect(isR20LiquidationSideSchemaContractSatisfied([
      representation("TARDIS_NORMALIZED_LIQUIDATIONS_CSV", { sideMappingProven: true, quantityMappingProven: true }),
      representation("TARDIS_RAW_BINANCE_FORCE_ORDER_REPLAY", { sideMappingProven: true, quantityMappingProven: true }),
    ])).toBe(true);
    expect(loadReport().gateResults.find((gate) => gate.id === "P06_SIDE_QUANTITY_SCHEMA_CONTRACT")?.status).toBe("FAIL");
  });

  it("requires revision policy and entitlement before acquisition", () => {
    expect(isR20LiquidationRevisionEntitlementContractSatisfied([
      representation("TARDIS_NORMALIZED_LIQUIDATIONS_CSV", { revisionPolicyProven: true, entitlementVerified: true }),
      representation("TARDIS_RAW_BINANCE_FORCE_ORDER_REPLAY", { revisionPolicyProven: true, entitlementVerified: true }),
    ])).toBe(true);
    expect(loadReport().gateResults.find((gate) => gate.id === "P07_REVISION_ARCHIVE_LICENSE_REPRODUCIBILITY_ENTITLEMENT")?.status).toBe("FAIL");
  });

  it("fails closed when a mandatory gate is unknown or false", () => {
    const result = evaluateR20LiquidationPreflight(baseInput({ representations: [] }));
    expect(result.finalDecision).toBe("ROUND-020 DATA ACQUISITION INELIGIBLE");
    expect(result.recommendedRepresentation).toBeNull();
    expect(result.gateResults.some((gate) => gate.status !== "PASS")).toBe(true);
  });

  it("keeps the final report ineligible and selects no representation", () => {
    const report = loadReport();
    expect(report.finalDecision).toBe("ROUND-020 DATA ACQUISITION INELIGIBLE");
    expect(report.recommendedRepresentation).toBeNull();
    expect(report.gateResults.map((gate) => gate.id)).toEqual([...R20_LIQUIDATION_PREFLIGHT_GATE_IDS]);
    expect(report.gateResults.find((gate) => gate.id === "P01_ACCEPTED_SOURCE_DESIGN_INTEGRITY")?.status).toBe("PASS");
    expect(report.gateResults.find((gate) => gate.id === "P02_TARGET_COVERAGE")?.status).toBe("PASS");
    expect(report.gateResults.slice(2).every((gate) => gate.status === "FAIL")).toBe(true);
  });

  it("records zero market-event body requests and zero bytes", () => {
    const report = loadReport();
    expect(report.marketEventBodyRequests).toBe(0);
    expect(report.marketEventBytesDownloaded).toBe(0);
    expect(report.rawMarketEventsRead).toBe(false);
  });

  it("keeps performance, ledger, candidate, and economics absent", () => {
    const report = loadReport();
    expect(report.governance.performanceExecutionCount).toBe(0);
    expect(report.governance.performanceLedgerPresent).toBe(false);
    expect(report.governance.candidateCreated).toBe(false);
    expect(report.governance.economicValuesRead).toBe(false);
    expect(report.governance.economicValuesCalculated).toBe(false);
    expect(report.governance.economicValuesInspected).toBe(false);
  });

  it("passes the metadata-only governance contract", () => {
    const report = loadReport();
    expect(isR20LiquidationPreflightMetadataOnly({
      marketEventBodyRequests: report.marketEventBodyRequests,
      marketEventBytesDownloaded: report.marketEventBytesDownloaded,
      rawMarketEventsRead: report.rawMarketEventsRead,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      candidateCreated: false,
      economicValuesRead: false,
      economicValuesCalculated: false,
      economicValuesInspected: false,
      newMarketDataFetched: false,
    })).toBe(true);
  });

  it("keeps production and research governance unchanged", () => {
    const report = loadReport();
    expect(isR20LiquidationPreflightGovernanceSafe({
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      candidateCreated: false,
      economicValuesRead: false,
      economicValuesCalculated: false,
      economicValuesInspected: false,
      newMarketDataFetched: false,
      productionUnchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      automaticTrading: false,
    })).toBe(true);
    expect(report.governance.productionUnchanged).toBe(true);
    expect(report.governance.baseline002Status).toBe("NOT_FROZEN");
    expect(report.governance.m3JStatus).toBe("BLOCKED");
    expect(report.governance.m4Status).toBe("NOT_STARTED");
    expect(report.governance.automaticTrading).toBe(false);
  });

  it("does not introduce a market-event client or performance command", () => {
    const script = readFileSync(scriptPath, "utf8");
    const protocol = readFileSync(protocolPath, "utf8");
    expect(script).not.toMatch(/fetch\s*\(|axios|new\s+WebSocket|child_process|execFile|spawn\s*\(/i);
    expect(protocol).not.toMatch(/fetch\s*\(|axios|new\s+WebSocket|child_process|execFile|spawn\s*\(/i);
    expect(script).not.toMatch(/\/api\/|\.csv\?|range=|limit=/i);
    expect(script).toContain("metadata");
  });

  it("never serializes an API key or event value", () => {
    const reportText = readFileSync(reportPath, "utf8");
    const script = readFileSync(scriptPath, "utf8");
    expect(reportText).not.toMatch(/api[_-]?key\s*[:=]\s*[^f]/i);
    expect(reportText).not.toMatch(/(price|quantity|amount|notional|eventTime)\s*[:=]/i);
    expect(script).not.toMatch(/process\.env\.[A-Z0-9_]*KEY|password|secret/i);
  });

  it("keeps the mandatory status fields explicit", () => {
    const report = loadReport();
    expect(report.governance.performanceExecuted).toBe(false);
    expect(report.governance.selectionExecuted).toBe(false);
    expect(report.governance.newMarketDataFetched).toBe(false);
  });
});
