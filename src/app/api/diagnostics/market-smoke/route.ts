import {
  BinanceMarketDataProvider,
  MARKET_TIMEFRAMES,
  type MarketSnapshot,
  type MarketTimeframe,
} from "@/lib/market-data";
import { RESEARCH_SYMBOLS, type ResearchSymbol } from "@/lib/config/constants";
import { isAuthorizedCronRequest } from "@/lib/security/cron";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type DiagnosticDataset = Readonly<{
  status: "VALID" | "INVALID";
  closedCandleCount: number;
  errorCode: string | null;
}>;

function invalidDataset(errorCode: string): DiagnosticDataset {
  return {
    status: "INVALID",
    closedCandleCount: 0,
    errorCode,
  };
}

function summarizeDataset(
  snapshot: MarketSnapshot,
  symbol: ResearchSymbol,
  timeframe: MarketTimeframe,
): DiagnosticDataset {
  const symbolResult = snapshot.symbols[symbol];
  if (symbolResult.status === "VALID") {
    return {
      status: "VALID",
      closedCandleCount: symbolResult.datasets[timeframe].candles.length,
      errorCode: null,
    };
  }

  const datasetResult = symbolResult.datasets[timeframe];
  return datasetResult.status === "VALID"
    ? {
        status: "VALID",
        closedCandleCount: datasetResult.dataset.candles.length,
        errorCode: null,
      }
    : invalidDataset(datasetResult.error.code);
}

function summarizeSnapshot(snapshot: MarketSnapshot) {
  return Object.fromEntries(
    RESEARCH_SYMBOLS.flatMap((symbol) =>
      MARKET_TIMEFRAMES.map((timeframe) => [
        `${symbol} ${timeframe}`,
        summarizeDataset(snapshot, symbol, timeframe),
      ]),
    ),
  );
}

function diagnosticHeaders(): HeadersInit {
  return { "Cache-Control": "no-store" };
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const runtimeRegion = process.env.VERCEL_REGION ?? "unknown";

  try {
    const snapshot = await new BinanceMarketDataProvider().getMarketSnapshot();

    return Response.json(
      {
        ok: snapshot.status === "VALID",
        runtime: "nodejs",
        nodeVersion: process.version,
        region: runtimeRegion,
        serverTime: snapshot.serverTime?.serverTime ?? null,
        snapshotStatus: snapshot.status,
        latencyMs: snapshot.diagnostics.roundTripMs,
        datasets: summarizeSnapshot(snapshot),
        errorCode: snapshot.error?.code ?? null,
      },
      { headers: diagnosticHeaders() },
    );
  } catch {
    return Response.json(
      {
        ok: false,
        runtime: "nodejs",
        nodeVersion: process.version,
        region: runtimeRegion,
        serverTime: null,
        snapshotStatus: "INVALID",
        latencyMs: null,
        datasets: Object.fromEntries(
          RESEARCH_SYMBOLS.flatMap((symbol) =>
            MARKET_TIMEFRAMES.map((timeframe) => [
              `${symbol} ${timeframe}`,
              invalidDataset("INVALID_RESPONSE"),
            ]),
          ),
        ),
        errorCode: "INVALID_RESPONSE",
      },
      { headers: diagnosticHeaders() },
    );
  }
}
