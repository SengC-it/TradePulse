import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { R15_CONFORMANCE_DOCUMENT, R15_CONFORMANCE_SHA256, validateR15Conformance } from "../src/lib/research/m3-r15-round-015-conformance.ts";
import { R15_PLAN, R15_PLAN_SHA256, validateR15Plan } from "../src/lib/research/m3-r15-round-015-plan.ts";
import { R15_CONFORMANCE_PATH, R15_PLAN_PATH, R15_SPEC_CANONICAL_JSON, R15_SPEC_OBJECT, R15_SPEC_PATH, R15_SPEC_SHA256 } from "../src/lib/research/m3-r15-round-015-protocol.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

function writeJson(root: string, relativePath: string, expected: unknown): void {
  const target = path.join(root, relativePath);
  const expectedCanonical = stableStringify(expected);
  if (existsSync(target)) {
    const current = JSON.parse(readFileSync(target, "utf8")) as unknown;
    if (stableStringify(current) !== expectedCanonical) throw new Error(`R15 committed specification differs: ${target}`);
    return;
  }
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${expectedCanonical}\n`, "utf8");
}

const root = path.resolve(process.cwd());
writeJson(root, R15_SPEC_PATH, R15_SPEC_OBJECT);
writeJson(root, R15_PLAN_PATH, R15_PLAN);
writeJson(root, R15_CONFORMANCE_PATH, R15_CONFORMANCE_DOCUMENT);
validateR15Plan();
validateR15Conformance();
console.log(JSON.stringify({ status: "PASS", specPath: R15_SPEC_PATH, specSha256: R15_SPEC_SHA256, specBytes: Buffer.byteLength(R15_SPEC_CANONICAL_JSON, "utf8"), planPath: R15_PLAN_PATH, planSha256: R15_PLAN_SHA256, conformancePath: R15_CONFORMANCE_PATH, conformanceSha256: R15_CONFORMANCE_SHA256, resultAffectingDeviationCount: R15_CONFORMANCE_DOCUMENT.resultAffectingDeviationCount, network: false, performance: false }, null, 2));
