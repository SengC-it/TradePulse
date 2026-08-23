import nodemailer from "nodemailer";
import type { SendMailOptions, Transporter } from "nodemailer";

import type { SignalAdvisory } from "./types.ts";

export type SignalEmailTransport = Pick<Transporter, "sendMail">;

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

function getSmtpConfiguration(): SmtpConfiguration {
  const port = Number(process.env.SMTP_PORT ?? "587");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("SMTP_PORT must be a valid TCP port.");
  }

  return {
    host: requiredEnvironment("SMTP_HOST"),
    port,
    user: requiredEnvironment("SMTP_USER"),
    appPassword: requiredEnvironment("SMTP_APP_PASSWORD"),
    from: requiredEnvironment("ALERT_EMAIL_FROM"),
    to: requiredEnvironment("ALERT_EMAIL_TO"),
  };
}

function display(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
}

export function renderSignalAdvisoryEmail(advisory: SignalAdvisory): RenderedSignalEmail {
  return {
    subject: `[TradePulse] ${advisory.symbol} ${advisory.direction} signal advisory`,
    text: [
      "SIGNAL ADVISORY ONLY",
      "MANUAL TRADING DECISION REQUIRED",
      "",
      `Symbol: ${advisory.symbol}`,
      `Direction: ${advisory.direction}`,
      `Signal Time: ${advisory.signalTime}`,
      `Signal Valid Until: ${advisory.signalValidUntil}`,
      `Current / Reference Price: ${display(advisory.currentReferencePrice)}`,
      `Suggested Entry Reference: ${display(advisory.suggestedEntryReference)}`,
      `Stop Loss: ${display(advisory.stopLoss)}`,
      `Take Profit: ${display(advisory.takeProfit)}`,
      `Risk / Reward: ${display(advisory.riskReward)}R`,
      `Strategy ID: ${advisory.strategyId}`,
      `Strategy Version: ${advisory.strategyVersion}`,
      `Signal ID: ${advisory.signalId}`,
      `Market Regime: BTC=${advisory.marketRegime.btcRegime}; Symbol=${advisory.marketRegime.symbolRegime}`,
      `Data freshness: ${advisory.dataFreshness.status}; age=${advisory.dataFreshness.ageMs}ms; sourceServerTime=${advisory.dataFreshness.sourceServerTime}`,
      `Score: ${display(advisory.score)}; Grade: ${advisory.grade}`,
      "",
      "TradePulse does not place orders, manage positions, or make trading decisions.",
    ].join("\n"),
  };
}

function createDefaultTransport(configuration: SmtpConfiguration): SignalEmailTransport {
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
  const transport = options.transport ?? createDefaultTransport(configuration);
  const rendered = renderSignalAdvisoryEmail(advisory);
  const mail: SendMailOptions = {
    from: configuration.from,
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
