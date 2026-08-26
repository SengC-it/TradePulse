import { isAuthorizedCronRequest } from "@/lib/security/cron";
import {
  createDefaultSignalReviewRunDependencies,
  runDailySignalReview,
} from "@/lib/signal-review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = { "Cache-Control": "no-store" };

export async function GET() {
  return Response.json(
    { error: "method_not_allowed" },
    { status: 405, headers: noStoreHeaders },
  );
}

export async function POST(request: Request) {
  if (!isAuthorizedCronRequest(request, process.env.CRON_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers: noStoreHeaders });
  }

  try {
    const result = await runDailySignalReview({
      dependencies: createDefaultSignalReviewRunDependencies(),
    });
    const status = result.outcome === "FAILED" ? 500 : result.outcome === "PARTIAL" ? 503 : 200;
    return Response.json(result, { status, headers: noStoreHeaders });
  } catch {
    return Response.json(
      { outcome: "FAILED", error: "SIGNAL_REVIEW_CONFIGURATION_OR_RUNTIME_FAILURE" },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
