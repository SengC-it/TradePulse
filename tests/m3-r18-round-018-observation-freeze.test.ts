import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { ROUND_018_ACCEPTED_SOURCE } from "@/lib/research/m3-r18-round-018-protocol";
import {
  parseR18ObservationMetadataLine,
  publishR18StructuralArtifactsAtomically,
  verifyR18StructuralRecord,
  type R18ObservationFreezeManifest,
} from "@/lib/research/m3-r18-round-018-observation-freeze";

const sha = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex");

describe("Round-018 metadata-only observation freeze", () => {
  it("extracts only identity and H4 label status from an observation line", () => {
    const line = JSON.stringify({
      decisionTime: 1704067200000,
      direction: "LONG",
      labels: { "4": { direction: "LONG", horizonHours: 4, signalTime: 1704067200000, status: "EXECUTED", symbol: "BTCUSDT" } },
      observationId: "1704067200000|BTCUSDT|LONG",
      symbol: "BTCUSDT",
    });
    const metadata = parseR18ObservationMetadataLine(line);
    expect(metadata).toMatchObject({
      observationId: "1704067200000|BTCUSDT|LONG",
      decisionTime: 1704067200000,
      symbol: "BTCUSDT",
      direction: "LONG",
      canonicalIdentityValid: true,
      h4LabelIdentityPresent: true,
      h4LabelStatus: "EXECUTED",
    });
    expect(JSON.stringify(metadata)).not.toContain("entryPrice");
    expect(JSON.stringify(metadata)).not.toContain("exitPrice");
    expect(JSON.stringify(metadata)).not.toContain("netForward");
  });

  it("rejects noncanonical label identity without nearest-time matching", () => {
    const line = JSON.stringify({
      decisionTime: 1704067200000,
      direction: "LONG",
      labels: { "4": { direction: "LONG", horizonHours: 4, signalTime: 1704067200001, status: "EXECUTED", symbol: "BTCUSDT" } },
      observationId: "1704067200000|BTCUSDT|LONG",
      symbol: "BTCUSDT",
    });
    const metadata = parseR18ObservationMetadataLine(line);
    expect(metadata.canonicalIdentityValid).toBe(true);
    expect(metadata.h4LabelIdentityPresent).toBe(false);
    expect(metadata.labelSourceStatus).toBe("INCOMPLETE");
  });

  it("publishes structural data with destination-local staging and preserves exact bytes", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r18-structural-test-"));
    const data = "{\"observationId\":\"x\"}\n";
    const manifest = {
      schemaVersion: "m3-r18-round-018-structural-observation-freeze-001",
      researchRoundId: "baseline-002-research-round-018",
      acceptedSourceCommit: ROUND_018_ACCEPTED_SOURCE,
      observationSource: { path: ".cache/tradepulse/round-014/observations.ndjson", manifestPath: "docs/research/round-014-observation-freeze.json", observationCount: 1, bytes: 1, sha256: "a", sourceStatus: "ACCEPTED_R14_NATIVE_OBSERVATION_FREEZE" },
      acceptedCandleCache: { path: ".cache/tradepulse/round-006", sourceStatus: "ACCEPTED_EXISTING_ROUND006_CANDLE_CACHE", pageCount: 1, timeframes: ["1h", "4h"], networkAcquired: false },
      compactStructuralObservation: { path: ".cache/tradepulse/round-018/observations.ndjson", bytes: data.length, sha256: sha(data), formalOnly: true, economicValuesRead: false },
      counts: {} as R18ObservationFreezeManifest["counts"],
      integrity: { allPopulationPartitioned: true, duplicateCanonicalCount: 0, provenanceIncompleteCount: 0, pointInTimeViolationCount: 0, economicFieldsRead: false, economicValuesCalculated: false, economicValuesInspected: false },
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      performanceExecuted: false,
      selectionExecuted: false,
      productionUnchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      automaticTrading: false,
      manifestSha256: "test",
    } as R18ObservationFreezeManifest;
    try {
      publishR18StructuralArtifactsAtomically(root, data, manifest);
      const output = readFileSync(path.join(root, ".cache/tradepulse/round-018/observations.ndjson"), "utf8");
      expect(output).toBe(data);
      expect(existsSync(path.join(root, "docs/research/round-018-observation-freeze.json"))).toBe(true);
      expect(readdirSync(path.join(root, ".cache/tradepulse/round-018")).filter((name) => name.includes("staging")).length).toBe(0);
      expect(readdirSync(path.join(root, ".cache/tradepulse/round-018")).filter((name) => name.endsWith(".ndjson"))).toEqual(["observations.ndjson"]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("keeps structural records free of economic fields", () => {
    expect(verifyR18StructuralRecord({
      schemaVersion: "m3-r18-round-018-structural-observation-001",
      replayStatus: "BASELINE_FORMAL",
      controlIncluded: true,
      totalScore: 70,
      scoreBreakdown: { trendStrength: 20, pullbackQuality: 10, breakoutStrength: 10, volumeScore: 5, riskRewardScore: 5 },
    })).toBe(true);
  });
});
