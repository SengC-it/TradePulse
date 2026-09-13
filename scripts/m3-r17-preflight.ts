import { buildR17Preflight } from "../src/lib/research/m3-r17-round-017-preflight.ts";

try {
  const report = await buildR17Preflight();
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
