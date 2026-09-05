import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_JSON_PATH,
  ROUND_020_LIQUIDATION_PREFLIGHT_JSON_PATH,
  ROUND_020_LIQUIDATION_PREFLIGHT_MARKDOWN_PATH,
  ROUND_020_LIQUIDATION_PREFLIGHT_RESEARCH_ROUND_ID,
  ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_DESIGN_MERGE,
  ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_RESEARCH_SOURCE,
  ROUND_020_LIQUIDATION_PREFLIGHT_BRANCH,
  R20_LIQUIDATION_PREFLIGHT_END_ISO,
  R20_LIQUIDATION_PREFLIGHT_EXCHANGE_ID,
  R20_LIQUIDATION_PREFLIGHT_GATE_IDS,
  R20_LIQUIDATION_PREFLIGHT_METADATA_ENDPOINT,
  R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS,
  R20_LIQUIDATION_PREFLIGHT_SOURCE_ID,
  R20_LIQUIDATION_PREFLIGHT_START_ISO,
  R20_LIQUIDATION_PREFLIGHT_SYMBOLS,
  R20_LIQUIDATION_PREFLIGHT_VENUE,
  evaluateR20LiquidationPreflight,
  isR20LiquidationPreflightMetadataOnly,
  type R20LiquidationPreflightInput,
} from "../src/lib/research/m3-r20-liquidation-data-preflight-protocol.ts";

const root = process.cwd();
const design = JSON.parse(readFileSync(path.join(root, ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_JSON_PATH), "utf8")) as {
  ranking?: { recommendedSourceId?: string };
  mechanismFamily?: { candidateCreated?: boolean };
};

const metadataTargetAvailability = {
  BTCUSDT: { availableSince: "2019-11-17T00:00:00.000Z", availableTo: null, liquidationDatasetAdvertised: true },
  ETHUSDT: { availableSince: "2019-11-27T00:00:00.000Z", availableTo: null, liquidationDatasetAdvertised: true },
  SOLUSDT: { availableSince: "2020-09-14T00:00:00.000Z", availableTo: null, liquidationDatasetAdvertised: true },
  XRPUSDT: { availableSince: "2020-01-06T00:00:00.000Z", availableTo: null, liquidationDatasetAdvertised: true },
  BNBUSDT: { availableSince: "2020-02-10T00:00:00.000Z", availableTo: null, liquidationDatasetAdvertised: true },
} as const;

const input: R20LiquidationPreflightInput = {
  acceptedSourceIntegrity: true,
  recommendedSourceUnchanged: design.ranking?.recommendedSourceId === R20_LIQUIDATION_PREFLIGHT_SOURCE_ID,
  candidateCreated: design.mechanismFamily?.candidateCreated === true,
  performanceExecutionCount: 0,
  coverage: {
    exchangeId: R20_LIQUIDATION_PREFLIGHT_EXCHANGE_ID,
    datasetType: "liquidations",
    formats: ["csv"],
    exportedFrom: "2019-11-17T00:00:00.000Z",
    exportedUntil: "2026-09-05T00:00:00.000Z",
    targetSymbolAvailability: metadataTargetAvailability,
    exactDailyFileMatrixProbed: false,
  },
  representations: R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS.map((representation) => ({
    representation,
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
    normalizedIdMayBeEmpty: representation === "TARDIS_NORMALIZED_LIQUIDATIONS_CSV",
    rawPayloadIdentityMayBeMissing: representation === "TARDIS_RAW_BINANCE_FORCE_ORDER_REPLAY",
  })),
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
};

if (!isR20LiquidationPreflightMetadataOnly(input)) {
  throw new Error("Round-020 preflight attempted a forbidden market-event or economic operation.");
}

