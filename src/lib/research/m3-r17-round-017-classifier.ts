import {
  M3_R17_ACTIVE_LIFETIME_MS,
  M3_R17_RESEARCH_END,
  M3_R17_RESEARCH_START,
  R17_DIRECTIONS,
  R17_REGIMES,
  R17_SYMBOLS,
  compareR17Strings,
  r17DirectionOrder,
  r17HashCanonical,
  r17SymbolOrder,
  type R17Classification,
  type R17Direction,
  type R17EventTimeIdentity,
  type R17Observation,
  type R17Regime,
  type R17Symbol,
} from "./m3-r17-round-017-protocol.ts";
import { stableStringify } from "./utils.ts";

type R17Anchor = Readonly<{ signalId: string; signalTime: number }>;
type R17SymbolState = { LONG?: R17Anchor; SHORT?: R17Anchor };

function assertEvent(event: R17EventTimeIdentity): void {
  if (!event || typeof event !== "object") throw new Error("R17 event must be an object.");
  if (typeof event.signalId !== "string" || event.signalId.length === 0) throw new Error("R17 event signalId is required.");
  if (!Number.isSafeInteger(event.signalTime) || event.signalTime < M3_R17_RESEARCH_START || event.signalTime > M3_R17_RESEARCH_END) throw new Error(`R17 event signalTime is outside the frozen boundary: ${event.signalId}.`);
  if (!R17_SYMBOLS.includes(event.symbol) || !R17_DIRECTIONS.includes(event.direction)) throw new Error(`R17 event symbol or direction is invalid: ${event.signalId}.`);
  if (event.strategyVersion !== "baseline-001") throw new Error(`R17 event strategy version is not baseline-001: ${event.signalId}.`);
  if (!R17_REGIMES.includes(event.btcRegime)) throw new Error(`R17 event BTC regime is invalid: ${event.signalId}.`);
  if (event.foldId !== null && !["F1", "F2", "F3", "F4", "F5", "F6"].includes(event.foldId)) throw new Error(`R17 event fold identity is invalid: ${event.signalId}.`);
}

function eventComparator(left: R17EventTimeIdentity, right: R17EventTimeIdentity): number {
  return left.signalTime - right.signalTime
    || r17SymbolOrder(left.symbol) - r17SymbolOrder(right.symbol)
    || r17DirectionOrder(left.direction) - r17DirectionOrder(right.direction)
    || compareR17Strings(left.signalId, right.signalId);
}

function observationId(event: R17EventTimeIdentity, classification: R17Classification): string {
  return r17HashCanonical({ signalId: event.signalId, symbol: event.symbol, direction: event.direction, signalTime: event.signalTime, strategyVersion: event.strategyVersion, classification }).slice(0, 32);
}

function makeObservation(event: R17EventTimeIdentity, classification: R17Classification, anchor: R17Anchor): R17Observation {
  return Object.freeze({
    observationId: observationId(event, classification),
    signalId: event.signalId,
    symbol: event.symbol,
    direction: event.direction,
    signalTime: event.signalTime,
    strategyVersion: event.strategyVersion,
    classification,
    anchorSignalId: anchor.signalId,
    anchorSignalTime: anchor.signalTime,
    foldId: event.foldId,
    btcRegime: event.btcRegime,
    controlIncluded: true,
    candidateIncluded: classification === "FIRST",
  });
}

export function classifyR17Events(events: readonly R17EventTimeIdentity[]): readonly R17Observation[] {
  const ordered = [...events].sort(eventComparator);
  const seenSignalIds = new Set<string>();
  const states = new Map<R17Symbol, R17SymbolState>();
  const observations: R17Observation[] = [];

  for (const event of ordered) {
    assertEvent(event);
    if (seenSignalIds.has(event.signalId)) throw new Error(`R17 formal signal stream contains duplicate signalId: ${event.signalId}.`);
    seenSignalIds.add(event.signalId);

    const state = states.get(event.symbol) ?? {};
    const opposite: R17Direction = event.direction === "LONG" ? "SHORT" : "LONG";
    if (state[opposite] !== undefined) {
      delete state.LONG;
      delete state.SHORT;
    }

    const current = state[event.direction];
    let classification: R17Classification;
    let anchor: R17Anchor;
    if (current === undefined || event.signalTime >= current.signalTime + M3_R17_ACTIVE_LIFETIME_MS) {
      classification = "FIRST";
      anchor = Object.freeze({ signalId: event.signalId, signalTime: event.signalTime });
      state[event.direction] = anchor;
    } else {
      classification = "FOLLOW_UP";
      anchor = current;
    }
    states.set(event.symbol, state);
    observations.push(makeObservation(event, classification, anchor));
  }

  return Object.freeze(observations);
}

