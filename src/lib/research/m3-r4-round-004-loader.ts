import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import { INTERVAL_MS } from "../market-data/intervals.ts";
import type { Candle } from "../market-data/types.ts";
import type { BacktestData } from "../backtest/types.ts";
import { buildHistoricalLoadRanges } from "../backtest/ranges.ts";
import { BinanceHistoricalDataLoader } from "../historical-data/binance/loader.ts";
import {
  validateFundingRecords,
  validateHistoricalCandleSeries,
} from "../historical-data/validation.ts";
import type {
  HistoricalFundingRecord,
  HistoricalIntrabarSettlementWindow,
  HistoricalManifest,
  HistoricalMarkPriceCandle,
  HistoricalMarkPriceSegment,
  HistoricalRange,
  HistoricalStudyData,
} from "../historical-data/types.ts";

export const M3_R4_C_PROTOCOL_BASE_MAIN_SHA =
  "fd42381d903f9b60ec98e7b297578de95dc8160b" as const;
export const M3_R4_C_SETTLEMENT_EXTENSION_TAG = "SETTLEMENT_ONLY" as const;
export const M3_R4_C_STANDARD_POLICY = "bt-policy-003" as const;
export const M3_R4_H11_SUPPORT_MAX_OFFSET_MS = 4 * INTERVAL_MS["1h"];

export type Round004HistoricalLoader = Pick<
  BinanceHistoricalDataLoader,
  | "loadStudyData"
  | "loadCandles"
  | "loadFunding"
  | "loadMarkPriceKlines"
  | "loadIntrabarSettlementWindows"
>;

export type Round004SettlementExtensionRanges = Readonly<{
  candleRange: HistoricalRange;
  fundingRange: HistoricalRange;
  markPriceRange: HistoricalRange;
}>;

export type Round004SettlementExtension = Readonly<{
  tag: typeof M3_R4_C_SETTLEMENT_EXTENSION_TAG;
  serverTime: number;
  ranges: Round004SettlementExtensionRanges;
  candles1h: Readonly<Record<ResearchSymbol, readonly Candle[]>>;
  funding: Readonly<Record<ResearchSymbol, readonly HistoricalFundingRecord[]>>;
  markPrice: Readonly<Record<ResearchSymbol, readonly HistoricalMarkPriceCandle[] | undefined>>;
  markPriceSegments: Readonly<Record<ResearchSymbol, readonly HistoricalMarkPriceSegment[] | undefined>>;
  manifests: readonly HistoricalManifest[];
}>;

export type Round004LoadedStudy = Readonly<{
  standard: HistoricalStudyData;
  settlementExtension: Round004SettlementExtension;
  standardData: BacktestData;
  standardDataWithIntrabar: BacktestData;
  h13SettlementData: BacktestData;
  /** Compatibility alias for callers that need the complete H13 settlement view. */
  combinedData: BacktestData;
}>;

function freezeRecord<T>(record: Record<ResearchSymbol, T>): Readonly<Record<ResearchSymbol, T>> {
  return Object.freeze(record);
}

