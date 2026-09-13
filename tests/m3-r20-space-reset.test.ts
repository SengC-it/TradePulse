import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  R20_ADMISSIBILITY_STATUSES,
  R20_DATA_SURFACE_STATUSES,
  R20_FORBIDDEN_OPERATIONS,
  R20_MECHANISM_FAMILY_IDS,
  R20_MECHANISM_LEDGER_STATUSES,
  R20_RANKING_DIMENSIONS,
  R20_RANKING_DIMENSION_WEIGHTS,
  R20_RANKING_METHOD,
  R20_RECOMMENDATION_ELIGIBILITY,
  R20_RECOMMENDED_NEXT_FAMILY,
  R20_SPACE_RESET_STATUS,
  ROUND_020_ACCEPTED_SOURCE,
  ROUND_020_ACCEPTED_SOURCE_BRANCH,
  ROUND_020_BASE_BRANCH,
  ROUND_020_BRANCH,
  ROUND_020_DESIGN_PATH,
  ROUND_020_PHASE,
  ROUND_020_RESEARCH_END_ISO,
  ROUND_020_RESEARCH_ROUND_ID,
  ROUND_020_RESEARCH_START_ISO,
  calculateR20StructuralPriority,
  hasAtMostOneRecommendation,
  hasConcreteProvenanceForExistingDataSurface,
  isRound020DesignOnlyRecord,
  isRound020SpaceResetStatus,
  rankR20ResearchFamilies,
  rankingUsesNoEconomicFields,
} from "@/lib/research/m3-r20-space-reset-protocol";
import type { R20StructuralDimensionScores } from "@/lib/research/m3-r20-space-reset-protocol";

type JsonRecord = Record<string, unknown>;

const DESIGN_PATH = path.join(process.cwd(), ROUND_020_DESIGN_PATH);

function record(value: unknown): JsonRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected JSON object");
  }
  return value as JsonRecord;
}

function records(value: unknown): JsonRecord[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected JSON array");
  }
  return value.map(record);
}

function loadDesign(): Readonly<JsonRecord> {
  return JSON.parse(readFileSync(DESIGN_PATH, "utf8")) as Readonly<JsonRecord>;
}

function acceptedBlob(sourcePath: string): Buffer {
  return execFileSync("git", ["show", `${ROUND_020_ACCEPTED_SOURCE}:${sourcePath}`], {
    cwd: process.cwd(),
    encoding: null,
    maxBuffer: 1024 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }) as Buffer;
}

function acceptedBlobSha(sourcePath: string): string {
  return execFileSync("git", ["rev-parse", `${ROUND_020_ACCEPTED_SOURCE}:${sourcePath}`], {
    cwd: process.cwd(),
    encoding: "utf8",
  }).trim();
}

function acceptedPathExists(sourcePath: string): boolean {
  execFileSync("git", ["cat-file", "-e", `${ROUND_020_ACCEPTED_SOURCE}:${sourcePath}`], {
    cwd: process.cwd(),
    stdio: "ignore",
  });
  return true;
}

function sha256(value: Uint8Array): string {
  return createHash("sha256").update(value).digest("hex");
}

function collectKeys(value: unknown, output: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, output);
    return output;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      output.push(key);
      collectKeys(child, output);
    }
  }
  return output;
}

function makeDimensionScores(values: readonly number[]): R20StructuralDimensionScores {
  if (values.length !== R20_RANKING_DIMENSIONS.length) {
    throw new Error("Expected exactly eight ranking values");
  }

  return Object.fromEntries(
    R20_RANKING_DIMENSIONS.map((dimension, index) => [dimension, values[index]]),
  ) as R20StructuralDimensionScores;
}

