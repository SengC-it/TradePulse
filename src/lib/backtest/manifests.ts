import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { BACKTEST_PERIOD_RANGES, BACKTEST_POLICY, type BacktestPeriod } from "./constants.ts";
import { buildHistoricalLoadRanges } from "./ranges.ts";
import {
  HISTORICAL_PROVIDER,
  type HistoricalManifest,
  type HistoricalIntrabarSettlementManifest,
} from "../historical-data/types.ts";
import type { IntrabarSettlementRequirement } from "./types.ts";
import { intrabarSettlementIdentityKey } from "../historical-data/intrabar.ts";

export type ManifestCoverage = Readonly<{
  valid: boolean;
  diagnostics: readonly string[];
}>;

export type BacktestFallbackManifestRequirement = Readonly<{
  symbol: ResearchSymbol;
  segment: "base" | "settlement-tail";
}>;

export type BacktestIntrabarManifestRequirement = IntrabarSettlementRequirement;

function hasValidChecksum(manifest: HistoricalManifest): boolean {
  return /^[a-f0-9]{64}$/i.test(manifest.sha256);
}

function isResearchSymbol(value: unknown): value is ResearchSymbol {
  return typeof value === "string" && RESEARCH_SYMBOLS.includes(value as ResearchSymbol);
}

function validateProvidedMarkPriceManifest(
  manifest: Extract<HistoricalManifest, { kind: "mark-price" }>,
  diagnostics: string[],
): void {
  if (manifest.provider !== HISTORICAL_PROVIDER) {
    diagnostics.push(`Mark-price manifest provider is not ${HISTORICAL_PROVIDER}.`);
  }
  if (manifest.source !== "/fapi/v1/markPriceKlines") {
    diagnostics.push("Mark-price manifest source is not /fapi/v1/markPriceKlines.");
  }
  if (manifest.timeframe !== "1h") {
    diagnostics.push("Mark-price manifest timeframe is not 1h.");
  }
  if (!isResearchSymbol(manifest.symbol)) {
    diagnostics.push("Mark-price manifest symbol is not in the approved research universe.");
  }
  if (!hasValidChecksum(manifest)) {
    diagnostics.push(`Mark-price manifest checksum is invalid for ${String(manifest.symbol)}.`);
  }
}

function validateProvidedIntrabarManifest(
  manifest: HistoricalIntrabarSettlementManifest,
  diagnostics: string[],
): void {
  if (manifest.provider !== HISTORICAL_PROVIDER) diagnostics.push("Intrabar manifest provider is invalid.");
  if (manifest.source !== "/fapi/v1/klines") diagnostics.push("Intrabar manifest source is invalid.");
  if (manifest.timeframe !== "1m") diagnostics.push("Intrabar manifest timeframe is not 1m.");
  if (!isResearchSymbol(manifest.symbol)) diagnostics.push("Intrabar manifest symbol is invalid.");
  if (manifest.rowCount !== 60) diagnostics.push(`Intrabar manifest row count is not 60 for ${manifest.symbol}.`);
  if (!Number.isInteger(manifest.exitCandleOpenTime)) diagnostics.push("Intrabar manifest exit candle time is invalid.");
  if (manifest.requestedStartTime !== manifest.exitCandleOpenTime) {
    diagnostics.push(`Intrabar manifest start does not match its exit candle for ${manifest.symbol}.`);
  }
  if (manifest.requestedEndTime !== manifest.exitCandleOpenTime + 60 * 60 * 1000 - 1) {
    diagnostics.push(`Intrabar manifest end does not cover exactly one 1H candle for ${manifest.symbol}.`);
  }
  if (manifest.actualStartTime !== manifest.requestedStartTime || manifest.actualEndTime !== manifest.requestedEndTime) {
    diagnostics.push(`Intrabar manifest actual boundaries do not match the requested window for ${manifest.symbol}.`);
  }
  if (!hasValidChecksum(manifest)) diagnostics.push(`Intrabar manifest checksum is invalid for ${manifest.symbol}.`);
}

function findManifest(
  manifests: readonly HistoricalManifest[],
  symbol: ResearchSymbol,
  kind: HistoricalManifest["kind"],
  timeframe: "1h" | "4h" | "funding",
  settlementOnly: boolean,
): HistoricalManifest | undefined {
  return manifests.find((manifest) => {
    if (
      manifest.provider !== HISTORICAL_PROVIDER ||
      manifest.symbol !== symbol ||
      manifest.kind !== kind ||
      manifest.settlementOnly !== settlementOnly
    ) {
      return false;
    }
    if (kind === "candles") {
      return manifest.kind === "candles" && manifest.timeframe === timeframe;
    }
    return timeframe === "funding";
  });
}

