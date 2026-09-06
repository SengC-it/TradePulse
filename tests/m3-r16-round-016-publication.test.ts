import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";

import { publishR16ArtifactsAtomically, type R16ExecutionArtifacts } from "../src/lib/research/m3-r16-round-016-performance.ts";
import { R16_PUBLICATION_HASHES_PATH, R16_REQUIRED_OUTPUT_PATHS } from "../src/lib/research/m3-r16-round-016-protocol.ts";

function fakeArtifacts(): R16ExecutionArtifacts {
  return {
    report: undefined as never,
    summaryJson: "summary-字节",
    auditJson: "audit-字节",
    resultsMarkdown: "results-字节",
    selectionJson: "selection-json-字节",
    selectionMarkdown: "selection-markdown-字节",
    publicationHashesJson: "publication-hashes-字节",
  };
}

function outputPaths(root: string): readonly string[] {
  return Object.freeze([...R16_REQUIRED_OUTPUT_PATHS.slice(6), R16_PUBLICATION_HASHES_PATH].map((relative) => path.join(root, relative)));
}

function stagingDirectories(root: string): string[] {
  const docs = path.join(root, "docs");
  return existsSync(docs) ? readdirSync(docs).filter((entry) => entry.startsWith(".m3-r16-round-016-staging-")) : [];
}

function testRoot(): string {
  const root = mkdtempSync(path.join(process.cwd(), ".r16-publication-test-"));
  mkdirSync(path.join(root, "docs", "evidence"), { recursive: true });
  return root;
}

describe("Round-016 crash-safe publication", () => {
  it("rolls back AUDIT when publication fails before RESULTS", () => {
    const root = testRoot();
    try {
      expect(() => publishR16ArtifactsAtomically({ root, artifacts: fakeArtifacts(), beforePublish: (_target, index) => { if (index === 1) throw new Error("fail before RESULTS"); } })).toThrow("fail before RESULTS");
      expect(outputPaths(root).every((filePath) => !existsSync(filePath))).toBe(true);
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rolls back AUDIT, RESULTS, and all staged outputs when publication fails before SUMMARY", () => {
    const root = testRoot();
    try {
      expect(() => publishR16ArtifactsAtomically({ root, artifacts: fakeArtifacts(), beforePublish: (_target, index) => { if (index === 5) throw new Error("fail before SUMMARY"); } })).toThrow("fail before SUMMARY");
      expect(outputPaths(root).every((filePath) => !existsSync(filePath))).toBe(true);
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("publishes exact UTF-8 bytes in AUDIT-to-SUMMARY order and removes staging", () => {
    const root = testRoot();
    const order: string[] = [];
    try {
      publishR16ArtifactsAtomically({ root, artifacts: fakeArtifacts(), beforePublish: (target) => { order.push(path.basename(target)); } });
      expect(order).toEqual([
        "M3_R16_ROUND_016_AUDIT.json",
        "M3_R16_ROUND_016_RESULTS.md",
        "M3_R16_ROUND_016_SELECTION.json",
        "M3_R16_ROUND_016_SELECTION.md",
        "round-016-publication-hashes.json",
        "M3_R16_ROUND_016_SUMMARY.json",
      ]);
      expect(readFileSync(path.join(root, "docs", "evidence", "M3_R16_ROUND_016_AUDIT.json"))).toEqual(Buffer.from("audit-字节", "utf8"));
      expect(readFileSync(path.join(root, "docs", "evidence", "M3_R16_ROUND_016_SUMMARY.json"))).toEqual(Buffer.from("summary-字节", "utf8"));
      expect(outputPaths(root).every((filePath) => existsSync(filePath))).toBe(true);
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a pre-existing destination before staging and preserves it byte-for-byte", () => {
    const root = testRoot();
    const existing = path.join(root, "docs", "evidence", "M3_R16_ROUND_016_SUMMARY.json");
    const bytes = Buffer.from("pre-existing-authoritative-bytes", "utf8");
    try {
      writeFileSync(existing, bytes);
      expect(() => publishR16ArtifactsAtomically({ root, artifacts: fakeArtifacts() })).toThrow(/already exists/u);
      expect(readFileSync(existing)).toEqual(bytes);
      expect(outputPaths(root).filter((filePath) => filePath !== existing).every((filePath) => !existsSync(filePath))).toBe(true);
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stages on the repository destination filesystem and has no network dependency", () => {
    const root = testRoot();
    let staging: string | undefined;
    try {
      publishR16ArtifactsAtomically({ root, artifacts: fakeArtifacts(), onStagingCreated: (directory) => { staging = directory; } });
      expect(staging).toBeDefined();
      expect(staging!.startsWith(path.join(root, "docs") + path.sep)).toBe(true);
      expect(path.parse(staging!).root).toBe(path.parse(root).root);
      const source = readFileSync(path.join(process.cwd(), "src", "lib", "research", "m3-r16-round-016-performance.ts"), "utf8");
      expect(source).not.toContain("os.tmpdir");
      expect(source).not.toContain("fetch(");
      expect(source).not.toContain("BinancePublicClient");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
