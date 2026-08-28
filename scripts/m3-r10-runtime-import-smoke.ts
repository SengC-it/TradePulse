import { readR10SpecConformance } from "../src/lib/research/m3-r10-round-010-conformance.ts";
import { validateR10Plan } from "../src/lib/research/m3-r10-round-010-plan.ts";
import { validateR10MachineRecord } from "../src/lib/research/selection-gates-round-010.ts";
import { r10FeatureNames } from "../src/lib/research/m3-r10-round-010-candidates.ts";
import { buildR10IntrabarPlan } from "../src/lib/research/m3-r10-round-010-intrabar-plan.ts";
import { existingR10OutputArtifacts } from "../src/lib/research/m3-r10-round-010-performance.ts";

readR10SpecConformance();
validateR10Plan();
validateR10MachineRecord();
if (r10FeatureNames().length !== 10) throw new Error("R10 runtime-import smoke expected ten fixed features.");
if (typeof buildR10IntrabarPlan !== "function") throw new Error("R10 intrabar plan module did not load.");
console.log(JSON.stringify({
  status: "PASS",
  imported: ["protocol", "plan", "selection-gates", "candidates", "intrabar-plan", "performance"],
  outputArtifactsPresent: existingR10OutputArtifacts().length,
  network: false,
  performance: false,
}, null, 2));