describe("Round-020 research-space reset", () => {
  it("binds the exact accepted research source and design boundary", () => {
    const design = loadDesign();

    expect(design.researchRoundId).toBe(ROUND_020_RESEARCH_ROUND_ID);
    expect(design.phase).toBe(ROUND_020_PHASE);
    expect(design.acceptedResearchSource).toEqual({
      branch: ROUND_020_ACCEPTED_SOURCE_BRANCH,
      commit: ROUND_020_ACCEPTED_SOURCE,
      requiredBaseHead: ROUND_020_ACCEPTED_SOURCE,
    });
    expect(design.researchBoundary).toEqual({
      start: ROUND_020_RESEARCH_START_ISO,
      end: ROUND_020_RESEARCH_END_ISO,
      classification: "RESEARCH_AVAILABLE_SEEN_DATA",
      timezoneArithmetic: "UTC_EPOCH_MILLISECONDS_ONLY",
    });
    expect(ROUND_020_BASE_BRANCH).toBe(ROUND_020_ACCEPTED_SOURCE_BRANCH);
    expect(ROUND_020_BRANCH).toBe("research/round-020-space-reset");
  });

  it("keeps the product boundary advisory-only and unchanged", () => {
    const product = record(loadDesign().productBoundary);

    expect(product).toMatchObject({
      signalAdvisoryOnly: true,
      privateBinanceApi: false,
      automaticTrading: false,
      tradingEnabled: false,
      productionUnchanged: true,
      baseline001Unchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      shadowActivation: false,
      schedulerActivation: false,
      mainModified: false,
    });
  });

  it("covers the required R13-R19 mechanism families at family level", () => {
    const ledger = records(loadDesign().mechanismFamilyLedger);
    const ids = new Set(ledger.map((item) => String(item.mechanismFamilyId)));
    const required = [
      "R13_TREND",
      "R13_EMA_STATE",
      "R13_SHORT_MEDIUM_RETURN_MOMENTUM",
      "R13_VOLATILITY_ATR",
      "R13_VOLUME",
      "R13_TAKER_IMBALANCE",
      "R13_SYMBOL_VS_BTC_RELATIVE_RETURN",
      "R13_FUNDING",
      "R13_CROSS_SYMBOL_BREADTH",
      "R13_RIDGE_FEATURE_COMBINATION_FORWARD_EDGE",
      "R14_EXACT_R13_REPLAY",
      "R15_BETA_ALPHA_DECOMPOSITION",
      "R15_MARKET_RELATIVE_DIRECTIONAL_STRUCTURE",
      "R16_OPEN_INTEREST",
      "R16_MARK_INDEX_BASIS",
      "R16_TAKER_FLOW_PERSISTENCE",
      "R17_THESIS_LIFECYCLE",
      "R17_FIRST_FOLLOW_UP_STATE",
      "R17_DEDUP_PERSISTENCE",
      "R17_SESSION_CALENDAR",
      "R18_SCORE_COMPONENT_CONSENSUS",
      "R18_5_OF_5_CONSENSUS",
      "R18_4_OF_5_CONSENSUS",
      "R18_3_OF_5_CONSENSUS",
      "R18_SCORE_THRESHOLD",
      "R18_GRADE",
      "R18_COMPONENT_REWEIGHTING",
      "R18_COMPRESSION_EXPANSION_REPACKAGING",
      "R19_PRIOR_CANDLE_COUNTER_MOVE",
      "R19_STATE_TRANSITION",
      "R19_MARKET_RELATIVE_CONFIRMATION",
      "R19_CALENDAR_SESSION",
      "R19_RANGE_EXPANSION",
    ];

    expect(required.every((id) => ids.has(id))).toBe(true);
    expect(ledger.every((item) => R20_MECHANISM_LEDGER_STATUSES.includes(item.status as never))).toBe(true);
    expect(R20_MECHANISM_FAMILY_IDS).toContain(R20_RECOMMENDED_NEXT_FAMILY);
  });

  it("does not admit prior R13-R19 mechanism families as new directions", () => {
    const assessments = records(loadDesign().familyAssessments);
    const assessmentById = new Map(assessments.map((item) => [String(item.mechanismFamilyId), item]));

    expect(assessmentById.get("SPOT_PERPETUAL_LEAD_LAG_DISLOCATION")?.admissibility)
      .toBe("REJECTED_PRIOR_MECHANISM_OVERLAP");
    expect(assessmentById.get("ON_CHAIN_CAPITAL_FLOW")?.admissibility)
      .toBe("REJECTED_POINT_IN_TIME_RISK");
    expect(assessmentById.get("EXTERNAL_EVENT_INFORMATION_SHOCK")?.admissibility)
      .toBe("REJECTED_POINT_IN_TIME_RISK");
    expect(assessments.every((item) => R20_ADMISSIBILITY_STATUSES.includes(item.admissibility as never))).toBe(true);
  });

  it("recommends exactly one genuinely new family without creating a candidate", () => {
    const design = loadDesign();
    const decision = record(design.decision);

    expect(decision.recommendedNextFamily).toBe(R20_RECOMMENDED_NEXT_FAMILY);
    expect(decision.recommendedNextFamilyDataStatus).toBe("NOT_PRESENT_NEW_DATA_REQUIRED");
    expect(decision.nextRequiredStage).toBe("DATA_ACQUISITION_DESIGN");
    expect(decision.candidateRule).toBe("NOT_CREATED");
    expect(decision.formalRound020Design).toBe("NOT_STARTED");
    expect(hasAtMostOneRecommendation(decision as never)).toBe(true);
    expect(record(design.researchSpaceMap).currentFrozenInformationSpaceExhausted).toBe(true);
  });

  it("binds every existing data surface to concrete immutable provenance", () => {
    const surfaces = records(loadDesign().dataSurfaceInventory);
    const existing = surfaces.filter((surface) => surface.status !== "NOT_PRESENT_NEW_DATA_REQUIRED");

    expect(existing.length).toBeGreaterThan(0);
    for (const surface of existing) {
      expect(R20_DATA_SURFACE_STATUSES).toContain(surface.status);
      expect(hasConcreteProvenanceForExistingDataSurface(surface as never), String(surface.dataFamily)).toBe(true);
      const sourcePath = String(surface.canonicalRepositoryPath);
      expect(existsSync(path.join(process.cwd(), sourcePath))).toBe(true);
      expect(acceptedPathExists(sourcePath)).toBe(true);
      expect(sha256(acceptedBlob(sourcePath)), sourcePath)
        .toBe(surface.fileSha256);
      expect(acceptedBlobSha(sourcePath)).toMatch(/^[a-f0-9]{40}$/);
    }
  });

  it("records absent future data surfaces explicitly rather than using a vague cache reference", () => {
    const surfaces = records(loadDesign().dataSurfaceInventory);
    const absent = surfaces.filter((surface) => surface.status === "NOT_PRESENT_NEW_DATA_REQUIRED");

    expect(absent.length).toBeGreaterThanOrEqual(4);
    for (const surface of absent) {
      expect(surface.repositoryPaths).toEqual([]);
      expect(surface.canonicalRepositoryPath).toBeNull();
      expect(surface.manifestPath).toBeNull();
      expect(surface.dataPath).toBeNull();
      expect(surface.dataSha256).toBeNull();
      expect(surface.networkAcquired).toBe(false);
      expect(String(surface.sourceStatus)).toContain("NO_ACCEPTED");
    }
  });

  it("matches all frozen baseline formal source blobs to the accepted source", () => {
    const provenance = record(loadDesign().frozenProtocolIdentities);
    const blobs = records(provenance.formalSourceBlobs);

    expect(blobs).toHaveLength(5);
    for (const source of blobs) {
      const sourcePath = String(source.path);
      const blob = acceptedBlob(sourcePath);
      expect(sha256(blob), sourcePath).toBe(source.sha256);
      expect(acceptedBlobSha(sourcePath), sourcePath).toBe(source.gitBlobSha);
      for (const anchor of source.anchors as string[]) {
        expect(blob.toString("utf8"), `${sourcePath} ${anchor}`).toContain(anchor);
      }
    }
    expect(provenance.baselineFormalPredicate).toBe("candidate?.formalSignal && candidate.totalScore >= 70");
    expect(record(provenance.folds).redefinition).toBe(false);
    expect(record(provenance.regimes).thresholdChanges).toBe(false);
  });

  it("ranks only structural dimensions and contains no economic result fields", () => {
    const ranking = record(loadDesign().ranking);
    const forbiddenKeys = new Set(["netR", "profitFactor", "pnl", "drawdown", "winLoss", "forwardReturn", "economicLabelValue"]);

    expect(rankingUsesNoEconomicFields(ranking)).toBe(true);
    expect(collectKeys(ranking).filter((key) => forbiddenKeys.has(key))).toEqual([]);
    expect(ranking.usesForwardEconomicValues).toBe(false);
    expect(ranking.usesHistoricalEconomicResults).toBe(false);
    expect(records(ranking.orderedFamilies)).toHaveLength(7);
  });

  it("freezes eight equal-weight dimensions and recomputes every priority", () => {
    const ranking = record(loadDesign().ranking);
    const dimensions = ranking.scoringDimensions as string[];
    const weights = record(ranking.dimensionWeights);

    expect(ranking.method).toBe(R20_RANKING_METHOD);
    expect(dimensions).toEqual([...R20_RANKING_DIMENSIONS]);
    expect(Object.keys(weights)).toEqual([...R20_RANKING_DIMENSIONS]);
    expect(weights).toEqual(R20_RANKING_DIMENSION_WEIGHTS);
    expect(Object.values(weights)).toEqual(R20_RANKING_DIMENSIONS.map(() => 1));
    expect(ranking.formula).toBe("round(sum(dimensionScores) / 8, 3)");
    expect(ranking.rounding).toBe("nearest 0.001; deterministic arithmetic mean of the eight integer scores");
    expect(ranking.tieBreak).toBe("mechanismFamilyId lexical ascending after descending overallResearchPriority");
    expect(ranking.recommendationEligibility).toEqual([...R20_RECOMMENDATION_ELIGIBILITY]);
    expect(ranking.generatedNotHandEntered).toBe(true);

    for (const family of records(ranking.orderedFamilies)) {
      const scores = record(family.dimensionScores);
      expect(Object.keys(scores)).toHaveLength(8);
      expect(Object.keys(scores)).toEqual([...R20_RANKING_DIMENSIONS]);
      expect(Object.values(scores).every((value) => Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 5)).toBe(true);
      expect(family.overallResearchPriority).toBe(
        calculateR20StructuralPriority(scores as never),
      );
    }
  });

  it("orders all seven families by calculated score and fixed lexical tie-break", () => {
    const ranking = record(loadDesign().ranking);
    const ordered = records(ranking.orderedFamilies);
    const priorities = ordered.map((family) => Number(family.overallResearchPriority));

    expect(ordered.map((family) => Number(family.rank))).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (let index = 1; index < ordered.length; index += 1) {
      const previous = ordered[index - 1];
      const current = ordered[index];
      expect(priorities[index - 1]).toBeGreaterThanOrEqual(priorities[index]);
      if (priorities[index - 1] === priorities[index]) {
        expect(String(previous.mechanismFamilyId).localeCompare(String(current.mechanismFamilyId))).toBeLessThan(0);
      }
    }
    expect(ordered.map((family) => family.mechanismFamilyId)).toEqual([
      "FORCED_DELEVERAGING_LIQUIDATION_STATE",
      "POSITIONING_CROWDING_STATE",
      "OPTIONS_IMPLIED_STATE",
      "CROSS_EXCHANGE_FRAGMENTATION",
      "ON_CHAIN_CAPITAL_FLOW",
      "EXTERNAL_EVENT_INFORMATION_SHOCK",
      "SPOT_PERPETUAL_LEAD_LAG_DISLOCATION",
    ]);
  });

  it("uses a deterministic lexical tie-break for equal structural priorities", () => {
    const ranked = rankR20ResearchFamilies([
      {
        mechanismFamilyId: "Z_FAMILY",
        admissibility: "ADMISSIBLE_EXISTING_DATA",
        dimensionScores: makeDimensionScores([3, 3, 3, 3, 3, 3, 3, 3]),
      },
      {
        mechanismFamilyId: "A_FAMILY",
        admissibility: "ADMISSIBLE_NEW_DATA_REQUIRED",
        dimensionScores: makeDimensionScores([3, 3, 3, 3, 3, 3, 3, 3]),
      },
    ]);

    expect(ranked.map((family) => family.mechanismFamilyId)).toEqual(["A_FAMILY", "Z_FAMILY"]);
    expect(ranked.every((family) => family.overallResearchPriority === 3)).toBe(true);
  });

  it("restricts recommendation eligibility and selects the highest-ranked eligible family", () => {
    const design = loadDesign();
    const ranking = record(design.ranking);
    const ordered = records(ranking.orderedFamilies);
    const eligible = ordered.filter((family) => R20_RECOMMENDATION_ELIGIBILITY.includes(
      String(family.admissibility) as never,
    ));
    const decision = record(design.decision);

    expect(eligible.length).toBeGreaterThan(0);
    expect(eligible[0].mechanismFamilyId).toBe(decision.recommendedNextFamily);
    expect(ordered.filter((family) => !family.eligibleForRecommendation)
      .every((family) => !R20_RECOMMENDATION_ELIGIBILITY.includes(String(family.admissibility) as never))).toBe(true);
    expect(ordered.filter((family) => R20_RECOMMENDATION_ELIGIBILITY.includes(String(family.admissibility) as never))
      .every((family) => family.eligibleForRecommendation === true)).toBe(true);
  });

  it("proves the reset performed no economic inspection or new-data acquisition", () => {
    const design = loadDesign();
    const governance = record(design.authoritativeExecutionGovernance);
    const status = record(design.status);
    const closure = record(design.round019Closure);

    expect(governance).toMatchObject({
      performanceExecutionCount: 0,
      ledgerPresent: false,
      ledgerClaim: "FORBIDDEN",
      preflightAuthorized: false,
      preflightExecuted: false,
      performanceAuthorized: false,
      performanceExecuted: false,
      selectionAuthorized: false,
      selectionExecuted: false,
      economicValuesRead: false,
      economicValuesCalculated: false,
      economicValuesInspected: false,
      noNewMarketDataAcquisitionInThisTask: true,
    });
    expect(status).toMatchObject({
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      preflightAuthorized: false,
      performanceExecuted: false,
      selectionExecuted: false,
      economicValuesRead: false,
      economicValuesCalculated: false,
      economicValuesInspected: false,
      newMarketDataFetched: false,
      production: "UNCHANGED",
      baseline002: "NOT_FROZEN",
      m3J: "BLOCKED",
      m4: "NOT_STARTED",
      automaticTrading: false,
    });
    expect(closure).toMatchObject({
      reopened: false,
      preflightExecuted: false,
      performanceExecuted: false,
      selectionExecuted: false,
      economicValuesInspected: false,
    });
    expect(isRound020SpaceResetStatus(R20_SPACE_RESET_STATUS)).toBe(true);
  });

  it("keeps the round-global execution ledger and all execution outputs absent", () => {
    const design = loadDesign();
    const governance = record(design.authoritativeExecutionGovernance);
    const forbiddenArtifacts = governance.forbiddenArtifacts as string[];

    expect(governance.ledgerPath).toBe("docs/research/round-020-performance-ledger.json");
    expect(governance.performanceExecutionCount).toBe(0);
    expect(forbiddenArtifacts.length).toBe(7);
    for (const artifact of forbiddenArtifacts) {
      expect(existsSync(path.join(process.cwd(), artifact)), artifact).toBe(false);
    }
  });

  it("contains no execution, network, or data-acquisition dependency", () => {
    const protocol = readFileSync(path.join(process.cwd(), "src/lib/research/m3-r20-space-reset-protocol.ts"), "utf8");
    const designText = readFileSync(DESIGN_PATH, "utf8");

    expect(protocol).not.toMatch(/from\s+["']node:(?:child_process|fs|net|https)["']/);
    expect(protocol).not.toMatch(/\b(?:fetch|axios|https?:\/\/|execFile|spawn)\b/);
    expect(protocol).not.toMatch(/research:round-020|round-020:(?:preflight|performance|selection)/i);
    expect(designText).not.toContain("https://api.binance");
    expect(designText).not.toContain("research:round-020");
    expect(R20_FORBIDDEN_OPERATIONS).toEqual(expect.arrayContaining([
      "ROUND_020_PREFLIGHT",
      "ROUND_020_PERFORMANCE",
      "ROUND_020_BACKTEST",
      "ROUND_020_SELECTION",
      "FORWARD_ECONOMIC_NUMERIC_READ",
      "NEW_MARKET_DATA_ACQUISITION",
      "AUTOMATIC_TRADING",
    ]));
  });

  it("validates the complete design-only record shape", () => {
    const design = loadDesign();
    expect(isRound020DesignOnlyRecord(design)).toBe(true);
    expect(design.activeHypothesis).toBeNull();
    expect(design.candidateRule).toBeNull();
    expect(record(design.decision).candidateRule).toBe("NOT_CREATED");
  });
});
