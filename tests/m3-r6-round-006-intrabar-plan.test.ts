import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import type {
  BacktestData,
  IntrabarSettlementRequirement,
} from "../src/lib/backtest/types.ts";
import type {
  HistoricalIntrabarSettlementWindow,
} from "../src/lib/historical-data/types.ts";
import {
  appendRound006IntrabarWindows,
} from "../src/lib/research/m3-r6-round-006-performance.ts";
import {
  M3_R6_ROUND_006_CANDIDATE_IDS,
} from "../src/lib/research/m3-r6-round-006-protocol.ts";
import { M3_R6_ROUND_006_CONTROL_ID } from "../src/lib/research/selection-gates-round-006.ts";
import {
  M3_R6_ROUND_006_INTRABAR_CONSUMERS,
  M3_R6_ROUND_006_INTRABAR_PLAN_FILENAME,
  Round006IntrabarPlanError,
  assertRound006IntrabarRequirementsDeclared,
  buildRound006IntrabarDependencyPlan,
  createRound006DeclaredIntrabarLoader,
  persistRound006IntrabarDependencyPlan,
  round006IntrabarPlanPath,
  validateRound006IntrabarPlanCoverage,
} from "../src/lib/research/m3-r6-round-006-intrabar-plan.ts";

const HOUR = 60 * 60 * 1_000;
const SOURCE_SHA = "f24efef2f3a5f158b687ccc7f1bb069d853b6120";

function temporaryDirectory(): string {
  return mkdtempSync(path.join(os.tmpdir(), "tradepulse-r6-intrabar-plan-test-"));
}

function coarseData(): BacktestData {
  return { manifests: [] } as unknown as BacktestData;
}

function requirement(
  symbol: "BTCUSDT" | "ETHUSDT" = "BTCUSDT",
  openTime = 10 * HOUR,
  settlementOnly = false,
): IntrabarSettlementRequirement {
  return {
    symbol,
    exitCandleOpenTime: openTime,
    exitCandleCloseTime: openTime + HOUR - 1,
    settlementOnly,
  };
}

function windowFor(input: IntrabarSettlementRequirement): HistoricalIntrabarSettlementWindow {
  return {
    symbol: input.symbol,
    exitCandleOpenTime: input.exitCandleOpenTime,
    settlementOnly: input.settlementOnly,
    candles: [],
    manifest: {} as HistoricalIntrabarSettlementWindow["manifest"],
  };
}

function planFor(rawRequirements: readonly IntrabarSettlementRequirement[]) {
  return buildRound006IntrabarDependencyPlan({
    data: coarseData(),
    sourceSha: SOURCE_SHA,
    rawRequirements,
  });
}

