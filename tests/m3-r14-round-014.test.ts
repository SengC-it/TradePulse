import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import path from "node:path";

import { fitR13RidgeModel } from "../src/lib/research/m3-r13-round-013-model.ts";
import { featureVectorFromOrderedValues } from "../src/lib/research/m3-r13-round-013-features.ts";
import { R13_FEATURE_NAMES } from "../src/lib/research/m3-r13-round-013-protocol.ts";
import { M3_R14_DATASET_IDENTITY_SHA256, M3_R14_MANIFEST_IDENTITY_SHA256, M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256, R14_IDENTITY_DOCUMENT, validateR14Identity } from "../src/lib/research/m3-r14-round-014-identity.ts";
import { R14_CHECKPOINT_SCHEMA_VERSION, R14_COMPLETION_MARKER, readR14Checkpoint, writeR14CheckpointAtomic } from "../src/lib/research/m3-r14-round-014-checkpoints.ts";
import { publishR14ArtifactsAtomically, type R14ExecutionArtifacts } from "../src/lib/research/m3-r14-round-014-performance.ts";

function artifacts(): R14ExecutionArtifacts {
  return {
    report: undefined as never,
    summaryJson: "summary-字节",
    auditJson: "audit-字节",
    resultsMarkdown: "results-字节",
    selectionJson: "selection-json-字节",
    selectionMarkdown: "selection-markdown-字节",
  };
}

function stagingDirectories(root: string): string[] {
  const docs = path.join(root, "docs");
  if (!existsSync(docs)) return [];
  return readdirSync(docs).filter((entry) => entry.startsWith(".m3-r14-round-014-staging-"));
}

describe("Round-014 scientific identity", () => {
  it("freezes the R13 scientific projection with zero deviations", () => {
    expect(validateR14Identity()).toBe(R14_IDENTITY_DOCUMENT);
    expect(R14_IDENTITY_DOCUMENT.scientificDeviationCount).toBe(0);
    expect(R14_IDENTITY_DOCUMENT.comparison).toEqual({
      datasetIdentitySha256Equal: true,
      manifestIdentitySha256Equal: true,
      featureSpecSha256Equal: true,
      modelSpecSha256Equal: true,
      gateSha256Equal: true,
      planScientificFieldsEqual: true,
      foldDefinitionsEqual: true,
      horizonDefinitionsEqual: true,
      executionEconomicsEqual: true,
      selectionDefinitionsEqual: true,
    });
    expect(M3_R14_DATASET_IDENTITY_SHA256).toHaveLength(64);
    expect(M3_R14_MANIFEST_IDENTITY_SHA256).toHaveLength(64);
    expect(M3_R14_SCIENTIFIC_SPEC_IDENTITY_SHA256).toHaveLength(64);
  });
});

