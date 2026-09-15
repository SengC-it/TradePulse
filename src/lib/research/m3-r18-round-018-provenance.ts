import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import {
  ROUND_018_ACCEPTED_SOURCE,
  ROUND_018_R14_MANIFEST_SOURCE,
  ROUND_018_OBSERVATION_COUNT,
  ROUND_018_OBSERVATION_SOURCE,
  ROUND_018_OBSERVATION_SHA256,
} from "./m3-r18-round-018-protocol.ts";

type SourceBlob = Readonly<{
  path: string;
  gitBlobSha: string;
  sha256: string;
  anchors: readonly string[];
}>;

type R18DesignForProvenance = Readonly<{
  acceptedResearchSource: Readonly<{ branch: string; commit: string; requiredBaseHead: string }>;
  baselineScoreProvenance: Readonly<{
    acceptedSourceCommit: string;
    authoritativeSourceBlobs: readonly SourceBlob[];
    workingTreeSubstitution: boolean;
  }>;
  canonicalDataSource: Readonly<{
    observationDataPath: string;
    acceptedObservationCount: number;
    observationDataSha256: string;
    manifestPath: string;
    manifestSha256: string;
  }>;
  frozenFolds: Readonly<{ sourceCommit: string; sourcePath: string; sourceSha256: string }>;
  frozenRegimes: Readonly<{ sourceCommit: string; sourcePath: string; sourceSha256: string }>;
}>;

export type R18AcceptedProvenance = Readonly<{
  acceptedSourceCommit: typeof ROUND_018_ACCEPTED_SOURCE;
  sourceBlobs: readonly SourceBlob[];
  engineSourceSha256: string;
  foldsSourceSha256: string;
  regimesSourceSha256: string;
  r14ManifestPath: typeof ROUND_018_R14_MANIFEST_SOURCE;
  r14ManifestSha256: string;
  r14ObservationDataPath: string;
  r14ObservationCount: number;
  r14ObservationDataSha256: typeof ROUND_018_OBSERVATION_SHA256;
  acceptedSourceProvenanceValid: boolean;
}>;

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function gitBlob(root: string, commit: string, sourcePath: string): Buffer {
  return execFileSync("git", ["cat-file", "blob", `${commit}:${sourcePath}`], {
    cwd: root,
    encoding: null,
    stdio: ["ignore", "pipe", "pipe"],
  }) as Buffer;
}

