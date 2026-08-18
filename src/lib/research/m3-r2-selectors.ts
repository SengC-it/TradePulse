import { RESEARCH_SYMBOLS, type ResearchSymbol } from "../config/constants.ts";
import type { M3R2DecisionSnapshot } from "./m3-r2-decision-snapshot.ts";
import {
  M3_R2_ROUND_002_CANDIDATE_IDS,
  type M3R2CandidateId,
} from "./selection-gates-round-002.ts";
import { M3_R2_ROUND_002_CONTROL_ID } from "./m3-r2-round-002-plan.ts";

export class M3R2SelectorError extends Error {
  public readonly name = "M3R2SelectorError";
}

function finite(value: number): boolean {
  return Number.isFinite(value);
}

function symbolIndex(symbol: ResearchSymbol): number {
  return RESEARCH_SYMBOLS.indexOf(symbol);
}

function directionIndex(direction: M3R2DecisionSnapshot["direction"]): number {
  return direction === "LONG" ? 0 : 1;
}

export function m3R2DecisionSnapshotIdentity(
  snapshot: Pick<M3R2DecisionSnapshot, "symbol" | "direction" | "signalTime">,
): string {
  return `${snapshot.symbol}|${snapshot.direction}|${snapshot.signalTime}`;
}

function compareSnapshots(left: M3R2DecisionSnapshot, right: M3R2DecisionSnapshot): number {
  return left.signalTime - right.signalTime || symbolIndex(left.symbol) - symbolIndex(right.symbol) || directionIndex(left.direction) - directionIndex(right.direction);
}

function validSnapshot(snapshot: M3R2DecisionSnapshot): boolean {
  return (
    Number.isSafeInteger(snapshot.signalTime) && snapshot.signalTime >= 0 &&
    RESEARCH_SYMBOLS.includes(snapshot.symbol) &&
    (snapshot.direction === "LONG" || snapshot.direction === "SHORT") &&
    (snapshot.btcRegime === "BTC_STRONG_BULL" || snapshot.btcRegime === "BTC_NEUTRAL" || snapshot.btcRegime === "BTC_STRONG_BEAR") &&
    [
      snapshot.symbol4hClose,
      snapshot.symbol4hEma50,
      snapshot.symbol4hEma200,
      snapshot.symbol4hAtr,
      snapshot.symbol4hEma200FiveBarsAgo,
      snapshot.nearestBaselinePullbackTouchAgeBars,
      snapshot.current1hQuoteVolume,
      snapshot.previous20Closed1hQuoteVolumeMean,
      snapshot.current1hClose,
      snapshot.previous3BreakoutExtreme,
      snapshot.current1hAtr,
      snapshot.breakoutMarginAtr,
    ].every(finite)
  );
}

function normalized(value: number, atr: number): number | null {
  return finite(value) && finite(atr) && atr > 0 && finite(value / atr) ? value / atr : null;
}

export function passesM3R2H6(snapshot: M3R2DecisionSnapshot): boolean {
  if (!validSnapshot(snapshot)) return false;
  if (snapshot.symbol === "BTCUSDT") return true;
  return snapshot.direction === "LONG"
    ? snapshot.btcRegime === "BTC_STRONG_BULL"
    : snapshot.btcRegime === "BTC_STRONG_BEAR";
}

export function passesM3R2H7(snapshot: M3R2DecisionSnapshot): boolean {
  if (!validSnapshot(snapshot) || snapshot.symbol4hAtr <= 0) return false;
  const closeDistance = snapshot.direction === "LONG"
    ? snapshot.symbol4hClose - snapshot.symbol4hEma50
    : snapshot.symbol4hEma50 - snapshot.symbol4hClose;
  const emaSpread = snapshot.direction === "LONG"
    ? snapshot.symbol4hEma50 - snapshot.symbol4hEma200
    : snapshot.symbol4hEma200 - snapshot.symbol4hEma50;
  const emaSlope = snapshot.direction === "LONG"
    ? snapshot.symbol4hEma200 - snapshot.symbol4hEma200FiveBarsAgo
    : snapshot.symbol4hEma200FiveBarsAgo - snapshot.symbol4hEma200;
  const normalizedCloseDistance = normalized(closeDistance, snapshot.symbol4hAtr);
  const normalizedEmaSpread = normalized(emaSpread, snapshot.symbol4hAtr);
  const normalizedEmaSlope = normalized(emaSlope, snapshot.symbol4hAtr);
  return normalizedCloseDistance !== null && normalizedCloseDistance >= 1.0 &&
    normalizedEmaSpread !== null && normalizedEmaSpread >= 0.5 &&
    normalizedEmaSlope !== null && normalizedEmaSlope >= 0.1;
}