function isFiniteSafeTimestamp(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * Round-004 H11 origin support can evaluate up to four fully closed 1H
 * candles before an official evaluation time. Keep the frozen research and
 * settlement ranges unchanged, and extend only the two decision candle
 * ranges required to build that support window.
 */
export function buildRound004HistoricalLoadRanges(): ReturnType<typeof buildHistoricalLoadRanges> {
  const standard = buildHistoricalLoadRanges("COMBINED");
  const extendCandleRange = (timeframe: "1h" | "4h") => Object.freeze({
    ...standard.candleRange[timeframe],
    startTime: standard.candleRange[timeframe].startTime - M3_R4_H11_SUPPORT_MAX_OFFSET_MS,
  });
  return Object.freeze({
    ...standard,
    candleRange: Object.freeze({
      ...standard.candleRange,
      "1h": extendCandleRange("1h"),
      "4h": extendCandleRange("4h"),
    }),
  });
}

/**
 * The standard loader already owns the frozen 24-candle tail. The extension
 * begins at held #25 and ends at held #48; it is never a decision dataset.
 */
export function buildH13SettlementOnlyExtensionRanges(): Round004SettlementExtensionRanges {
  const standard = buildHistoricalLoadRanges("COMBINED");
  const standardTail = standard.settlementTail;
  if (!standardTail) throw new Error("Round-004 requires the standard OOS settlement tail.");
  const firstExtensionOpen = standardTail.candleRange.endTime + INTERVAL_MS["1h"];
  const lastExtensionOpen = standardTail.candleRange.endTime + 24 * INTERVAL_MS["1h"];
  const extension = {
    candleRange: {
      startTime: firstExtensionOpen,
      endTime: lastExtensionOpen,
      settlementOnly: true,
    },
    fundingRange: {
      startTime: firstExtensionOpen,
      endTime: lastExtensionOpen + INTERVAL_MS["1h"] - 1,
      settlementOnly: true,
    },
    markPriceRange: {
      startTime: firstExtensionOpen,
      endTime: lastExtensionOpen + INTERVAL_MS["1h"] - 1,
      settlementOnly: true,
    },
  } satisfies Round004SettlementExtensionRanges;
  return Object.freeze({
    candleRange: Object.freeze(extension.candleRange),
    fundingRange: Object.freeze(extension.fundingRange),
    markPriceRange: Object.freeze(extension.markPriceRange),
  });
}

function standardDataFromStudy(study: HistoricalStudyData): BacktestData {
  const datasets = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [
      symbol,
      Object.freeze({
        candles1h: study.datasets[symbol].candles1h.candles,
        candles4h: study.datasets[symbol].candles4h.candles,
      }),
    ]),
  ) as BacktestData["datasets"];
  const funding = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, study.funding[symbol].records]),
  ) as BacktestData["funding"];
  const markPrice = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, study.markPrice[symbol]?.candles]),
  ) as BacktestData["markPrice"];
  const markPriceSegments = Object.fromEntries(
    RESEARCH_SYMBOLS.map((symbol) => [symbol, study.markPriceSegments[symbol]]),
  ) as BacktestData["markPriceSegments"];
  return Object.freeze({
    datasets,
    funding,
    markPrice,
    markPriceSegments,
    manifests: study.manifests,
    serverTime: study.serverTime,
  });
}

function appendIntrabarWindowsToData(
  data: BacktestData,
  windows: readonly HistoricalIntrabarSettlementWindow[],
): BacktestData {
  return Object.freeze({
    ...data,
    intrabarSettlementWindows: Object.freeze([...windows]),
    manifests: Object.freeze([
      ...data.manifests,
      ...windows.map((window) => window.manifest),
    ]),
  });
}

function validateSettlementExtension(extension: Round004SettlementExtension): void {
  if (!isFiniteSafeTimestamp(extension.serverTime)) throw new Error("Settlement extension server time is invalid.");
  for (const range of Object.values(extension.ranges)) {
    if (!range.settlementOnly || !isFiniteSafeTimestamp(range.startTime) || !isFiniteSafeTimestamp(range.endTime) || range.endTime < range.startTime) {
      throw new Error("Round-004 settlement extension ranges must be ordered SETTLEMENT_ONLY ranges.");
    }
  }
  for (const manifest of extension.manifests) {
    if (!manifest.settlementOnly) throw new Error("Round-004 extension contains a non-settlement manifest.");
  }
  const firstOpen = extension.ranges.candleRange.startTime;
  const lastOpen = extension.ranges.candleRange.endTime;
  for (const symbol of RESEARCH_SYMBOLS) {
    const candles = extension.candles1h[symbol] ?? [];
    if (candles.some((candle) => candle.openTime < firstOpen || candle.openTime > lastOpen)) {
      throw new Error(`Round-004 extension candle escaped the frozen tail for ${symbol}.`);
    }
    const funding = extension.funding[symbol] ?? [];
    if (funding.some((record) => record.fundingTime < extension.ranges.fundingRange.startTime || record.fundingTime > extension.ranges.fundingRange.endTime)) {
      throw new Error(`Round-004 extension funding escaped the frozen tail for ${symbol}.`);
    }
    const markPrice = extension.markPrice[symbol] ?? [];
    if (markPrice.some((candle) => candle.openTime < extension.ranges.markPriceRange.startTime || candle.openTime > lastOpen)) {
      throw new Error(`Round-004 extension mark-price data escaped the frozen tail for ${symbol}.`);
    }
  }
}

