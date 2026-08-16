import { fixedSymbolOrder } from "./scoring.ts";
import type { StrategyCandidate } from "./types.ts";

export function rankCandidates(
  candidates: readonly StrategyCandidate[],
): readonly StrategyCandidate[] {
  const indexed = candidates.map((candidate, index) => ({ candidate, index }));

  indexed.sort((left, right) => {
    const scoreDifference = right.candidate.totalScore - left.candidate.totalScore;
    if (scoreDifference !== 0) {
      return scoreDifference;
    }

    const symbolDifference =
      fixedSymbolOrder(left.candidate.symbol) -
      fixedSymbolOrder(right.candidate.symbol);
    if (symbolDifference !== 0) {
      return symbolDifference;
    }

    return left.index - right.index;
  });

  return Object.freeze(indexed.map(({ candidate }) => candidate));
}
