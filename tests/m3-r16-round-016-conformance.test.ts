import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import {
  R16_CONFORMANCE_CHECK_IDS,
  buildR16Conformance,
} from "../src/lib/research/m3-r16-round-016-conformance.ts";
import { R16_PLAN, R16_PLAN_SHA256 } from "../src/lib/research/m3-r16-round-016-plan.ts";
import { R16_SPEC_OBJECT, R16_SPEC_SHA256 } from "../src/lib/research/m3-r16-round-016-protocol.ts";

describe("Round-016 pre-performance conformance", () => {
  it("defines every result-affecting check in stable order and fails closed without frozen inputs", async () => {
    const document = await buildR16Conformance(path.join(process.cwd(), ".r16-conformance-empty-fixture"));
    expect(document.checks).toHaveLength(R16_CONFORMANCE_CHECK_IDS.length);
    expect(document.checks.map((value) => value.checkId)).toEqual([...R16_CONFORMANCE_CHECK_IDS]);
    expect(document.resultAffectingDeviationCount).toBe(document.resultAffectingDeviations.length);
    expect(document.integrity).toBe("INCOMPLETE");
    expect(document.checks.find((value) => value.checkId === "sourceR15ObservationShaVerified")).toBeDefined();
    expect(document.checks.find((value) => value.checkId === "microArchiveChecksumsVerified")?.passed).toBe(false);
    expect(document.specSha256).toBe(R16_SPEC_SHA256);
    expect(document.planSha256).toBe(R16_PLAN_SHA256);
    expect(R16_SPEC_OBJECT.data.restHistoricalBackfill).toBe(false);
    expect(R16_PLAN.source.sourceDatabase).toBe("DISABLED");
  });

  it("keeps the performance path offline and free of private Binance access", () => {
    const performance = readFileSync(path.join(process.cwd(), "src", "lib", "research", "m3-r16-round-016-performance.ts"), "utf8");
    expect(performance).not.toContain("fetch(");
    expect(performance).not.toContain("BinancePublicClient");
    expect(performance).not.toMatch(/createOrder|cancelOrder|apiKey|secretKey/iu);
    expect(performance).toContain("PERFORMANCE_LOCKED_CRASH_SAFE");
  });
});
