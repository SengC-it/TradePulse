import { readFileSync, readdirSync, renameSync, existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import * as os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { publishR12ArtifactsAtomically, r12OutputPaths, type R12ExecutionArtifacts } from "../src/lib/research/m3-r12-round-012-performance.ts";

function fixtureArtifacts(): R12ExecutionArtifacts {
  return {
    report: {} as R12ExecutionArtifacts["report"],
    auditArtifact: {} as R12ExecutionArtifacts["auditArtifact"],
    summaryJson: "summary-byte-准确",
    auditJson: "audit-byte-准确",
    resultsMarkdown: "results-byte-准确",
    selectionJson: "selection-json-byte-准确",
    selectionMarkdown: "selection-markdown-byte-准确",
  } as R12ExecutionArtifacts;
}

function testRoot(): string {
  return mkdtempSync(path.join(os.tmpdir(), "tradepulse-r12-publication-"));
}

describe("M3-R12 atomic publication", () => {
  it("rolls back AUDIT when publication fails before RESULTS", () => {
    const root = testRoot();
    let staging = "";
    let calls = 0;
    try {
      expect(() => publishR12ArtifactsAtomically({
        root,
        artifacts: fixtureArtifacts(),
        onStagingDirectory: (directory) => { staging = directory; },
        rename: (source, destination) => {
          calls += 1;
          if (calls === 2) throw new Error("RESULTS_PUBLICATION_FAILED");
          return renameSync(source, destination);
        },
      })).toThrow("RESULTS_PUBLICATION_FAILED");
      expect(r12OutputPaths(root).every((filePath) => !existsSync(filePath))).toBe(true);
      expect(staging).not.toBe("");
      expect(existsSync(staging)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rolls back every destination when SUMMARY publication fails", () => {
    const root = testRoot();
    let staging = "";
    let calls = 0;
    try {
      expect(() => publishR12ArtifactsAtomically({
        root,
        artifacts: fixtureArtifacts(),
        onStagingDirectory: (directory) => { staging = directory; },
        rename: (source, destination) => {
          calls += 1;
          if (calls === 5) throw new Error("SUMMARY_PUBLICATION_FAILED");
          return renameSync(source, destination);
        },
      })).toThrow("SUMMARY_PUBLICATION_FAILED");
      expect(r12OutputPaths(root).every((filePath) => !existsSync(filePath))).toBe(true);
      expect(existsSync(staging)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("preserves exact bytes, publishes SUMMARY last, and removes staging", () => {
    const root = testRoot();
    let staging = "";
    const order: string[] = [];
    try {
      publishR12ArtifactsAtomically({
        root,
        artifacts: fixtureArtifacts(),
        onStagingDirectory: (directory) => { staging = directory; },
        rename: (source, destination) => {
          order.push(path.basename(String(destination)));
          return renameSync(source, destination);
        },
      });
      expect(order).toEqual([
        "M3_R12_ROUND_012_AUDIT.json",
        "M3_R12_ROUND_012_RESULTS.md",
        "M3_R12_ROUND_012_SELECTION.json",
        "M3_R12_ROUND_012_SELECTION.md",
        "M3_R12_ROUND_012_SUMMARY.json",
      ]);
      const targets = r12OutputPaths(root);
      expect(readFileSync(targets[0]!, "utf8")).toBe("summary-byte-准确");
      expect(readFileSync(targets[1]!, "utf8")).toBe("audit-byte-准确");
      expect(readFileSync(targets[2]!, "utf8")).toBe("results-byte-准确");
      expect(readFileSync(targets[3]!, "utf8")).toBe("selection-json-byte-准确");
      expect(readFileSync(targets[4]!, "utf8")).toBe("selection-markdown-byte-准确");
      expect(existsSync(staging)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a pre-existing destination before staging and leaves it unchanged", () => {
    const root = testRoot();
    const summary = r12OutputPaths(root)[0]!;
    const original = "pre-existing-summary";
    try {
      mkdirSync(path.dirname(summary), { recursive: true });
      writeFileSync(summary, original, "utf8");
      const rename = vi.fn<typeof renameSync>();
      expect(() => publishR12ArtifactsAtomically({ root, artifacts: fixtureArtifacts(), rename })).toThrow("R12 output already exists");
      expect(readFileSync(summary, "utf8")).toBe(original);
      expect(readdirSync(path.join(root, "docs"), { withFileTypes: true }).some((entry) => entry.name.includes("staging"))).toBe(false);
      expect(rename).not.toHaveBeenCalled();
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("stages beside the destination and never consults os.tmpdir", () => {
    const root = testRoot();
    let staging = "";
    try {
      const source = readFileSync("src/lib/research/m3-r12-round-012-performance.ts", "utf8");
      expect(source).not.toContain("node:os");
      expect(source).not.toContain("tmpdir(");
      publishR12ArtifactsAtomically({
        root,
        artifacts: fixtureArtifacts(),
        onStagingDirectory: (directory) => { staging = directory; },
      });
      expect(staging.startsWith(path.join(root, "docs", "evidence"))).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
