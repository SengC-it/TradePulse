import path from "node:path";

import type { BinanceResponse } from "../src/lib/market-data/binance/client.ts";
import { Round006CachedBinanceClient, runRound006PublicDataPreflight } from "../src/lib/research/m3-r6-round-006-data.ts";

const DEFAULT_SERVER_TIME = 1787801312279;

class R9PreflightCacheClient extends Round006CachedBinanceClient {
  private readonly serverTime: number;

  constructor(cacheDirectory: string, serverTime: number) {
    super({ cacheDirectory });
    this.serverTime = serverTime;
  }

  override async getServerTime(): Promise<BinanceResponse<{ serverTime: number }>> {
    return Object.freeze({
      data: Object.freeze({ serverTime: this.serverTime }),
      diagnostics: Object.freeze({ endpoint: "/fapi/v1/time", operationStartedAt: 0, attemptStartedAt: 0, attemptCompletedAt: 0, roundTripMs: 0, attempts: 1 }),
    });
  }
}

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const cacheDirectory = argument("--cache-directory") ?? path.resolve(process.cwd(), ".cache", "tradepulse", "round-006");
const parsedServerTime = Number(argument("--study-server-time") ?? DEFAULT_SERVER_TIME);
if (!Number.isSafeInteger(parsedServerTime) || parsedServerTime <= 0) throw new Error("--study-server-time must be a positive safe integer.");

const client = new R9PreflightCacheClient(cacheDirectory, parsedServerTime);
const report = await runRound006PublicDataPreflight(client);
console.log(JSON.stringify({ ...report, cacheDirectory, network: "PRELOCK_ONLY" }, null, 2));
