import { isAuthorizedCronRequest } from "@/lib/security/cron";
import {
  createDefaultSignalAdvisoryScanDependencies,
  runSignalAdvisoryScan,
} from "@/lib/signal-advisory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSignalAdvisoryScan({
      dependencies: createDefaultSignalAdvisoryScanDependencies(),
    });
    const status = result.outcome === "FAILED" ? 500 : result.outcome === "PARTIAL" ? 503 : 200;

    return Response.json(result, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json(
      {
        outcome: "FAILED",
        error: "SIGNAL_ADVISORY_CONFIGURATION_OR_RUNTIME_FAILURE",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
