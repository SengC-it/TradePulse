import type { BacktestSignalResult } from "../backtest/types.ts";
import { adaptBacktestSignalResult } from "./adapter.ts";
import type { NormalizedResearchSignal } from "./types.ts";
import { stableStringify } from "./utils.ts";
import type { R12CandidateId, R12Cohort } from "./m3-r12-round-012-protocol.ts";

const HOUR_MS = 60 * 60 * 1_000;

export type R12FeatureHints = Readonly<{
  distanceFromEma20Atr?: number | null;
}>;

export type R12FormalInput = Readonly<{
  raw: BacktestSignalResult;
  signal?: NormalizedResearchSignal;
  feature?: R12FeatureHints;
}>;

export type R12ClassifiedRecord = Readonly<{
  raw: BacktestSignalResult;
  signal: NormalizedResearchSignal;
  signalId: string;
  thesisId: string;
  thesisOrdinal: number;
  cohort: R12Cohort;
  anchorSignalId: string;
  timeSinceFirstHours: number;
  directionAdjustedPriceExtensionFromFirstAtr: number | null;
  distanceFromEma20Atr: number | null;
  scoreDeltaFromFirst: number;
}>;

function signalIdentity(raw: BacktestSignalResult): string {
  return `${raw.snapshot.symbol}|${raw.snapshot.direction}|${raw.snapshot.signalTime}`;
}

function compareInputs(left: R12FormalInput, right: R12FormalInput): number {
  return left.raw.snapshot.signalTime - right.raw.snapshot.signalTime
    || left.raw.snapshot.symbol.localeCompare(right.raw.snapshot.symbol)
    || left.raw.snapshot.direction.localeCompare(right.raw.snapshot.direction)
    || signalIdentity(left.raw).localeCompare(signalIdentity(right.raw));
}

/** Returns the anchor's own terminal timestamp; null means it stays active through the boundary. */
export function r12AnchorTerminalTime(raw: BacktestSignalResult): number | null {
  if (raw.status === "EXECUTED") {
    if (raw.exitTime === null) throw new Error("R12 EXECUTED anchor is missing exitTime.");
    return raw.exitTime;
  }
  if (raw.status === "ENTRY_OUTSIDE_BRACKET") return raw.entryTime ?? raw.snapshot.signalTime;
  if (raw.status === "PERIOD_END_CENSORED") return null;
  throw new Error(`R12 cannot classify ${raw.status} as an active thesis anchor.`);
}

function cohortForOrdinal(ordinal: number): R12Cohort {
  return ordinal === 1 ? "FIRST" : ordinal === 2 ? "FOLLOWUP_1" : "FOLLOWUP_2_PLUS";
}

function classifyOne(
  input: R12FormalInput,
  anchor: Readonly<{ raw: BacktestSignalResult; signal: NormalizedResearchSignal; signalId: string; thesisId: string }> | null,
  ordinal: number,
): R12ClassifiedRecord {
  const signal = input.signal ?? adaptBacktestSignalResult(input.raw);
  const signalId = signalIdentity(input.raw);
  const anchorSignalId = anchor?.signalId ?? signalId;
  const firstSignalTime = anchor?.raw.snapshot.signalTime ?? input.raw.snapshot.signalTime;
  const firstEntry = anchor?.raw.snapshot.entryReference ?? input.raw.snapshot.entryReference;
  const firstAtr = anchor?.raw.snapshot.stopAtr ?? input.raw.snapshot.stopAtr;
  const directionSign = input.raw.snapshot.direction === "LONG" ? 1 : -1;
  const extension = Number.isFinite(firstAtr) && firstAtr > 0
    ? directionSign * (input.raw.snapshot.entryReference - firstEntry) / firstAtr
    : null;
  const distance = input.feature?.distanceFromEma20Atr ?? null;
  return Object.freeze({
    raw: input.raw,
    signal,
    signalId,
    thesisId: anchor?.thesisId ?? `R12-THESIS-${input.raw.snapshot.symbol}-${input.raw.snapshot.direction}-${input.raw.snapshot.signalTime}`,
    thesisOrdinal: ordinal,
    cohort: cohortForOrdinal(ordinal),
    anchorSignalId,
    timeSinceFirstHours: (input.raw.snapshot.signalTime - firstSignalTime) / HOUR_MS,
    directionAdjustedPriceExtensionFromFirstAtr: extension,
    distanceFromEma20Atr: distance,
    scoreDeltaFromFirst: input.raw.snapshot.totalScore - (anchor?.raw.snapshot.totalScore ?? input.raw.snapshot.totalScore),
  });
}