function requireManifest(
  manifests: readonly HistoricalManifest[],
  diagnostics: string[],
  symbol: ResearchSymbol,
  kind: HistoricalManifest["kind"],
  timeframe: "1h" | "4h" | "funding",
  settlementOnly: boolean,
  label: string,
): HistoricalManifest | undefined {
  const manifest = findManifest(manifests, symbol, kind, timeframe, settlementOnly);
  if (!manifest) {
    diagnostics.push(`Required ${label} manifest is missing for ${symbol}.`);
    return undefined;
  }
  if (!hasValidChecksum(manifest)) {
    diagnostics.push(`Required ${label} manifest checksum is invalid for ${symbol}.`);
  }
  return manifest;
}

function validateRequiredMarkPriceManifest(
  manifests: readonly HistoricalManifest[],
  period: BacktestPeriod,
  requirement: BacktestFallbackManifestRequirement,
  diagnostics: string[],
): void {
  const ranges = buildHistoricalLoadRanges(period);
  const expectedRange =
    requirement.segment === "base" ? ranges.markPriceRange : ranges.settlementTail?.markPriceRange;
  if (!expectedRange) {
    diagnostics.push(
      `A settlement-tail mark-price manifest is not valid for the ${period} period (${requirement.symbol}).`,
    );
    return;
  }

  const expectedSettlementOnly = expectedRange.settlementOnly ?? false;
  const manifest = manifests.find(
    (candidate): candidate is Extract<HistoricalManifest, { kind: "mark-price" }> =>
      candidate.kind === "mark-price" &&
      candidate.provider === HISTORICAL_PROVIDER &&
      candidate.source === "/fapi/v1/markPriceKlines" &&
      candidate.timeframe === "1h" &&
      candidate.symbol === requirement.symbol &&
      candidate.requestedStartTime === expectedRange.startTime &&
      // A future candidate may require a longer settlement-only tail than the
      // legacy 24-candle policy. Extra coverage is safe; the base range stays
      // exact so fallback provenance cannot silently widen the study window.
      (expectedSettlementOnly
        ? candidate.requestedEndTime >= expectedRange.endTime
        : candidate.requestedEndTime === expectedRange.endTime) &&
      candidate.settlementOnly === expectedSettlementOnly,
  );

  if (!manifest) {
    diagnostics.push(
      `Required ${requirement.segment} mark-price manifest is missing or does not match the official source, symbol, or frozen range for ${requirement.symbol}.`,
    );
    return;
  }
  if (!hasValidChecksum(manifest)) {
    diagnostics.push(`Required ${requirement.segment} mark-price manifest checksum is invalid for ${requirement.symbol}.`);
  }
}

export function validateRequiredMarkPriceManifestCoverage(
  manifests: readonly HistoricalManifest[] | undefined,
  period: BacktestPeriod,
  requirements: readonly BacktestFallbackManifestRequirement[],
): ManifestCoverage {
  const diagnostics: string[] = [];
  const provided = manifests ?? [];
  const uniqueRequirements = new Map<string, BacktestFallbackManifestRequirement>();
  for (const requirement of requirements) {
    uniqueRequirements.set(`${requirement.segment}:${requirement.symbol}`, requirement);
  }
  for (const requirement of uniqueRequirements.values()) {
    validateRequiredMarkPriceManifest(provided, period, requirement, diagnostics);
  }
  return Object.freeze({ valid: diagnostics.length === 0, diagnostics: Object.freeze(diagnostics) });
}

export function validateIntrabarSettlementManifestCoverage(
  manifests: readonly HistoricalManifest[] | undefined,
  requirements: readonly BacktestIntrabarManifestRequirement[],
): ManifestCoverage {
  const diagnostics: string[] = [];
  const provided = manifests ?? [];
  const unique = new Map<string, BacktestIntrabarManifestRequirement>();
  for (const requirement of requirements) {
    const key = intrabarSettlementIdentityKey(requirement);
    const existing = unique.get(key);
    if (existing && existing.settlementOnly !== requirement.settlementOnly) {
      diagnostics.push(`Conflicting settlementOnly classification for intrabar requirement ${key}.`);
      continue;
    }
    unique.set(key, requirement);
  }
  for (const requirement of unique.values()) {
    const manifest = provided.find(
      (candidate): candidate is Extract<HistoricalManifest, { kind: "intrabar-settlement" }> =>
        candidate.kind === "intrabar-settlement" &&
        candidate.provider === HISTORICAL_PROVIDER &&
        candidate.source === "/fapi/v1/klines" &&
        candidate.timeframe === "1m" &&
        candidate.symbol === requirement.symbol &&
        candidate.exitCandleOpenTime === requirement.exitCandleOpenTime &&
        candidate.requestedStartTime === requirement.exitCandleOpenTime &&
        candidate.requestedEndTime === requirement.exitCandleCloseTime &&
        candidate.settlementOnly === requirement.settlementOnly,
    );
    if (!manifest) {
      diagnostics.push(`Required intrabar settlement manifest is missing or does not match the frozen window for ${requirement.symbol} at ${requirement.exitCandleOpenTime}.`);
      continue;
    }
    validateProvidedIntrabarManifest(manifest, diagnostics);
  }
  return Object.freeze({ valid: diagnostics.length === 0, diagnostics: Object.freeze(diagnostics) });
}

