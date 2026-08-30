import { R15_CONFORMANCE_DOCUMENT, validateR15Conformance } from "../src/lib/research/m3-r15-round-015-conformance.ts";
import { validateR15Plan } from "../src/lib/research/m3-r15-round-015-plan.ts";
import { R15_SPEC_OBJECT, R15_SPEC_SHA256, R15_TARGET_THRESHOLD } from "../src/lib/research/m3-r15-round-015-protocol.ts";
import { R15_GATE_MACHINE_RECORD, R15_GATE_SHA256 } from "../src/lib/research/selection-gates-round-015.ts";

validateR15Plan();
validateR15Conformance();
if (R15_SPEC_OBJECT.horizonHours !== 4 || R15_TARGET_THRESHOLD !== 0.10 || R15_CONFORMANCE_DOCUMENT.resultAffectingDeviationCount !== 0 || R15_GATE_MACHINE_RECORD.gates.length !== 18 || R15_GATE_SHA256.length !== 64 || R15_SPEC_SHA256.length !== 64) throw new Error("R15 runtime import smoke failed.");
console.log(JSON.stringify({ status: "PASS", stage: "runtime-import-smoke", specSha256: R15_SPEC_SHA256, gateSha256: R15_GATE_SHA256, network: false, performance: false }, null, 2));
