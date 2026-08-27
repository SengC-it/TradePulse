import { existsSync } from "node:fs";

import {
  R8_RESULT_AFFECTING_SPEC_DIFF_COUNT,
  validateR8ProtocolMachineRecord,
} from "../src/lib/research/m3-r8-round-008-protocol.ts";
import { R8_PLAN, validateR8Plan } from "../src/lib/research/m3-r8-round-008-plan.ts";
import { runR8SyntheticLifecycleContract } from "../src/lib/research/m3-r8-round-008-evidence.ts";
import { executeR8Authoritative, existingR8OutputArtifacts } from "../src/lib/research/m3-r8-round-008-performance.ts";
import { M3_R8_OUTPUT_PATH_LIST } from "../src/lib/research/m3-r8-round-008-publication.ts";

validateR8ProtocolMachineRecord();
validateR8Plan();
if (R8_RESULT_AFFECTING_SPEC_DIFF_COUNT !== 0) throw new Error("R8 result-affecting specification drift detected.");
if (!runR8SyntheticLifecycleContract().passed) throw new Error("R8 synthetic lifecycle contract failed.");
if (typeof executeR8Authoritative !== "function") throw new Error("R8 authoritative entry point failed to import.");
const allowExistingEvidence = process.argv.includes("--allow-existing-evidence");
if (!allowExistingEvidence && (M3_R8_OUTPUT_PATH_LIST.some((relative) => existsSync(relative)) || existingR8OutputArtifacts().length > 0)) throw new Error("R8 output unexpectedly exists during import smoke.");
if (R8_PLAN.performance.status !== "NOT_GENERATED" || R8_PLAN.performance.authorization !== "NOT_AUTHORIZED") throw new Error("R8 performance boundary changed during import smoke.");

console.log("M3-R8 native runtime import smoke: PASS");
