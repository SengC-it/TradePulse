import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  buildR22ReviewStartedCandidate,
  calculateR22HumanReviewIdempotencyKey,
  calculateR22ReviewObservationId,
  parseR22HumanReviewLabels,
  validateR22HumanReviewCandidate,
} from "@/lib/observation-evidence/human-review";
import type {
  ObservationEvidenceAppendResult,
  ObservationEvidenceCandidate,
} from "@/lib/observation-evidence/types";
import {
  startHumanReview,
  submitHumanReview,
  type R22HumanReviewAdvisoryIdentityStore,
  type R22HumanReviewDependencies,
  type R22HumanReviewEvidenceStore,
} from "@/lib/human-review/service";
import {
  isR22R9ImplementationReady,
  R22_R9_ACCEPTED_SOURCE,
  R22_R9_FINAL_DECISION,
  R22_R9_HUMAN_REVIEW_CONTRACT,
  R22_R9_STATUS,
} from "@/lib/research/round-022-r9-human-review-causal-integration-protocol";

const identity = {
  signalId: "signal-001",
  symbol: "BTCUSDT" as const,
  direction: "LONG" as const,
  signalTime: "2026-09-12T10:00:00.000Z",
  strategyId: "baseline-001",
  strategyVersion: "baseline-001",
};

class InMemoryReviewEvidenceStore implements R22HumanReviewEvidenceStore {
  readonly events = new Map<string, ObservationEvidenceCandidate>();

  async appendEvidence(candidate: ObservationEvidenceCandidate): Promise<ObservationEvidenceAppendResult> {
    const existing = [...this.events.values()].find((event) => event.idempotencyKey === candidate.idempotencyKey);
    if (existing) return { status: "IDEMPOTENT_REPLAY", evidenceId: existing.evidenceId };
    this.events.set(`${candidate.reviewObservationId}|${candidate.eventType}`, candidate);
    return { status: "APPENDED", evidenceId: candidate.evidenceId };
  }

  async findReviewEvent(input: Readonly<{
    reviewObservationId: string;
    eventType: "REVIEW_STARTED" | "REVIEW_SUBMITTED";
  }>): Promise<ObservationEvidenceCandidate | null> {
    return this.events.get(`${input.reviewObservationId}|${input.eventType}`) ?? null;
  }
}

function createDependencies(
  store: InMemoryReviewEvidenceStore,
  now: () => string,
  advisory: R22HumanReviewAdvisoryIdentityStore = {
    findBySignalId: async (signalId) => signalId === identity.signalId ? identity : null,
  },
): R22HumanReviewDependencies {
  return { advisoryIdentityStore: advisory, evidenceStore: store, now };
}

