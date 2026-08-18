import { existsSync, readFileSync } from "node:fs";

import {
  M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256,
  M3R3RecoveryError,
  parseM3R3Round001EvidenceBytes,
  sha256M3R3RawBytes,
  validateM3R3ControlParity,
  verifyM3R3Round002InputArtifacts,
} from "../src/lib/research/m3-r3-round-003-recovery.ts";

const controlPath = ".tmp/m3-r2-round002-control.json";
const snapshotPath = ".tmp/m3-r2-round002-decision-snapshots.json";
const evidencePath = "docs/evidence/M3_H_ROUND_001_SUMMARY.json";

function printFailure(code: string): void {
  console.log(JSON.stringify({ status: code }));
  process.exitCode = 1;
}

if (!existsSync(controlPath) || !existsSync(snapshotPath)) {
  printFailure("ROUND_003_INPUT_ARTIFACTS_UNAVAILABLE");
} else {
  try {
    const controlReportBytes = readFileSync(controlPath);
    const decisionSnapshotBytes = readFileSync(snapshotPath);
    const verified = verifyM3R3Round002InputArtifacts({ controlReportBytes, decisionSnapshotBytes });
    const round001EvidenceBytes = readFileSync(evidencePath);
    if (sha256M3R3RawBytes(round001EvidenceBytes) !== M3_R3_ROUND_003_EXPECTED_ROUND_001_EVIDENCE_SHA256) {
      throw new M3R3RecoveryError("ROUND_003_INPUT_ARTIFACT_HASH_MISMATCH", "Round-001 evidence SHA-256 mismatch.");
    }
    const round001Evidence = parseM3R3Round001EvidenceBytes(round001EvidenceBytes);
    const parity = validateM3R3ControlParity({ controlReport: verified.controlReport, round001Evidence });
    console.log(JSON.stringify({
      artifactReuseStatus: verified.artifactReuseStatus,
      controlValidationStatus: "PASS",
      controlParityStatus: parity.controlParityStatus,
      controlReportSha256: verified.controlReportSha256,
      decisionSnapshotArtifactSha256: verified.decisionSnapshotArtifactSha256,
      round001EvidenceSha256: sha256M3R3RawBytes(round001EvidenceBytes),
      studyServerTime: verified.studyServerTime,
      snapshotCount: verified.snapshotCount,
    }));
  } catch (error) {
    if (error instanceof M3R3RecoveryError) {
      printFailure(error.code);
    } else {
      printFailure("ROUND_003_INPUT_ARTIFACT_VALIDATION_FAILED");
    }
  }
}
