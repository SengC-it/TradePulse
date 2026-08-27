export {};

const performanceModule = await import("./m3-r6-performance.ts");
const selectionModule = await import("./m3-r6-select.ts");

function hasFunctionExport(moduleValue: object, exportName: string): boolean {
  return typeof (moduleValue as Record<string, unknown>)[exportName] === "function";
}

for (const [moduleName, moduleValue, exportNames] of [
  ["performance", performanceModule, ["parseRound006AuthoritativeArguments", "runM3R6PerformanceCommand"]],
  ["selection", selectionModule, ["parseRound006SelectionArguments", "runM3R6SelectionCommand"]],
] as const) {
  for (const exportName of exportNames) {
    if (!hasFunctionExport(moduleValue, exportName)) {
      throw new Error(`Missing expected Round-006 ${moduleName} runtime export: ${exportName}`);
    }
  }
}

console.log("M3-R6 runtime-import smoke: PASS");
