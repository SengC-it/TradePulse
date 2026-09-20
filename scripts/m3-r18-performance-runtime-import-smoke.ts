import { buildR18ExecutionArtifacts, evaluateR18PerformanceGates, loadR18StructuralIndex, publishR18ArtifactsAtomically } from "../src/lib/research/m3-r18-round-018-performance.ts";
import { assertR18SelectionNotExecuted, claimR18PerformanceExecution, deriveR18PerformanceExecutionCount, validateR18PerformanceLedger, writeR18CheckpointAtomic } from "../src/lib/research/m3-r18-round-018-performance-ledger.ts";

if (typeof buildR18ExecutionArtifacts !== "function"
  || typeof evaluateR18PerformanceGates !== "function"
  || typeof loadR18StructuralIndex !== "function"
  || typeof publishR18ArtifactsAtomically !== "function"
  || typeof claimR18PerformanceExecution !== "function"
  || typeof deriveR18PerformanceExecutionCount !== "function"
  || typeof validateR18PerformanceLedger !== "function"
  || typeof writeR18CheckpointAtomic !== "function"
  || typeof assertR18SelectionNotExecuted !== "function") {
  throw new Error("R18 performance runtime-import smoke failed.");
}

console.log("R18 performance runtime-import smoke PASS");
