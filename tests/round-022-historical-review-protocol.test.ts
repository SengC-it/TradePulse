import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  R22_HISTORICAL_REVIEW_ACCEPTED_SOURCE,
  R22_HISTORICAL_REVIEW_BASE_BRANCH,
  R22_HISTORICAL_REVIEW_BRANCH,
  R22_HISTORICAL_REVIEW_CONTRACT_PATH,
  R22_HISTORICAL_REVIEW_DESIGN_PATH,
  R22_HISTORICAL_REVIEW_DIRECTIONS,
  R22_HISTORICAL_REVIEW_GOVERNANCE,
  R22_HISTORICAL_REVIEW_IDENTITY_FIELDS,
  R22_HISTORICAL_REVIEW_PHASE,
  R22_HISTORICAL_REVIEW_ROUND_ID,
  R22_HISTORICAL_REVIEW_SCHEMA_VERSION,
  R22_HISTORICAL_REVIEW_STATUSES,
  classifyR22HistoricalReview,
  createR22HistoricalReviewKey,
  isR22HistoricalReviewDesignOnlyGovernance,
  isR22HistoricalReviewIdentityValid,
  type R22HistoricalReviewIdentity,
} from "@/lib/research/historical-review-protocol";

type JsonRecord = Record<string, unknown>;

const contractPath = path.join(process.cwd(), R22_HISTORICAL_REVIEW_CONTRACT_PATH);
const designPath = path.join(process.cwd(), R22_HISTORICAL_REVIEW_DESIGN_PATH);
const protocolPath = path.join(process.cwd(), "src/lib/research/historical-review-protocol.ts");

function loadContract(): JsonRecord {
  return JSON.parse(readFileSync(contractPath, "utf8")) as JsonRecord;
}

function validIdentity(overrides: Partial<R22HistoricalReviewIdentity> = {}): R22HistoricalReviewIdentity {
  return {
    signalId: "signal-001",
    symbol: "BTCUSDT",
    direction: "LONG",
    signalTime: "2026-08-15T00:00:00.000Z",
    strategyId: "baseline-001",
    strategyVersion: "baseline-001",
    ...overrides,
  };
}

