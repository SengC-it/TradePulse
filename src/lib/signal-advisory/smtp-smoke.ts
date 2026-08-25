import type { SendMailOptions } from "nodemailer";

import {
  createDefaultTransport,
  getSmtpConfiguration,
  type SignalEmailTransport,
  type SmtpConfiguration,
} from "./email.ts";

export const SMTP_SMOKE_RECIPIENT = "sheng.chi@qq.com";
export const SMTP_SMOKE_RECIPIENT_MISMATCH = "SMTP_SMOKE_RECIPIENT_MISMATCH";

export type SmtpSmokeSendResult = Readonly<{
  emailMessageId: string;
}>;

type SmtpSmokeOptions = Readonly<{
  configuration?: SmtpConfiguration;
  transport?: SignalEmailTransport;
}>;

export async function sendSmtpSmokeEmail(
  options: SmtpSmokeOptions = {},
): Promise<SmtpSmokeSendResult> {
  const configuredRecipient = options.configuration?.to ?? process.env.ALERT_EMAIL_TO;
  if (configuredRecipient !== SMTP_SMOKE_RECIPIENT) {
    throw Object.assign(
      new Error(SMTP_SMOKE_RECIPIENT_MISMATCH),
      { code: SMTP_SMOKE_RECIPIENT_MISMATCH },
    );
  }

  const configuration = options.configuration ?? getSmtpConfiguration();
  const transport = options.transport ?? createDefaultTransport(configuration);
  const mail: SendMailOptions = {
    from: configuration.from,
    to: configuration.to,
    subject: "【模拟测试】TradePulse Production SMTP 验证",
    text: [
      "TradePulse 模拟邮件测试",
      "",
      "这是一封系统邮件发送验证，不是真实交易信号。",
      "",
      "如果你收到本邮件，说明 Production Gmail SMTP 配置和 QQ 收件链路正常。",
      "",
      "系统不会自动下单。",
    ].join("\n"),
  };
  const result = await transport.sendMail(mail);
  const emailMessageId = typeof result.messageId === "string" ? result.messageId.trim() : "";

  if (!emailMessageId) {
    throw new Error("SMTP smoke transport did not return an email message id.");
  }

  return { emailMessageId };
}

function readErrorProperty(error: unknown, property: string): unknown {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  return property in error ? (error as Record<string, unknown>)[property] : undefined;
}

export function isSmtpSmokeRecipientMismatch(error: unknown): boolean {
  return readErrorProperty(error, "code") === SMTP_SMOKE_RECIPIENT_MISMATCH;
}

export type SmtpSmokeFailure = Readonly<{
  errorCode: "EAUTH" | "ETIMEDOUT" | "ECONNECTION" | "SMTP_UNKNOWN";
  responseCode?: number;
}>;

export function classifySmtpSmokeFailure(error: unknown): SmtpSmokeFailure {
  const code = readErrorProperty(error, "code");
  const responseCode = readErrorProperty(error, "responseCode");
  const safeResponseCode = typeof responseCode === "number" && Number.isInteger(responseCode)
    ? responseCode
    : undefined;

  if (code === "EAUTH" || safeResponseCode === 535) {
    return {
      errorCode: "EAUTH",
      ...(safeResponseCode === undefined ? {} : { responseCode: safeResponseCode }),
    };
  }

  if (code === "ETIMEDOUT") {
    return { errorCode: "ETIMEDOUT" };
  }

  if (code === "ECONNECTION") {
    return { errorCode: "ECONNECTION" };
  }

  return { errorCode: "SMTP_UNKNOWN" };
}
