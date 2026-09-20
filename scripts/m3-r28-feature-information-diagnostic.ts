import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { executeR28FeatureInformationDiagnostic, diagnosticResultHash } from "../src/lib/research/round-028-feature-information-diagnostic.ts";

const root = process.cwd();
const outputDirectory = path.join(root, "docs", "research");
mkdirSync(outputDirectory, { recursive: true });
const execution = await executeR28FeatureInformationDiagnostic(root);
writeFileSync(path.join(outputDirectory, "round-028-feature-information-result.json"), `${JSON.stringify(execution.result, null, 2)}\n`, "utf8");
writeFileSync(path.join(outputDirectory, "round-028-feature-information-result.md"), `${execution.markdown}\n`, "utf8");
console.log(JSON.stringify({ featureInformationDiagnosticExecutionCount: execution.result.featureInformationDiagnosticExecutionCount, resultSha256: diagnosticResultHash(execution.result), directions: execution.result.directions }, null, 2));
