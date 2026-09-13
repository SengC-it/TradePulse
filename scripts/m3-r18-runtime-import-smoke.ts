import { materializeR18ObservationFreeze } from "../src/lib/research/m3-r18-round-018-observation-freeze.ts";
import { classifyR18ReplayEvaluation } from "../src/lib/research/m3-r18-round-018-replay.ts";
import { buildR18PreflightReport, R18_PREFLIGHT_SCHEMA_VERSION } from "../src/lib/research/m3-r18-round-018-preflight.ts";

if (typeof materializeR18ObservationFreeze !== "function"
  || typeof classifyR18ReplayEvaluation !== "function"
  || typeof buildR18PreflightReport !== "function"
  || R18_PREFLIGHT_SCHEMA_VERSION !== "m3-r18-round-018-structural-preflight-001") {
  throw new Error("R18 runtime-import smoke failed.");
}
console.log("R18 runtime-import smoke PASS");