export function passesM3R2H8(snapshot: M3R2DecisionSnapshot): boolean {
  return validSnapshot(snapshot) && Number.isInteger(snapshot.nearestBaselinePullbackTouchAgeBars) &&
    snapshot.nearestBaselinePullbackTouchAgeBars >= 1 && snapshot.nearestBaselinePullbackTouchAgeBars <= 2;
}

export function passesM3R2H9(snapshot: M3R2DecisionSnapshot): boolean {
  if (!validSnapshot(snapshot) || snapshot.previous20Closed1hQuoteVolumeMean <= 0 || snapshot.current1hQuoteVolume < 0) return false;
  const ratio = snapshot.current1hQuoteVolume / snapshot.previous20Closed1hQuoteVolumeMean;
  return finite(ratio) && ratio >= 1.0;
}

export function passesM3R2H10(snapshot: M3R2DecisionSnapshot): boolean {
  return validSnapshot(snapshot) && snapshot.current1hAtr > 0 && snapshot.breakoutMarginAtr >= 0.1;
}

function passesCandidate(snapshot: M3R2DecisionSnapshot, candidateId: M3R2CandidateId): boolean {
  switch (candidateId) {
    case "R2-H6-STRICT-BTC":
      return passesM3R2H6(snapshot);
    case "R2-H7-STRONG-SYMBOL":
      return passesM3R2H7(snapshot);
    case "R2-H8-RECENT-PULLBACK":
      return passesM3R2H8(snapshot);
    case "R2-H9-VOLUME-CONFIRM":
      return passesM3R2H9(snapshot);
    case "R2-H10-BREAKOUT-010":
      return passesM3R2H10(snapshot);
    case "R2-C1-BTC-STRONG-SYMBOL":
      return passesM3R2H6(snapshot) && passesM3R2H7(snapshot);
    case "R2-C2-STRONG-SYMBOL-RECENT-PULLBACK":
      return passesM3R2H7(snapshot) && passesM3R2H8(snapshot);
    case "R2-C3-STRONG-SYMBOL-VOLUME-BREAKOUT":
      return passesM3R2H7(snapshot) && passesM3R2H9(snapshot) && passesM3R2H10(snapshot);
    case "R2-C4-BTC-STRONG-SYMBOL-VOLUME-BREAKOUT":
      return passesM3R2H6(snapshot) && passesM3R2H7(snapshot) && passesM3R2H9(snapshot) && passesM3R2H10(snapshot);
  }
}

export const M3_R2_SELECTOR_BY_CANDIDATE_ID = Object.freeze(
  Object.fromEntries(M3_R2_ROUND_002_CANDIDATE_IDS.map((candidateId) => [candidateId, (snapshot: M3R2DecisionSnapshot) => passesCandidate(snapshot, candidateId)])),
) as Readonly<Record<M3R2CandidateId, (snapshot: M3R2DecisionSnapshot) => boolean>>;

function validateCollection(snapshots: readonly M3R2DecisionSnapshot[]): void {
  const identities = new Set<string>();
  for (const snapshot of snapshots) {
    if (!validSnapshot(snapshot)) throw new M3R2SelectorError("Invalid M3-R2 decision snapshot; selector is fail-closed.");
    const identity = m3R2DecisionSnapshotIdentity(snapshot);
    if (identities.has(identity)) throw new M3R2SelectorError(`Duplicate M3-R2 decision identity: ${identity}.`);
    identities.add(identity);
  }
}

export function selectM3R2CandidateSnapshots(
  candidateId: M3R2CandidateId | typeof M3_R2_ROUND_002_CONTROL_ID,
  snapshots: readonly M3R2DecisionSnapshot[],
): readonly M3R2DecisionSnapshot[] {
  validateCollection(snapshots);
  const ordered = [...snapshots].sort(compareSnapshots);
  const selected = candidateId === M3_R2_ROUND_002_CONTROL_ID
    ? ordered
    : ordered.filter(M3_R2_SELECTOR_BY_CANDIDATE_ID[candidateId]);
  return Object.freeze(selected);
}

export function selectM3R2Candidates(
  snapshots: readonly M3R2DecisionSnapshot[],
): Readonly<Record<M3R2CandidateId, readonly M3R2DecisionSnapshot[]>> {
  return Object.freeze(Object.fromEntries(
    M3_R2_ROUND_002_CANDIDATE_IDS.map((candidateId) => [candidateId, selectM3R2CandidateSnapshots(candidateId, snapshots)]),
  )) as Readonly<Record<M3R2CandidateId, readonly M3R2DecisionSnapshot[]>>;
}
