import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

export type R8PublicationInput = Readonly<{
  root?: string;
  summary: string;
  audit: string;
  results: string;
  selectionJson: string;
  selectionMarkdown: string;
  rename?: typeof renameSync;
  onStagingDirectory?: (stagingDirectory: string) => void;
}>;

function writeStaged(stagingDirectory: string, target: string, payload: string): void {
  writeFileSync(path.join(stagingDirectory, path.basename(target)), Buffer.from(payload, "utf8"));
}

function publicationFailureWithRollbackErrors(publicationError: unknown, rollbackErrors: readonly unknown[]): Error {
  const primary = publicationError instanceof Error ? publicationError.message : String(publicationError);
  const rollback = rollbackErrors.map(String).join("; ");
  return new Error(`R8 publication failed: ${primary}; rollback failed: ${rollback}`, { cause: publicationError });
}

/** Publishes AUDIT -> RESULTS -> selection markdown -> selection JSON -> SUMMARY. SUMMARY is the commit marker. */
export function publishR8ArtifactsAtomically(input: R8PublicationInput): void {
  const root = input.root ?? process.cwd();
  const targets = Object.freeze({
    audit: path.join(root, "docs", "evidence", "M3_R8_ROUND_008_AUDIT.json"),
    results: path.join(root, "docs", "M3_R8_ROUND_008_RESULTS.md"),
    selectionMarkdown: path.join(root, "docs", "evidence", "M3_R8_ROUND_008_SELECTION.md"),
    selectionJson: path.join(root, "docs", "evidence", "M3_R8_ROUND_008_SELECTION.json"),
    summary: path.join(root, "docs", "evidence", "M3_R8_ROUND_008_SUMMARY.json"),
  });
  const targetList = Object.values(targets);
  if (targetList.some((target) => existsSync(target))) throw new Error("R8 output already exists; refusing overwrite.");

  mkdirSync(path.dirname(targets.audit), { recursive: true });
  const stagingDirectory = mkdtempSync(path.join(path.dirname(targets.audit), ".tradepulse-m3-r8-"));
  input.onStagingDirectory?.(stagingDirectory);
  const publication = [
    [targets.audit, input.audit],
    [targets.results, input.results],
    [targets.selectionMarkdown, input.selectionMarkdown],
    [targets.selectionJson, input.selectionJson],
    [targets.summary, input.summary],
  ] as const;
  const published: string[] = [];
  const renameArtifact = input.rename ?? renameSync;
  try {
    for (const [target, payload] of publication) writeStaged(stagingDirectory, target, payload);
    for (const [target] of publication) {
      if (existsSync(target)) throw new Error(`R8 output appeared during publication: ${target}`);
      renameArtifact(path.join(stagingDirectory, path.basename(target)), target);
      published.push(target);
    }
    rmSync(stagingDirectory, { recursive: true, force: true });
  } catch (publicationError) {
    const rollbackErrors: unknown[] = [];
    for (const target of [...published].reverse()) {
      try { unlinkSync(target); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    try { rmSync(stagingDirectory, { recursive: true, force: true }); } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    if (rollbackErrors.length > 0) throw publicationFailureWithRollbackErrors(publicationError, rollbackErrors);
    throw publicationError;
  }
}
