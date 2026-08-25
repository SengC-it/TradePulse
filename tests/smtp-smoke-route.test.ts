import { readFileSync } from "node:fs";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  SMTP_SMOKE_RECIPIENT,
  SMTP_SMOKE_RECIPIENT_MISMATCH,
  sendSmtpSmokeEmail,
} from "@/lib/signal-advisory/smtp-smoke";
import { GET, handlePost } from "@/app/api/diagnostics/smtp-smoke/route";

const SECRET = "smtp-smoke-test-secret";
const SMTP_CONFIGURATION = {
  host: "smtp.gmail.com",
  port: 587,
  user: "zunxian.chi@gmail.com",
  appPassword: "never-return-this",
  from: "Trade Pulse <zunxian.chi@gmail.com>",
  to: SMTP_SMOKE_RECIPIENT,
};

const originalSecret = process.env.TRADEPULSE_SMTP_SMOKE_SECRET;

function request(
  method = "POST",
  secret: string | undefined = SECRET,
): Request {
  const headers = new Headers();
  if (secret !== undefined) {
    headers.set("x-tradepulse-smtp-smoke-secret", secret);
  }

  return new Request("https://example.test/api/diagnostics/smtp-smoke", {
    method,
    headers,
  });
}

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.TRADEPULSE_SMTP_SMOKE_SECRET;
  } else {
    process.env.TRADEPULSE_SMTP_SMOKE_SECRET = originalSecret;
  }
  vi.restoreAllMocks();
});

describe("SMTP smoke sender", () => {
  it("uses only the approved recipient and fixed simulation content", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "<smtp-smoke-message-id>" });

    await expect(
      sendSmtpSmokeEmail({
        configuration: SMTP_CONFIGURATION,
        transport: { sendMail },
      }),
    ).resolves.toEqual({ emailMessageId: "<smtp-smoke-message-id>" });

    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail.mock.calls[0]?.[0]).toMatchObject({
      from: {
        name: "Trade Pulse",
        address: "zunxian.chi@gmail.com",
      },
      to: SMTP_SMOKE_RECIPIENT,
      subject: "【模拟测试】TradePulse Production SMTP 验证",
      text: expect.stringContaining("这是一封系统邮件发送验证，不是真实交易信号。"),
    });
    expect(sendMail.mock.calls[0]?.[0].text).toContain("系统不会自动下单。");
  });

  it("fails closed before sendMail when the recipient is not approved", async () => {
    const sendMail = vi.fn();

    await expect(
      sendSmtpSmokeEmail({
        configuration: { ...SMTP_CONFIGURATION, to: "zunxian.chi@gmail.com" },
        transport: { sendMail },
      }),
    ).rejects.toMatchObject({ code: SMTP_SMOKE_RECIPIENT_MISMATCH });

    expect(sendMail).not.toHaveBeenCalled();
  });

  it("keeps the fixed sender name when ALERT_EMAIL_FROM has a wrong display name", async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: "<smtp-smoke-message-id>" });

    await sendSmtpSmokeEmail({
      configuration: {
        ...SMTP_CONFIGURATION,
        from: "zunxian.chi zunxian.chi@gmail.com",
      },
      transport: { sendMail },
    });

    expect(sendMail.mock.calls[0]?.[0].from).toEqual({
      name: "Trade Pulse",
      address: "zunxian.chi@gmail.com",
    });
  });
});

describe("SMTP smoke route", () => {
  it("returns 401 when the dedicated secret is not configured", async () => {
    delete process.env.TRADEPULSE_SMTP_SMOKE_SECRET;
    const send = vi.fn();

    const response = await handlePost(request(), {
      sendSmtpSmokeEmail: send,
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(send).not.toHaveBeenCalled();
  });

  it("returns 401 when the dedicated secret is missing", async () => {
    process.env.TRADEPULSE_SMTP_SMOKE_SECRET = SECRET;
    const send = vi.fn();

    const response = await handlePost(request("POST", ""), {
      sendSmtpSmokeEmail: send,
    });

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(send).not.toHaveBeenCalled();
  });

  it("returns 401 for an invalid dedicated secret", async () => {
    process.env.TRADEPULSE_SMTP_SMOKE_SECRET = SECRET;
    const send = vi.fn();

    const response = await handlePost(request("POST", "wrong-secret"), {
      sendSmtpSmokeEmail: send,
    });

    expect(response.status).toBe(401);
    expect(send).not.toHaveBeenCalled();
  });

  it("executes the sender with a valid dedicated secret and masks response data", async () => {
    process.env.TRADEPULSE_SMTP_SMOKE_SECRET = SECRET;
    const send = vi.fn().mockResolvedValue({ emailMessageId: "<secret-message-id>" });

    const response = await handlePost(request(), { sendSmtpSmokeEmail: send });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      ok: true,
      smtpAuth: "SUCCESS",
      recipient: "s***@qq.com",
      messageIdPresent: true,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(JSON.stringify(body)).not.toContain("secret-message-id");
    expect(JSON.stringify(body)).not.toContain("never-return-this");
    expect(send).toHaveBeenCalledOnce();
  });

  it("does not send on GET", async () => {
    const response = GET();

    expect(response.status).toBe(405);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "method_not_allowed" });
  });

  it("maps EAUTH 535 to a safe response", async () => {
    process.env.TRADEPULSE_SMTP_SMOKE_SECRET = SECRET;
    const send = vi.fn().mockRejectedValue({
      code: "EAUTH",
      responseCode: 535,
      message: "password must never be returned",
    });

    const response = await handlePost(request(), { sendSmtpSmokeEmail: send });
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      smtpAuth: "FAILED",
      errorCode: "EAUTH",
      responseCode: 535,
    });
    expect(JSON.stringify(body)).not.toContain("password");
  });

  it("maps connection and timeout failures without exposing raw errors", async () => {
    process.env.TRADEPULSE_SMTP_SMOKE_SECRET = SECRET;

    const connectionResponse = await handlePost(request(), {
      sendSmtpSmokeEmail: vi.fn().mockRejectedValue({ code: "ECONNECTION", message: "secret" }),
    });
    const timeoutResponse = await handlePost(request(), {
      sendSmtpSmokeEmail: vi.fn().mockRejectedValue({ code: "ETIMEDOUT", message: "secret" }),
    });
    const connectionBody = await connectionResponse.json();
    const timeoutBody = await timeoutResponse.json();

    expect(connectionBody).toMatchObject({ errorCode: "ECONNECTION" });
    expect(timeoutBody).toMatchObject({ errorCode: "ETIMEDOUT" });
    expect(JSON.stringify(connectionBody)).not.toContain("secret");
  });

  it("has no signal scan or database-store dependency", () => {
    const routeSource = readFileSync(
      new URL("../src/app/api/diagnostics/smtp-smoke/route.ts", import.meta.url),
      "utf8",
    );
    const senderSource = readFileSync(
      new URL("../src/lib/signal-advisory/smtp-smoke.ts", import.meta.url),
      "utf8",
    );

    expect(routeSource).not.toContain("runSignalAdvisoryScan");
    expect(routeSource).not.toContain("createSignalAdvisoryStore");
    expect(senderSource).not.toContain("tp_signal_advisories");
    expect(senderSource).not.toContain("tp_scan_runs");
  });
});
