import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

export const M3_R8_OUTPUT_PATHS = Object.freeze({
  summary: "docs/evidence/M3_R8_ROUND_008_SUMMARY.json",
  audit: "docs/evidence/M3_R8_ROUND_008_AUDIT.json",
  results: "docs/M3_R8_ROUND_008_RESULTS.md",
  selectionJson: "docs/evidence/M3_R8_ROUND_008_SELECTION.json",
  selectionMarkdown: "docs/evidence/M3_R8_ROUND_008_SELECTION.md",
} as const);

export const M3_R8_OUTPUT_PATH_LIST = Object.freeze(Object.values(M3_R8_OUTPUT_PATHS));

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

export function r8OutputPaths(root = process.cwd()): readonly string[] {
  return M3_R8_OUTPUT_PATH_LIST.map((relative) => path.join(root, relative));
}

export type R8OutputStat = Readonly<{ filePath: string; bytes: number }>;

export function readR8OutputStats(root = process.cwd()): readonly R8OutputStat[] {
  return Object.freeze(r8OutputPaths(root).map((filePath) => {
    if (!existsSync(filePath)) throw new Error(`R8 published output is missing: ${filePath}`);
    return Object.freeze({ filePath, bytes: statSync(filePath).size });
  }));
}

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
    audit: path.join(root, M3_R8_OUTPUT_PATHS.audit),
    results: path.join(root, M3_R8_OUTPUT_PATHS.results),
    selectionMarkdown: path.join(root, M3_R8_OUTPUT_PATHS.selectionMarkdown),
    selectionJson: path.join(root, M3_R8_OUTPUT_PATHS.selectionJson),
    summary: path.join(root, M3_R8_OUTPUT_PATHS.summary),
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