export function validateR17Observation(value: unknown): R17Observation {
  if (typeof value !== "object" || value === null) throw new Error("R17 observation must be an object.");
  const observation = value as R17Observation;
  const expectedKeys = ["anchorSignalId", "anchorSignalTime", "btcRegime", "candidateIncluded", "classification", "controlIncluded", "direction", "foldId", "observationId", "signalId", "signalTime", "strategyVersion", "symbol"];
  if (stableStringify(Object.keys(observation).sort()) !== stableStringify(expectedKeys.sort())) throw new Error("R17 observation contains fields outside the frozen identity schema.");
  if (typeof observation.observationId !== "string" || observation.observationId.length !== 32) throw new Error("R17 observation identity is invalid.");
  if (typeof observation.signalId !== "string" || observation.signalId.length === 0) throw new Error("R17 observation signalId is invalid.");
  if (!Number.isSafeInteger(observation.signalTime) || observation.signalTime < M3_R17_RESEARCH_START || observation.signalTime > M3_R17_RESEARCH_END) throw new Error("R17 observation signalTime is outside the frozen boundary.");
  if (!R17_SYMBOLS.includes(observation.symbol) || !R17_DIRECTIONS.includes(observation.direction) || observation.strategyVersion !== "baseline-001" || !R17_REGIMES.includes(observation.btcRegime)) throw new Error("R17 observation identity fields are invalid.");
  if (observation.foldId !== null && !["F1", "F2", "F3", "F4", "F5", "F6"].includes(observation.foldId)) throw new Error("R17 observation fold identity is invalid.");
  if (!Number.isSafeInteger(observation.anchorSignalTime) || observation.anchorSignalTime > observation.signalTime || observation.anchorSignalTime < M3_R17_RESEARCH_START) throw new Error("R17 observation anchor time is invalid.");
  if (typeof observation.anchorSignalId !== "string" || observation.anchorSignalId.length === 0 || observation.controlIncluded !== true || typeof observation.candidateIncluded !== "boolean") throw new Error("R17 observation anchor or inclusion fields are invalid.");
  if (observation.classification !== "FIRST" && observation.classification !== "FOLLOW_UP") throw new Error("R17 observation classification is invalid.");
  if (observation.candidateIncluded !== (observation.classification === "FIRST")) throw new Error("R17 candidate inclusion does not match classification.");
  if (observation.classification === "FIRST" && (observation.anchorSignalId !== observation.signalId || observation.anchorSignalTime !== observation.signalTime)) throw new Error("R17 FIRST observation must create its own anchor.");
  if (observation.classification === "FOLLOW_UP" && (observation.anchorSignalTime >= observation.signalTime || observation.signalTime >= observation.anchorSignalTime + M3_R17_ACTIVE_LIFETIME_MS)) throw new Error("R17 FOLLOW_UP observation is outside its frozen anchor lifetime.");
  if (observation.observationId !== observationId(observation, observation.classification)) throw new Error("R17 observationId is not a deterministic identity hash.");
  return observation;
}

export function r17ObservationCanonicalLine(observation: R17Observation): string {
  validateR17Observation(observation);
  return `${stableStringify(observation)}\n`;
}

export function r17ClassificationCounts(observations: readonly R17Observation[]): Readonly<{ controlCount: number; candidateCount: number; firstCount: number; followUpCount: number; suppressedCount: number }> {
  let firstCount = 0;
  let followUpCount = 0;
  for (const observation of observations) {
    if (observation.classification === "FIRST") firstCount += 1;
    else followUpCount += 1;
  }
  return Object.freeze({ controlCount: observations.length, candidateCount: firstCount, firstCount, followUpCount, suppressedCount: followUpCount });
}

export type { R17Regime };