/**
 * Classifies only the existing formal baseline stream. State is determined by
 * decision timestamps and the anchor's own settlement lifecycle; no result of
 * a later signal can affect an earlier classification.
 */
export function classifyR12FormalSignals(inputs: readonly R12FormalInput[]): readonly R12ClassifiedRecord[] {
  const ordered = [...inputs].sort(compareInputs);
  const seen = new Set<string>();
  const active = new Map<string, Readonly<{ anchor: R12ClassifiedRecord; nextOrdinal: number }>>();
  const classified: R12ClassifiedRecord[] = [];
  for (const input of ordered) {
    const raw = input.raw;
    const key = `${raw.snapshot.symbol}|${raw.snapshot.direction}`;
    const identity = signalIdentity(raw);
    if (seen.has(identity)) throw new Error(`R12 duplicate formal signal identity: ${identity}.`);
    seen.add(identity);
    if (raw.status === "DATA_INCOMPLETE" || raw.status === "SETTLEMENT_AMBIGUOUS") {
      throw new Error(`R12 fail-closed classification for ${identity}: ${raw.status}.`);
    }
    const current = active.get(key);
    const terminalTime = current ? r12AnchorTerminalTime(current.anchor.raw) : null;
    if (current && terminalTime !== null && terminalTime <= raw.snapshot.signalTime) active.delete(key);
    const activeState = active.get(key) ?? null;
    const anchor = activeState?.anchor ?? null;
    const record = classifyOne(input, anchor ? {
      raw: anchor.raw,
      signal: anchor.signal,
      signalId: anchor.signalId,
      thesisId: anchor.thesisId,
    } : null, activeState?.nextOrdinal ?? 1);
    classified.push(record);
    if (!anchor) active.set(key, Object.freeze({ anchor: record, nextOrdinal: 2 }));
    else active.set(key, Object.freeze({ anchor, nextOrdinal: (activeState?.nextOrdinal ?? 1) + 1 }));
  }
  return Object.freeze(classified);
}

export function retainR12Candidate(records: readonly R12ClassifiedRecord[], candidateId: R12CandidateId): readonly R12ClassifiedRecord[] {
  if (candidateId === "R12-D1-FIRST-ONLY") return Object.freeze(records.filter((record) => record.cohort === "FIRST"));
  if (candidateId === "R12-D2-FIRST-PLUS-ONE") return Object.freeze(records.filter((record) => record.cohort === "FIRST" || record.cohort === "FOLLOWUP_1"));
  throw new Error(`Unknown R12 candidate: ${candidateId}.`);
}

/** Proves that filtering reuses the exact CONTROL settlement, rather than re-settling candidates. */
export function assertR12CandidateSettlementIdentity(
  control: readonly R12ClassifiedRecord[],
  candidate: readonly R12ClassifiedRecord[],
): true {
  const byId = new Map(control.map((record) => [record.signalId, record]));
  for (const retained of candidate) {
    const source = byId.get(retained.signalId);
    if (!source) throw new Error(`R12 candidate signal is absent from CONTROL: ${retained.signalId}.`);
    const sourceIdentity = {
      status: source.raw.status,
      entryTime: source.raw.entryTime,
      exitTime: source.raw.exitTime,
      grossR: source.raw.grossR,
      feeR: source.raw.feeR,
      fundingR: source.raw.fundingR,
      netR: source.raw.netR,
    };
    const candidateIdentity = {
      status: retained.raw.status,
      entryTime: retained.raw.entryTime,
      exitTime: retained.raw.exitTime,
      grossR: retained.raw.grossR,
      feeR: retained.raw.feeR,
      fundingR: retained.raw.fundingR,
      netR: retained.raw.netR,
    };
    if (stableStringify(sourceIdentity) !== stableStringify(candidateIdentity)) {
      throw new Error(`R12 candidate settlement diverged from CONTROL: ${retained.signalId}.`);
    }
  }
  return true;
}

export function r12CohortCounts(records: readonly R12ClassifiedRecord[]): Readonly<Record<R12Cohort, number>> {
  return Object.freeze({
    FIRST: records.filter((record) => record.cohort === "FIRST").length,
    FOLLOWUP_1: records.filter((record) => record.cohort === "FOLLOWUP_1").length,
    FOLLOWUP_2_PLUS: records.filter((record) => record.cohort === "FOLLOWUP_2_PLUS").length,
  });
}
