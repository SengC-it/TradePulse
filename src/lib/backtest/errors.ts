export const BACKTEST_ERROR_CODES = [
  "DATA_INCOMPLETE",
  "SETTLEMENT_AMBIGUOUS",
  "INVALID_INPUT",
  "INVALID_VERSION",
] as const;

export type BacktestErrorCode = (typeof BACKTEST_ERROR_CODES)[number];

export class BacktestError extends Error {
  readonly code: BacktestErrorCode;

  constructor(code: BacktestErrorCode, message: string) {
    super(message);
    this.name = "BacktestError";
    this.code = code;
  }
}
