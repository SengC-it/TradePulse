import type { HistoricalFundingRecord } from "../historical-data/types.ts";
import type { BacktestFundingCharge, BacktestSignalSnapshot } from "./types.ts";

export type FundingExitReason = "TP" | "SL" | "TIME_EXIT";

export type FundingResolution = Readonly<{
  charges: readonly BacktestFundingCharge[];
  ambiguous: boolean;
}>;

export function resolveFundingCharges(input: Readonly<{
  funding: readonly HistoricalFundingRecord[];
  entryTime: number;
  exitReason: FundingExitReason;
  exitCandle: Readonly<{ openTime: number; closeTime: number }>;
  exitTime: number;
  direction: BacktestSignalSnapshot["direction"];
}>): FundingResolution {
  const charges: BacktestFundingCharge[] = [];
  for (const event of input.funding) {
    if (event.fundingTime <= input.entryTime) continue;

    if (input.exitReason !== "TIME_EXIT") {
      if (event.fundingTime > input.exitCandle.closeTime) continue;
      if (event.fundingTime > input.exitCandle.openTime) {
        return { charges: Object.freeze([]), ambiguous: true };
      }
    } else if (event.fundingTime > input.exitTime) {
      continue;
    }

    const fundingPnL =
      input.direction === "LONG"
        ? -event.fundingRate * event.markPrice
        : event.fundingRate * event.markPrice;
    if (!Number.isFinite(fundingPnL)) {
      throw new Error("Funding calculation produced a non-finite value.");
    }
    charges.push(
      Object.freeze({
        fundingTime: event.fundingTime,
        fundingRate: event.fundingRate,
        markPrice: event.markPrice,
        fundingPnL: Object.is(fundingPnL, -0) ? 0 : fundingPnL,
      }),
    );
  }
  return { charges: Object.freeze(charges), ambiguous: false };
}
