import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

import { classifyR17Events, r17ObservationCanonicalLine, validateR17Observation } from "../src/lib/research/m3-r17-round-017-classifier.ts";
import { M3_R17_ACTIVE_LIFETIME_MS, M3_R17_RESEARCH_START, R17_FOLD_IDS, type R17EventTimeIdentity } from "../src/lib/research/m3-r17-round-017-protocol.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const T0 = Date.parse("2024-01-01T00:00:00.000Z");

function event(input: Partial<R17EventTimeIdentity> & Pick<R17EventTimeIdentity, "signalId" | "signalTime">): R17EventTimeIdentity {
  return Object.freeze({ signalId: input.signalId, signalTime: input.signalTime, symbol: input.symbol ?? "BTCUSDT", direction: input.direction ?? "LONG", strategyVersion: "baseline-001", foldId: input.foldId ?? "F1", btcRegime: input.btcRegime ?? "BTC_NEUTRAL" });
}

describe("Round-017 deterministic thesis lifecycle classifier", () => {
  it("sorts by signal time, symbol, LONG before SHORT, then signalId", () => {
    const result = classifyR17Events([
      event({ signalId: "b", signalTime: T0, symbol: "ETHUSDT", direction: "SHORT" }),
      event({ signalId: "c", signalTime: T0, symbol: "BTCUSDT", direction: "SHORT" }),
      event({ signalId: "a", signalTime: T0, symbol: "BTCUSDT", direction: "LONG" }),
      event({ signalId: "d", signalTime: T0 - 1, symbol: "BTCUSDT", direction: "LONG" }),
    ]);
    expect(result.map((value) => value.signalId)).toEqual(["d", "a", "c", "b"]);
  });

  it("creates a FIRST anchor when no same-key thesis is active", () => {
    const [observation] = classifyR17Events([event({ signalId: "first", signalTime: T0 })]);
    expect(observation).toMatchObject({ classification: "FIRST", candidateIncluded: true, controlIncluded: true, anchorSignalId: "first", anchorSignalTime: T0 });
  });

  it("classifies an in-lifetime same-symbol/same-direction event as FOLLOW_UP", () => {
    const result = classifyR17Events([event({ signalId: "first", signalTime: T0 }), event({ signalId: "follow", signalTime: T0 + M3_R17_ACTIVE_LIFETIME_MS - 1 })]);
    expect(result[1]).toMatchObject({ classification: "FOLLOW_UP", candidateIncluded: false, anchorSignalId: "first", anchorSignalTime: T0 });
  });

  it("treats the exact four-hour boundary as a new FIRST", () => {
    const result = classifyR17Events([event({ signalId: "first", signalTime: T0 }), event({ signalId: "boundary", signalTime: T0 + M3_R17_ACTIVE_LIFETIME_MS })]);
    expect(result.map((value) => value.classification)).toEqual(["FIRST", "FIRST"]);
    expect(result[1]?.anchorSignalId).toBe("boundary");
  });

  it("does not extend an anchor when a FOLLOW_UP is suppressed", () => {
    const result = classifyR17Events([event({ signalId: "first", signalTime: T0 }), event({ signalId: "follow-1", signalTime: T0 + 1_000 }), event({ signalId: "follow-2", signalTime: T0 + M3_R17_ACTIVE_LIFETIME_MS - 1 })]);
    expect(result.map((value) => value.classification)).toEqual(["FIRST", "FOLLOW_UP", "FOLLOW_UP"]);
    expect(result[2]?.anchorSignalId).toBe("first");
  });

  it("keeps thesis state independent for different symbols", () => {
    const result = classifyR17Events([event({ signalId: "btc", signalTime: T0, symbol: "BTCUSDT" }), event({ signalId: "eth", signalTime: T0 + 1_000, symbol: "ETHUSDT" }), event({ signalId: "btc-follow", signalTime: T0 + 2_000, symbol: "BTCUSDT" }), event({ signalId: "eth-follow", signalTime: T0 + 3_000, symbol: "ETHUSDT" })]);
    expect(result.map((value) => value.classification)).toEqual(["FIRST", "FIRST", "FOLLOW_UP", "FOLLOW_UP"]);
  });

  it("keeps thesis state independent for different directions until the frozen opposite reset", () => {
    const result = classifyR17Events([event({ signalId: "long", signalTime: T0, direction: "LONG" }), event({ signalId: "short", signalTime: T0 + 1_000, direction: "SHORT" }), event({ signalId: "long-after-opposite", signalTime: T0 + 2_000, direction: "LONG" })]);
    expect(result.map((value) => value.classification)).toEqual(["FIRST", "FIRST", "FIRST"]);
    expect(result[2]?.anchorSignalId).toBe("long-after-opposite");
  });

  it("closes both direction anchors before classifying an opposite event", () => {
    const result = classifyR17Events([event({ signalId: "long", signalTime: T0, direction: "LONG" }), event({ signalId: "long-follow", signalTime: T0 + 1_000, direction: "LONG" }), event({ signalId: "short", signalTime: T0 + 2_000, direction: "SHORT" }), event({ signalId: "short-follow", signalTime: T0 + 3_000, direction: "SHORT" })]);
    expect(result.map((value) => value.classification)).toEqual(["FIRST", "FOLLOW_UP", "FIRST", "FOLLOW_UP"]);
    expect(result[2]?.anchorSignalId).toBe("short");
  });

  it("applies LONG-before-SHORT at the same timestamp", () => {
    const result = classifyR17Events([event({ signalId: "same-short", signalTime: T0, direction: "SHORT" }), event({ signalId: "same-long", signalTime: T0, direction: "LONG" })]);
    expect(result.map((value) => value.signalId)).toEqual(["same-long", "same-short"]);
    expect(result.map((value) => value.classification)).toEqual(["FIRST", "FIRST"]);
  });

  it("uses signalId as the final deterministic tie-break", () => {
    const result = classifyR17Events([event({ signalId: "z", signalTime: T0 }), event({ signalId: "a", signalTime: T0 })]);
    expect(result.map((value) => value.signalId)).toEqual(["a", "z"]);
    expect(result.map((value) => value.classification)).toEqual(["FIRST", "FOLLOW_UP"]);
  });

  it("retains fold and decision-time regime identity without using outcomes", () => {
    const [observation] = classifyR17Events([event({ signalId: "identity", signalTime: T0, foldId: R17_FOLD_IDS[0], btcRegime: "BTC_STRONG_BULL" })]);
    expect(observation).toMatchObject({ foldId: "F1", btcRegime: "BTC_STRONG_BULL", strategyVersion: "baseline-001" });
    expect(observation).not.toHaveProperty("label");
    expect(observation).not.toHaveProperty("netR");
  });

  it("produces the same observation identity for the same event sequence", () => {
    const input = [event({ signalId: "same", signalTime: T0 }), event({ signalId: "same-follow", signalTime: T0 + 1_000 })];
    expect(classifyR17Events(input)).toEqual(classifyR17Events([...input].reverse()));
  });

  it("rejects duplicate signal identities", () => {
    expect(() => classifyR17Events([event({ signalId: "duplicate", signalTime: T0 }), event({ signalId: "duplicate", signalTime: T0 + 1 })])).toThrow(/duplicate signalId/u);
  });

  it("rejects events outside the frozen research boundary", () => {
    expect(() => classifyR17Events([event({ signalId: "before", signalTime: M3_R17_RESEARCH_START - 1 })])).toThrow(/outside the frozen boundary/u);
  });

  it("validates the canonical identity record and line", () => {
    const [observation] = classifyR17Events([event({ signalId: "canonical", signalTime: T0 })]);
    expect(validateR17Observation(observation)).toEqual(observation);
    expect(r17ObservationCanonicalLine(observation)).toBe(`${stableStringify(observation)}\n`);
  });

  it("does not contain settlement or future-outcome dependencies", () => {
    const source = readFileSync(path.join(process.cwd(), "src", "lib", "research", "m3-r17-round-017-classifier.ts"), "utf8");
    expect(source).not.toMatch(/netR|settlement|futureOutcome|label/iu);
  });
});
