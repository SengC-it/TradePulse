import { isAuthorizedCronRequest } from "@/lib/security/cron";
import {
  classifySmtpSmokeFailure,
  isSmtpSmokeRecipientMismatch,
  sendSmtpSmokeEmail,
  type SmtpSmokeSendResult,
} from "@/lib/signal-advisory/smtp-smoke";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RESPONSE_HEADERS = { "Cache-Control": "no-store" };
const MASKED_RECIPIENT = "s***@qq.com";

type SmtpSmokeRouteDependencies = Readonly<{
  sendSmtpSmokeEmail: () => Promise<SmtpSmokeSendResult>;
}>;

const defaultDependencies: SmtpSmokeRouteDependencies = {
  sendSmtpSmokeEmail: () => sendSmtpSmokeEmail(),
};

function json(body: unknown, status: number): Response {
  return Response.json(body, { status, headers: RESPONSE_HEADERS });
}

function isAuthorizedSmtpSmokeRequest(request: Request): boolean {
  const diagnosticSecret = request.headers.get("x-tradepulse-smtp-smoke-secret");
  if (!diagnosticSecret) {
    return false;
  }

  const authorizationRequest = new Request(request.url, {
    method: request.method,
    headers: { authorization: `Bearer ${diagnosticSecret}` },
  });

  return isAuthorizedCronRequest(
    authorizationRequest,
    process.env.TRADEPULSE_SMTP_SMOKE_SECRET,
  );
}

export async function handlePost(
  request: Request,
  dependencies: SmtpSmokeRouteDependencies = defaultDependencies,
): Promise<Response> {
  if (!isAuthorizedSmtpSmokeRequest(request)) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    await dependencies.sendSmtpSmokeEmail();

    return json(
      {
        ok: true,
        smtpAuth: "SUCCESS",
        recipient: MASKED_RECIPIENT,
        messageIdPresent: true,
      },
      200,
    );
  } catch (error) {
    if (isSmtpSmokeRecipientMismatch(error)) {
      return json(
        { ok: false, errorCode: "SMTP_SMOKE_RECIPIENT_MISMATCH" },
        409,
      );
    }

    return json(
      {
        ok: false,
        smtpAuth: "FAILED",
        ...classifySmtpSmokeFailure(error),
      },
      502,
    );
  }
}

export function GET(): Response {
  return json({ error: "method_not_allowed" }, 405);
}

export function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
