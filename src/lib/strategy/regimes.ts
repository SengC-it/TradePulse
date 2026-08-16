import type { BTCRegime, SymbolRegime } from "./types.ts";

export type SymbolRegimeInput = Readonly<{
  close: number | null;
  ema50: number | null;
  ema200: number | null;
  ema200FiveBarsAgo: number | null;
}>;

export type BTCRegimeInput = Readonly<
  SymbolRegimeInput & {
    atr14: number | null;
  }
>;

function finiteValues(values: readonly (number | null)[]): values is readonly number[] {
  return values.every((value) => value !== null && Number.isFinite(value));
}

export function calculateSymbolRegime(
  input: SymbolRegimeInput,
): SymbolRegime | null {
  const values = [
    input.close,
    input.ema50,
    input.ema200,
    input.ema200FiveBarsAgo,
  ];

  if (!finiteValues(values)) {
    return null;
  }

  const [close, ema50, ema200, ema200FiveBarsAgo] = values;

  if (
    close > ema200 &&
    ema50 > ema200 &&
    ema200 > ema200FiveBarsAgo
  ) {
    return "LONG_ONLY";
  }

  if (
    close < ema200 &&
    ema50 < ema200 &&
    ema200 < ema200FiveBarsAgo
  ) {
    return "SHORT_ONLY";
  }

  return "NO_TRADE";
}

export function calculateBTCRegime(input: BTCRegimeInput): BTCRegime | null {
  const values = [
    input.close,
    input.ema50,
    input.ema200,
    input.ema200FiveBarsAgo,
    input.atr14,
  ];

  if (!finiteValues(values)) {
    return null;
  }

  const [close, ema50, ema200, ema200FiveBarsAgo, atr14] = values;

  if (atr14 <= 0) {
    return null;
  }

  const bullCloseDistance = (close - ema200) / atr14;
  const bullEmaSpread = (ema50 - ema200) / atr14;
  const bullEmaSlope = (ema200 - ema200FiveBarsAgo) / atr14;
  const bearCloseDistance = (ema200 - close) / atr14;
  const bearEmaSpread = (ema200 - ema50) / atr14;
  const bearEmaSlope = (ema200FiveBarsAgo - ema200) / atr14;

  if (
    close > ema50 &&
    ema50 > ema200 &&
    bullCloseDistance >= 1 &&
    bullEmaSpread >= 0.5 &&
    bullEmaSlope >= 0.1
  ) {
    return "BTC_STRONG_BULL";
  }

  if (
    close < ema50 &&
    ema50 < ema200 &&
    bearCloseDistance >= 1 &&
    bearEmaSpread >= 0.5 &&
    bearEmaSlope >= 0.1
  ) {
    return "BTC_STRONG_BEAR";
  }

  return "BTC_NEUTRAL";
}
