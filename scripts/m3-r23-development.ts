import { runR23HistoricalDevelopment, validateR23ProtocolIdentity } from "../src/lib/research/round-023-development-runner.ts";

validateR23ProtocolIdentity();
console.log(JSON.stringify(runR23HistoricalDevelopment(), null, 2));
