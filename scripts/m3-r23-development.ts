import { publishR23DevelopmentResult, validateR23ProtocolIdentity } from "../src/lib/research/round-023-development-runner.ts";

validateR23ProtocolIdentity();
console.log(JSON.stringify(await publishR23DevelopmentResult(), null, 2));
