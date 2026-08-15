import { createHealthPayload } from "@/lib/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  const databaseConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return Response.json(
    createHealthPayload({
      environment:
        process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      version: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
      databaseConfigured,
    }),
  );
}