export function validateRequiredManifestCoverage(
  manifests: readonly HistoricalManifest[] | undefined,
  period: BacktestPeriod,
  fallbackRequirements: readonly BacktestFallbackManifestRequirement[] = [],
  intrabarRequirements: readonly BacktestIntrabarManifestRequirement[] = [],
): ManifestCoverage {
  const diagnostics: string[] = [];
  const provided = manifests ?? [];
  for (const manifest of provided) {
    if (manifest.kind === "mark-price") {
      // Unused mark-price paths stay optional, but a provided manifest is still
      // provenance and must not be allowed to carry malformed metadata.
      validateProvidedMarkPriceManifest(manifest, diagnostics);
      continue;
    }
    if (manifest.kind === "intrabar-settlement") {
      validateProvidedIntrabarManifest(manifest, diagnostics);
      continue;
    }
    if (manifest.provider !== HISTORICAL_PROVIDER) {
      diagnostics.push(`Manifest provider is not ${HISTORICAL_PROVIDER}.`);
    }
    if (!hasValidChecksum(manifest)) {
      diagnostics.push(`Manifest checksum is invalid for ${manifest.symbol}.`);
    }
  }

  const basePeriodEnd = period === "DEV" ? BACKTEST_PERIOD_RANGES.DEV.endTime : BACKTEST_PERIOD_RANGES.OOS.endTime;
  const baseFunding = new Map<ResearchSymbol, HistoricalManifest>();
  for (const symbol of RESEARCH_SYMBOLS) {
    requireManifest(provided, diagnostics, symbol, "candles", "1h", false, "base 1H candle");
    requireManifest(provided, diagnostics, symbol, "candles", "4h", false, "base 4H candle");
    const funding = requireManifest(provided, diagnostics, symbol, "funding", "funding", false, "base funding");
    if (funding) {
      baseFunding.set(symbol, funding);
      if (funding.requestedEndTime !== basePeriodEnd) {
        diagnostics.push(`Base funding manifest does not cover the exact ${period} period end for ${symbol}.`);
      }
    }
  }

  if (period !== "DEV") {
    const tailStart = BACKTEST_PERIOD_RANGES.OOS.endTime + 1;
    const tailFundingEnd =
      BACKTEST_PERIOD_RANGES.OOS.endTime + BACKTEST_POLICY.heldCandleCount * 60 * 60 * 1000;
    const tailCandleEnd =
      Math.floor(BACKTEST_PERIOD_RANGES.OOS.endTime / (60 * 60 * 1000)) * (60 * 60 * 1000) +
      BACKTEST_POLICY.heldCandleCount * 60 * 60 * 1000;
    for (const symbol of RESEARCH_SYMBOLS) {
      const tailCandles = requireManifest(
        provided,
        diagnostics,
        symbol,
        "candles",
        "1h",
        true,
        "settlement-only 1H candle",
      );
      if (tailCandles && tailCandles.requestedEndTime < tailCandleEnd) {
        diagnostics.push(`Settlement-only 1H coverage does not reach held candle #24 for ${symbol}.`);
      }
      const tailFunding = requireManifest(
        provided,
        diagnostics,
        symbol,
        "funding",
        "funding",
        true,
        "settlement-only funding",
      );
      const baseFundingManifest = baseFunding.get(symbol);
      if (tailFunding) {
        if (tailFunding.requestedStartTime !== tailStart) {
          diagnostics.push(`Settlement-only funding does not start immediately after OOS for ${symbol}.`);
        }
        if (tailFunding.requestedEndTime < tailFundingEnd) {
          diagnostics.push(`Settlement-only funding does not cover the held #24 settlement boundary for ${symbol}.`);
        }
        if (baseFundingManifest && tailFunding.requestedStartTime !== baseFundingManifest.requestedEndTime + 1) {
          diagnostics.push(`Base and settlement-only funding coverage has a gap for ${symbol}.`);
        }
      }
    }
  }

  const markPriceCoverage = validateRequiredMarkPriceManifestCoverage(provided, period, fallbackRequirements);
  diagnostics.push(...markPriceCoverage.diagnostics);
  const intrabarCoverage = validateIntrabarSettlementManifestCoverage(provided, intrabarRequirements);
  diagnostics.push(...intrabarCoverage.diagnostics);

  return Object.freeze({ valid: diagnostics.length === 0, diagnostics: Object.freeze(diagnostics) });
}
