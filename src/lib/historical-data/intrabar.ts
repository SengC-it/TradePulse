import type { ResearchSymbol } from "../config/constants.ts";

export type IntrabarSettlementIdentity = Readonly<{
  symbol: ResearchSymbol;
  exitCandleOpenTime: number;
  settlementOnly: boolean;
}>;

export function intrabarSettlementIdentityKey(
  value: Pick<IntrabarSettlementIdentity, "symbol" | "exitCandleOpenTime">,
): string {
  return `${value.symbol}:${value.exitCandleOpenTime}`;
}

export function deduplicateIntrabarSettlementIdentities<T extends IntrabarSettlementIdentity>(
  values: readonly T[],
): Readonly<{
  unique: readonly T[];
  duplicateKeys: readonly string[];
  conflictingKeys: readonly string[];
}> {
  const byKey = new Map<string, T>();
  const duplicateKeys = new Set<string>();
  const conflictingKeys = new Set<string>();
  for (const value of values) {
    const key = intrabarSettlementIdentityKey(value);
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, value);
      continue;
    }
    duplicateKeys.add(key);
    if (existing.settlementOnly !== value.settlementOnly) conflictingKeys.add(key);
  }
  return Object.freeze({
    unique: Object.freeze([...byKey.values()]),
    duplicateKeys: Object.freeze([...duplicateKeys]),
    conflictingKeys: Object.freeze([...conflictingKeys]),
  });
}
