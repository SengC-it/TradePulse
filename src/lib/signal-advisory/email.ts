import nodemailer from "nodemailer";
import type { SendMailOptions, Transporter } from "nodemailer";

import type { SignalAdvisory } from "./types.ts";

export type SignalEmailTransport = Pick<Transporter, "sendMail">;

export const TRADEPULSE_SMTP_USER = "zunxian.chi@gmail.com";
export const TRADEPULSE_ALERT_EMAIL_TO = "sheng.chi@qq.com";
export const TRADEPULSE_EMAIL_FROM_NAME = "Trade Pulse";

export type RenderedSignalEmail = Readonly<{
  subject: string;
  text: string;
}>;

export type SmtpConfiguration = Readonly<{
  host: string;
  port: number;
  user: string;
  appPassword: string;
  from: string;
  to: string;
}>;

function requiredEnvironment(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required email environment variable: ${name}`);
  }
  return value;
}

function extractEmailAddress(value: string): string | null {
  const angleAddress = value.match(/<\s*([^<>\s]+@[^<>\s]+)\s*>/u)?.[1];
  if (angleAddress) {
    return angleAddress;
  }

  return value.match(/[^\s<>]+@[^\s<>]+/u)?.[0] ?? null;
}

function isValidEmailAddress(value: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/u.test(value);
}

export function validateSmtpConfiguration(configuration: SmtpConfiguration): void {
  if (!isValidEmailAddress(configuration.user)) {
    throw new Error("SMTP_USER must be a valid email address.");
  }

  if (configuration.user !== TRADEPULSE_SMTP_USER) {
    throw new Error(`SMTP_USER must be ${TRADEPULSE_SMTP_USER}.`);
  }

  if (extractEmailAddress(configuration.from) !== configuration.user) {
    throw new Error("ALERT_EMAIL_FROM email address must match SMTP_USER.");
  }

  if (configuration.to !== TRADEPULSE_ALERT_EMAIL_TO) {
    throw new Error(`ALERT_EMAIL_TO must be ${TRADEPULSE_ALERT_EMAIL_TO}.`);
  }
}

export function getTradePulseFrom(configuration: SmtpConfiguration): { name: string; address: string } {
  validateSmtpConfiguration(configuration);
  return {
    name: TRADEPULSE_EMAIL_FROM_NAME,
    address: configuration.user,
  };
}

export function getSmtpConfiguration(): SmtpConfiguration {
  const port = Number(process.env.SMTP_PORT ?? "587");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }

  const configuration = {
    host: requiredEnvironment("SMTP_HOST"),
    port,
    user: requiredEnvironment("SMTP_USER"),
    appPassword: requiredEnvironment("SMTP_APP_PASSWORD"),
    from: requiredEnvironment("ALERT_EMAIL_FROM"),
    to: requiredEnvironment("ALERT_EMAIL_TO"),
  };

  validateSmtpConfiguration(configuration);
  return configuration;
}

function displayPrice(value: number): string {
  return new Intl.NumberFormat("en-US", {
    useGrouping: true,
    maximumFractionDigits: 8,
  }).format(value);
}

function displayScore(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function displayDirection(direction: SignalAdvisory["direction"]): string {
  return direction === "LONG" ? "看涨（做多）" : "看跌（做空）";
}

function displaySymbol(symbol: SignalAdvisory["symbol"]): string {
  const names: Partial<Record<SignalAdvisory["symbol"], string>> = {
    BTCUSDT: "比特币",
    ETHUSDT: "以太坊",
  };
  const name = names[symbol];
  return name ? `${symbol}（${name}）` : symbol;
}

function displayTime(value: string): string {
  const timeZone = process.env.APP_TIMEZONE || "Asia/Shanghai";
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour: "2-digit",
      hour12: false,
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  } catch {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Shanghai",
      hour: "2-digit",
      hour12: false,
      hourCycle: "h23",
      minute: "2-digit",
      month: "2-digit",
      day: "2-digit",
    });
  }

  const parts = Object.fromEntries(formatter.formatToParts(new Date(value)).map((part) => [part.type, part.value]));
  return `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

export function renderSignalAdvisoryEmail(advisory: SignalAdvisory): RenderedSignalEmail {
  const direction = displayDirection(advisory.direction);

  return {
    subject: `【Trade Pulse】${advisory.symbol} ${direction}｜${displayScore(advisory.score)}分`,
    text: [
      "Trade Pulse 信号提醒",
      "",
      `币种：${displaySymbol(advisory.symbol)}`,
      `方向：${direction}`,
      `信号时间：${displayTime(advisory.signalTime)}`,
      `当前价格：${displayPrice(advisory.currentReferencePrice)}`,
      `参考进场：${displayPrice(advisory.suggestedEntryReference)}`,
      `止损：${displayPrice(advisory.stopLoss)}`,
      `止盈：${displayPrice(advisory.takeProfit)}`,
      `信号强度：${displayScore(advisory.score)}分`,
      `有效至：${displayTime(advisory.signalValidUntil)}`,
      "",
      "仅供参考，请自行决定是否交易。",
      "系统不会自动下单或替你做交易决定。",
    ].join("\n"),
  };
}

export function createDefaultTransport(configuration: SmtpConfiguration): SignalEmailTransport {
  return nodemailer.createTransport({
    host: configuration.host,
    port: configuration.port,
    secure: configuration.port === 465,
    requireTLS: configuration.port !== 465,
    auth: {
      user: configuration.user,
      pass: configuration.appPassword,
    },
  });
}

export async function sendSignalEmail(
  advisory: SignalAdvisory,
  options: Readonly<{
    transport?: SignalEmailTransport;
    configuration?: SmtpConfiguration;
  }> = {},
): Promise<{ emailMessageId: string }> {
  const configuration = options.configuration ?? getSmtpConfiguration();
  const from = getTradePulseFrom(configuration);
  const transport = options.transport ?? createDefaultTransport(configuration);
  const rendered = renderSignalAdvisoryEmail(advisory);
  const mail: SendMailOptions = {
    from,
    to: configuration.to,
    subject: rendered.subject,
    text: rendered.text,
    headers: {
      "X-TradePulse-Signal-ID": advisory.signalId,
      "X-TradePulse-Advisory": "true",
    },
  };
  const result = await transport.sendMail(mail);
  const emailMessageId = typeof result.messageId === "string" ? result.messageId.trim() : "";

  if (!emailMessageId) {
    throw new Error("SMTP transport did not return an email message id.");
  }

  return { emailMessageId };
}
