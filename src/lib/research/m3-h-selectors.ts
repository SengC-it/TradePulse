import {
  RESEARCH_DIRECTION_ORDER,
  RESEARCH_SYMBOL_ORDER,
  type ResearchDirection,
} from "./constants.ts";
import type { ResearchSymbol } from "../config/constants.ts";
import type { M3HSelectorSpec } from "./m3-h-round-001-plan.ts";
import { requireFiniteNumber, requireSafeTimestamp, stableStringify } from "./utils.ts";

export type M3HDecisionSnapshot = Readonly<{
  signalTime: number;
  symbol: ResearchSymbol;
  direction: ResearchDirection;
  totalScore: number;
  entryReference: number;
  stopDistance: number;
}>;

export class M3HSelectorError extends Error {
  public readonly name = "M3HSelectorError";
}

function symbolIndex(symbol: ResearchSymbol): number {
  return RESEARCH_SYMBOL_ORDER.indexOf(symbol);
}

function directionIndex(direction: ResearchDirection): number {
  return RESEARCH_DIRECTION_ORDER.indexOf(direction);
}

export function decisionSnapshotIdentity(snapshot: Pick<M3HDecisionSnapshot, "symbol" | "direction" | "signalTime">): string {
  return `${snapshot.symbol}|${snapshot.direction}|${snapshot.signalTime}`;
}

export function compareDecisionSnapshots(left: M3HDecisionSnapshot, right: M3HDecisionSnapshot): number {
  const timeDifference = left.signalTime - right.signalTime;
  if (timeDifference !== 0) return timeDifference;
  const symbolDifference = symbolIndex(left.symbol) - symbolIndex(right.symbol);
  if (symbolDifference !== 0) return symbolDifference;
  return directionIndex(left.direction) - directionIndex(right.direction);
}

function validateDecisionSnapshot(snapshot: M3HDecisionSnapshot): void {
  requireSafeTimestamp(snapshot.signalTime, "M3-H decision signalTime");
  if (!RESEARCH_SYMBOL_ORDER.includes(snapshot.symbol)) throw new M3HSelectorError(`Unsupported M3-H symbol: ${snapshot.symbol}.`);
  if (!RESEARCH_DIRECTION_ORDER.includes(snapshot.direction)) throw new M3HSelectorError(`Unsupported M3-H direction: ${snapshot.direction}.`);
  requireFiniteNumber(snapshot.totalScore, "M3-H decision totalScore");
  requireFiniteNumber(snapshot.entryReference, "M3-H decision entryReference");
  requireFiniteNumber(snapshot.stopDistance, "M3-H decision stopDistance");
}

export function canonicalizeDecisionSnapshots(
  snapshots: readonly M3HDecisionSnapshot[],
): readonly M3HDecisionSnapshot[] {
  const identities = new Set<string>();
  for (const snapshot of snapshots) {
    validateDecisionSnapshot(snapshot);
    const identity = decisionSnapshotIdentity(snapshot);
    if (identities.has(identity)) throw new M3HSelectorError(`Duplicate M3-H decision identity: ${identity}.`);
    identities.add(identity);
  }
  return Object.freeze([...snapshots].sort(compareDecisionSnapshots));
}

function selectCooldown(
  snapshots: readonly M3HDecisionSnapshot[],
  selector: Extract<M3HSelectorSpec, { kind: "H1_COOLDOWN" }>,
): readonly M3HDecisionSnapshot[] {
  const lastAccepted = new Map<string, number>();
  const retained: M3HDecisionSnapshot[] = [];
  for (const snapshot of snapshots) {
    const key = `${snapshot.symbol}|${snapshot.direction}`;
    const previous = lastAccepted.get(key);
    if (previous === undefined) {
      retained.push(snapshot);
      lastAccepted.set(key, snapshot.signalTime);
      continue;
    }
    const deltaHours = (snapshot.signalTime - previous) / (60 * 60 * 1_000);
    if (deltaHours <= 0) throw new M3HSelectorError(`M3-H cooldown stream is not strictly chronological for ${key}.`);
    if (deltaHours <= selector.cooldownHours) continue;
    retained.push(snapshot);
    lastAccepted.set(key, snapshot.signalTime);
  }
  return Object.freeze(retained);
}

