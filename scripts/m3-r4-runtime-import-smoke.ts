export {};

const performanceModule = await import("./m3-r4-performance.ts");

for (const exportName of [
  "parseRound004AuthoritativeArguments",
  "publishRound004ArtifactsAtomically",
  "runM3R4PerformanceCommand",
] as const) {
  if (typeof performanceModule[exportName] !== "function") {
    throw new Error(`Missing expected runtime export: ${exportName}`);
  }
}

console.log("M3-R4 runtime-import smoke: PASS");
