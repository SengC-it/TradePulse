import { createHash } from "node:crypto";

import type { AdvisoryDirection } from "./types.ts";

export function buildDeterministicSignalId(input: {
  symbol: string;
  direction: AdvisoryDirection;
  signalTime: string;
  strategyVersion: string;
}): string {
  const identity = [
    input.symbol,
    input.direction,
    input.signalTime,
    input.strategyVersion,
  ].join("|");

  return createHash("sha256").update(identity, "utf8").digest("hex");
}
