import { execFileSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { runR32Reprobe } from "../src/lib/research/round-032-binance-metrics-environment.ts";

export function isR32DirectExecution(moduleUrl: string, argv1 = process.argv[1]): boolean {
  return argv1 !== undefined && moduleUrl === pathToFileURL(path.resolve(argv1)).href;
}

export async function main(): Promise<void> {
  const protocolCommitSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  if (!/^[0-9a-f]{40}$/u.test(protocolCommitSha)) throw new Error("R32 protocol commit SHA could not be resolved.");
  const result = await runR32Reprobe({ protocolCommitSha });
  console.log(JSON.stringify(result, null, 2));
}

if (isR32DirectExecution(import.meta.url)) await main();
