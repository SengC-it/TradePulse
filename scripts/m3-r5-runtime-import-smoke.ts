export {};

const performanceModule = await import("./m3-r5-performance.ts");

for (const exportName of [
  "parseRound005AuthoritativeArguments",
  "publishRound005ArtifactsAtomically",
  "executeRound005Authoritative",
] as const) {
  if (typeof performanceModule[exportName] !== "function") {
    throw new Error(`Missing expected runtime export: ${exportName}`);
  }
}

console.log("M3-R5 runtime-import smoke: PASS");