async function loadSettlementExtension(
  loader: Round004HistoricalLoader,
  serverTime: number,
): Promise<Round004SettlementExtension> {
  const ranges = buildH13SettlementOnlyExtensionRanges();
  const loaded = await Promise.all(
    RESEARCH_SYMBOLS.map(async (symbol) => {
      const [candles, funding] = await Promise.all([
        loader.loadCandles({ symbol, timeframe: "1h", range: ranges.candleRange, serverTime }),
        loader.loadFunding({ symbol, range: ranges.fundingRange, policy: M3_R4_C_STANDARD_POLICY }),
      ]);
      const needsMarkPrice = funding.records.some(
        (record) => !(typeof record.directMarkPrice === "number" && Number.isFinite(record.directMarkPrice) && record.directMarkPrice > 0),
      );
      const markPrice = needsMarkPrice
        ? await loader.loadMarkPriceKlines({ symbol, range: ranges.markPriceRange, serverTime })
        : undefined;
      return { symbol, candles, funding, markPrice } as const;
    }),
  );
  const candles1h = {} as Record<ResearchSymbol, readonly Candle[]>;
  const funding = {} as Record<ResearchSymbol, readonly HistoricalFundingRecord[]>;
  const markPrice = {} as Record<ResearchSymbol, readonly HistoricalMarkPriceCandle[] | undefined>;
  const markPriceSegments = {} as Record<ResearchSymbol, readonly HistoricalMarkPriceSegment[] | undefined>;
  const manifests: HistoricalManifest[] = [];
  for (const item of loaded) {
    candles1h[item.symbol] = item.candles.candles;
    funding[item.symbol] = item.funding.records;
    manifests.push(item.candles.manifest, item.funding.manifest);
    if (item.markPrice) {
      markPrice[item.symbol] = item.markPrice.candles;
      markPriceSegments[item.symbol] = Object.freeze([
        Object.freeze({ segment: "settlement-tail", candles: item.markPrice.candles, manifest: item.markPrice.manifest }),
      ]);
      manifests.push(...item.markPrice.manifests);
    }
  }
  const extension: Round004SettlementExtension = Object.freeze({
    tag: M3_R4_C_SETTLEMENT_EXTENSION_TAG,
    serverTime,
    ranges,
    candles1h: freezeRecord(candles1h),
    funding: freezeRecord(funding),
    markPrice: freezeRecord(markPrice),
    markPriceSegments: freezeRecord(markPriceSegments),
    manifests: Object.freeze(manifests),
  });
  validateSettlementExtension(extension);
  return extension;
}

