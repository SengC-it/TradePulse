import type {
  SignalGrade,
  StrategyEvaluation,
  StrategyScoreBreakdown,
} from "../strategy/types.ts";

export type SignalEvaluationRecord = Readonly<{
  scanRunId: string;
  strategyVersion: string;
  evaluatedAt: string;
  symbol: StrategyEvaluation["symbol"];
  direction: StrategyEvaluation["direction"];
  status: StrategyEvaluation["status"];
  reasonCode: StrategyEvaluation["reason"];
  symbolRegime: StrategyEvaluation["symbolRegime"];
  btcRegime: StrategyEvaluation["btcRegime"];
  score: number | null;
  grade: SignalGrade | null;
  formalSignal: boolean;
  entryReference: number | null;
  stopReference: number | null;
  takeProfitReference: number | null;
  scoreBreakdown: StrategyScoreBreakdown | null;
}>;

export function mapStrategyEvaluations(input: Readonly<{
  scanRunId: string;
  evaluatedAt: string;
  evaluations: readonly StrategyEvaluation[];
}>): readonly SignalEvaluationRecord[] {
  return input.evaluations.map((evaluation) => ({
    scanRunId: input.scanRunId,
    strategyVersion: evaluation.strategyVersion,
    evaluatedAt: input.evaluatedAt,
    symbol: evaluation.symbol,
    direction: evaluation.direction,
    status: evaluation.status,
    reasonCode: evaluation.reason,
    symbolRegime: evaluation.symbolRegime,
    btcRegime: evaluation.btcRegime,
    score: evaluation.candidate?.totalScore ?? null,
    grade: evaluation.candidate?.grade ?? null,
    formalSignal: evaluation.candidate?.formalSignal === true,
    entryReference: evaluation.candidate?.entryReference ?? null,
    stopReference: evaluation.candidate?.stopReference ?? null,
    takeProfitReference: evaluation.candidate?.takeProfitReference ?? null,
    scoreBreakdown: evaluation.candidate?.breakdown ?? null,
  }));
}
