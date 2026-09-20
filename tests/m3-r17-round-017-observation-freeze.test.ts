import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { classifyR17Events, r17ObservationCanonicalLine } from "../src/lib/research/m3-r17-round-017-classifier.ts";
import { annotateR17EventsWithFold, scanR17ObservationData } from "../src/lib/research/m3-r17-round-017-observation-freeze.ts";
import { M3_R17_OBSERVATION_DATA_PATH, readR17Design, type R17EventTimeIdentity } from "../src/lib/research/m3-r17-round-017-protocol.ts";

const T0 = Date.parse("2024-01-01T00:00:00.000Z");

function event(input: Partial<R17EventTimeIdentity> & Pick<R17EventTimeIdentity, "signalId" | "signalTime">): R17EventTimeIdentity {
  return Object.freeze({ signalId: input.signalId, signalTime: input.signalTime, symbol: input.symbol ?? "BTCUSDT", direction: input.direction ?? "LONG", strategyVersion: "baseline-001", foldId: input.foldId ?? null, btcRegime: input.btcRegime ?? "BTC_NEUTRAL" });
}

function testRoot(): string {
  return mkdtempSync(path.join(process.cwd(), ".r17-freeze-test-"));
}

function writeObservationFixture(root: string, events: readonly R17EventTimeIdentity[]): string {
  const observations = classifyR17Events(events);
  const filePath = path.join(root, M3_R17_OBSERVATION_DATA_PATH);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, observations.map((observation) => r17ObservationCanonicalLine(observation)).join(""), "utf8");
  return filePath;
}

describe("Round-017 corrected formal observation freeze", () => {
  it("scans the global formal identity stream without outcome fields", async () => {
    const root = testRoot();
    try {
      const filePath = writeObservationFixture(root, [event({ signalId: "first", signalTime: T0 }), event({ signalId: "follow", signalTime: T0 + 1_000 })]);
      const scan = await scanR17ObservationData(filePath);
      expect(scan).toMatchObject({ observationCount: 2, controlCount: 2, candidateCount: 1, firstCount: 1, followUpCount: 1, suppressedCount: 1 });
      expect(scan.structuralAudit).toMatchObject({ duplicateCanonicalIdentityCount: 0, uniqueSignalTimeCount: 2, sameSymbolSameDirectionGapLt4hCount: 1, oppositeDirectionSameTimestampCount: 0 });
      expect(readFileSync(filePath, "utf8")).not.toMatch(/label|netR|profitFactor|drawdown/iu);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("assigns folds only after global events are formed and preserves the count", () => {
    const design = readR17Design();
    const events = [event({ signalId: "folded", signalTime: T0 })];
    const annotated = annotateR17EventsWithFold(events, design);
    expect(annotated).toHaveLength(events.length);
    expect(annotated[0]?.signalId).toBe(events[0]?.signalId);
    expect(annotated[0]?.foldId).toBe("F1");
  });

  it("keeps performance, selection, and economic data outside the identity freeze", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "lib", "research", "m3-r17-round-017-observation-freeze.ts"), "utf8");
    const formalStreamSource = readFileSync(path.join(process.cwd(), "src", "lib", "research", "m3-r17-round-017-formal-stream.ts"), "utf8");
    expect(source).not.toMatch(/\b(?:meanNetR|profitFactor|maximumDrawdown|settlementResult)\b|\bfutureOutcome(?:Value|Price|Result|At|R|Id)\b/iu);
    expect(formalStreamSource).toMatch(/allowNetworkAcquisition:\s*false/u);
  });
});
