import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  R20_LIQUIDATION_ALLOWED_RECOMMENDATION_STATUSES,
  R20_LIQUIDATION_CANONICAL_EVENT_FIELDS,
  R20_LIQUIDATION_COMPLETENESS_STATUSES,
  R20_LIQUIDATION_DESIGN_GOVERNANCE,
  R20_LIQUIDATION_FUTURE_MANIFEST_REQUIRED_FIELDS,
  R20_LIQUIDATION_MECHANISM_FAMILY,
  R20_LIQUIDATION_RANKING_DIMENSIONS,
  R20_LIQUIDATION_RANKING_METHOD,
  R20_LIQUIDATION_RANKING_ROUNDING,
  R20_LIQUIDATION_RANKING_TIE_BREAK,
  R20_LIQUIDATION_RANKING_WEIGHTS,
  R20_LIQUIDATION_SOURCE_CLASSIFICATIONS,
  R20_LIQUIDATION_SYMBOLS,
  R20_LIQUIDATION_VENUE,
  ROUND_020_LIQUIDATION_ACCEPTED_SOURCE,
  ROUND_020_LIQUIDATION_BASE_BRANCH,
  ROUND_020_LIQUIDATION_BRANCH,
  ROUND_020_LIQUIDATION_DESIGN_MARKDOWN_PATH,
  ROUND_020_LIQUIDATION_DESIGN_PATH,
  ROUND_020_LIQUIDATION_PHASE,
  buildR20LiquidationCompositeIdentity,
  calculateR20LiquidationSourcePriority,
  exactR20LiquidationIdentityMatches,
  isR20LiquidationDesignOnlyGovernance,
  isR20LiquidationPointInTimeAdmissible,
  rankR20LiquidationSources,
} from "@/lib/research/m3-r20-liquidation-data-design-protocol";
import type { R20LiquidationIdentityParts } from "@/lib/research/m3-r20-liquidation-data-design-protocol";

type R20DesignSource = {
  sourceId: string;
  coverageClassification: (typeof R20_LIQUIDATION_SOURCE_CLASSIFICATIONS)[number];
  recommendationEligible: boolean;
  rankingDimensionScores: typeof R20_LIQUIDATION_RANKING_WEIGHTS;
  metadataProbes: string[];
  documentationUrls: string[];
};

type R20OrderedSource = {
  rank: number;
  sourceId: string;
  overallResearchPriority: number;
  classification: string;
  eligibleForRecommendation: boolean;
};

type R20Design = {
  acceptedResearchSource: { commit: string; baseBranch: string; branch: string };
  phase: string;
  researchBoundary: { venue: string; marketType: string; symbols: string[]; start: string; end: string };
  mechanismFamily: { id: string; candidateCreated: boolean; thresholds: null };
  eventSchema: { requiredFields: string[]; sideRule: { liquidationSide: string; executionSide: string; forbiddenInference: string } };
  sources: R20DesignSource[];
  ranking: { orderedSources: R20OrderedSource[]; recommendationCount: number; recommendedSourceId: string; scoresContainNoTradingResults: boolean };
  decision: { outcome: string; recommendedSourceId: string; recommendedSourceClassification: string; preflightRequiresAllMetadataProbes: boolean };
  futureAcquisitionManifestContract: { requiredFields: string[]; manifestExists: boolean; networkAcquired: boolean; bytes: number };
  sourceInventoryMethod: { networkAcquired: boolean };
  forbiddenArtifactsAtDesignStage: string[];
  governance: typeof R20_LIQUIDATION_DESIGN_GOVERNANCE;
  status: { dataAcquisitionPreflight: string; performance: string; selection: string };
};

const DESIGN_PATH = path.join(process.cwd(), ROUND_020_LIQUIDATION_DESIGN_PATH);
const MARKDOWN_PATH = path.join(process.cwd(), ROUND_020_LIQUIDATION_DESIGN_MARKDOWN_PATH);

