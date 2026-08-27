import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { INTERVAL_MS } from "../src/lib/market-data/intervals.ts";
import {
  M3_R6_ROUND_006_OUTPUT_PATHS,
  buildRound006HistoricalLoadRanges,
  publishRound006ArtifactsAtomically,
  round006ArtifactStagingPrefix,
  round006AuthorizedSettlementEndTime,
} from "../src/lib/research/m3-r6-round-006-performance.ts";
import { M3_R6_RESEARCH_RANGE } from "../src/lib/research/m3-r6-round-006-protocol.ts";

function temporaryDirectory(): string {
  return mkdtempSync(path.join(os.tmpdir(), "tradepulse-m3-r6-test-"));
}

function publicationInput(root: string) {
  return {
    summaryPath: path.join(root, "evidence", "summary.json"),
    auditPath: path.join(root, "evidence", "audit.json"),
    resultsPath: path.join(root, "results.md"),
    summary: "SUMMARY-UTF8-✓\r\n",
    audit: "AUDIT-BYTES-\u0000\r\n",
    results: "# RESULTS\r\nexact bytes\r\n",
  };
}

function stagingDirectories(directory: string): string[] {
  return readdirSync(directory).filter((entry) => entry.startsWith(".tradepulse-m3-r6-"));
}

describe("M3-R6 Round-006 research execution boundaries", () => {
  it("freezes native ranges and the authorized settlement tail", () => {
    const ranges = buildRound006HistoricalLoadRanges();
    expect(ranges.candleRange["1h"].startTime).toBe(
      M3_R6_RESEARCH_RANGE.startTime - 250 * INTERVAL_MS["1h"],
    );
    expect(ranges.candleRange["1h"].endTime).toBe(
      Math.floor(M3_R6_RESEARCH_RANGE.endTime / INTERVAL_MS["1h"]) * INTERVAL_MS["1h"],
    );
    expect(ranges.candleRange["4h"].startTime).toBe(
      M3_R6_RESEARCH_RANGE.startTime - 250 * INTERVAL_MS["4h"],
    );
    expect(ranges.settlementTail.candleRange.settlementOnly).toBe(true);
    expect(ranges.settlementTail.candleRange.startTime).toBe(M3_R6_RESEARCH_RANGE.endTime + 1);
    expect(round006AuthorizedSettlementEndTime()).toBe(
      ranges.settlementTail.candleRange.endTime + INTERVAL_MS["1h"] - 1,
    );
  });

  it("publishes on the destination filesystem without consulting os.tmpdir", () => {
    const root = temporaryDirectory();
    const input = publicationInput(root);
    const tmpdir = vi.spyOn(os, "tmpdir").mockImplementation(() => {
      throw new Error("publisher must not call os.tmpdir");
    });
    try {
      publishRound006ArtifactsAtomically(input);
      expect(round006ArtifactStagingPrefix(input.summaryPath)).toBe(
        path.join(root, "evidence", ".tradepulse-m3-r6-"),
      );
      expect(stagingDirectories(path.dirname(input.summaryPath))).toEqual([]);
      expect(existsSync(input.auditPath)).toBe(true);
      expect(existsSync(input.resultsPath)).toBe(true);
      expect(existsSync(input.summaryPath)).toBe(true);
    } finally {
      tmpdir.mockRestore();
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves exact bytes and publishes AUDIT, RESULTS, then SUMMARY", () => {
    const root = temporaryDirectory();
    const input = publicationInput(root);
    const order: string[] = [];
    try {
      publishRound006ArtifactsAtomically({
        ...input,
        rename: (source, destination) => {
          order.push(path.basename(String(destination)));
          return renameSync(source, destination);
        },
      });
      expect(order).toEqual(["audit.json", "results.md", "summary.json"]);
      expect(readFileSync(input.auditPath)).toEqual(Buffer.from(input.audit, "utf8"));
      expect(readFileSync(input.resultsPath)).toEqual(Buffer.from(input.results, "utf8"));
      expect(readFileSync(input.summaryPath)).toEqual(Buffer.from(input.summary, "utf8"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rolls back every publication after AUDIT and before RESULTS", () => {
    const root = temporaryDirectory();
    const input = publicationInput(root);
    try {
      expect(() => publishRound006ArtifactsAtomically({
        ...input,
        rename: (source, destination) => {
          if (String(destination) === input.resultsPath) throw new Error("RESULTS_PUBLICATION_FAILED");
          return renameSync(source, destination);
        },
      })).toThrow("RESULTS_PUBLICATION_FAILED");
      expect(existsSync(input.auditPath)).toBe(false);
      expect(existsSync(input.resultsPath)).toBe(false);
      expect(existsSync(input.summaryPath)).toBe(false);
      expect(stagingDirectories(path.dirname(input.summaryPath))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rolls back AUDIT and RESULTS when SUMMARY publication fails", () => {
    const root = temporaryDirectory();
    const input = publicationInput(root);
    try {
      expect(() => publishRound006ArtifactsAtomically({
        ...input,
        rename: (source, destination) => {
          if (String(destination) === input.summaryPath) throw new Error("SUMMARY_PUBLICATION_FAILED");
          return renameSync(source, destination);
        },
      })).toThrow("SUMMARY_PUBLICATION_FAILED");
      expect(existsSync(input.auditPath)).toBe(false);
      expect(existsSync(input.resultsPath)).toBe(false);
      expect(existsSync(input.summaryPath)).toBe(false);
      expect(stagingDirectories(path.dirname(input.summaryPath))).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("publishes optional research output before AUDIT while keeping SUMMARY last", () => {
    const root = temporaryDirectory();
    const input = publicationInput(root);
    const researchResultsPath = path.join(root, "research", "round-006-results.md");
    const order: string[] = [];
    try {
      publishRound006ArtifactsAtomically({
        ...input,
        researchResultsPath,
        researchResults: "research result\n",
        rename: (source, destination) => {
          order.push(path.basename(String(destination)));
          return renameSync(source, destination);
        },
      });
      expect(order).toEqual(["round-006-results.md", "audit.json", "results.md", "summary.json"]);
      expect(order.at(-1)).toBe("summary.json");
      expect(readFileSync(researchResultsPath, "utf8")).toBe("research result\n");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a pre-existing output before staging and preserves it", () => {
    const root = temporaryDirectory();
    const input = publicationInput(root);
    try {
      const existingAudit = "PRE-EXISTING-AUDIT\n";
      const auditDirectory = path.dirname(input.auditPath);
      const rename = vi.fn<typeof renameSync>();
      mkdirSync(auditDirectory, { recursive: true });
      writeFileSync(input.auditPath, existingAudit, "utf8");
      expect(() => publishRound006ArtifactsAtomically({ ...input, rename })).toThrow("refusing overwrite");
      expect(readFileSync(input.auditPath, "utf8")).toBe(existingAudit);
      expect(existsSync(input.resultsPath)).toBe(false);
      expect(existsSync(input.summaryPath)).toBe(false);
      expect(rename).not.toHaveBeenCalled();
      expect(stagingDirectories(auditDirectory)).toEqual([]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("M3-R6 Round-006 output contract", () => {
  it("keeps the three authoritative output paths explicit", () => {
    expect(M3_R6_ROUND_006_OUTPUT_PATHS).toEqual([
      "docs/evidence/M3_R6_ROUND_006_SUMMARY.json",
      "docs/evidence/M3_R6_ROUND_006_AUDIT.json",
      "docs/M3_R6_ROUND_006_RESULTS.md",
    ]);
  });
});