function combineStudyData(
  standard: HistoricalStudyData,
  extension: Round004SettlementExtension,
  intrabarSettlementWindows: readonly HistoricalIntrabarSettlementWindow[] = [],
): BacktestData {
  const datasets = {} as Record<ResearchSymbol, BacktestData["datasets"][ResearchSymbol]>;
  const funding = {} as Record<ResearchSymbol, readonly HistoricalFundingRecord[]>;
  const markPrice = {} as Record<ResearchSymbol, readonly HistoricalMarkPriceCandle[] | undefined>;
  const markPriceSegments = {} as Record<ResearchSymbol, readonly HistoricalMarkPriceSegment[] | undefined>;
  for (const symbol of RESEARCH_SYMBOLS) {
    const base = standard.datasets[symbol];
    const combinedCandles = validateHistoricalCandleSeries(
      [...base.candles1h.candles, ...(extension.candles1h[symbol] ?? [])],
      {
        symbol,
        timeframe: "1h",
        expectedStartTime: base.candles1h.candles[0]?.openTime,
        expectedEndTime: extension.candles1h[symbol]?.at(-1)?.openTime ?? base.candles1h.candles.at(-1)?.openTime,
        serverTime: standard.serverTime,
      },
    );
    datasets[symbol] = Object.freeze({ candles1h: combinedCandles, candles4h: base.candles4h.candles });
    funding[symbol] = validateFundingRecords(
      [...standard.funding[symbol].records, ...(extension.funding[symbol] ?? [])],
      { symbol, policy: M3_R4_C_STANDARD_POLICY },
    );
    const baseMark = standard.markPrice[symbol]?.candles ?? [];
    const extensionMark = extension.markPrice[symbol] ?? [];
    markPrice[symbol] = baseMark.length || extensionMark.length ? Object.freeze([...baseMark, ...extensionMark]) : undefined;
    const segments = [
      ...(standard.markPriceSegments[symbol] ?? []),
      ...(extension.markPriceSegments[symbol] ?? []),
    ];
    markPriceSegments[symbol] = segments.length ? Object.freeze(segments) : undefined;
  }
  return Object.freeze({
    datasets: Object.freeze(datasets),
    funding: Object.freeze(funding),
    markPrice: Object.freeze(markPrice),
    markPriceSegments: Object.freeze(markPriceSegments),
    intrabarSettlementWindows: Object.freeze([...intrabarSettlementWindows]),
    manifests: Object.freeze([...standard.manifests, ...extension.manifests, ...intrabarSettlementWindows.map((window) => window.manifest)]),
    serverTime: standard.serverTime,
  });
}

export async function loadRound004Study(
  loader: Round004HistoricalLoader = new BinanceHistoricalDataLoader(),
): Promise<Round004LoadedStudy> {
  const ranges = buildRound004HistoricalLoadRanges();
  const standard = await loader.loadStudyData({ ...ranges, policy: M3_R4_C_STANDARD_POLICY });
  const extension = await loadSettlementExtension(loader, standard.serverTime);
  const standardData = standardDataFromStudy(standard);
  const h13SettlementData = combineStudyData(standard, extension);
  const standardDataWithIntrabar = appendIntrabarWindowsToData(standardData, []);
  return Object.freeze({
    standard,
    settlementExtension: extension,
    standardData,
    standardDataWithIntrabar,
    h13SettlementData,
    combinedData: h13SettlementData,
  });
}

export async function loadRound004IntrabarWindows(
  loader: Round004HistoricalLoader,
  requirements: readonly import("../backtest/types.ts").IntrabarSettlementRequirement[],
  serverTime: number,
): Promise<readonly HistoricalIntrabarSettlementWindow[]> {
  return loader.loadIntrabarSettlementWindows(requirements, serverTime);
}

export function appendRound004IntrabarWindows(
  study: Round004LoadedStudy,
  windows: readonly HistoricalIntrabarSettlementWindow[],
): Round004LoadedStudy {
  const standardTailEnd = buildHistoricalLoadRanges("COMBINED").settlementTail?.candleRange.endTime ?? Number.MAX_SAFE_INTEGER;
  const standardWindows = windows.filter((window) => window.exitCandleOpenTime <= standardTailEnd);
  const standardDataWithIntrabar = appendIntrabarWindowsToData(study.standardData, standardWindows);
  const h13SettlementData = combineStudyData(study.standard, study.settlementExtension, windows);
  return Object.freeze({
    ...study,
    standardDataWithIntrabar,
    h13SettlementData,
    combinedData: h13SettlementData,
  });
}

export const toRound004BacktestData = standardDataFromStudy;