describe("Round-006 intrabar dependency declaration", () => {
  it("declares an ambiguous settlement window before the loader can fetch it", async () => {
    const root = temporaryDirectory();
    const plan = planFor([requirement()]);
    const target = round006IntrabarPlanPath(root);
    try {
      persistRound006IntrabarDependencyPlan(plan, root);
      const loader = {
        loadIntrabarSettlementWindows: vi.fn(async (requirements: readonly IntrabarSettlementRequirement[]) => {
          expect(existsSync(target)).toBe(true);
          expect(JSON.parse(readFileSync(target, "utf8")).declarationHash).toBe(plan.declarationHash);
          expect(requirements).toEqual(plan.requirements);
          return [];
        }),
      };
      const declaredLoader = createRound006DeclaredIntrabarLoader(loader, plan);
      await declaredLoader.loadIntrabarSettlementWindows(plan.requirements, 20 * HOUR);
      expect(loader.loadIntrabarSettlementWindows).toHaveBeenCalledOnce();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("declares no window for a non-ambiguous coarse dependency", () => {
    const plan = planFor([]);
    expect(plan.rawDependencyCount).toBe(0);
    expect(plan.uniqueDeclaredWindowCount).toBe(0);
    expect(plan.requirements).toEqual([]);
    expect(plan.declarations).toEqual([]);
  });

  it("deduplicates dependencies across the CONTROL and candidate consumer union", () => {
    const plan = planFor([requirement(), requirement(), requirement("ETHUSDT", 11 * HOUR)]);
    expect(plan.rawDependencyCount).toBe(3);
    expect(plan.uniqueDeclaredWindowCount).toBe(2);
    expect(plan.duplicateDependencyCount).toBe(1);
    expect(plan.consumers).toEqual([
      M3_R6_ROUND_006_CONTROL_ID,
      ...M3_R6_ROUND_006_CANDIDATE_IDS,
    ]);
    expect(plan.consumerDependencyUnion).toHaveLength(M3_R6_ROUND_006_INTRABAR_CONSUMERS.length);
    expect(new Set(plan.consumerDependencyUnion.map((entry) => entry.declarationHash))).toEqual(
      new Set([plan.declarationHash]),
    );
  });

  it("produces deterministic declaration order and hash independent of discovery order", () => {
    const first = planFor([requirement("ETHUSDT", 11 * HOUR), requirement(), requirement("BTCUSDT", 12 * HOUR)]);
    const second = planFor([requirement("BTCUSDT", 12 * HOUR), requirement(), requirement("ETHUSDT", 11 * HOUR)]);
    expect(first.declarations).toEqual(second.declarations);
    expect(first.declarationHash).toBe(second.declarationHash);
    expect(first.requirements).toEqual(second.requirements);
  });

  it("blocks an undeclared fetch before the historical loader is invoked", async () => {
    const plan = planFor([requirement()]);
    const loader = {
      loadIntrabarSettlementWindows: vi.fn(async () => []),
    };
    const declaredLoader = createRound006DeclaredIntrabarLoader(loader, plan);
    await expect(declaredLoader.loadIntrabarSettlementWindows(
      [requirement(), requirement("ETHUSDT")],
      20 * HOUR,
    )).rejects.toThrow("must request exactly 1 declared windows");
    expect(loader.loadIntrabarSettlementWindows).not.toHaveBeenCalled();
  });

  it("blocks a declared-set mismatch even when the request count is unchanged", async () => {
    const plan = planFor([requirement()]);
    const loader = {
      loadIntrabarSettlementWindows: vi.fn(async () => []),
    };
    const declaredLoader = createRound006DeclaredIntrabarLoader(loader, plan);
    await expect(declaredLoader.loadIntrabarSettlementWindows(
      [requirement("ETHUSDT")],
      20 * HOUR,
    )).rejects.toBeInstanceOf(Round006IntrabarPlanError);
    expect(loader.loadIntrabarSettlementWindows).not.toHaveBeenCalled();
  });

  it("reports a missing declared window and no undeclared window when acquisition is incomplete", () => {
    const plan = planFor([requirement(), requirement("ETHUSDT")]);
    const coverage = validateRound006IntrabarPlanCoverage(plan, [windowFor(requirement())]);
    expect(coverage.declaredWindowCount).toBe(2);
    expect(coverage.presentWindowCount).toBe(1);
    expect(coverage.missingDeclaredIdentities).toHaveLength(1);
    expect(coverage.undeclaredWindowIdentities).toEqual([]);
    expect(coverage.duplicateWindowIdentities).toEqual([]);
  });

  it("accepts every declared window and rejects the 171-style identity mismatch", () => {
    const requirements = [requirement(), requirement("ETHUSDT")];
    const plan = planFor(requirements);
    const coverage = validateRound006IntrabarPlanCoverage(plan, requirements.map(windowFor));
    expect(coverage.missingDeclaredIdentities).toEqual([]);
    expect(coverage.undeclaredWindowIdentities).toEqual([]);
    expect(coverage.presentWindowCount).toBe(2);
  });

  it("reports an undeclared window and duplicate window identity", () => {
    const declared = requirement();
    const undeclared = requirement("ETHUSDT");
    const plan = planFor([declared]);
    const coverage = validateRound006IntrabarPlanCoverage(plan, [
      windowFor(declared),
      windowFor(declared),
      windowFor(undeclared),
    ]);
    expect(coverage.undeclaredWindowIdentities).toHaveLength(1);
    expect(coverage.duplicateWindowIdentities).toHaveLength(1);
  });

  it("attaches the frozen declaration hash to data before performance consumers run", () => {
    const plan = planFor([requirement()]);
    const data = appendRound006IntrabarWindows(
      coarseData(),
      [windowFor(requirement())],
      plan.requirements,
      plan,
    );
    expect(data.intrabarSettlementDeclarationHash).toBe(plan.declarationHash);
    expect(data.intrabarSettlementRequirements).toEqual(plan.requirements);
  });

  it("contains only dependency declaration metadata, not performance metrics or selection", () => {
    const plan = planFor([requirement()]);
    const serialized = JSON.stringify(plan);
    expect(serialized).not.toMatch(/expectancy|profitFactor|maxDrawdown|selectedCandidate|netR/u);
    expect(plan.candidateDependencyRule).toBe("ALL_FROZEN_CONSUMERS_SHARE_CONTROL_UNION");
  });

  it("keeps the same frozen dependency identity for every consumer", () => {
    const plan = planFor([requirement()]);
    expect(plan.consumerDependencyUnion).toEqual(
      M3_R6_ROUND_006_INTRABAR_CONSUMERS.map((consumerId) => ({
        consumerId,
        declarationHash: plan.declarationHash,
      })),
    );
  });

  it("reuses an identical persisted declaration and fails closed on a changed declaration", () => {
    const root = temporaryDirectory();
    const plan = planFor([requirement()]);
    try {
      persistRound006IntrabarDependencyPlan(plan, root);
      expect(persistRound006IntrabarDependencyPlan(plan, root)).toBe(round006IntrabarPlanPath(root));
      expect(readdirSync(root)).toContain(M3_R6_ROUND_006_INTRABAR_PLAN_FILENAME);
      expect(() => persistRound006IntrabarDependencyPlan(planFor([requirement("ETHUSDT")]), root))
        .toThrow("identity does not match");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stages the declaration on the cache filesystem without consulting os.tmpdir", () => {
    const root = temporaryDirectory();
    const plan = planFor([requirement()]);
    const tmpdir = vi.spyOn(os, "tmpdir").mockImplementation(() => {
      throw new Error("intrabar declaration must not call os.tmpdir");
    });
    try {
      persistRound006IntrabarDependencyPlan(plan, root);
      expect(existsSync(round006IntrabarPlanPath(root))).toBe(true);
      expect(readdirSync(root).filter((entry) => entry.startsWith(".m3-r6-intrabar-plan-")).length).toBe(0);
    } finally {
      tmpdir.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("asserts the complete frozen declaration set before any acquisition", () => {
    const plan = planFor([requirement(), requirement("ETHUSDT")]);
    expect(() => assertRound006IntrabarRequirementsDeclared(plan.requirements, plan)).not.toThrow();
    expect(() => assertRound006IntrabarRequirementsDeclared([requirement()], plan))
      .toThrow("must request exactly 2 declared windows");
  });
});
