import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { MARKET_TIMEFRAMES } from "../src/lib/market-data/intervals.ts";
import { BinanceMarketDataProvider } from "../src/lib/market-data/binance/provider.ts";

const provider = new BinanceMarketDataProvider();
const snapshot = await provider.getMarketSnapshot();

console.log(`Snapshot status: ${snapshot.status}`);
console.log(`Provider: ${snapshot.provider}`);
console.log(
  `Binance Server Time: ${snapshot.serverTime ? new Date(snapshot.serverTime.serverTime).toISOString() : "UNAVAILABLE"}`,
);

for (const symbol of RESEARCH_SYMBOLS) {
  const symbolResult = snapshot.symbols[symbol];
  for (const timeframe of MARKET_TIMEFRAMES) {
    const datasetResult =
      symbolResult.status === "VALID"
        ? { status: "VALID" as const, dataset: symbolResult.datasets[timeframe] }
        : symbolResult.datasets[timeframe];

    if (datasetResult.status === "INVALID") {
      console.log(`${symbol} ${timeframe} INVALID ${datasetResult.error.code}: ${datasetResult.error.message}`);
      continue;
    }

    const first = datasetResult.dataset.candles[0];
    const last = datasetResult.dataset.candles[datasetResult.dataset.candles.length - 1];
    console.log(
      [
        symbol,
        timeframe,
        "VALID",
        `closed=${datasetResult.dataset.candles.length}`,
        `firstOpenTime=${first.openTime}`,
        `lastOpenTime=${last.openTime}`,
        `lastClose=${last.close}`,
      ].join(" "),
    );
  }
}

console.log(`Latency: ${snapshot.diagnostics.roundTripMs}ms`);
process.exitCode = snapshot.status === "VALID" ? 0 : 1;
