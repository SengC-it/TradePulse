import { existsSync, mkdtempSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { publishR8ArtifactsAtomically } from "../src/lib/research/m3-r8-round-008-publication.ts";

const payload = {
  audit: "audit-\u{1F4CA}",
  results: "results\n",
  selectionMarkdown: "selection-md\n",
  selectionJson: "{\"selection\":true}",
  summary: "summary\n",
} as const;

function paths(root: string): Record<keyof typeof payload, string> {
  return {
    audit: path.join(root, "docs", "evidence", "M3_R8_ROUND_008_AUDIT.json"),
    results: path.join(root, "docs", "M3_R8_ROUND_008_RESULTS.md"),
    selectionMarkdown: path.join(root, "docs", "evidence", "M3_R8_ROUND_008_SELECTION.md"),
    selectionJson: path.join(root, "docs", "evidence", "M3_R8_ROUND_008_SELECTION.json"),
    summary: path.join(root, "docs", "evidence", "M3_R8_ROUND_008_SUMMARY.json"),
  };
}

function publish(root: string, options: Partial<Parameters<typeof publishR8ArtifactsAtomically>[0]> = {}): void {
  publishR8ArtifactsAtomically({ root, ...payload, ...options });
}

describe("M3-R8 destination-local publication", () => {
  it("stages on the destination filesystem, preserves exact bytes, and publishes SUMMARY last", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "tradepulse-r8-publication-"));
    try {
      const order: string[] = [];
      let stagingDirectory = "";
      publish(root, {
        onStagingDirectory: (directory) => { stagingDirectory = directory; },
        rename: (from, to) => { order.push(path.basename(String(to))); renameSync(from, to); },
      });
      const target = paths(root);
      expect(stagingDirectory.startsWith(path.join(root, "docs", "evidence"))).toBe(true);
      expect(existsSync(stagingDirectory)).toBe(false);
      expect(order).toEqual([
        "M3_R8_ROUND_008_AUDIT.json",
        "M3_R8_ROUND_008_RESULTS.md",
        "M3_R8_ROUND_008_SELECTION.md",
        "M3_R8_ROUND_008_SELECTION.json",
        "M3_R8_ROUND_008_SUMMARY.json",
      ]);
      for (const key of Object.keys(payload) as (keyof typeof payload)[]) expect(readFileSync(target[key], "utf8")).toBe(payload[key]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rolls back every destination when RESULTS publication fails", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "tradepulse-r8-publication-"));
    let stagingDirectory = "";
    try {
      let calls = 0;
      expect(() => publish(root, {
        onStagingDirectory: (directory) => { stagingDirectory = directory; },
        rename: (from, to) => { calls += 1; if (calls === 2) throw new Error("RESULTS_PUBLICATION_FAILED"); renameSync(from, to); },
      })).toThrow("RESULTS_PUBLICATION_FAILED");
      for (const target of Object.values(paths(root))) expect(existsSync(target)).toBe(false);
      expect(existsSync(stagingDirectory)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rolls back AUDIT, RESULTS, and selection outputs when SUMMARY publication fails", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "tradepulse-r8-publication-"));
    let stagingDirectory = "";
    try {
      let calls = 0;
      expect(() => publish(root, {
        onStagingDirectory: (directory) => { stagingDirectory = directory; },
        rename: (from, to) => { calls += 1; if (calls === 5) throw new Error("SUMMARY_PUBLICATION_FAILED"); renameSync(from, to); },
      })).toThrow("SUMMARY_PUBLICATION_FAILED");
      for (const target of Object.values(paths(root))) expect(existsSync(target)).toBe(false);
      expect(existsSync(stagingDirectory)).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects pre-existing output before staging and leaves it unchanged", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "tradepulse-r8-publication-"));
    try {
      const target = paths(root);
      mkdirSync(path.dirname(target.audit), { recursive: true });
      writeFileSync(target.audit, "pre-existing-bytes", "utf8");
      let staged = false;
      expect(() => publish(root, { onStagingDirectory: () => { staged = true; } })).toThrow("refusing overwrite");
      expect(readFileSync(target.audit, "utf8")).toBe("pre-existing-bytes");
      expect(existsSync(target.results)).toBe(false);
      expect(staged).toBe(false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not depend on os.tmpdir for staging", () => {
    const source = readFileSync(path.resolve("src/lib/research/m3-r8-round-008-publication.ts"), "utf8");
    expect(source).not.toContain("os.tmpdir");
    expect(source).not.toContain("node:os");
  });
});