describe("Round-014 crash-safe checkpoints", () => {
  it("writes a complete checkpoint atomically and leaves no staging directory", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r14-checkpoint-test-"));
    const target = path.join(root, "nested", "checkpoint.json");
    try {
      const result = writeR14CheckpointAtomic({ filePath: target, kind: "TEST", key: "one", inputHashes: { source: "source" }, payload: { value: "exact-✓" } });
      const raw = readFileSync(target, "utf8");
      const parsed = readR14Checkpoint<{ value: string }>(target, { source: "source" });
      expect(result.completionMarker).toBe(R14_COMPLETION_MARKER);
      expect(result.schemaVersion).toBe(R14_CHECKPOINT_SCHEMA_VERSION);
      expect(parsed.payload.value).toBe("exact-✓");
      expect(raw).toContain('"completionMarker":"COMPLETE"');
      expect(readdirSync(path.dirname(target)).filter((entry) => entry.startsWith(".r14-checkpoint-staging-")).length).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("cleans staging after a simulated crash before commit", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r14-checkpoint-test-"));
    const target = path.join(root, "checkpoint.json");
    try {
      expect(() => writeR14CheckpointAtomic({ filePath: target, kind: "TEST", key: "crash", inputHashes: {}, payload: { value: 1 }, beforeCommit: () => { throw new Error("simulated crash"); } })).toThrow("simulated crash");
      expect(existsSync(target)).toBe(false);
      expect(readdirSync(root).filter((entry) => entry.startsWith(".r14-checkpoint-staging-")).length).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("reuses a completed checkpoint without rerunning or overwriting it", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r14-checkpoint-test-"));
    const target = path.join(root, "checkpoint.json");
    try {
      writeR14CheckpointAtomic({ filePath: target, kind: "TEST", key: "reuse", inputHashes: { source: "source" }, payload: { value: "original" } });
      const before = readFileSync(target);
      const reused = writeR14CheckpointAtomic({ filePath: target, kind: "TEST", key: "reuse", inputHashes: { source: "source" }, payload: { value: "different" }, beforeCommit: () => { throw new Error("must not execute"); } });
      expect(reused.payload.value).toBe("original");
      expect(readFileSync(target)).toEqual(before);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("Round-014 all-or-nothing evidence publication", () => {
  it("rolls back after AUDIT publication and leaves no artifact or staging directory", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r14-publication-test-"));
    try {
      expect(() => publishR14ArtifactsAtomically({ root, artifacts: artifacts(), beforePublish: (_target, index) => { if (index === 1) throw new Error("fail before RESULTS"); } })).toThrow("fail before RESULTS");
      expect(readdirSync(path.join(root, "docs", "evidence"), { withFileTypes: true }).some((entry) => entry.name.includes("M3_R14_ROUND_014"))).toBe(false);
      expect(existsSync(path.join(root, "docs", "M3_R14_ROUND_014_RESULTS.md"))).toBe(false);
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rolls back AUDIT and RESULTS before SUMMARY publication", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r14-publication-test-"));
    try {
      expect(() => publishR14ArtifactsAtomically({ root, artifacts: artifacts(), beforePublish: (_target, index) => { if (index === 4) throw new Error("fail before SUMMARY"); } })).toThrow("fail before SUMMARY");
      expect(existsSync(path.join(root, "docs", "evidence", "M3_R14_ROUND_014_AUDIT.json"))).toBe(false);
      expect(existsSync(path.join(root, "docs", "M3_R14_ROUND_014_SUMMARY.json"))).toBe(false);
      expect(existsSync(path.join(root, "docs", "M3_R14_ROUND_014_SELECTION.json"))).toBe(false);
      expect(existsSync(path.join(root, "docs", "M3_R14_ROUND_014_RESULTS.md"))).toBe(false);
      expect(existsSync(path.join(root, "docs", "M3_R14_ROUND_014_SELECTION.md"))).toBe(false);
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("publishes exact bytes in AUDIT -> RESULTS -> selection -> SUMMARY order", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r14-publication-test-"));
    const order: string[] = [];
    try {
      publishR14ArtifactsAtomically({ root, artifacts: artifacts(), beforePublish: (target) => { order.push(path.basename(target)); } });
      expect(order).toEqual([
        "M3_R14_ROUND_014_AUDIT.json",
        "M3_R14_ROUND_014_RESULTS.md",
        "M3_R14_ROUND_014_SELECTION.json",
        "M3_R14_ROUND_014_SELECTION.md",
        "M3_R14_ROUND_014_SUMMARY.json",
      ]);
      expect(readFileSync(path.join(root, "docs", "evidence", "M3_R14_ROUND_014_AUDIT.json"), "utf8")).toBe("audit-字节");
      expect(readFileSync(path.join(root, "docs", "M3_R14_ROUND_014_RESULTS.md"), "utf8")).toBe("results-字节");
      expect(readFileSync(path.join(root, "docs", "evidence", "M3_R14_ROUND_014_SUMMARY.json"), "utf8")).toBe("summary-字节");
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stages on the destination filesystem without os.tmpdir", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r14-publication-test-"));
    const stagingLocations: string[] = [];
    try {
      const publisherSource = readFileSync(path.join(process.cwd(), "src", "lib", "research", "m3-r14-round-014-performance.ts"), "utf8");
      publishR14ArtifactsAtomically({ root, artifacts: artifacts(), beforePublish: () => {
        stagingLocations.push(...readdirSync(path.join(root, "docs")).filter((entry) => entry.startsWith(".m3-r14-round-014-staging-")));
      } });
      expect(publisherSource).not.toContain("os.tmpdir");
      expect(stagingLocations.length).toBeGreaterThan(0);
      expect(stagingLocations.every((entry) => entry.startsWith(".m3-r14-round-014-staging-"))).toBe(true);
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a pre-existing output before staging and preserves it byte-for-byte", () => {
    const root = mkdtempSync(path.join(process.cwd(), ".r14-publication-test-"));
    const existing = path.join(root, "docs", "evidence", "M3_R14_ROUND_014_SUMMARY.json");
    try {
      const original = "pre-existing-authoritative-bytes";
      mkdirSync(path.dirname(existing), { recursive: true });
      writeFileSync(existing, original, "utf8");
      expect(() => publishR14ArtifactsAtomically({ root, artifacts: artifacts() })).toThrow(/already exists/u);
      expect(readFileSync(existing, "utf8")).toBe(original);
      expect(existsSync(path.join(root, "docs", "M3_R14_ROUND_014_RESULTS.md"))).toBe(false);
      expect(stagingDirectories(root)).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("Round-014 no-network pre-lock boundary", () => {
  it("keeps model-fit smoke synthetic and does not need a market-data client", () => {
    const examples = Array.from({ length: 30 }, (_, row) => ({ features: featureVectorFromOrderedValues(R13_FEATURE_NAMES.map((_, column) => row + column / 100)), targetNetForwardAtr: row / 100 }));
    const model = fitR13RidgeModel(examples);
    expect(Number.isFinite(model.intercept)).toBe(true);
    const performanceSource = readFileSync(path.join(process.cwd(), "src", "lib", "research", "m3-r14-round-014-performance.ts"), "utf8");
    expect(performanceSource).not.toContain("BinancePublicClient");
    expect(performanceSource).not.toContain("fetch(");
  });
});
