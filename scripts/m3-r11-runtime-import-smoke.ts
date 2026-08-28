import { readR11SpecConformance } from "../src/lib/research/m3-r11-round-011-conformance.ts";
import { validateR11Plan } from "../src/lib/research/m3-r11-round-011-plan.ts";
import { validateR11MachineRecord } from "../src/lib/research/selection-gates-round-011.ts";
import { r11FeatureNames } from "../src/lib/research/m3-r11-round-011-candidates.ts";
import { buildR11IntrabarPlan } from "../src/lib/research/m3-r11-round-011-intrabar-plan.ts";
import { existingR11OutputArtifacts } from "../src/lib/research/m3-r11-round-011-performance.ts";

readR11SpecConformance();
validateR11Plan();
validateR11MachineRecord();
if (r11FeatureNames().length !== 10) throw new Error("R11 runtime-import smoke expected ten fixed features.");
if (typeof buildR11IntrabarPlan !== "function") throw new Error("R11 intrabar plan module did not load.");
console.log(JSON.stringify({
  status: "PASS",
  imported: ["protocol", "plan", "selection-gates", "candidates", "intrabar-plan", "performance"],
  outputArtifactsPresent: existingR11OutputArtifacts().length,
  network: false,
  performance: false,
}, null, 2));
