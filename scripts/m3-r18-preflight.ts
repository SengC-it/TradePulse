import { buildR18PreflightFromFreeze } from "../src/lib/research/m3-r18-round-018-preflight.ts";

try {
  const report = buildR18PreflightFromFreeze();
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
