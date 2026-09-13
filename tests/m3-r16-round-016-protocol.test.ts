import { describe, expect, it } from "vitest";

import {
  M3_R16_ACCEPTED_R15_SOURCE_SHA,
  M3_R16_NO_GAIN_OUTCOME,
  M3_R16_RESEARCH_END_ISO,
  M3_R16_RESEARCH_ROUND_ID,
  R16_ALPHA_CONTROL_FEATURE_NAMES,
  R16_ALPHA_MICRO_FEATURE_NAMES,
  R16_ARTIFACT_HASH_METHOD,
  R16_BASIS_INTERVAL_MS,
  R16_BETA_CONTROL_FEATURE_NAMES,
  R16_BETA_MICRO_FEATURE_NAMES,
  R16_DIRECTIONS,
  R16_FOLD_IDS,
  R16_GATE_THRESHOLDS,
  R16_GOVERNANCE,
  R16_HORIZON_HOURS,
  R16_METRICS_INTERVAL_MS,
  R16_REQUIRED_OUTPUT_PATHS,
  R16_RESEARCH_RANGE,
  R16_RIDGE_LAMBDA,
  R16_SPEC_OBJECT,
  R16_SYMBOLS,
} from "../src/lib/research/m3-r16-round-016-protocol.ts";
import { R16_PLAN, R16_PLAN_SHA256, validateR16Plan } from "../src/lib/research/m3-r16-round-016-plan.ts";

describe("Round-016 frozen protocol", () => {
  it("freezes the accepted Round-015 boundary and public-only governance", () => {
    expect(M3_R16_RESEARCH_ROUND_ID).toBe("baseline-002-research-round-016");
    expect(M3_R16_ACCEPTED_R15_SOURCE_SHA).toBe("c3986653f8b7ef26bb0e58b545fa3426386605e4");
    expect(M3_R16_RESEARCH_END_ISO).toBe("2026-08-15T23:59:59.999Z");
    expect(R16_RESEARCH_RANGE.classification).toBe("RESEARCH_AVAILABLE_SEEN_DATA");
    expect(R16_RESEARCH_RANGE.endTime).toBe(Date.parse("2026-08-15T23:59:59.999Z"));
    expect(R16_SYMBOLS).toEqual(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"]);
    expect(R16_DIRECTIONS).toEqual(["LONG", "SHORT"]);
    expect(R16_FOLD_IDS).toEqual(["F1", "F2", "F3", "F4", "F5", "F6"]);
    expect(R16_HORIZON_HOURS).toBe(4);
    expect(R16_BASIS_INTERVAL_MS).toBe(5 * 60_000);
    expect(R16_METRICS_INTERVAL_MS).toBe(5 * 60_000);
    expect(R16_GOVERNANCE).toMatchObject({
      classification: "HISTORICAL_DEVELOPMENT_INFORMATION_STUDY",
      sourcePolicy: "OFFICIAL_BINANCE_VISION_USDM_ARCHIVE_ONLY",
      productionDataExcluded: true,
      privateBinanceApi: false,
      automaticTrading: false,
      tradingEnabled: false,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
    });
  });

  it("freezes the four pooled models, fixed lambda, and exact microstructure feature identities", () => {
    expect(R16_BETA_CONTROL_FEATURE_NAMES).toHaveLength(10);
    expect(R16_ALPHA_CONTROL_FEATURE_NAMES).toHaveLength(10);
    expect(R16_BETA_MICRO_FEATURE_NAMES).toHaveLength(20);
    expect(R16_ALPHA_MICRO_FEATURE_NAMES).toHaveLength(20);
    expect(R16_BETA_MICRO_FEATURE_NAMES.slice(-10)).toEqual([
      "MB01_btcOiChange1h",
      "MB02_btcOiChange4h",
      "MB03_btcOiChange12h",
      "MB04_directionAdjustedBtcPriceOiInteraction",
      "MB05_directionAdjustedBtcBasisNowBps",
      "MB06_directionAdjustedBtcBasisChange1h",
      "MB07_directionAdjustedBtcBasisChange4h",
      "MB08_directionAdjustedBtcTaker1h",
      "MB09_directionAdjustedBtcTaker3h",
      "MB10_directionAdjustedBtcTakerAcceleration",
    ]);
    expect(R16_ALPHA_MICRO_FEATURE_NAMES.slice(-10)).toEqual([
      "MA01_oiChange1hMinusMedian",
      "MA02_oiChange4hMinusMedian",
      "MA03_oiChange12hMinusMedian",
      "MA04_directionAdjustedPriceOiInteractionMinusMedian",
      "MA05_directionAdjustedBasisNowMinusMedian",
      "MA06_directionAdjustedBasisChange1hMinusMedian",
      "MA07_directionAdjustedBasisChange4hMinusMedian",
      "MA08_directionAdjustedTaker1hMinusMedian",
      "MA09_directionAdjustedTaker3hMinusMedian",
      "MA10_directionAdjustedTakerAccelerationMinusMedian",
    ]);
    expect(R16_RIDGE_LAMBDA).toBe(10);
    expect(R16_SPEC_OBJECT.model).toMatchObject({
      type: "DETERMINISTIC_INTERPRETABLE_RIDGE_LINEAR_REGRESSION",
      lambda: 10,
      standardization: "RESEARCH_ONLY",
      validation: "PREDICT_ONLY_NO_REFIT_NO_THRESHOLD_UPDATE",
      noSweep: true,
      noOptimizer: true,
      noSymbolIdentity: true,
    });
    expect(R16_SPEC_OBJECT.model.models).toEqual(["R16-BETA-CONTROL", "R16-BETA-MICRO", "R16-ALPHA-CONTROL", "R16-ALPHA-MICRO"]);
    expect(R16_SPEC_OBJECT.governance.automaticTrading).toBe(false);
    expect(R16_ARTIFACT_HASH_METHOD).toBe("SHA256_EXACT_COMMITTED_UTF8_BYTES");
    expect(M3_R16_NO_GAIN_OUTCOME).toBe("NO ROBUST MICROSTRUCTURE INFORMATION GAIN — ROUND-016");
  });

  it("keeps the canonical output boundary and plan identity stable", () => {
    expect(R16_REQUIRED_OUTPUT_PATHS).toEqual([
      "docs/research/round-016-spec.json",
      "docs/research/round-016-plan.json",
      "docs/research/round-016-conformance.json",
      "docs/research/round-016-micro-data-freeze.json",
      "docs/research/round-016-observation-freeze.json",
      "docs/research/round-016-publication-hashes.json",
      "docs/evidence/M3_R16_ROUND_016_SUMMARY.json",
      "docs/evidence/M3_R16_ROUND_016_AUDIT.json",
      "docs/M3_R16_ROUND_016_RESULTS.md",
      "docs/evidence/M3_R16_ROUND_016_SELECTION.json",
      "docs/evidence/M3_R16_ROUND_016_SELECTION.md",
    ]);
    expect(R16_PLAN.specSha256).toHaveLength(64);
    expect(R16_PLAN_SHA256).toHaveLength(64);
    expect(validateR16Plan(R16_PLAN)).toBe(R16_PLAN);
    expect(R16_PLAN.source).toMatchObject({ archiveOnly: true, historicalRestBackfill: "DISABLED", sourceDatabase: "DISABLED" });
    expect(R16_PLAN.performance).toMatchObject({ executionCount: 1, continuation: "SAME_EXECUTION_ID_ONLY", network: "DISABLED_AFTER_LOCK" });
    expect(R16_GATE_THRESHOLDS.minimumCommonMaskCoverage).toBe(0.9);
  });
});
