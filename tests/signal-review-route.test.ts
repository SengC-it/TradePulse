import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createDependencies: vi.fn(),
  runReview: vi.fn(),
}));

vi.mock("@/lib/signal-review", () => ({
  createDefaultSignalReviewRunDependencies: mocks.createDependencies,
  runDailySignalReview: mocks.runReview,
}));

import { GET, POST } from "@/app/api/cron/signal-review/route";

const originalSecret = process.env.CRON_SECRET;

afterEach(() => {
  mocks.createDependencies.mockReset();
  mocks.runReview.mockReset();
  if (originalSecret === undefined) {
    delete process.env.CRON_SECRET;
  } else {
    process.env.CRON_SECRET = originalSecret;
  }
});

describe("daily signal review cron route", () => {
  it("rejects GET without running a review", async () => {
    const response = await GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: "method_not_allowed" });
    expect(mocks.runReview).not.toHaveBeenCalled();
  });

  it("rejects missing and invalid CRON_SECRET before creating dependencies", async () => {
    process.env.CRON_SECRET = "cron-secret";
    expect((await POST(new Request("https://example.test/api/cron/signal-review"))).status).toBe(401);
    expect((await POST(new Request("https://example.test/api/cron/signal-review", {
      headers: { authorization: "Bearer wrong" },
    }))).status).toBe(401);
    expect(mocks.createDependencies).not.toHaveBeenCalled();
  });

  it("runs the authenticated review and returns a safe summary", async () => {
    process.env.CRON_SECRET = "cron-secret";
    mocks.createDependencies.mockReturnValue({});
    mocks.runReview.mockResolvedValue({
      ok: true,
      outcome: "SUCCEEDED",
      runKey: "daily-review:2026-08-26",
      considered: 2,
      created: 2,
      updated: 1,
      resolved: 1,
      errors: [],
    });

    const response = await POST(new Request("https://example.test/api/cron/signal-review", {
      method: "POST",
      headers: { authorization: "Bearer cron-secret" },
    }));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toMatchObject({ outcome: "SUCCEEDED", runKey: "daily-review:2026-08-26" });
    expect(mocks.runReview).toHaveBeenCalledWith({ dependencies: {} });
  });
});
