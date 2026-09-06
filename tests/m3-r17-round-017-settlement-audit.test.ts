import { describe, expect, it } from "vitest";

import {
  auditR17SettlementIdentityMatrix,
  isR17AcceptedSettlementSource,
  R17_G01_DATA_COMPLETENESS_FAILURE,
  type R17FormalIdentityInput,
  type R17SettlementIdentitySource,
} from "../src/lib/research/m3-r17-round-017-settlement-audit.ts";

function formal(canonicalIdentity: string, status: R17FormalIdentityInput["formalSourceStatus"] = "ACCEPTED_BASELINE_001_FORMAL_STREAM"): R17FormalIdentityInput {
  return Object.freeze({
    canonicalIdentity,
    formalSourceStatus: status,
    formalSourcePath: "ROUND006_FROZEN_1H_4H_CANDLE_CACHE_WITH_BASELINE_001_ENGINE",
    formalSourceSha256: "f".repeat(64),
  });
}

function source(input: Partial<R17SettlementIdentitySource> & Pick<R17SettlementIdentitySource, "identityIds" | "labelIdentityIds">): R17SettlementIdentitySource {
  return Object.freeze({
    sourceKind: "R14_OBSERVATION_CACHE",
    sourcePath: ".cache/tradepulse/round-014/observations.ndjson",
    sourceSha256: "a".repeat(64),
    sourceStatus: "ACCEPTED_EXISTING_HISTORICAL_CACHE",
    matchMode: "EXACT_CANONICAL_IDENTITY",
    networkAcquired: false,
    reconstructed: false,
    sourceRecordCount: input.identityIds.size,
    identityCount: input.identityIds.size,
    labelIdentityCount: input.labelIdentityIds.size,
    duplicateIdentityCount: 0,
    invalidIdentityRecordCount: 0,
    ...input,
  });
}

const identity = (offset: number): string => `${1_704_067_200_000 + offset * 3_600_000}|BTCUSDT|LONG`;

