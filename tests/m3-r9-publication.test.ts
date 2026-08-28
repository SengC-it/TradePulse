import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  publishR9ArtifactsAtomically,
  r9OutputPaths,
  type R9ExecutionArtifacts,
} from "../src/lib/research/m3-r9-round-009-performance.ts";

describe("M3-R9 evidence publication", () => {
  it("publishes each generated artifact to its matching destination without execution", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "tradepulse-r9-publication-test-"));
    const artifacts = {
      summaryJson: "SUMMARY_BYTES",
      auditJson: "AUDIT_BYTES",
      resultsMarkdown: "RESULTS_BYTES",
      selectionJson: "SELECTION_JSON_BYTES",
      selectionMarkdown: "SELECTION_MARKDOWN_BYTES",
    } as unknown as R9ExecutionArtifacts;
    try {
      publishR9ArtifactsAtomically({ root, artifacts });
      const [summary, audit, results, selectionJson, selectionMarkdown] = r9OutputPaths(root);
      expect(readFileSync(summary, "utf8")).toBe(artifacts.summaryJson);
      expect(readFileSync(audit, "utf8")).toBe(artifacts.auditJson);
      expect(readFileSync(results, "utf8")).toBe(artifacts.resultsMarkdown);
      expect(readFileSync(selectionJson, "utf8")).toBe(artifacts.selectionJson);
      expect(readFileSync(selectionMarkdown, "utf8")).toBe(artifacts.selectionMarkdown);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
