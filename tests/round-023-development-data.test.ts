import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  R23_ACCEPTED_R14_OBSERVATION_BYTES,
  R23_ACCEPTED_R14_OBSERVATION_SHA256,
  R23_DEVELOPMENT_DATA_PATH,
  R23_DEVELOPMENT_DATA_MANIFEST_PATH,
  buildR23DevelopmentDataManifest,
  scanR23MetadataOnly,
} from "@/lib/research/round-023-development-data";

const temporaryRoots: string[] = [];

function fixtureRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), "tradepulse-r23-data-"));
  temporaryRoots.push(root);
  return root;
}

function fixtureLine(input: Readonly<{ decisionTime: number; symbol: string; direction: "LONG" | "SHORT"; status?: string }>): string {
  const status = input.status ?? "EXECUTED";
  return JSON.stringify({
    observationId: `${input.decisionTime}|${input.symbol}|${input.direction}`,
    decisionTime: input.decisionTime,
    symbol: input.symbol,
    direction: input.direction,
    labels: { "4": { status } },
    latencyStressLabels: { "4": { status } },
  });
}

function writeFixture(lines: readonly string[]): string {
  const filePath = path.join(fixtureRoot(), "observations.ndjson");
  writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Round-023 development data identity freeze", () => {
  it("scans metadata without exposing economic values", async () => {
    const filePath = writeFixture(["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"].flatMap((symbol) => [
      fixtureLine({ decisionTime: 1704067199999, symbol, direction: "LONG" }),
      fixtureLine({ decisionTime: 1704067199999, symbol, direction: "SHORT" }),
    ]));
    const scan = await scanR23MetadataOnly(filePath);
    expect(scan.metadataOnly).toBe(true);
    expect(scan.economicValuesRead).toBe(false);
    expect(Object.keys(scan)).not.toContain("labels");
    expect(Object.keys(scan)).not.toContain("netForwardAtr");
    expect(scan.observationCount).toBe(10);
    expect(scan.duplicateObservationIds).toBe(0);
    expect(scan.chronologyValid).toBe(true);
  });

  it("rejects non-canonical identity, duplicate identity, chronology, and boundary violations", async () => {
    await expect(scanR23MetadataOnly(writeFixture([
      JSON.stringify({ observationId: "wrong", decisionTime: 1704067199999, symbol: "BTCUSDT", direction: "LONG", labels: { "4": { status: "EXECUTED" } }, latencyStressLabels: { "4": { status: "EXECUTED" } } }),
    ]))).rejects.toThrow("non-canonical");
    const duplicate = fixtureLine({ decisionTime: 1704067199999, symbol: "BTCUSDT", direction: "LONG" });
    await expect(scanR23MetadataOnly(writeFixture([duplicate, duplicate]))).rejects.toThrow("duplicate");
    await expect(scanR23MetadataOnly(writeFixture([
      fixtureLine({ decisionTime: 1704067199999, symbol: "BTCUSDT", direction: "SHORT" }),
      fixtureLine({ decisionTime: 1704067199999, symbol: "BTCUSDT", direction: "LONG" }),
    ]))).rejects.toThrow("chronology");
    await expect(scanR23MetadataOnly(writeFixture([
      fixtureLine({ decisionTime: Date.parse("2026-08-16T00:00:00.000Z"), symbol: "BTCUSDT", direction: "LONG" }),
    ]))).rejects.toThrow("post-boundary");
  });

  it("binds the committed manifest to the accepted R14 identity", () => {
    const document = JSON.parse(readFileSync(path.join(process.cwd(), R23_DEVELOPMENT_DATA_MANIFEST_PATH), "utf8")) as {
      normalizedObservationPath: string;
      acceptedSource: { observationDataSha256: string; observationDataBytes: number };
      networkAcquired: boolean;
      newHistoricalDevelopmentDataFetched: boolean;
      integrity: string;
      manifestSha256: string;
    };
    expect(document.normalizedObservationPath).toBe(R23_DEVELOPMENT_DATA_PATH);
    expect(document.acceptedSource.observationDataSha256).toBe(R23_ACCEPTED_R14_OBSERVATION_SHA256);
    expect(document.acceptedSource.observationDataBytes).toBe(R23_ACCEPTED_R14_OBSERVATION_BYTES);
    expect(document.networkAcquired).toBe(false);
    expect(document.newHistoricalDevelopmentDataFetched).toBe(false);
    expect(document.integrity).toBe("COMPLETE");
    expect(document.manifestSha256).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("rejects a source that is not the accepted immutable identity", () => {
    const scan = {
      metadataOnly: true,
      economicValuesRead: false,
      observationCount: 1,
      perSymbolCounts: { BTCUSDT: 1, ETHUSDT: 0, SOLUSDT: 0, XRPUSDT: 0, BNBUSDT: 0 },
      directionCounts: { LONG: 1, SHORT: 0 },
      primaryH4StatusCounts: { EXECUTED: 1, NO_ENTRY: 0, DATA_INCOMPLETE: 0, PERIOD_END_CENSORED: 0 },
      latencyH4StatusCounts: { EXECUTED: 1, NO_ENTRY: 0, DATA_INCOMPLETE: 0, PERIOD_END_CENSORED: 0 },
      observationDataBytes: 1,
      observationDataSha256: "0".repeat(64),
      firstObservationId: "x",
      lastObservationId: "x",
      firstDecisionTime: 1,
      lastDecisionTime: 1,
      duplicateObservationIds: 0,
      postBoundaryRows: 0,
      beforeWindowRows: 0,
      chronologyValid: true,
      requiredSymbolsComplete: false,
    } as const;
    expect(() => buildR23DevelopmentDataManifest({ scan, acquisitionTimestamp: "2026-09-14T00:00:00.000Z", acquisitionCodeSha256: "0".repeat(64) })).toThrow("accepted R14 observation identity");
  });
});
