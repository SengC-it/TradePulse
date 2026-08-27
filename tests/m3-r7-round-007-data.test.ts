import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import type { BacktestData, IntrabarSettlementRequirement } from "../src/lib/backtest/types.ts";
import {
  M3_R7_INTRABAR_PLAN_VERSION,
  buildR7IntrabarPlan,
  persistR7IntrabarPlan,
  r7DatasetIdentity,
} from "../src/lib/research/m3-r7-round-007-intrabar-plan.ts";

const requirement: IntrabarSettlementRequirement = {
  symbol: "BTCUSDT",
  exitCandleOpenTime: 1_000,
  exitCandleCloseTime: 3_599,
  settlementOnly: true,
};

const emptyData = { datasets: {}, funding: {}, manifests: [] } as unknown as BacktestData;

describe("M3-R7 dataset and intrabar freeze", () => {
  it("deduplicates declared intrabar requirements and binds every consumer", () => {
    const plan = buildR7IntrabarPlan({ data: emptyData, sourceSha: "a".repeat(40), requirements: [requirement, requirement], existingR6PlanSha256: "b".repeat(64) });
    expect(plan.planVersion).toBe(M3_R7_INTRABAR_PLAN_VERSION);
    expect(plan.requirements).toEqual([requirement]);
    expect(plan.declarations).toHaveLength(1);
    expect(plan.consumers).toHaveLength(6);
    expect(plan.preLockOnly).toBe(true);
    expect(plan.postLockFetch).toBe(false);
  });

  it("persists the declaration before acquisition and keeps dataset identity deterministic", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "tradepulse-r7-data-test-"));
    try {
      const plan = buildR7IntrabarPlan({ data: emptyData, sourceSha: "a".repeat(40), requirements: [requirement], existingR6PlanSha256: "b".repeat(64) });
      const target = path.join(root, "round-007-intrabar-plan.json");
      persistR7IntrabarPlan(plan, target);
      expect(existsSync(target)).toBe(true);
      expect(JSON.parse(readFileSync(target, "utf8")).declarationHash).toBe(plan.declarationHash);
      const first = r7DatasetIdentity({ data: emptyData, plan, studyServerTime: 1_000_000 });
      const second = r7DatasetIdentity({ data: emptyData, plan, studyServerTime: 1_000_000 });
      expect(first).toBe(second);
      expect(first).toMatch(/^[0-9a-f]{64}$/u);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