function selectTopN(
  snapshots: readonly M3HDecisionSnapshot[],
  selector: Extract<M3HSelectorSpec, { kind: "H4_TOP_N" }>,
): readonly M3HDecisionSnapshot[] {
  const grouped = new Map<number, M3HDecisionSnapshot[]>();
  for (const snapshot of snapshots) {
    const group = grouped.get(snapshot.signalTime) ?? [];
    group.push(snapshot);
    grouped.set(snapshot.signalTime, group);
  }
  const retained = [...grouped.values()].flatMap((group) =>
    [...group]
      .sort((left, right) => right.totalScore - left.totalScore || symbolIndex(left.symbol) - symbolIndex(right.symbol) || directionIndex(left.direction) - directionIndex(right.direction))
      .slice(0, selector.topN),
  );
  return Object.freeze(retained.sort(compareDecisionSnapshots));
}

function selectCostProxy(
  snapshots: readonly M3HDecisionSnapshot[],
  selector: Extract<M3HSelectorSpec, { kind: "H2_COST_PROXY" }>,
): readonly M3HDecisionSnapshot[] {
  const retained: M3HDecisionSnapshot[] = [];
  for (const snapshot of snapshots) {
    if (!(snapshot.entryReference > 0) || !(snapshot.stopDistance > 0)) {
      throw new M3HSelectorError(
        `M3-H cost proxy input is invalid for ${decisionSnapshotIdentity(snapshot)}; candidate evidence is fail-closed.`,
      );
    }
    const proxy = 0.002 * snapshot.entryReference / snapshot.stopDistance;
    if (!Number.isFinite(proxy)) {
      throw new M3HSelectorError(
        `M3-H cost proxy is non-finite for ${decisionSnapshotIdentity(snapshot)}; candidate evidence is fail-closed.`,
      );
    }
    if (proxy <= selector.maxFrictionProxyR) retained.push(snapshot);
  }
  return Object.freeze(retained);
}

function selectScoreThreshold(
  snapshots: readonly M3HDecisionSnapshot[],
  selector: Extract<M3HSelectorSpec, { kind: "H3_SCORE_THRESHOLD" }>,
): readonly M3HDecisionSnapshot[] {
  return Object.freeze(snapshots.filter((snapshot) => snapshot.totalScore >= selector.minimumScore));
}

export function selectCandidateDecisionSnapshots(
  input: readonly M3HDecisionSnapshot[],
  selector: M3HSelectorSpec,
): readonly M3HDecisionSnapshot[] {
  const snapshots = canonicalizeDecisionSnapshots(input);
  const selected = selector.kind === "H1_COOLDOWN"
    ? selectCooldown(snapshots, selector)
    : selector.kind === "H4_TOP_N"
      ? selectTopN(snapshots, selector)
      : selector.kind === "H2_COST_PROXY"
        ? selectCostProxy(snapshots, selector)
        : selectScoreThreshold(snapshots, selector);
  const identities = new Set<string>();
  for (const snapshot of selected) identities.add(decisionSnapshotIdentity(snapshot));
  if (identities.size !== selected.length) throw new M3HSelectorError("M3-H selector produced duplicate identities.");
  return Object.freeze([...selected].sort(compareDecisionSnapshots));
}

export function decisionSnapshotKey(snapshot: M3HDecisionSnapshot): string {
  return stableStringify({
    signalTime: snapshot.signalTime,
    symbol: snapshot.symbol,
    direction: snapshot.direction,
    totalScore: snapshot.totalScore,
    entryReference: snapshot.entryReference,
    stopDistance: snapshot.stopDistance,
  });
}
