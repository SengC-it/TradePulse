import { readR9SpecConformance } from "../src/lib/research/m3-r9-round-009-conformance.ts";
import { validateR9Plan } from "../src/lib/research/m3-r9-round-009-plan.ts";
import { validateR9MachineRecord } from "../src/lib/research/selection-gates-round-009.ts";
import { r9FeatureNames } from "../src/lib/research/m3-r9-round-009-candidates.ts";
import { buildR9IntrabarPlan } from "../src/lib/research/m3-r9-round-009-intrabar-plan.ts";
import { existingR9OutputArtifacts } from "../src/lib/research/m3-r9-round-009-performance.ts";

readR9SpecConformance();
validateR9Plan();
validateR9MachineRecord();
if (r9FeatureNames().length !== 10) throw new Error("R9 runtime-import smoke expected ten fixed features.");
if (typeof buildR9IntrabarPlan !== "function") throw new Error("R9 intrabar plan module did not load.");
console.log(JSON.stringify({
  status: "PASS",
  imported: ["protocol", "plan", "selection-gates", "candidates", "intrabar-plan", "performance"],
  outputArtifactsPresent: existingR9OutputArtifacts().length,
  network: false,
  performance: false,
}, null, 2));
