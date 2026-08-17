import type { BacktestSignalResult } from "../backtest/types.ts";
import type { NormalizedResearchSignal } from "./types.ts";
import { deepFreeze } from "./utils.ts";

export function adaptBacktestSignalResult(result: BacktestSignalResult): NormalizedResearchSignal {
  return deepFreeze({
    signalTime: result.snapshot.signalTime,
    symbol: result.snapshot.symbol,
    direction: result.snapshot.direction,
    symbolRegime: result.snapshot.symbolRegime,
    btcRegime: result.snapshot.btcRegime,
    totalScore: result.snapshot.totalScore,
    grade: result.snapshot.grade,
    status: result.status,
    entryTime: result.entryTime,
    exitTime: result.exitTime,
    grossR: result.grossR,
    feeR: result.feeR,
    fundingR: result.fundingR,
    netR: result.netR,
  });
}
