import { readR12SpecConformance, validateR12SpecConformance } from "../src/lib/research/m3-r12-round-012-conformance.ts";
import { validateR12Plan } from "../src/lib/research/m3-r12-round-012-plan.ts";
import { validateR12MachineRecord } from "../src/lib/research/selection-gates-round-012.ts";
import { existingR12OutputArtifacts } from "../src/lib/research/m3-r12-round-012-performance.ts";
import { M3_R12_CANDIDATE_IDS, M3_R12_RESEARCH_ROUND_ID } from "../src/lib/research/m3-r12-round-012-protocol.ts";

const conformance = readR12SpecConformance();
validateR12SpecConformance(conformance);
validateR12Plan();
validateR12MachineRecord();
if (M3_R12_CANDIDATE_IDS.length !== 2 || M3_R12_RESEARCH_ROUND_ID !== "baseline-002-research-round-012") throw new Error("R12 runtime-import smoke identity failed.");
console.log(JSON.stringify({
  status: "PASS",
  imported: ["protocol", "plan", "selection-gates", "thesis", "conformance", "performance"],
  outputArtifactsPresent: existingR12OutputArtifacts().length,
  network: false,
  performance: false,
}, null, 2));