describe("Round-017 settlement-label identity audit", () => {
  it("does not fail G01 for a missing R14 identity when an accepted alternate label exists", () => {
    const id = identity(1);
    const audit = auditR17SettlementIdentityMatrix({
      formalIdentities: [formal(id)],
      settlementSources: [
        source({ identityIds: new Set(), labelIdentityIds: new Set() }),
        source({ sourceKind: "R15_OBSERVATION_CACHE", sourcePath: ".cache/tradepulse/round-015/observations.ndjson", identityIds: new Set([id]), labelIdentityIds: new Set([id]) }),
      ],
    });

    expect(audit.summary.categoryCounts.FORMAL_COMPLETE_R14_OBSERVATION_ID_MISSING_BUT_OTHER_ACCEPTED_LABEL_IDENTITY_EXISTS).toBe(1);
    expect(audit.summary.acceptedSettlementLabelIdentityCompleteCount).toBe(1);
    expect(audit.summary.g01DataComplete).toBe(true);
    expect(audit.summary.g01Failure).toBeNull();
  });

  it("fails G01 when no accepted settlement-label identity exists", () => {
    const id = identity(2);
    const audit = auditR17SettlementIdentityMatrix({ formalIdentities: [formal(id)], settlementSources: [source({ identityIds: new Set(), labelIdentityIds: new Set() })] });

    expect(audit.summary.categoryCounts.FORMAL_COMPLETE_NO_ACCEPTED_SETTLEMENT_LABEL_IDENTITY).toBe(1);
    expect(audit.summary.trueMissingRequiredLabelCount).toBe(1);
    expect(audit.summary.g01DataComplete).toBe(false);
    expect(audit.summary.g01Failure).toBe(R17_G01_DATA_COMPLETENESS_FAILURE);
  });

  it("requires exact canonical identity and rejects fuzzy, nearest, or one-millisecond matches", () => {
    const id = identity(3);
    for (const matchMode of ["FUZZY_TIMESTAMP", "NEAREST_TIMESTAMP"] as const) {
      const fuzzyAudit = auditR17SettlementIdentityMatrix({
        formalIdentities: [formal(id)],
        settlementSources: [source({ matchMode, identityIds: new Set([id]), labelIdentityIds: new Set([id]) })],
      });
      expect(fuzzyAudit.summary.acceptedSettlementLabelIdentityCompleteCount).toBe(0);
      expect(fuzzyAudit.summary.g01DataComplete).toBe(false);
    }

    const timestampParts = id.split("|");
    const shiftedIdentity = `${Number(timestampParts[0]) + 1}|BTCUSDT|LONG`;
    const shiftedAudit = auditR17SettlementIdentityMatrix({
      formalIdentities: [formal(id)],
      settlementSources: [source({ identityIds: new Set([shiftedIdentity]), labelIdentityIds: new Set([shiftedIdentity]) })],
    });
    expect(shiftedAudit.summary.acceptedSettlementLabelIdentityCompleteCount).toBe(0);
    expect(shiftedAudit.summary.g01DataComplete).toBe(false);
  });

  it("rejects network-acquired and reconstructed labels", () => {
    const id = identity(4);
    for (const sourceStatus of ["NETWORK_ACQUIRED", "RECONSTRUCTED"] as const) {
      const candidate = source({ sourceStatus, identityIds: new Set([id]), labelIdentityIds: new Set([id]) });
      expect(isR17AcceptedSettlementSource(candidate)).toBe(false);
      const audit = auditR17SettlementIdentityMatrix({ formalIdentities: [formal(id)], settlementSources: [candidate] });
      expect(audit.summary.trueMissingRequiredLabelCount).toBe(1);
      expect(audit.summary.g01DataComplete).toBe(false);
    }
  });

  it("fails closed for incomplete formal provenance", () => {
    const id = identity(5);
    const audit = auditR17SettlementIdentityMatrix({
      formalIdentities: [formal(id, "INCOMPLETE")],
      settlementSources: [source({ identityIds: new Set([id]), labelIdentityIds: new Set([id]) })],
    });

    expect(audit.summary.categoryCounts.FORMAL_SOURCE_PROVENANCE_INCOMPLETE).toBe(1);
    expect(audit.summary.trueMissingFormalProvenanceCount).toBe(1);
    expect(audit.summary.g01DataComplete).toBe(false);
  });

  it("partitions every formal identity exactly once", () => {
    const ids = [identity(10), identity(11), identity(12), identity(13), "not-a-canonical-identity"];
    const audit = auditR17SettlementIdentityMatrix({
      formalIdentities: [formal(ids[0]!), formal(ids[1]!), formal(ids[2]!), formal(ids[3]!, "INCOMPLETE"), formal(ids[4]!)],
      settlementSources: [
        source({ identityIds: new Set([ids[0]!]), labelIdentityIds: new Set([ids[0]!]) }),
        source({ sourceKind: "R15_OBSERVATION_CACHE", identityIds: new Set([ids[1]!]), labelIdentityIds: new Set([ids[1]!]) }),
        source({ identityIds: new Set([ids[2]!]), labelIdentityIds: new Set() }),
        source({ sourceKind: "R16_OBSERVATION_CACHE", identityIds: new Set([ids[3]!, ids[4]!]), labelIdentityIds: new Set([ids[3]!, ids[4]!]) }),
      ],
    });

    expect(audit.summary.partitionTotal).toBe(ids.length);
    expect(Object.values(audit.summary.categoryCounts).reduce((sum, count) => sum + count, 0)).toBe(ids.length);
    expect(audit.matrix).toHaveLength(ids.length);
    expect(audit.summary.categoryCounts.OTHER_ANOMALY).toBe(1);
  });

  it("keeps the audit metadata-only and never exposes economic values", () => {
    const id = identity(20);
    const audit = auditR17SettlementIdentityMatrix({
      formalIdentities: [formal(id)],
      settlementSources: [source({ identityIds: new Set([id]), labelIdentityIds: new Set([id]) })],
    });
    const serialized = JSON.stringify(audit);

    expect(audit.summary.labelValuesRead).toBe(false);
    expect(audit.summary.economicFieldsRead).toBe(false);
    expect(audit.summary).not.toHaveProperty("netR");
    expect(audit.summary).not.toHaveProperty("profitFactor");
    expect(serialized).not.toMatch(/netR|profitFactor|maximumDrawdown|winLoss|futureReturn/iu);
    expect(audit.summary).not.toHaveProperty("performanceExecutionCount");
  });

  it("does not provide a network-acquisition path", async () => {
    const moduleSource = await import("node:fs/promises").then(({ readFile }) => readFile(new URL("../src/lib/research/m3-r17-round-017-settlement-audit.ts", import.meta.url), "utf8"));
    expect(moduleSource).not.toMatch(/\bfetch\s*\(/u);
  });
});
