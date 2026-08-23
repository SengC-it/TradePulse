import { afterEach, describe, expect, it } from "vitest";

import { GET } from "@/app/api/cron/signal-advisory/route";

const originalCronSecret = process.env.CRON_SECRET;

afterEach(() => {
  if (originalCronSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalCronSecret;
  }
});

describe("signal advisory cron route", () => {
  it("rejects unauthenticated invocations before loading market data", async () => {
    process.env.CRON_SECRET = "test-cron-secret";
    const response = await GET(new Request("https://example.test/api/cron/signal-advisory"));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });
});
