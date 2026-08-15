import { describe, expect, it } from "vitest";

import {
  EMAIL_GRADE_POLICY,
  RESEARCH_SYMBOLS,
  SCORE_COMPONENTS,
  STRATEGY_VERSION,
} from "@/lib/config/constants";
import { createHealthPayload } from "@/lib/health";
import { isAuthorizedCronRequest } from "@/lib/security/cron";

describe("M0 foundation boundaries", () => {
  it("keeps the approved five-symbol research pool", () => {
    expect(RESEARCH_SYMBOLS).toEqual([
      "BTCUSDT",
      "ETHUSDT",
      "SOLUSDT",
      "XRPUSDT",
      "BNBUSDT",
    ]);
  });

  it("keeps the baseline version and 100-point score allocation", () => {
    expect(STRATEGY_VERSION).toBe("baseline-001");
    expect(Object.values(SCORE_COMPONENTS).reduce((sum, value) => sum + value, 0)).toBe(100);
    expect(EMAIL_GRADE_POLICY).toEqual({ A: true, B: true, C: false });
  });

  it("does not report credentials or trading capability from health", () => {
    const payload = createHealthPayload({
      environment: "test",
      version: "local",
      databaseConfigured: false,
    });

    expect(payload.trading.enabled).toBe(false);
    expect(JSON.stringify(payload)).not.toContain("SECRET");
    expect(JSON.stringify(payload)).not.toContain("PASSWORD");
  });
});

describe("Cron authorization boundary", () => {
  it("accepts only the exact Bearer secret", () => {
    const request = new Request("http://localhost/api/cron/scan", {
      headers: { authorization: "Bearer test-cron-secret" },
    });

    expect(isAuthorizedCronRequest(request, "test-cron-secret")).toBe(true);
    expect(isAuthorizedCronRequest(request, "wrong-secret")).toBe(false);
    expect(isAuthorizedCronRequest(request, undefined)).toBe(false);
  });

  it("rejects missing and malformed authorization headers", () => {
    const missing = new Request("http://localhost/api/cron/scan");
    const malformed = new Request("http://localhost/api/cron/scan", {
      headers: { authorization: "Basic test-cron-secret" },
    });

    expect(isAuthorizedCronRequest(missing, "test-cron-secret")).toBe(false);
    expect(isAuthorizedCronRequest(malformed, "test-cron-secret")).toBe(false);
  });
});
