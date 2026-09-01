import { validateR16Plan } from "../src/lib/research/m3-r16-round-016-plan.ts";
import { R16_ALPHA_MICRO_FEATURE_NAMES, R16_BETA_MICRO_FEATURE_NAMES, R16_GATE_THRESHOLDS, R16_SPEC_OBJECT, R16_SPEC_SHA256, R16_FOLD_IDS, M3_R16_PERFORMANCE_LOCK, R16_ARTIFACT_HASH_METHOD } from "../src/lib/research/m3-r16-round-016-protocol.ts";
import { R16_GATE_SHA256 } from "../src/lib/research/selection-gates-round-016.ts";

validateR16Plan();
if (R16_FOLD_IDS.length !== 6 || R16_BETA_MICRO_FEATURE_NAMES.length !== 20 || R16_ALPHA_MICRO_FEATURE_NAMES.length !== 20 || R16_SPEC_OBJECT.model.lambda !== 10 || R16_GATE_THRESHOLDS.minimumCommonMaskCoverage !== 0.9 || M3_R16_PERFORMANCE_LOCK !== "FIRST_M3_R16_PERFORMANCE_RESULT_GENERATED" || R16_ARTIFACT_HASH_METHOD !== "SHA256_EXACT_COMMITTED_UTF8_BYTES" || R16_SPEC_SHA256.length !== 64 || R16_GATE_SHA256.length !== 64) throw new Error("R16 runtime-import smoke failed.");
console.log(JSON.stringify({ status: "PASS", stage: "runtime-import-smoke", specSha256: R16_SPEC_SHA256, gateSha256: R16_GATE_SHA256, network: false, performance: false }, null, 2));
