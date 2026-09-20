import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { R16_PLAN, R16_PLAN_SHA256, validateR16Plan } from "../src/lib/research/m3-r16-round-016-plan.ts";
import { R16_PLAN_PATH, R16_SPEC_CANONICAL_JSON, R16_SPEC_OBJECT, R16_SPEC_PATH, R16_SPEC_SHA256 } from "../src/lib/research/m3-r16-round-016-protocol.ts";
import { stableStringify } from "../src/lib/research/utils.ts";

function writeCanonicalJson(root: string, relativePath: string, value: unknown): void {
  const target = path.join(root, relativePath);
  const expected = `${stableStringify(value)}\n`;
  if (existsSync(target)) {
    if (readFileSync(target, "utf8") !== expected) throw new Error(`R16 committed specification differs: ${target}`);
    return;
  }
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, expected, "utf8");
}

const root = path.resolve(process.cwd());
validateR16Plan();
writeCanonicalJson(root, R16_SPEC_PATH, R16_SPEC_OBJECT);
writeCanonicalJson(root, R16_PLAN_PATH, R16_PLAN);
console.log(JSON.stringify({
  status: "PASS",
  stage: "write-spec",
  specPath: R16_SPEC_PATH,
  specSha256: R16_SPEC_SHA256,
  specBytes: Buffer.byteLength(R16_SPEC_CANONICAL_JSON, "utf8"),
  planPath: R16_PLAN_PATH,
  planSha256: R16_PLAN_SHA256,
  network: false,
  performance: false,
}, null, 2));
