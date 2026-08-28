import "../src/lib/research/m3-r7-round-007-protocol.ts";
import { validateR7MachineRecord } from "../src/lib/research/selection-gates-round-007.ts";
import { validateR7Plan } from "../src/lib/research/m3-r7-round-007-plan.ts";
import "../src/lib/research/m3-r7-round-007-intrabar-plan.ts";
import "../src/lib/research/m3-r7-round-007-model.ts";
import "../src/lib/research/m3-r7-round-007-candidates.ts";
import "../src/lib/research/m3-r7-round-007-performance.ts";

validateR7MachineRecord();
validateR7Plan();
console.log("M3-R7 native runtime import smoke: PASS");
