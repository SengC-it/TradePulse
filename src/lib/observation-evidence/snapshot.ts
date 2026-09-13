import { createHash } from "node:crypto";

import { canonicalJson } from "./canonical.ts";
import type {
  ObservationAdvisoryIdentity,
  ObservationArtifactType,
  ObservationJsonValue,
  ObservationSnapshotArtifact,
  ObservationTimestampAuthority,
} from "./types.ts";

export const R22_OBSERVATION_SNAPSHOT_SCHEMA_VERSION =
  "m3-r22-observation-instrumentation-design-002" as const;

export const R22_OBSERVATION_TIMESTAMP_AUTHORITY: ObservationTimestampAuthority = Object.freeze({
  capturedAtAuthority: "SERVER_WALL_CLOCK",
  informationAsOfAuthority: "SERVER_SOURCE_CUTOFF",
  userSuppliedCapturedAt: false,
  userSuppliedInformationAsOf: false,
  backdated: false,
});

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export type ObservationSnapshotContentHashInput = Readonly<{
  schemaVersion: string;
  artifactType: ObservationArtifactType;
  advisoryIdentity: ObservationAdvisoryIdentity;
  informationAsOf: string;
  sourceRef: string;
  payload: ObservationJsonValue;
}>;

export function calculateObservationSnapshotContentHash(
  input: ObservationSnapshotContentHashInput,
): string {
  return sha256(canonicalJson({
    schemaVersion: input.schemaVersion,
    artifactType: input.artifactType,
    advisoryIdentity: input.advisoryIdentity,
    informationAsOf: input.informationAsOf,
    sourceRef: input.sourceRef,
    payload: input.payload,
  }));
}

export function calculateObservationSnapshotEvidenceHash(input: Readonly<{
  contentHash: string;
  capturedAt: string;
  timestampAuthority: ObservationTimestampAuthority;
  artifactId: string;
}>): string {
  return sha256(canonicalJson({
    contentHash: input.contentHash,
    capturedAt: input.capturedAt,
    timestampAuthority: input.timestampAuthority,
    artifactId: input.artifactId,
  }));
}

export function calculateObservationSnapshotIdempotencyKey(input: Readonly<{
  signalId: string;
  artifactType: ObservationArtifactType;
  schemaVersion: string;
  informationAsOf: string;
  contentHash: string;
}>): string {
  return sha256([
    "SNAPSHOT",
    input.signalId,
    input.artifactType,
    input.schemaVersion,
    input.informationAsOf,
    input.contentHash,
  ].join("|"));
}

export function snapshotHashInput(artifact: ObservationSnapshotArtifact): ObservationSnapshotContentHashInput {
  return {
    schemaVersion: artifact.schemaVersion,
    artifactType: artifact.artifactType,
    advisoryIdentity: artifact.advisoryIdentity,
    informationAsOf: artifact.informationAsOf,
    sourceRef: artifact.sourceRef,
    payload: artifact.payload,
  };
}
