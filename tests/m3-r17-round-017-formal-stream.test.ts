import { describe, expect, it } from "vitest";

import {
  assertGlobalUniqueR17FormalAdvisories,
  assertR17ClassifierGapInvariant,
  auditR17FormalStream,
  formalEventsFromEvaluations,
  isR17BaselineFormalCandidate,
  reconcileR17FormalStreamCount,
} from "../src/lib/research/m3-r17-round-017-formal-stream.ts";
import { classifyR17Events } from "../src/lib/research/m3-r17-round-017-classifier.ts";
import type { StrategyCandidate, StrategyEvaluation } from "../src/lib/strategy/types.ts";
import type { R17EventTimeIdentity } from "../src/lib/research/m3-r17-round-017-protocol.ts";

const T0 = Date.parse("2024-01-01T00:00:00.000Z");

function candidate(input: Partial<Pick<StrategyCandidate, "direction" | "symbol" | "formalSignal" | "totalScore">> = {}): StrategyCandidate {
  const direction = input.direction ?? "LONG";
  return {
    strategyVersion: "baseline-001",
    symbol: input.symbol ?? "BTCUSDT",
    direction,
    symbolRegime: direction === "LONG" ? "LONG_ONLY" : "SHORT_ONLY",
    btcRegime: "BTC_NEUTRAL",
    entryReference: 100,
    stopReference: 99,
    takeProfitReference: 102,
    stopDistance: 1,
    stopAtr: 1,
    breakdown: { trendStrength: 20, pullbackQuality: 20, breakoutStrength: 20, volumeScore: 20, riskRewardScore: 20 },
    totalScore: input.totalScore ?? 80,
    grade: "A",
    formalSignal: input.formalSignal ?? true,
  };
}

function evaluation(value: StrategyCandidate): StrategyEvaluation {
  return {
    strategyVersion: "baseline-001",
    symbol: value.symbol,
    direction: value.direction,
    status: value.formalSignal && value.totalScore >= 70 ? "FORMAL_SIGNAL" : "CANDIDATE_BELOW_THRESHOLD",
    reason: null,
    symbolRegime: value.symbolRegime,
    btcRegime: value.btcRegime,
    candidate: value,
  };
}

function event(input: Partial<R17EventTimeIdentity> & Pick<R17EventTimeIdentity, "signalId" | "signalTime">): R17EventTimeIdentity {
  return Object.freeze({ signalId: input.signalId, signalTime: input.signalTime, symbol: input.symbol ?? "BTCUSDT", direction: input.direction ?? "LONG", strategyVersion: "baseline-001", foldId: input.foldId ?? null, btcRegime: input.btcRegime ?? "BTC_NEUTRAL" });
}

describe("Round-017 baseline formal stream conformance", () => {
  it("uses exactly the accepted formal predicate and excludes non-formal candidates", () => {
    expect(isR17BaselineFormalCandidate(candidate({ formalSignal: true, totalScore: 70 }))).toBe(true);
    expect(isR17BaselineFormalCandidate(candidate({ formalSignal: false, totalScore: 90 }))).toBe(false);
    expect(isR17BaselineFormalCandidate(candidate({ formalSignal: true, totalScore: 69.99 }))).toBe(false);
  });

  it("does not let a non-formal opposite evaluation close an active anchor", () => {
    const events = [
      ...formalEventsFromEvaluations(T0, [evaluation(candidate({ direction: "LONG" }))]),
      ...formalEventsFromEvaluations(T0 + 1_000, [evaluation(candidate({ direction: "SHORT", formalSignal: false, totalScore: 90 }))]),
      ...formalEventsFromEvaluations(T0 + 2_000, [evaluation(candidate({ direction: "LONG" }))]),
    ];
    const observations = classifyR17Events(events);
    expect(observations.map((observation) => observation.classification)).toEqual(["FIRST", "FOLLOW_UP"]);
  });

  it("lets an actual opposite formal advisory close the anchor", () => {
    const events = [
      ...formalEventsFromEvaluations(T0, [evaluation(candidate({ direction: "LONG" }))]),
      ...formalEventsFromEvaluations(T0 + 1_000, [evaluation(candidate({ direction: "SHORT" }))]),
      ...formalEventsFromEvaluations(T0 + 2_000, [evaluation(candidate({ direction: "LONG" }))]),
    ];
    expect(classifyR17Events(events).map((observation) => observation.classification)).toEqual(["FIRST", "FIRST", "FIRST"]);
  });

  it("fails closed for duplicate canonical formal advisories even when fold annotations differ", () => {
    const first = event({ signalId: "same", signalTime: T0, foldId: "F1" });
    const second = event({ signalId: "same", signalTime: T0, foldId: "F2" });
    expect(() => assertGlobalUniqueR17FormalAdvisories([first, second])).toThrow(/duplicate canonical advisory/u);
  });

  it("keeps fold annotation from changing the global stream count", () => {
    const stream = [event({ signalId: "one", signalTime: T0 }), event({ signalId: "two", signalTime: T0 + 1_000 })];
    const annotated = stream.map((value, index) => ({ ...value, foldId: index === 0 ? "F1" : "F2" as const }));
    expect(new Set(annotated.map((value) => value.signalId)).size).toBe(stream.length);
    expect(auditR17FormalStream(stream).duplicateCanonicalIdentityCount).toBe(0);
  });

  it("reconciles only to the accepted 7,500 formal-advisory count", () => {
    expect(() => reconcileR17FormalStreamCount(7_500)).not.toThrow();
    expect(() => reconcileR17FormalStreamCount(7_499)).toThrow(/FORMAL_STREAM_RECONCILIATION_FAILED/u);
  });

  it("fails closed when sub-four-hour same-direction gaps produce no follow-ups", () => {
    const audit = auditR17FormalStream([event({ signalId: "a", signalTime: T0 }), event({ signalId: "b", signalTime: T0 + 1_000 })]);
    expect(audit.sameSymbolSameDirectionGapLt4hCount).toBe(1);
    expect(() => assertR17ClassifierGapInvariant(audit, 0)).toThrow(/classifier invariant/u);
    expect(() => assertR17ClassifierGapInvariant(audit, 1)).not.toThrow();
  });
});
