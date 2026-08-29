import { existsSync } from "node:fs";

import { readR13SpecConformance } from "../src/lib/research/m3-r13-round-013-conformance.ts";
import { R13_PLAN, validateR13Plan } from "../src/lib/research/m3-r13-round-013-plan.ts";
import { R13_SELECTION_GATE_SHA256, R13_GATE_MACHINE_RECORD } from "../src/lib/research/selection-gates-round-013.ts";
import { R13_FEATURE_NAMES } from "../src/lib/research/m3-r13-round-013-protocol.ts";
import { R13_RIDGE_LAMBDA } from "../src/lib/research/m3-r13-round-013-model.ts";
import { R13_PRIMARY_DELAY_MS, R13_STRESS_DELAY_MS } from "../src/lib/research/m3-r13-round-013-labels.ts";
import { existingR13OutputArtifacts } from "../src/lib/research/m3-r13-round-013-performance.ts";

const conformance = readR13SpecConformance();
validateR13Plan();
if (R13_FEATURE_NAMES.length !== 18 || R13_RIDGE_LAMBDA !== 10 || R13_PRIMARY_DELAY_MS !== 360_000 || R13_STRESS_DELAY_MS !== 420_000) throw new Error("R13 runtime-import smoke contract failed.");
if (R13_SELECTION_GATE_SHA256.length !== 64 || R13_GATE_MACHINE_RECORD.gateIdentities.length !== 16) throw new Error("R13 gate module did not load its frozen record.");
if (conformance.resultAffectingDeviationCount !== 0 || conformance.postLockMarketFetchPossible || conformance.privateBinanceApi || conformance.automaticTrading) throw new Error("R13 runtime-import smoke conformance failed.");
console.log(JSON.stringify({ status: "PASS", imported: ["protocol", "features", "labels", "model", "validation", "drawdown", "selection-gates", "conformance", "plan", "data", "performance"], planSchemaVersion: R13_PLAN.schemaVersion, outputArtifactsPresent: existingR13OutputArtifacts().length, docsConformancePresent: existsSync("docs/research/round-013-spec-conformance.json"), network: false, performance: false }, null, 2));