describe("Round-022 R9 human-review causal lifecycle", () => {
  it("freezes R9 ownership, accepted source, and acceptance boundary", () => {
    expect(R22_R9_ACCEPTED_SOURCE).toBe("b393334ec7203e6eb08565aaad413ef269bd8147");
    expect(R22_R9_STATUS.r6AcceptanceStatus).toBe("ACCEPTED");
    expect(R22_R9_STATUS.r7AcceptanceStatus).toBe("ACCEPTED");
    expect(R22_R9_STATUS.r8AcceptanceStatus).toBe("ACCEPTED");
    expect(R22_R9_STATUS.closesReadinessNodes).toEqual(["S07", "S08", "S09"]);
    expect(R22_R9_STATUS.s07Status).toBe("SOURCE_READY_PENDING_ACCEPTANCE");
    expect(R22_R9_STATUS.s08Status).toBe("SOURCE_READY_PENDING_ACCEPTANCE");
    expect(R22_R9_STATUS.s09Status).toBe("SOURCE_READY_PENDING_ACCEPTANCE");
    expect(R22_R9_STATUS.s10Status).toBe("FAIL");
    expect(R22_R9_STATUS.s07AcceptedReady).toBe(false);
    expect(R22_R9_STATUS.s08AcceptedReady).toBe(false);
    expect(R22_R9_STATUS.s09AcceptedReady).toBe(false);
    expect(R22_R9_STATUS.r10Started).toBe(false);
    expect(isR22R9ImplementationReady()).toBe(true);
    expect(R22_R9_FINAL_DECISION).toMatchObject({
      decision: "ROUND-022 R9 HUMAN REVIEW CAUSAL LIFECYCLE IMPLEMENTATION READY",
      nextStage: "STOP_PENDING_R9_ACCEPTANCE",
    });
  });

  it("creates a server-owned REVIEW_STARTED event with no fabricated labels", async () => {
    const store = new InMemoryReviewEvidenceStore();
    const dependencies = createDependencies(store, () => "2026-09-12T10:00:02.000Z");
    const result = await startHumanReview({ signalId: identity.signalId, dependencies });
    const start = [...store.events.values()][0]!;

    expect(result).toMatchObject({ status: "APPENDED", eventType: "REVIEW_STARTED" });
    expect(start.eventKind).toBe("REVIEW");
    expect(start.eventType).toBe("REVIEW_STARTED");
    expect(start.reviewStartedAt).toBe("2026-09-12T10:00:02.000Z");
    expect(start.reviewSubmittedAt).toBeNull();
    expect(start.capturedAt).toBe("2026-09-12T10:00:02.000Z");
    expect(start.reviewObservationId).toBe(calculateR22ReviewObservationId(identity.signalId));
    expect(start.payload).not.toHaveProperty("humanReview");
    expect(validateR22HumanReviewCandidate(start)).toEqual({ status: "OBSERVABLE", reason: "NONE" });
  });

  it("rejects a pre-signal REVIEW_STARTED without clamping or persistence", async () => {
    const store = new InMemoryReviewEvidenceStore();
    const result = await startHumanReview({
      signalId: identity.signalId,
      dependencies: createDependencies(store, () => "2026-09-12T09:59:59.999Z"),
    });
    expect(result).toMatchObject({ status: "NOT_EVALUABLE", reason: "INVALID_CANDIDATE" });
    expect(store.events.size).toBe(0);
  });

  it("keeps reviewObservationId and START idempotency stable across retries", async () => {
    const store = new InMemoryReviewEvidenceStore();
    const dependencies = createDependencies(store, () => "2026-09-12T10:00:02.000Z");
    const first = await startHumanReview({ signalId: identity.signalId, dependencies });
    const retry = await startHumanReview({ signalId: identity.signalId, dependencies });
    const reviewObservationId = calculateR22ReviewObservationId(identity.signalId);
    expect(first.status).toBe("APPENDED");
    expect(retry.status).toBe("IDEMPOTENT_REPLAY");
    expect(first.reviewObservationId).toBe(reviewObservationId);
    expect(retry.reviewObservationId).toBe(reviewObservationId);
    expect(calculateR22HumanReviewIdempotencyKey(reviewObservationId, "REVIEW_STARTED")).toBe(
      "REVIEW|R22_REVIEW|signal-001|m3-r22-observation-instrumentation-design-002|START",
    );
    expect(store.events.size).toBe(1);
  });

  it("requires a valid persisted START before SUBMIT and reuses its timestamp", async () => {
    const store = new InMemoryReviewEvidenceStore();
    let clock = "2026-09-12T10:00:02.000Z";
    const dependencies = createDependencies(store, () => clock);
    await startHumanReview({ signalId: identity.signalId, dependencies });
    clock = "2026-09-12T10:00:05.000Z";
    const result = await submitHumanReview({
      signalId: identity.signalId,
      labels: { reviewComplete: true, informationSufficient: true, unnecessaryAlert: false },
      dependencies,
    });
    const submit = [...store.events.values()].find((event) => event.eventType === "REVIEW_SUBMITTED");

    expect(result).toMatchObject({ status: "APPENDED", eventType: "REVIEW_SUBMITTED" });
    expect(submit).toBeDefined();
    expect(submit!.reviewObservationId).toBe(calculateR22ReviewObservationId(identity.signalId));
    expect(submit!.reviewStartedAt).toBe("2026-09-12T10:00:02.000Z");
    expect(submit!.reviewSubmittedAt).toBe("2026-09-12T10:00:05.000Z");
    expect(submit!.capturedAt).toBe("2026-09-12T10:00:05.000Z");
    expect(submit!.payload).toMatchObject({
      humanReview: { reviewComplete: true, informationSufficient: true, unnecessaryAlert: false },
      labelSource: "EXPLICIT_HUMAN_LABEL",
      decisionLatencyProxyMs: 3_000,
      humanDecisionRequired: true,
      automaticTrading: false,
    });
    expect(submit!.idempotencyKey).toBe(
      "REVIEW|R22_REVIEW|signal-001|m3-r22-observation-instrumentation-design-002|SUBMIT",
    );
    expect(submit!.idempotencyKey).not.toBe([...store.events.values()][0]!.idempotencyKey);
    expect(validateR22HumanReviewCandidate(submit!)).toEqual({ status: "OBSERVABLE", reason: "NONE" });
  });

  it("accepts only the exact three human-review labels and returns a normalized copy", async () => {
    const valid = {
      reviewComplete: true,
      informationSufficient: true,
      unnecessaryAlert: false,
    };
    expect(parseR22HumanReviewLabels(valid)).toEqual(valid);
    expect(parseR22HumanReviewLabels(valid)).not.toBe(valid);
    expect(parseR22HumanReviewLabels({ reviewComplete: true, informationSufficient: true })).toBeNull();
    expect(parseR22HumanReviewLabels({
      reviewComplete: true,
      informationSufficient: true,
      unnecessaryAlert: "false",
    })).toBeNull();
    expect(parseR22HumanReviewLabels({ ...valid, comment: "extra" })).toBeNull();
    expect(parseR22HumanReviewLabels({ ...valid, arbitrary: 1 })).toBeNull();

    const store = new InMemoryReviewEvidenceStore();
    const dependencies = createDependencies(store, () => "2026-09-12T10:00:05.000Z");
    await startHumanReview({ signalId: identity.signalId, dependencies });
    const extra = await submitHumanReview({
      signalId: identity.signalId,
      labels: { ...valid, comment: "extra" },
      dependencies,
    });
    expect(extra).toMatchObject({ status: "NOT_EVALUABLE", reason: "SUBMIT_FIELDS_REQUIRED" });
    expect([...store.events.values()].filter((event) => event.eventType === "REVIEW_SUBMITTED")).toHaveLength(0);
  });

  it("replays SUBMIT without a second row or replacing the original server timestamp", async () => {
    const store = new InMemoryReviewEvidenceStore();
    let clock = "2026-09-12T10:00:01.000Z";
    const dependencies = createDependencies(store, () => clock);
    const labels = { reviewComplete: true, informationSufficient: false, unnecessaryAlert: false };
    await startHumanReview({ signalId: identity.signalId, dependencies });
    clock = "2026-09-12T10:00:02.000Z";
    const first = await submitHumanReview({ signalId: identity.signalId, labels, dependencies });
    const firstSubmit = [...store.events.values()].find((event) => event.eventType === "REVIEW_SUBMITTED");
    clock = "2026-09-12T10:00:03.000Z";
    const retry = await submitHumanReview({
      signalId: identity.signalId,
      labels: { ...labels },
      dependencies,
    });
    const submitEvents = [...store.events.values()].filter((event) => event.eventType === "REVIEW_SUBMITTED");
    const reviewObservationId = calculateR22ReviewObservationId(identity.signalId);

    expect(first.status).toBe("APPENDED");
    expect(retry).toMatchObject({
      status: "IDEMPOTENT_REPLAY",
      reviewObservationId,
      evidenceId: first.evidenceId,
    });
    expect(firstSubmit).toBeDefined();
    expect(submitEvents).toHaveLength(1);
    expect(submitEvents[0]!.reviewSubmittedAt).toBe("2026-09-12T10:00:02.000Z");
    expect(submitEvents[0]!.idempotencyKey).toBe(
      calculateR22HumanReviewIdempotencyKey(reviewObservationId, "REVIEW_SUBMITTED"),
    );
  });

  it("rejects SUBMIT without START, missing labels, or submittedAt before START", async () => {
    const missingStartStore = new InMemoryReviewEvidenceStore();
    const missingLabels = await submitHumanReview({
      signalId: identity.signalId,
      labels: { reviewComplete: true },
      dependencies: createDependencies(missingStartStore, () => "2026-09-12T10:00:05.000Z"),
    });
    const missingStart = await submitHumanReview({
      signalId: identity.signalId,
      labels: { reviewComplete: true, informationSufficient: true, unnecessaryAlert: false },
      dependencies: createDependencies(missingStartStore, () => "2026-09-12T10:00:05.000Z"),
    });
    expect(missingLabels.reason).toBe("SUBMIT_FIELDS_REQUIRED");
    expect(missingStart.reason).toBe("START_NOT_FOUND");

    const store = new InMemoryReviewEvidenceStore();
    let clock = "2026-09-12T10:00:05.000Z";
    const dependencies = createDependencies(store, () => clock);
    await startHumanReview({ signalId: identity.signalId, dependencies });
    clock = "2026-09-12T10:00:04.000Z";
    const inversion = await submitHumanReview({
      signalId: identity.signalId,
      labels: { reviewComplete: true, informationSufficient: true, unnecessaryAlert: false },
      dependencies,
    });
    expect(inversion.reason).toBe("INVALID_CANDIDATE");
    expect([...store.events.values()].filter((event) => event.eventType === "REVIEW_SUBMITTED")).toHaveLength(0);
  });

  it("rejects a persisted START whose advisory identity does not match the authoritative advisory", async () => {
    const store = new InMemoryReviewEvidenceStore();
    const validStart = buildR22ReviewStartedCandidate({
      advisory: identity,
      reviewStartedAt: "2026-09-12T10:00:02.000Z",
      capturedAt: "2026-09-12T10:00:02.000Z",
    });
    store.events.set(`${validStart.reviewObservationId}|REVIEW_STARTED`, {
      ...validStart,
      strategyVersion: "different-strategy",
    });
    const result = await submitHumanReview({
      signalId: identity.signalId,
      labels: { reviewComplete: true, informationSufficient: true, unnecessaryAlert: false },
      dependencies: createDependencies(store, () => "2026-09-12T10:00:05.000Z"),
    });
    expect(result).toMatchObject({ status: "NOT_EVALUABLE", reason: "IDENTITY_MISMATCH" });
  });

  it("keeps START and SUBMIT distinct, append-only, and independent of economic review data", async () => {
    const store = new InMemoryReviewEvidenceStore();
    let clock = "2026-09-12T10:00:02.000Z";
    const dependencies = createDependencies(store, () => clock);
    await startHumanReview({ signalId: identity.signalId, dependencies });
    clock = "2026-09-12T10:00:05.000Z";
    await submitHumanReview({
      signalId: identity.signalId,
      labels: { reviewComplete: false, informationSufficient: true, unnecessaryAlert: true },
      dependencies,
    });
    expect(store.events.size).toBe(2);
    expect(new Set([...store.events.values()].map((event) => event.eventType))).toEqual(
      new Set(["REVIEW_STARTED", "REVIEW_SUBMITTED"]),
    );
    expect(JSON.stringify([...store.events.values()].map((event) => event.payload))).not.toMatch(
      /pnl|profit|loss|return|future|settlement|tradeOutcome|economicOutcome/i,
    );
    expect(R22_R9_HUMAN_REVIEW_CONTRACT.forbiddenSource).toContain("not R22 human-review evidence");
  });

  it("exposes two server runtime boundaries without changing the signal scan path", () => {
    const startRoute = readFileSync("src/app/api/dashboard/human-review/start/route.ts", "utf8");
    const submitRoute = readFileSync("src/app/api/dashboard/human-review/submit/route.ts", "utf8");
    const service = readFileSync("src/lib/human-review/service.ts", "utf8");
    expect(startRoute).toContain("export async function POST");
    expect(submitRoute).toContain("export async function POST");
    expect(startRoute).toContain("startHumanReview");
    expect(submitRoute).toContain("submitHumanReview");
    expect(`${startRoute}\n${submitRoute}\n${service}`).not.toMatch(/tp_advisory_reviews|tp_review_runs/);
    expect(service).not.toMatch(/forwardReturn|futurePrice|realizedPnL|tradeOutcome|economicOutcome/);
    expect(service).not.toMatch(/signal-quality|risk-advisory|alert-intelligence|notification/);
  });
});