const evaluation = evaluateR20LiquidationPreflight(input);
const report = {
  schemaVersion: "m3-r20-liquidation-data-preflight-001",
  researchRoundId: ROUND_020_LIQUIDATION_PREFLIGHT_RESEARCH_ROUND_ID,
  phase: "DATA_ACQUISITION_PREFLIGHT",
  acceptedResearchSource: { commit: ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_RESEARCH_SOURCE, branch: "research/round-020-liquidation-data-design" },
  acceptedDesignMerge: ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_DESIGN_MERGE,
  acceptedDesignArtifacts: {
    json: {
      path: ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_JSON_PATH,
      acceptedGitBlobSha1: "921752f15ddb7a9c18558703f5181ffce2e7e8cf",
      sha256: "ce4dfd1f49643b249fae0735f3693b3e208b9062f468b30fa63dee11aeaa6a21",
    },
    markdown: {
      path: "docs/research/round-020-liquidation-data-design.md",
      acceptedGitBlobSha1: "9e60df35676731fdb97b98d7b0f062e0fadca30a",
      sha256: "5973ebfe65e21c99497327fad66b447441ea2e394c2657b84f73b59917c3961a",
    },
    contentUnchanged: true,
  },
  preflightCommit: process.env.ROUND_020_PREFLIGHT_COMMIT ?? ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_DESIGN_MERGE,
  branch: ROUND_020_LIQUIDATION_PREFLIGHT_BRANCH,
  sourceId: R20_LIQUIDATION_PREFLIGHT_SOURCE_ID,
  representationEvaluated: [...R20_LIQUIDATION_PREFLIGHT_REPRESENTATIONS],
  target: {
    venue: R20_LIQUIDATION_PREFLIGHT_VENUE,
    exchangeId: R20_LIQUIDATION_PREFLIGHT_EXCHANGE_ID,
    marketType: "USD_M_PERPETUALS",
    symbols: [...R20_LIQUIDATION_PREFLIGHT_SYMBOLS],
    start: R20_LIQUIDATION_PREFLIGHT_START_ISO,
    end: R20_LIQUIDATION_PREFLIGHT_END_ISO,
  },
  metadataProbes: {
    count: 8,
    documentationUrls: [
      "https://docs.tardis.dev/faq/data",
      "https://docs.tardis.dev/downloadable-csv-files/data-types",
      "https://docs.tardis.dev/downloadable-csv-files",
      "https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Liquidation-Order-Streams",
    ],
    endpoint: R20_LIQUIDATION_PREFLIGHT_METADATA_ENDPOINT,
    endpointStatus: 200,
    exchangeId: R20_LIQUIDATION_PREFLIGHT_EXCHANGE_ID,
    channel: "forceOrder",
    datasetType: "liquidations",
    formats: ["csv"],
    exportedFrom: "2019-11-17T00:00:00.000Z",
    exportedUntil: "2026-09-05T00:00:00.000Z",
    targetSymbolAvailability: metadataTargetAvailability,
    exactDailyFileMatrixProbed: false,
    apiKeySerialized: false,
    entitlementVerified: false,
  },
  marketEventBodyRequests: 0,
  marketEventBytesDownloaded: 0,
  rawMarketEventsRead: false,
  identityContractSatisfied: false,
  pitContractSatisfied: false,
  coverageContractSatisfied: true,
  gapContractSatisfied: false,
  sideContractSatisfied: false,
  revisionContractSatisfied: false,
  entitlementContractSatisfied: false,
  representationEvidence: input.representations,
  gateResults: evaluation.gateResults,
  targetCoverageSummary: "Tardis metadata advertises liquidations for all five frozen perpetual symbols before 2023-01-01 and export availability through 2026-09-05; exact daily-file matrix was not probed.",
  pitTimestampConclusion: "FAIL: normalized timestamp/local_timestamp and raw replay publication/arrival provenance were not jointly proven without event payload access.",
  exactIdentityConclusion: "FAIL: normalized id may be empty and raw forceOrder immutable id/source sequence was not proven; frozen fallback was not weakened.",
  gapDisconnectConclusion: "FAIL: Tardis sampled/snapshot semantics are retained, but normalized and raw disconnect/gap provenance was not proven.",
  sideSchemaConclusion: "FAIL: buy=>short-liquidated and sell=>long-liquidated plus quantity mapping were not jointly proven for both representations.",
  revisionIntegrityConclusion: "FAIL: archive revision/checksum/replay reproducibility policy was not proven before acquisition.",
  entitlementConclusion: "FAIL: vendor data entitlement was not verified; no credential was read or serialized.",
  finalDecision: evaluation.finalDecision,
  recommendedRepresentation: evaluation.recommendedRepresentation,
  governance: {
    performanceExecutionCount: 0,
    performanceLedgerPresent: false,
    candidateCreated: false,
    economicValuesRead: false,
    economicValuesCalculated: false,
    economicValuesInspected: false,
    newMarketDataFetched: false,
    performanceExecuted: false,
    selectionExecuted: false,
    productionUnchanged: true,
    baseline002Status: "NOT_FROZEN",
    m3JStatus: "BLOCKED",
    m4Status: "NOT_STARTED",
    automaticTrading: false,
  },
  designArtifactPath: ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_JSON_PATH,
  forbiddenOperations: [
    "HISTORICAL_LIQUIDATION_PAYLOAD_READ",
    "PERFORMANCE",
    "SELECTION",
    "ECONOMIC_NUMERIC_READ",
    "NEW_MARKET_DATA_ACQUISITION",
  ],
  gateIds: [...R20_LIQUIDATION_PREFLIGHT_GATE_IDS],
};

writeFileSync(path.join(root, ROUND_020_LIQUIDATION_PREFLIGHT_JSON_PATH), `${JSON.stringify(report, null, 2)}\n`, "utf8");
writeFileSync(path.join(root, ROUND_020_LIQUIDATION_PREFLIGHT_MARKDOWN_PATH), `# Round-020 liquidation data acquisition preflight\n\n- Final decision: **${report.finalDecision}**\n- Source: \`${report.sourceId}\`\n- Representations evaluated: normalized CSV and raw Binance forceOrder replay\n- Metadata probes: ${report.metadataProbes.count}\n- Market-event body requests: 0\n- Market-event bytes downloaded: 0\n- Raw market events read: false\n\n## Mandatory gates\n\n${report.gateResults.map((gate) => `- ${gate.id}: **${gate.status}** — ${gate.reason}`).join("\n")}\n\n## Fail-closed conclusions\n\nTarget availability metadata is present, but immutable event identity, publication-time replay provenance, disconnect/gap evidence, side/quantity mapping, revision reproducibility, and entitlement are not all proven for both allowed representations. UNKNOWN or FAIL is ineligible; no event payload was read.\n\nProduction is unchanged. Performance, selection, candidate creation, economic inspection, and new market-data acquisition were not executed.\n`, "utf8");

console.log(JSON.stringify({
  finalDecision: report.finalDecision,
  metadataProbeCount: report.metadataProbes.count,
  marketEventBodyRequests: report.marketEventBodyRequests,
  marketEventBytesDownloaded: report.marketEventBytesDownloaded,
  rawMarketEventsRead: report.rawMarketEventsRead,
}, null, 2));
