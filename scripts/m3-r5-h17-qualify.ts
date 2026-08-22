import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { RESEARCH_SYMBOLS } from "../src/lib/config/constants.ts";
import { BinanceHistoricalDataLoader } from "../src/lib/historical-data/binance/loader.ts";
import {
  M3_R5_H17_OUTPUT_PATHS,
  assertH17QualificationPreflight,
  createH17QualificationReport,
  h17QualificationRawSha256,
  publishH17QualificationArtifactsAtomically,
  renderH17QualificationMarkdown,
  serializeH17QualificationReport,
  type H17QualificationInput,
} from "../src/lib/research/m3-r5-h17-funding-qualification.ts";
import {
  M3_R5_RESEARCH_END_ISO,
  M3_R5_RESEARCH_RANGE,
  M3_R5_RESEARCH_START_ISO,
} from "../src/lib/research/m3-r5-round-005-protocol.ts";

export type M3R5H17QualificationArguments = Readonly<{
  confirmAuthoritativeQualification: boolean;
  sourceSha: string;
  round: string;
  startTime: number;
  endTime: number;
}>;

function valueAfter(argv: readonly string[], flag: string): string {
  const index = argv.indexOf(flag);
  const value = index >= 0 ? argv[index + 1] : undefined;
  if (!value || value.startsWith("--")) throw new Error(`missing ${flag}`);
  return value;
}

function integerAfter(argv: readonly string[], flag: string): number {
  const value = Number(valueAfter(argv, flag));
  if (!Number.isInteger(value) || value < 0) throw new Error(`${flag} must be a non-negative integer`);
  return value;
}

export function parseM3R5H17QualificationArguments(argv: readonly string[]): M3R5H17QualificationArguments {
  return Object.freeze({
    confirmAuthoritativeQualification: argv.includes("--confirm-authoritative-qualification"),
    sourceSha: valueAfter(argv, "--source-sha"),
    round: valueAfter(argv, "--round"),
    startTime: integerAfter(argv, "--start-time"),
    endTime: integerAfter(argv, "--end-time"),
  });
}

function currentHeadSha(): string {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: process.cwd(), encoding: "utf8" }).trim();
}

function cleanWorktree(): boolean {
  return execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { cwd: process.cwd(), encoding: "utf8" }) === "";
}

function existingOutputArtifacts(): string[] {
  return Object.values(M3_R5_H17_OUTPUT_PATHS).filter((filePath) => existsSync(filePath));
}

async function loadQualificationInputs(loader: BinanceHistoricalDataLoader): Promise<readonly H17QualificationInput[]> {
  const inputs: H17QualificationInput[] = [];
  for (const symbol of RESEARCH_SYMBOLS) {
    const dataset = await loader.loadFunding({
      symbol,
      range: { startTime: M3_R5_RESEARCH_RANGE.startTime, endTime: M3_R5_RESEARCH_RANGE.endTime },
      policy: "bt-policy-003",
    });
    inputs.push({
      symbol,
      records: dataset.records.map((record) => ({
        symbol: record.symbol,
        fundingTime: record.fundingTime,
        fundingRate: record.fundingRate,
      })),
      paginationComplete: true,
      pageCount: null,
      manifest: {
        provider: dataset.manifest.provider,
        source: dataset.manifest.source,
        requestedStartTime: dataset.manifest.requestedStartTime,
        requestedEndTime: dataset.manifest.requestedEndTime,
        actualStartTime: dataset.manifest.actualStartTime,
        actualEndTime: dataset.manifest.actualEndTime,
        rowCount: dataset.manifest.rowCount,
        sha256: dataset.manifest.sha256,
      },
    });
  }
  return Object.freeze(inputs);
}

export async function runM3R5H17Qualification(args: M3R5H17QualificationArguments): Promise<void> {
  assertH17QualificationPreflight({
    ...args,
    requestedSourceSha: args.sourceSha,
    headSha: currentHeadSha(),
    cleanWorktree: cleanWorktree(),
    existingOutputArtifacts: existingOutputArtifacts(),
  });

  let inputs: readonly H17QualificationInput[];
  try {
    inputs = await loadQualificationInputs(new BinanceHistoricalDataLoader());
  } catch (error) {
    throw new Error(`RETRIEVAL_ABORT: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }

  const report = createH17QualificationReport({
    sourceSha: args.sourceSha,
    researchRoundId: args.round,
    startTime: args.startTime,
    endTime: args.endTime,
    symbols: inputs,
  });
  const jsonBytes = Buffer.from(serializeH17QualificationReport(report), "utf8");
  const markdownBytes = Buffer.from(renderH17QualificationMarkdown(report, h17QualificationRawSha256(jsonBytes)), "utf8");
  publishH17QualificationArtifactsAtomically({
    jsonPath: M3_R5_H17_OUTPUT_PATHS.json,
    markdownPath: M3_R5_H17_OUTPUT_PATHS.markdown,
    jsonBytes,
    markdownBytes,
  });
  console.log(JSON.stringify({
    schemaVersion: report.schemaVersion,
    researchRoundId: report.researchRoundId,
    sourceSha: report.sourceSha,
    requestedStartIso: M3_R5_RESEARCH_START_ISO,
    requestedEndIso: M3_R5_RESEARCH_END_ISO,
    qualificationStatus: report.qualificationStatus,
    h17DataQualification: report.h17DataQualification,
    reportSha256: h17QualificationRawSha256(jsonBytes),
  }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  try {
    await runM3R5H17Qualification(parseM3R5H17QualificationArguments(process.argv.slice(2)));
  } catch (error) {
    process.exitCode = 1;
    console.error(error instanceof Error ? error.message : error);
  }
}
