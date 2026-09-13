import { classifyR17Events } from "../src/lib/research/m3-r17-round-017-classifier.ts";
import { summarizeR17CompletedCheckpoints } from "../src/lib/research/m3-r17-round-017-checkpoints.ts";
import { R17_PREFLIGHT_SCHEMA_VERSION } from "../src/lib/research/m3-r17-round-017-preflight.ts";
import { isR17BaselineFormalCandidate, R17_FORMAL_PREDICATE } from "../src/lib/research/m3-r17-round-017-formal-stream.ts";

if (typeof classifyR17Events !== "function" || typeof summarizeR17CompletedCheckpoints !== "function" || typeof isR17BaselineFormalCandidate !== "function" || R17_FORMAL_PREDICATE !== "candidate?.formalSignal && candidate.totalScore >= 70" || R17_PREFLIGHT_SCHEMA_VERSION !== "m3-r17-round-017-preflight-001") throw new Error("R17 runtime import smoke failed.");
console.log("R17 runtime-import smoke PASS");