describe("Round-022 historical review design-only protocol", () => {
  it("binds the exact accepted base and design phase", () => {
    const contract = loadContract();
    expect(contract.researchRoundId).toBe(R22_HISTORICAL_REVIEW_ROUND_ID);
    expect(contract.phase).toBe(R22_HISTORICAL_REVIEW_PHASE);
    expect(contract.branch).toBe(R22_HISTORICAL_REVIEW_BRANCH);
    expect(contract.acceptedResearchSource).toEqual({
      branch: R22_HISTORICAL_REVIEW_BASE_BRANCH,
      commit: R22_HISTORICAL_REVIEW_ACCEPTED_SOURCE,
      requiredBaseHead: R22_HISTORICAL_REVIEW_ACCEPTED_SOURCE,
    });
  });

  it("freezes the exact six-field identity and exact direction/status values", () => {
    const contract = loadContract();
    expect(R22_HISTORICAL_REVIEW_IDENTITY_FIELDS).toEqual([
      "signalId",
      "symbol",
      "direction",
      "signalTime",
      "strategyId",
      "strategyVersion",
    ]);
    expect(R22_HISTORICAL_REVIEW_DIRECTIONS).toEqual(["LONG", "SHORT", "NO_SIGNAL"]);
    expect(R22_HISTORICAL_REVIEW_STATUSES).toContain("IDENTITY_INVALID");
    expect((contract.identity as JsonRecord).matching).toBe("EXACT_CASE_SENSITIVE_DETERMINISTIC");
  });

  it("accepts complete LONG and SHORT identities without reading any data", () => {
    expect(isR22HistoricalReviewIdentityValid(validIdentity())).toBe(true);
    expect(isR22HistoricalReviewIdentityValid(validIdentity({ direction: "SHORT" }))).toBe(true);
    expect(classifyR22HistoricalReview({
      identity: validIdentity({ direction: "SHORT" }),
      qualitySnapshotStatus: "MISSING",
    })).toMatchObject({
      status: "QUALITY_SNAPSHOT_MISSING",
      identityValid: true,
      humanDecisionRequired: true,
      automaticTrading: false,
    });
  });

  it("rejects incomplete, non-canonical, or unapproved identities", () => {
    expect(isR22HistoricalReviewIdentityValid(validIdentity({ signalId: " " }))).toBe(false);
    expect(isR22HistoricalReviewIdentityValid(validIdentity({ signalTime: "2026-08-15T08:00:00+08:00" }))).toBe(false);
    expect(isR22HistoricalReviewIdentityValid(validIdentity({ strategyVersion: "" }))).toBe(false);
    const unapprovedSymbol = { ...validIdentity(), symbol: "DOGEUSDT" } as unknown as R22HistoricalReviewIdentity;
    expect(classifyR22HistoricalReview({
      identity: unapprovedSymbol,
      qualitySnapshotStatus: "AVAILABLE",
    }).status).toBe("IDENTITY_INVALID");
  });

  it("treats NO_SIGNAL as not reviewable without inventing a quality snapshot", () => {
    const result = classifyR22HistoricalReview({
      identity: validIdentity({ direction: "NO_SIGNAL" }),
      qualitySnapshotStatus: "NOT_APPLICABLE",
    });
    expect(result).toMatchObject({
      status: "NOT_REVIEWABLE",
      identityValid: true,
      qualitySnapshotStatus: "NOT_APPLICABLE",
    });
  });

  it("uses a deterministic identity key and changes it for any identity field", () => {
    const first = createR22HistoricalReviewKey(validIdentity());
    const second = createR22HistoricalReviewKey(validIdentity({ signalTime: "2026-08-15T01:00:00.000Z" }));
    expect(first).toBe(createR22HistoricalReviewKey(validIdentity()));
    expect(first).not.toBe(second);
    expect(first).toContain(R22_HISTORICAL_REVIEW_SCHEMA_VERSION);
  });

  it("consumes quality snapshot availability without recalculating quality", () => {
    const result = classifyR22HistoricalReview({
      identity: validIdentity(),
      qualitySnapshotStatus: "AVAILABLE",
    });
    expect(result.status).toBe("QUALITY_SNAPSHOT_AVAILABLE");
    expect(result).not.toHaveProperty("qualityGrade");
    expect(result).not.toHaveProperty("qualityScore");
  });

  it("has no database, network, outcome, or performance read path", () => {
    const source = readFileSync(protocolPath, "utf8");
    expect(source).not.toMatch(/supabase|fetch\s*\(|tp_signal_results|forwardReturn|performanceEvidence|pnl/i);
    const contract = loadContract();
    const dataAccess = contract.dataAccess as JsonRecord;
    expect(dataAccess.currentPhase).toBe("NO_DATA_READ");
    expect(dataAccess.networkAcquisition).toBe(false);
    expect(dataAccess.outcomeTablesConsumed).toBe(false);
  });

  it("freezes the design-only governance state", () => {
    const contract = loadContract();
    expect(isR22HistoricalReviewDesignOnlyGovernance(R22_HISTORICAL_REVIEW_GOVERNANCE)).toBe(true);
    expect(contract.governance).toMatchObject({
      economicValuesRead: false,
      performanceExecutionCount: 0,
      performanceLedgerPresent: false,
      performanceExecuted: false,
      backtestExecuted: false,
      selectionExecuted: false,
      newMarketDataFetched: false,
      productionUnchanged: true,
      baseline002Status: "NOT_FROZEN",
      m3JStatus: "BLOCKED",
      m4Status: "NOT_STARTED",
      automaticTrading: false,
      humanDecisionRequired: true,
    });
  });

  it("documents all forbidden economic and execution boundaries", () => {
    const contract = loadContract();
    const forbidden = contract.forbiddenInputs as string[];
    expect(forbidden).toEqual(expect.arrayContaining([
      "PnL",
      "forwardReturn",
      "tp_signal_results",
      "performanceEvidence",
      "newMarketData",
    ]));
    const markdown = readFileSync(designPath, "utf8");
    expect(markdown).toContain("performs no data access");
    expect(markdown).toContain("automaticTrading=false");
    expect(markdown).toContain("STOP_PENDING_DESIGN_ACCEPTANCE");
  });
});
