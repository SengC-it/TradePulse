import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  ROUND_020_LIQUIDATION_PREFLIGHT_DESIGN_JSON_PATH,
  ROUND_020_LIQUIDATION_PREFLIGHT_JSON_PATH,
  ROUND_020_LIQUIDATION_PREFLIGHT_MARKDOWN_PATH,
  ROUND_020_LIQUIDATION_PREFLIGHT_RESEARCH_ROUND_ID,
  ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_DESIGN_MERGE,
  ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_RESEARCH_SOURCE,
  ROUND_020_LIQUIDATION_PREFLIGHT_EXECUTION_COMMIT,
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

const metadataEvidenceSources = [
  ...[
    "https://docs.tardis.dev/faq/data",
    "https://docs.tardis.dev/downloadable-csv-files/data-types",
    "https://docs.tardis.dev/downloadable-csv-files",
    "https://developers.binance.com/docs/derivatives/usds-margined-futures/websocket-market-streams/Liquidation-Order-Streams",
  ].map((url) => ({
    kind: "DOCUMENTATION_SOURCE",
    url,
    evidenceStatus: "DOCUMENTED_METADATA_EVIDENCE",
  })),
  {
    kind: "EXCHANGE_METADATA_SNAPSHOT",
    url: R20_LIQUIDATION_PREFLIGHT_METADATA_ENDPOINT,
    httpStatus: 200,
    evidenceStatus: "PRIOR_METADATA_SNAPSHOT_NOT_REPLAYABLE",
    retrievedAt: null,
    responseSha256: null,
    selectedFields: [
      "exchangeId",
      "channel",
      "datasetType",
      "formats",
      "exportedFrom",
      "exportedUntil",
      "targetSymbolAvailability",
    ],
  },
] as const;

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
  preflightParentCommit: ROUND_020_LIQUIDATION_PREFLIGHT_ACCEPTED_DESIGN_MERGE,
  preflightExecutionCommit: ROUND_020_LIQUIDATION_PREFLIGHT_EXECUTION_COMMIT,
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
  metadataEvidenceItemCount: metadataEvidenceSources.length,
  metadataEvidenceSources,
  metadataSnapshotObservedAt: null,
  metadataSnapshotSha256: null,
  replayableMetadataProbeExecuted: false,
  metadataSnapshot: {
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
  identityContractSatisfied: evaluation.representationResults.some((result) => result.identitySatisfied),
  pitContractSatisfied: evaluation.representationResults.some((result) => result.pitSatisfied),
  coverageContractSatisfied: true,
  gapContractSatisfied: evaluation.representationResults.some((result) => result.gapSatisfied),
  sideContractSatisfied: evaluation.representationResults.some((result) => result.sideSchemaSatisfied),
  revisionContractSatisfied: evaluation.representationResults.some((result) => result.revisionSatisfied),
  entitlementContractSatisfied: evaluation.representationResults.some((result) => result.entitlementSatisfied),
  representationEvidence: input.representations,
  representationResults: evaluation.representationResults,
  qualifyingRepresentations: evaluation.qualifyingRepresentations,
  representationSelectionStatus: evaluation.representationSelectionStatus,
  gateResults: evaluation.gateResults,
  targetCoverageSummary: "ADVERTISED_TARGET_COVERAGE: Tardis metadata advertises liquidations for all five frozen perpetual symbols before 2023-01-01 and export availability through 2026-09-05; exact daily-file matrix was not probed and is not asserted.",
  pitTimestampConclusion: "FAIL: neither representation currently proves event/publication or arrival provenance and replay leakage exclusion without event payload access.",
  exactIdentityConclusion: "FAIL: normalized id may be empty and raw forceOrder immutable id/source sequence was not proven; frozen fallback was not weakened.",
  gapDisconnectConclusion: "FAIL: Tardis sampled/snapshot semantics are retained, but neither representation currently proves disconnect/gap provenance.",
  sideSchemaConclusion: "FAIL: neither representation currently proves buy=>short-liquidated, sell=>long-liquidated, and quantity mapping together.",
  revisionIntegrityConclusion: "FAIL: neither representation currently proves archive revision/checksum/replay reproducibility policy before acquisition.",
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
writeFileSync(path.join(root, ROUND_020_LIQUIDATION_PREFLIGHT_MARKDOWN_PATH), `# Round-020 liquidation data acquisition preflight\n\n- Final decision: **${report.finalDecision}**\n- Source: \`${report.sourceId}\`\n- Representations evaluated independently: normalized CSV and raw Binance forceOrder replay\n- Metadata evidence items: ${report.metadataEvidenceItemCount}\n- Replayable metadata probe executed: ${report.replayableMetadataProbeExecuted}\n- Market-event body requests: 0\n- Market-event bytes downloaded: 0\n- Raw market events read: false\n- Preflight parent commit: \`${report.preflightParentCommit}\`\n- Preflight execution commit: \`${report.preflightExecutionCommit}\`\n\n## Coverage semantics\n\n**P02_ADVERTISED_TARGET_COVERAGE** uses only exchange metadata advertised coverage. The exact daily-file matrix was not probed and is not asserted.\n\n## Mandatory gates\n\n${report.gateResults.map((gate) => `- ${gate.id}: **${gate.status}** — ${gate.reason}`).join("\n")}\n\n## Representation results\n\n${report.representationResults.map((result) => `- ${result.representation}: fullyQualified=${result.fullyQualified}; pit=${result.pitSatisfied}; identity=${result.identitySatisfied}; gap=${result.gapSatisfied}; sideSchema=${result.sideSchemaSatisfied}; revision=${result.revisionSatisfied}; entitlement=${result.entitlementSatisfied}`).join("\n")}\n\n- Qualifying representations: ${report.qualifyingRepresentations.length === 0 ? "none" : report.qualifyingRepresentations.join(", ")}\n- Selection status: ${report.representationSelectionStatus}\n- Recommended representation: ${report.recommendedRepresentation ?? "null"}\n\n## Fail-closed conclusions\n\nThe current metadata evidence does not qualify either representation. UNKNOWN or FAIL is ineligible; no event payload was read. A future preflight must evaluate each representation independently and may recommend only one uniquely qualifying representation; two qualifying representations without a frozen tie-break remain fail-closed.\n\nProduction is unchanged. Performance, selection, candidate creation, economic inspection, and new market-data acquisition were not executed.\n`, "utf8");

console.log(JSON.stringify({
  finalDecision: report.finalDecision,
  metadataEvidenceItemCount: report.metadataEvidenceItemCount,
  marketEventBodyRequests: report.marketEventBodyRequests,
  marketEventBytesDownloaded: report.marketEventBytesDownloaded,
  rawMarketEventsRead: report.rawMarketEventsRead,
}, null, 2));
