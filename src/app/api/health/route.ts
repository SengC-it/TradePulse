import { createHealthPayload } from "@/lib/health";
import { createSignalAdvisoryStore } from "@/lib/signal-advisory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const databaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY,
  );
  let advisory;

  if (databaseConfigured) {
    try {
      advisory = await createSignalAdvisoryStore().getHealth();
    } catch {
      advisory = {
        lastSuccessfulScan: null,
        lastEmailSent: null,
        lastError: "HEALTH_CHECK_FAILED",
        strategyVersion: process.env.STRATEGY_VERSION ?? "baseline-001",
      };
    }
  }

  return Response.json(
    createHealthPayload({
      environment:
        process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      databaseConfigured,
      advisory,
    }),
  );
}
