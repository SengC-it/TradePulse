import { getDashboardAccess } from "@/lib/dashboard/access";
import {
  createDefaultR22HumanReviewDependencies,
  submitHumanReview,
} from "@/lib/human-review/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const access = await getDashboardAccess();
  if (!access.authenticated) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!access.authorized) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const record = body && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null;
  const signalId = record?.signalId;
  const labels = record?.humanReview;
  if (typeof signalId !== "string" || signalId.trim().length === 0) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  try {
    const result = await submitHumanReview({
      signalId,
      labels,
      dependencies: createDefaultR22HumanReviewDependencies(),
    });
    return Response.json(result, {
      status: result.status === "NOT_EVALUABLE" ? 422 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ error: "human_review_submit_failed" }, { status: 500 });
  }
}