function loadDesign(): R20Design {
  return JSON.parse(readFileSync(DESIGN_PATH, "utf8")) as R20Design;
}

function acceptedPathExists(sourcePath: string): boolean {
  execFileSync("git", ["cat-file", "-e", `${ROUND_020_LIQUIDATION_ACCEPTED_SOURCE}:${sourcePath}`], {
    cwd: process.cwd(),
    stdio: "ignore",
  });
  return true;
}

function sourceRows(): R20DesignSource[] {
  return loadDesign().sources;
}

function identity(): R20LiquidationIdentityParts {
  return {
    venue: "BINANCE_USDM",
    symbol: "BTCUSDT",
    eventTime: "2024-01-01T00:00:00.000Z",
    liquidationSide: "LONG",
    price: "100.00",
    quantity: "1.00",
    sourceSequence: "source-1",
  };
}

describe("Round-020 liquidation data acquisition design", () => {
  it("freezes the accepted source and research branch", () => {
    const design = loadDesign();
    expect(design.acceptedResearchSource.commit).toBe(ROUND_020_LIQUIDATION_ACCEPTED_SOURCE);
    expect(design.acceptedResearchSource.baseBranch).toBe(ROUND_020_LIQUIDATION_BASE_BRANCH);
    expect(design.acceptedResearchSource.branch).toBe(ROUND_020_LIQUIDATION_BRANCH);
  });

  it("freezes the design-only phase", () => {
    expect(loadDesign().phase).toBe(ROUND_020_LIQUIDATION_PHASE);
    expect(loadDesign().status.dataAcquisitionPreflight).toBe("NOT_STARTED");
  });

  it("freezes the five-symbol Binance USD-M target", () => {
    const target = loadDesign().researchBoundary;
    expect(target.venue).toBe(R20_LIQUIDATION_VENUE);
    expect(target.marketType).toBe("USD_M_PERPETUALS");
    expect(target.symbols).toEqual([...R20_LIQUIDATION_SYMBOLS]);
    expect(target.symbols).toHaveLength(5);
  });

  it("freezes the authoritative historical boundary", () => {
    expect(loadDesign().researchBoundary.start).toBe("2023-01-01T00:00:00.000Z");
    expect(loadDesign().researchBoundary.end).toBe("2026-08-15T23:59:59.999Z");
  });

  it("keeps the recommended family as forced-deleveraging state only", () => {
    const family = loadDesign().mechanismFamily;
    expect(family.id).toBe(R20_LIQUIDATION_MECHANISM_FAMILY);
    expect(family.candidateCreated).toBe(false);
    expect(family.thresholds).toBeNull();
  });

  it("freezes every required event-schema field", () => {
    expect(loadDesign().eventSchema.requiredFields).toEqual([...R20_LIQUIDATION_CANONICAL_EVENT_FIELDS]);
  });

  it("keeps liquidation side and execution side distinct", () => {
    const sideRule = loadDesign().eventSchema.sideRule;
    expect(sideRule.liquidationSide).toContain("position side");
    expect(sideRule.executionSide).toContain("separate");
    expect(sideRule.forbiddenInference).toContain("infer");
  });

  it("builds the exact documented fallback identity", () => {
    expect(buildR20LiquidationCompositeIdentity(identity())).toBe(
      "BINANCE_USDM|BTCUSDT|2024-01-01T00:00:00.000Z|LONG|100.00|1.00|source-1",
    );
  });

  it("accepts an exact identity match", () => {
    expect(exactR20LiquidationIdentityMatches(identity(), identity())).toBe(true);
  });

  it("rejects a nearest-timestamp identity match", () => {
    expect(exactR20LiquidationIdentityMatches(identity(), {
      ...identity(),
      eventTime: "2024-01-01T00:00:00.001Z",
    })).toBe(false);
  });

  it("rejects a price-only or quantity-only identity match", () => {
    expect(exactR20LiquidationIdentityMatches(identity(), {
      ...identity(),
      price: "100.01",
    })).toBe(false);
    expect(exactR20LiquidationIdentityMatches(identity(), {
      ...identity(),
      quantity: "1.01",
    })).toBe(false);
  });

  it("accepts a point-in-time event without a distinct publication time", () => {
    expect(isR20LiquidationPointInTimeAdmissible(100, null, 100)).toBe(true);
  });

  it("accepts an event and publication time at the decision boundary", () => {
    expect(isR20LiquidationPointInTimeAdmissible(100, 100, 100)).toBe(true);
  });

  it("rejects an event after decision time", () => {
    expect(isR20LiquidationPointInTimeAdmissible(101, null, 100)).toBe(false);
  });

  it("rejects a publication after decision time", () => {
    expect(isR20LiquidationPointInTimeAdmissible(99, 101, 100)).toBe(false);
  });

  it("freezes all completeness statuses", () => {
    expect(R20_LIQUIDATION_COMPLETENESS_STATUSES).toEqual([
      "COMPLETE_EVENT_STREAM",
      "SAMPLED_EVENT_STREAM",
      "AGGREGATED_EVENT_STREAM",
      "SNAPSHOT_ONLY",
      "UNKNOWN_COMPLETENESS",
    ]);
  });

  it("freezes the ten acquisition-quality dimensions", () => {
    expect(R20_LIQUIDATION_RANKING_DIMENSIONS).toHaveLength(10);
    expect(new Set(R20_LIQUIDATION_RANKING_DIMENSIONS).size).toBe(10);
  });

  it("freezes equal weights with total weight ten", () => {
    expect(R20_LIQUIDATION_RANKING_METHOD).toBe("EQUAL_WEIGHT_ARITHMETIC_MEAN");
    expect(Object.values(R20_LIQUIDATION_RANKING_WEIGHTS)).toEqual(new Array(10).fill(1));
    expect(Object.values(R20_LIQUIDATION_RANKING_WEIGHTS).reduce((sum, value) => sum + value, 0)).toBe(10);
  });

  it("rejects scores outside integer 0..5", () => {
    expect(() => calculateR20LiquidationSourcePriority({
      ...R20_LIQUIDATION_RANKING_WEIGHTS,
      officialProvenance: 5.5,
    })).toThrow();
    expect(() => calculateR20LiquidationSourcePriority({
      ...R20_LIQUIDATION_RANKING_WEIGHTS,
      officialProvenance: -1,
    })).toThrow();
  });

  it("calculates the equal-weight score deterministically", () => {
    expect(calculateR20LiquidationSourcePriority({
      ...R20_LIQUIDATION_RANKING_WEIGHTS,
      officialProvenance: 5,
      pointInTimeIntegrity: 3,
      historicalCoverage: 5,
      symbolBreadth: 5,
      completenessTransparency: 4,
      immutableArchiveAvailability: 5,
      reproducibility: 4,
      schemaQuality: 4,
      licensingStability: 3,
      acquisitionFeasibility: 4,
    })).toBe(4.2);
  });

  it("uses the frozen rounding and tie-break contract", () => {
    expect(R20_LIQUIDATION_RANKING_ROUNDING).toBe("ROUND_TO_3_DECIMAL_PLACES");
    expect(R20_LIQUIDATION_RANKING_TIE_BREAK).toContain("sourceIdLexicalAscending");
  });

  it("recomputes every source score from its ten dimensions", () => {
    const design = loadDesign();
    const ranked = rankR20LiquidationSources(sourceRows().map((source) => ({
      sourceId: source.sourceId,
      classification: source.coverageClassification,
      recommendationEligible: source.recommendationEligible,
      dimensionScores: source.rankingDimensionScores,
    })));
    expect(ranked).toHaveLength(design.ranking.orderedSources.length);
    ranked.forEach((source, index) => {
      expect(source.sourceId).toBe(design.ranking.orderedSources[index].sourceId);
      expect(source.overallResearchPriority).toBe(design.ranking.orderedSources[index].overallResearchPriority);
      expect(source.eligibleForRecommendation).toBe(design.ranking.orderedSources[index].eligibleForRecommendation);
    });
  });

  it("keeps the generated ranking in descending score order", () => {
    const ordered = loadDesign().ranking.orderedSources;
    expect(ordered.map((source) => source.rank)).toEqual(ordered.map((_, index) => index + 1));
    expect(ordered.slice(1).every((source, index) => source.overallResearchPriority <= ordered[index].overallResearchPriority)).toBe(true);
  });

  it("uses lexical sourceId ordering for equal scores", () => {
    const ranked = rankR20LiquidationSources([
      {sourceId: "B_SOURCE", classification: "INSUFFICIENT_PROVENANCE", recommendationEligible: false, dimensionScores: R20_LIQUIDATION_RANKING_WEIGHTS},
      {sourceId: "A_SOURCE", classification: "INSUFFICIENT_PROVENANCE", recommendationEligible: false, dimensionScores: R20_LIQUIDATION_RANKING_WEIGHTS},
    ]);
    expect(ranked.map((source) => source.sourceId)).toEqual(["A_SOURCE", "B_SOURCE"]);
  });

  it("allows at most one recommendation", () => {
    const eligible = loadDesign().ranking.orderedSources.filter((source) => source.eligibleForRecommendation);
    expect(eligible).toHaveLength(1);
    expect(loadDesign().ranking.recommendationCount).toBe(1);
  });

  it("does not recommend a source with a rejected classification", () => {
    const allowed = new Set(R20_LIQUIDATION_ALLOWED_RECOMMENDATION_STATUSES);
    sourceRows().forEach((source) => {
      if (source.recommendationEligible) {
        expect([...allowed].some((status) => status === source.coverageClassification)).toBe(true);
      }
    });
    expect(R20_LIQUIDATION_SOURCE_CLASSIFICATIONS).toContain("LIVE_ONLY_NOT_HISTORICAL");
  });

  it("recommends the highest-ranked admissible source", () => {
    const design = loadDesign();
    expect(design.ranking.recommendedSourceId).toBe("TARDIS_BINANCE_USDT_FUTURES_LIQUIDATIONS");
    expect(design.decision.recommendedSourceId).toBe(design.ranking.recommendedSourceId);
  });

  it("freezes a conditional rather than full-coverage outcome", () => {
    const decision = loadDesign().decision;
    expect(decision.outcome).toBe("ROUND-020 LIQUIDATION DATA SOURCE CONDITIONALLY QUALIFIED");
    expect(decision.recommendedSourceClassification).toBe("QUALIFIED_PARTIAL_TARGET_COVERAGE");
    expect(decision.preflightRequiresAllMetadataProbes).toBe(true);
  });

  it("requires concrete metadata probes for every source", () => {
    sourceRows().forEach((source) => {
      expect(source.metadataProbes.length).toBeGreaterThan(0);
      expect(source.documentationUrls.every((url: string) => url.startsWith("https://"))).toBe(true);
    });
  });

  it("keeps ranking free of trading-result fields", () => {
    const serialized = JSON.stringify(loadDesign().ranking);
    expect(serialized).not.toMatch(/netR|profitFactor|drawdown|forwardReturn|winLoss|pnl/i);
    expect(loadDesign().ranking.scoresContainNoTradingResults).toBe(true);
  });

  it("keeps candidate and threshold creation out of the design", () => {
    expect(loadDesign().mechanismFamily.candidateCreated).toBe(false);
    expect(loadDesign().mechanismFamily.thresholds).toBeNull();
    expect(loadDesign().governance.candidateCreated).toBe(false);
  });

  it("keeps all governance flags fail-closed", () => {
    expect(isR20LiquidationDesignOnlyGovernance(R20_LIQUIDATION_DESIGN_GOVERNANCE)).toBe(true);
    expect(loadDesign().governance).toEqual(R20_LIQUIDATION_DESIGN_GOVERNANCE);
  });

  it("keeps the performance ledger absent and count zero", () => {
    const governance = loadDesign().governance;
    expect(governance.performanceExecutionCount).toBe(0);
    expect(governance.performanceLedgerPresent).toBe(false);
    expect(governance.performanceExecuted).toBe(false);
  });

  it("keeps preflight, performance, and selection unauthorized", () => {
    const governance = loadDesign().governance;
    expect(governance.preflightAuthorized).toBe(false);
    expect(governance.performanceAuthorized).toBe(false);
    expect(governance.selectionExecuted).toBe(false);
  });

  it("keeps economics unread and new data unfetched", () => {
    const governance = loadDesign().governance;
    expect(governance.economicValuesRead).toBe(false);
    expect(governance.economicValuesCalculated).toBe(false);
    expect(governance.economicValuesInspected).toBe(false);
    expect(governance.newMarketDataFetched).toBe(false);
    expect(governance.acquisitionBytes).toBe(0);
  });

  it("freezes future manifest fields without creating a manifest", () => {
    const future = loadDesign().futureAcquisitionManifestContract;
    expect(future.requiredFields).toEqual([...R20_LIQUIDATION_FUTURE_MANIFEST_REQUIRED_FIELDS]);
    expect(future.manifestExists).toBe(false);
    expect(future.networkAcquired).toBe(false);
    expect(future.bytes).toBe(0);
  });

  it("does not introduce a network client in the design protocol", () => {
    const protocol = readFileSync(path.join(process.cwd(), "src/lib/research/m3-r20-liquidation-data-design-protocol.ts"), "utf8");
    expect(protocol).not.toMatch(/fetch\s*\(/);
    expect(protocol).not.toMatch(/WebSocket/);
    expect(protocol).not.toMatch(/child_process|execFile|axios/);
  });

  it("keeps all forbidden operations outside the authorized path", () => {
    expect(loadDesign().sourceInventoryMethod.networkAcquired).toBe(false);
    expect(loadDesign().status.performance).toBe("NOT_AUTHORIZED");
    expect(loadDesign().status.selection).toBe("NOT_AUTHORIZED");
  });

  it("does not create preflight, performance, selection, or raw-data artifacts", () => {
    const forbidden = loadDesign().forbiddenArtifactsAtDesignStage;
    forbidden.forEach((relativePath) => {
      if (relativePath.includes("/")) {
        expect(existsSync(path.join(process.cwd(), relativePath))).toBe(false);
      }
    });
  });

  it("keeps the design files present and documentation-linked", () => {
    expect(existsSync(DESIGN_PATH)).toBe(true);
    expect(existsSync(MARKDOWN_PATH)).toBe(true);
    expect(readFileSync(MARKDOWN_PATH, "utf8")).toContain("DATA_ACQUISITION_DESIGN_ONLY");
  });

  it("verifies the accepted source contains the inherited R20 reset design", () => {
    expect(acceptedPathExists("docs/research/round-020-space-reset.json")).toBe(true);
    expect(acceptedPathExists("src/lib/research/m3-r20-space-reset-protocol.ts")).toBe(true);
  });

  it("keeps Production and prior baseline governance unchanged", () => {
    const governance = loadDesign().governance;
    expect(governance.productionUnchanged).toBe(true);
    expect(governance.baseline001Unchanged).toBe(true);
    expect(governance.baseline002Status).toBe("NOT_FROZEN");
    expect(governance.m3JStatus).toBe("BLOCKED");
    expect(governance.m4Status).toBe("NOT_STARTED");
    expect(governance.automaticTrading).toBe(false);
  });
});
