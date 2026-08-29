import type { ResearchFoldId } from "./constants.ts";
import { R13_SYMBOLS, type R13Direction } from "./m3-r13-round-013-protocol.ts";
import { R13_HOUR_MS, R13_PRIMARY_DELAY_MS, r13ActionableAt } from "./m3-r13-round-013-labels.ts";

export const R13_PURGE_EMBARGO_HOURS = 24 as const;
export const R13_PURGE_EMBARGO_MS = R13_PURGE_EMBARGO_HOURS * R13_HOUR_MS;

export type R13ScoredOpportunity = Readonly<{
  symbol: string;
  direction: R13Direction;
  prediction: number;
}>;

export type R13TopOneSelection<T extends R13ScoredOpportunity> = Readonly<{
  selected: T | null;
  noTrade: boolean;
}>;

function directionOrder(direction: R13Direction): number {
  return direction === "LONG" ? 0 : 1;
}

/** A training label must finish before validation begins under the 24-hour purge. */
export function isR13TrainingObservationPurgeSafe(input: Readonly<{
  decisionTime: number;
  validationStartTime: number;
  maximumLabelHorizonHours?: number;
  delayMs?: number;
}>): boolean {
  const horizonMs = (input.maximumLabelHorizonHours ?? R13_PURGE_EMBARGO_HOURS) * R13_HOUR_MS;
  const actionableAt = r13ActionableAt(input.decisionTime, input.delayMs ?? R13_PRIMARY_DELAY_MS);
  return actionableAt + horizonMs < input.validationStartTime;
}

export function r13PurgeTrainingObservations<T extends Readonly<{ decisionTime: number }>>(
  observations: readonly T[],
  validationStartTime: number,
): readonly T[] {
  return Object.freeze(observations.filter((observation) => isR13TrainingObservationPurgeSafe({ decisionTime: observation.decisionTime, validationStartTime })));
}

/** Select exactly one positive-prediction opportunity from one timestamp. */
export function r13SelectTopOne<T extends R13ScoredOpportunity>(opportunities: readonly T[]): R13TopOneSelection<T> {
  const finite = opportunities.filter((opportunity) => Number.isFinite(opportunity.prediction));
  if (finite.length === 0) return Object.freeze({ selected: null, noTrade: true });
  const ordered = [...finite].sort((left, right) => right.prediction - left.prediction || R13_SYMBOLS.indexOf(left.symbol as (typeof R13_SYMBOLS)[number]) - R13_SYMBOLS.indexOf(right.symbol as (typeof R13_SYMBOLS)[number]) || directionOrder(left.direction) - directionOrder(right.direction));
  const top = ordered[0]!;
  return Object.freeze({ selected: top.prediction > 0 ? top : null, noTrade: top.prediction <= 0 });
}

export function r13ResearchTrainingRange(foldId: ResearchFoldId, range: Readonly<{ startTime: number; endTime: number }>): Readonly<{ startTime: number; endTime: number; purgeEmbargoStartTime: number; purgeEmbargoEndTime: number; foldId: ResearchFoldId }> {
  return Object.freeze({ startTime: range.startTime, endTime: range.endTime, purgeEmbargoStartTime: range.endTime + 1, purgeEmbargoEndTime: range.endTime + R13_PURGE_EMBARGO_MS, foldId });
}
