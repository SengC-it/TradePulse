import { existsSync } from "node:fs";
import path from "node:path";

import { R13_FEATURE_NAMES, R13_HORIZON_HOURS } from "../src/lib/research/m3-r13-round-013-protocol.ts";
import { R13_PRIMARY_DELAY_MS, R13_STRESS_DELAY_MS } from "../src/lib/research/m3-r13-round-013-labels.ts";
import { R13_RIDGE_LAMBDA } from "../src/lib/research/m3-r13-round-013-model.ts";
import { R13_SELECTION_GATE_SHA256 } from "../src/lib/research/selection-gates-round-013.ts";
import { R14_OBSERVATION_FREEZE_PATH } from "../src/lib/research/m3-r14-round-014-observations.ts";
import { M3_R14_IDENTITY_PATH, M3_R14_PERFORMANCE_LOCK, M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256, readR14Identity } from "../src/lib/research/m3-r14-round-014-identity.ts";
import { existingR14OutputArtifacts } from "../src/lib/research/m3-r14-round-014-performance.ts";

readR14Identity(path.join(process.cwd(), M3_R14_IDENTITY_PATH));
if (R13_FEATURE_NAMES.length !== 18 || R13_HORIZON_HOURS.join(",") !== "4,8,12,24" || R13_PRIMARY_DELAY_MS !== 360_000 || R13_STRESS_DELAY_MS !== 420_000 || R13_RIDGE_LAMBDA !== 10 || R13_SELECTION_GATE_SHA256.length !== 64 || M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256.length !== 64 || M3_R14_PERFORMANCE_LOCK !== "FIRST_M3_R14_PERFORMANCE_RESULT_GENERATED") throw new Error("R14 runtime-import smoke contract failed.");
if (existingR14OutputArtifacts().length > 0 || existsSync(path.join(process.cwd(), R14_OBSERVATION_FREEZE_PATH)) === false) throw new Error("R14 runtime-import smoke artifact boundary failed.");
console.log(JSON.stringify({ status: "PASS", imported: ["R13 protocol", "R13 model", "R13 gates", "R14 identity", "R14 observations", "R14 checkpoints", "R14 performance"], observationFreezePresent: true, outputArtifactsPresent: existingR14OutputArtifacts().length, network: false, performance: false }, null, 2));
