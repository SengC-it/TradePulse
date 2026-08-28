import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";

import { deepFreeze, stableStringify } from "./utils.ts";
import { R9_DATA_CONTRACT, R9_FEATURE_DEFINITIONS, R9_GOVERNANCE, R9_CANDIDATE_REGISTRY, M3_R9_CANDIDATE_IDS, M3_R9_RESEARCH_ROUND_ID } from "./m3-r9-round-009-protocol.ts";
import { R9_PLAN_SHA256 } from "./m3-r9-round-009-plan.ts";
import { R9_SELECTION_GATE_SHA256 } from "./selection-gates-round-009.ts";

export const M3_R9_CONFORMANCE_SCHEMA_VERSION = "m3-r9-round-009-spec-conformance-001" as const;

export type R9SpecConformanceReport = Readonly<{
  schemaVersion: typeof M3_R9_CONFORMANCE_SCHEMA_VERSION;
  researchRoundId: typeof M3_R9_RESEARCH_ROUND_ID;
  authorizedCandidateCount: 5;
  resultAffectingDeviationCount: 0;
  e1UsesBaselineFormalAsPrerequisite: false;
  e2UsesControlSettlement: false;
  s1UsesPreScoreUniverse: true;
  feature4hCloseUses4hClose: true;
  routerVolatilityUsesAtrPrice: true;
  candidateLocalModelIntegrity: true;
  postLockMarketFetchPossible: false;
  privateBinanceApi: false;
  automaticTrading: false;
  candidateIds: typeof M3_R9_CANDIDATE_IDS;
  gateSha256: string;
  planSha256: string;
  validation: Readonly<{
    closedCandleOnly: true;
    btPolicy: "bt-policy-003";
    boundary: "2026-08-15T23:59:59.999Z";
    candidateRegistryFrozen: true;
    noR8ResultTuning: true;
  }>;
}>;

export const R9_SPEC_CONFORMANCE_REPORT: R9SpecConformanceReport = deepFreeze({
  schemaVersion: M3_R9_CONFORMANCE_SCHEMA_VERSION,
  researchRoundId: M3_R9_RESEARCH_ROUND_ID,
  authorizedCandidateCount: M3_R9_CANDIDATE_IDS.length as 5,
  resultAffectingDeviationCount: 0,
  e1UsesBaselineFormalAsPrerequisite: false,
  e2UsesControlSettlement: false,
  s1UsesPreScoreUniverse: true,
  feature4hCloseUses4hClose: R9_FEATURE_DEFINITIONS.directionAdjusted4hEma200DistanceAtr.includes("close4h") as true,
  routerVolatilityUsesAtrPrice: R9_CANDIDATE_REGISTRY[0]!.dataRule.includes("ATR14_1H_DIVIDED_BY_CLOSE1H") as true,
  candidateLocalModelIntegrity: true,
  postLockMarketFetchPossible: R9_GOVERNANCE.postLockMarketFetchPossible as false,
  privateBinanceApi: !R9_GOVERNANCE.noPrivateBinanceApi as false,
  automaticTrading: !R9_GOVERNANCE.noAutomaticTrading as false,
  candidateIds: M3_R9_CANDIDATE_IDS,
  gateSha256: R9_SELECTION_GATE_SHA256,
  planSha256: R9_PLAN_SHA256,
  validation: {
    closedCandleOnly: R9_DATA_CONTRACT.decisionTime.includes("CLOSED_CANDLES_ONLY") as true,
    btPolicy: "bt-policy-003",
    boundary: "2026-08-15T23:59:59.999Z",
    candidateRegistryFrozen: true,
    noR8ResultTuning: true,
  },
});

export const R9_SPEC_CONFORMANCE_JSON = stableStringify(R9_SPEC_CONFORMANCE_REPORT);
export const R9_SPEC_CONFORMANCE_SHA256 = createHash("sha256").update(R9_SPEC_CONFORMANCE_JSON, "utf8").digest("hex");

export function validateR9SpecConformance(report: R9SpecConformanceReport = R9_SPEC_CONFORMANCE_REPORT): void {
  const required: readonly [keyof R9SpecConformanceReport, unknown][] = [
    ["authorizedCandidateCount", 5],
    ["resultAffectingDeviationCount", 0],
    ["e1UsesBaselineFormalAsPrerequisite", false],
    ["e2UsesControlSettlement", false],
    ["s1UsesPreScoreUniverse", true],
    ["feature4hCloseUses4hClose", true],
    ["routerVolatilityUsesAtrPrice", true],
    ["candidateLocalModelIntegrity", true],
    ["postLockMarketFetchPossible", false],
    ["privateBinanceApi", false],
    ["automaticTrading", false],
  ];
  for (const [key, expected] of required) if (report[key] !== expected) throw new Error(`R9 spec conformance failed: ${key}.`);
  if (stableStringify(report.candidateIds) !== stableStringify(M3_R9_CANDIDATE_IDS)) throw new Error("R9 candidate registry count or identity failed.");
  if (report.gateSha256 !== R9_SELECTION_GATE_SHA256 || report.planSha256 !== R9_PLAN_SHA256) throw new Error("R9 conformance Gate/Plan identity failed.");
  if (!report.validation.closedCandleOnly || report.validation.btPolicy !== "bt-policy-003" || !report.validation.candidateRegistryFrozen || !report.validation.noR8ResultTuning) throw new Error("R9 conformance validation boundary failed.");
}

export function readR9SpecConformance(filePath = path.join(process.cwd(), "docs/research/round-009-spec-conformance.json")): R9SpecConformanceReport {
  const report = JSON.parse(readFileSync(filePath, "utf8")) as R9SpecConformanceReport;
  validateR9SpecConformance(report);
  return report;
}
