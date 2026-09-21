import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type JsonRecord = Record<string, unknown>;
type JsonRecordList = JsonRecord[];

const root = process.cwd();
const researchRoot = path.join(root, "docs", "research");
const audit = JSON.parse(readFileSync(path.join(researchRoot, "round-033-post-outcome-audit.json"), "utf8")) as JsonRecord;
const result = JSON.parse(readFileSync(path.join(researchRoot, "round-033-live-transport-timestamp-alignment-result.json"), "utf8")) as JsonRecord;
const receipt = JSON.parse(readFileSync(path.join(researchRoot, "round-033-execution-receipt.json"), "utf8")) as JsonRecord;
const manifest = JSON.parse(readFileSync(path.join(researchRoot, "round-033-evidence-manifest.json"), "utf8")) as JsonRecord;

const artifactPaths = {
  executionReceiptSha256: path.join(researchRoot, "round-033-execution-receipt.json"),
  evidenceManifestSha256: path.join(researchRoot, "round-033-evidence-manifest.json"),
  resultJsonSha256: path.join(researchRoot, "round-033-live-transport-timestamp-alignment-result.json"),
  resultMarkdownSha256: path.join(researchRoot, "round-033-live-transport-timestamp-alignment-result.md"),
} as const;

function sha256(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function field(fieldId: string): JsonRecord {
  const match = (result.fieldSummaries as JsonRecordList).find((item) => item.fieldId === fieldId);
  if (!match) throw new Error(`Missing R33 field summary: ${fieldId}`);
  return match;
}

function symbolVerdict(fieldSummary: JsonRecord, symbol: string): JsonRecord {
  const match = (fieldSummary.symbolVerdicts as JsonRecordList).find((item) => item.symbol === symbol);
  if (!match) throw new Error(`Missing R33 symbol verdict: ${fieldSummary.fieldId}/${symbol}`);
  return match;
}

function offsetEvaluation(verdict: JsonRecord, offset: string): JsonRecord {
  const match = (verdict.offsetEvaluations as JsonRecordList).find((item) => item.offset === offset);
  if (!match) throw new Error(`Missing R33 offset evaluation: ${verdict.symbol}/${offset}`);
  return match;
}

describe("Round-033 post-outcome test-boundary closure", () => {
  it("records a zero-network closure and preserves the frozen result", () => {
    expect(audit.classification).toBe("POST_OUTCOME_TEST_BOUNDARY_CLOSURE_ONLY");
    expect(audit.parentCommitSha).toBe("ab6d93a3648776d2e3e10eda5ee7676a5fa90beb");
    expect(audit.networkRequestsDuringClosure).toBe(0);
    expect(audit.r33ReprobeRerun).toBe(false);
    expect(audit.m3GProtocolStatus).toBe("EXCLUDED_FROM_ROUND_033");
    expect(audit.m3GToolingExclusionPresentBeforeClosure).toBe(false);
    expect(audit.m3GToolingExclusionPresentAfterClosure).toBe(true);
    expect(audit.scientificResultChanged).toBe(false);
    expect(audit.r33ResultChanged).toBe(false);
    expect(audit.r33EvidenceChanged).toBe(false);
    expect(audit.r33NumericResultChanged).toBe(false);
    expect(result.sourceClassification).toBe("BINANCE_METRICS_PARTIAL_CURRENT_REGIME_MAPPING_ESTABLISHED");
    expect(result.sourceNextStage).toBe("ADMITTED_FIELDS_HISTORICAL_AUDIT_REQUIRED");
    expect(result.r33ExecutionCount).toBe(1);
    expect(result.liveLogicalRequests).toBe(25);
    expect(result.firstAttemptSuccessCount).toBe(25);
    expect(result.retryAttemptCount).toBe(0);
    expect(result.retrySuccessCount).toBe(0);
    expect(result.liveSuccessfulRequests).toBe(25);
    expect(result.liveFailedRequests).toBe(0);
    expect(result.archiveOverlapReady).toBe(true);
    expect(result.archiveVersionDriftDetected).toBe(false);
  });

  it("preserves receipt, result, manifest, and evidence identities", () => {
    const originalArtifacts = audit.originalArtifacts as JsonRecord;
    const receiptClaims = audit.receiptClaims as JsonRecord;
    for (const [key, filePath] of Object.entries(artifactPaths)) {
      expect(sha256(filePath), key).toBe(originalArtifacts[key]);
    }
    expect(receipt.r33ExecutionCount).toBe(1);
    expect(receipt.resultSha256).toBe(receiptClaims.resultSha256);
    expect(receipt.evidenceManifestSha256).toBe(receiptClaims.evidenceManifestSha256);
    expect(receipt.resultSha256).toBe("f62ba8aed31d8ade78b4a9299ccaab3b4a204fafbe65a019eccc4a8c99b5e361");
    expect(receipt.evidenceManifestSha256).toBe("4a09695718434543f27a4368a184998591507b3beb3ab7e5841010e366c63675");
    expect(manifest.archiveEvidenceFiles).toBe(5);
    expect(manifest.liveEvidenceFiles).toBe(25);
    expect(manifest.allEvidenceSha256Present).toBe(true);
    expect(manifest.entries).toHaveLength(30);
    for (const entry of manifest.entries as JsonRecord[]) {
      const entryPath = entry.path as string;
      const entrySha256 = entry.sha256 as string;
      const evidencePath = path.join(root, ...entryPath.split("/"));
      expect(sha256(evidencePath), entryPath).toBe(entrySha256);
    }
  });

  it("keeps the two admitted fields on ARCHIVE_PLUS_5M for all symbols", () => {
    const symbols = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "BNBUSDT"];
    expect(result.admittedFields).toEqual(["OPEN_INTEREST", "TOP_TRADER_POSITION"]);
    expect(result.admittedFieldCount).toBe(2);
    for (const fieldId of result.admittedFields as string[]) {
      const summary = field(fieldId);
      expect(summary.status).toBe("FIELD_MAPPING_ADMITTED_CURRENT_REGIME");
      expect(summary.admitted).toBe(true);
      expect(summary.selectedOffset).toBe("ARCHIVE_PLUS_5M");
      for (const symbol of symbols) {
        const verdict = symbolVerdict(summary, symbol);
        expect(verdict.verdict).toBe("UNIQUE_SEMANTIC_OFFSET");
        expect(verdict.selectedOffset).toBe("ARCHIVE_PLUS_5M");
        const selected = offsetEvaluation(verdict, "ARCHIVE_PLUS_5M");
        expect(selected.denominatorRows).toBe(286);
        expect(selected.matchedRows).toBe(286);
        expect(selected.timestampCoverage).toBe(1);
        expect(selected.numericAgreementRate).toBe(1);
        expect(selected.pass).toBe(true);
        expect(offsetEvaluation(verdict, "EXACT").pass).toBe(false);
        expect(offsetEvaluation(verdict, "ARCHIVE_MINUS_5M").pass).toBe(false);
      }
    }
  });

  it("keeps rejected fields and the M3-G1 exclusion explicit", () => {
    expect(result.rejectedFields).toEqual(["TOP_TRADER_ACCOUNT", "GLOBAL_LONG_SHORT", "TAKER_RATIO"]);
    for (const fieldId of result.rejectedFields as string[]) {
      const summary = field(fieldId);
      expect(summary.status).toBe("FIELD_NUMERIC_SEMANTIC_MISMATCH");
      expect(summary.admitted).toBe(false);
      expect(summary.selectedOffset).toBeNull();
    }
    const toolingSource = readFileSync(path.join(root, "tests", "m3-g1-research-tooling.test.ts"), "utf8");
    expect(toolingSource).toContain('!name.startsWith("round-033-")');
    expect(audit.m3GToolingExclusionPresentAfterClosure).toBe(true);
    expect(result.economicOutcomeFilesRead).toBe(false);
    expect(result.economicEvaluationPerformed).toBe(false);
    expect(result.tradingEconomicMetricsCalculated).toBe(false);
    const governance = result.governance as JsonRecord;
    expect(governance.forwardEconomicValuesRead).toBe(false);
    expect(governance.forwardReturnRead).toBe(false);
    expect(governance.performanceExecutionCount).toBe(0);
    expect(governance.automaticTrading).toBe(false);
    expect(governance.humanDecisionRequired).toBe(true);
    expect(governance.productionUnchanged).toBe(true);
  });
});
