import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { buildR16Conformance, validateR16Conformance } from "../src/lib/research/m3-r16-round-016-conformance.ts";
import { R16_CONFORMANCE_PATH } from "../src/lib/research/m3-r16-round-016-protocol.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

const target = path.join(process.cwd(), R16_CONFORMANCE_PATH);
try {
  const document = await buildR16Conformance(process.cwd());
  validateR16Conformance(document);
  const expected = `${stableStringify(document)}\n`;
  if (existsSync(target) && readFileSync(target, "utf8") !== expected) throw new Error(`R16 conformance differs: ${target}`);
  if (!existsSync(target)) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, expected, "utf8");
  }
  console.log(JSON.stringify({
    status: document.integrity === "COMPLETE" ? "PASS" : "PRE_PERFORMANCE_ABORT",
    stage: "conformance",
    conformancePath: R16_CONFORMANCE_PATH,
    resultAffectingDeviationCount: document.resultAffectingDeviationCount,
    resultAffectingDeviations: document.resultAffectingDeviations,
    integrity: document.integrity,
    network: false,
    performance: false,
  }, null, 2));
  if (document.integrity !== "COMPLETE") process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({
    status: "PRE_PERFORMANCE_ABORT",
    stage: "conformance",
    error: error instanceof Error ? error.message : String(error),
    performanceLockTriggered: false,
    network: false,
    performance: false,
  }, null, 2));
  process.exitCode = 1;
}