function gitBlobSha(root: string, commit: string, sourcePath: string): string {
  return execFileSync("git", ["rev-parse", `${commit}:${sourcePath}`], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function verifySourceBlob(root: string, commit: string, source: SourceBlob): boolean {
  try {
    const blob = gitBlob(root, commit, source.path);
    if (sha256(blob) !== source.sha256 || gitBlobSha(root, commit, source.path) !== source.gitBlobSha) return false;
    if (!source.anchors.every((anchor) => blob.toString("utf8").includes(anchor))) return false;
    const workingTreePath = path.join(root, source.path);
    if (!existsSync(workingTreePath) || sha256(readFileSync(workingTreePath)) !== source.sha256) return false;
    return true;
  } catch {
    return false;
  }
}

function verifyFixedSourcePath(root: string, commit: string, sourcePath: string, expectedSha256: string, anchor: string): boolean {
  try {
    const blob = gitBlob(root, commit, sourcePath);
    return sha256(blob) === expectedSha256
      && blob.toString("utf8").includes(anchor)
      && existsSync(path.join(root, sourcePath))
      && sha256(readFileSync(path.join(root, sourcePath))) === expectedSha256;
  } catch {
    return false;
  }
}

export function verifyR18AcceptedProvenance(
  root: string,
  design: R18DesignForProvenance,
): R18AcceptedProvenance {
  const sourceCommit = design.acceptedResearchSource.commit;
  let commitExists = false;
  try {
    const resolved = execFileSync("git", ["rev-parse", `${sourceCommit}^{commit}`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    commitExists = resolved === sourceCommit;
  } catch {
    commitExists = false;
  }

  const sourceBlobs = design.baselineScoreProvenance.authoritativeSourceBlobs;
  const sourceBlobsValid = sourceBlobs.length === 5
    && sourceBlobs.every((source) => verifySourceBlob(root, sourceCommit, source));
  const engine = sourceBlobs.find((source) => source.path === "src/lib/strategy/engine.ts");
  const folds = design.frozenFolds;
  const regimes = design.frozenRegimes;
  let manifestValid = false;
  let manifestDataPath = design.canonicalDataSource.observationDataPath;
  let manifestObservationCount = design.canonicalDataSource.acceptedObservationCount;
  let manifestDataSha256 = design.canonicalDataSource.observationDataSha256;
  try {
    const manifestBlob = gitBlob(root, sourceCommit, design.canonicalDataSource.manifestPath);
    const manifest = JSON.parse(manifestBlob.toString("utf8")) as Readonly<Record<string, unknown>>;
    const currentManifest = readFileSync(path.join(root, design.canonicalDataSource.manifestPath));
    manifestValid = sha256(manifestBlob) === design.canonicalDataSource.manifestSha256
      && sha256(currentManifest) === design.canonicalDataSource.manifestSha256
      && manifest.observationCount === ROUND_018_OBSERVATION_COUNT
      && manifest.observationDataPath === ROUND_018_OBSERVATION_SOURCE
      && manifest.observationDataSha256 === ROUND_018_OBSERVATION_SHA256
      && manifest.observationDataBytes === 1_893_811_055
      && manifest.observationDataPath === design.canonicalDataSource.observationDataPath;
    manifestDataPath = typeof manifest.observationDataPath === "string"
      ? manifest.observationDataPath
      : manifestDataPath;
    manifestObservationCount = typeof manifest.observationCount === "number"
      ? manifest.observationCount
      : manifestObservationCount;
    manifestDataSha256 = typeof manifest.observationDataSha256 === "string"
      ? manifest.observationDataSha256
      : manifestDataSha256;
  } catch {
    manifestValid = false;
  }

  const acceptedSourceProvenanceValid = commitExists
    && sourceCommit === ROUND_018_ACCEPTED_SOURCE
    && design.acceptedResearchSource.requiredBaseHead === ROUND_018_ACCEPTED_SOURCE
    && design.baselineScoreProvenance.acceptedSourceCommit === ROUND_018_ACCEPTED_SOURCE
    && design.baselineScoreProvenance.workingTreeSubstitution === false
    && design.canonicalDataSource.observationDataSha256 === ROUND_018_OBSERVATION_SHA256
    && design.canonicalDataSource.acceptedObservationCount === ROUND_018_OBSERVATION_COUNT
    && folds.sourceCommit === ROUND_018_ACCEPTED_SOURCE
    && regimes.sourceCommit === ROUND_018_ACCEPTED_SOURCE
    && verifyFixedSourcePath(root, sourceCommit, folds.sourcePath, folds.sourceSha256, "export const RESEARCH_FOLDS")
    && verifyFixedSourcePath(root, sourceCommit, regimes.sourcePath, regimes.sourceSha256, "export function calculateBTCRegime")
    && sourceBlobsValid
    && manifestValid;

  return Object.freeze({
    acceptedSourceCommit: ROUND_018_ACCEPTED_SOURCE,
    sourceBlobs: Object.freeze([...sourceBlobs]),
    engineSourceSha256: engine?.sha256 ?? "",
    foldsSourceSha256: folds.sourceSha256,
    regimesSourceSha256: regimes.sourceSha256,
    r14ManifestPath: ROUND_018_R14_MANIFEST_SOURCE,
    r14ManifestSha256: design.canonicalDataSource.manifestSha256,
    r14ObservationDataPath: manifestDataPath,
    r14ObservationCount: manifestObservationCount,
    r14ObservationDataSha256: manifestDataSha256 as typeof ROUND_018_OBSERVATION_SHA256,
    acceptedSourceProvenanceValid,
  });
}
