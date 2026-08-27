# Round-008 publication-only recovery

Round-008 (`baseline-002-research-round-008`) completed its single authoritative performance execution from source `e4662257e512ea08fa2ded6b2d6a171079d02fb0` and triggered the performance lock. The original runner exited with code `1` after publication at `POST_SELECTION_REPORTING_STATISTICS` because the reporting path used the wrong Selection Markdown location (`SELECTION_MARKDOWN_PATH_MISMATCH`).

The five generated evidence files were recovered byte-for-byte. Their hashes and sizes are recorded in `round-008-publication-manifest.json`; all are below the normal Git 100 MiB policy and use `git-blob` storage. No evidence was regenerated, reserialized, or edited.

The recovery is limited to one non-result-affecting fix: the publication layer now owns the canonical Round-008 output-path registry, and the post-run statistics reader reuses it. The canonical Selection Markdown path is `docs/evidence/M3_R8_ROUND_008_SELECTION.md`. Missing published output now fails clearly. Offline regression tests cover path identity, successful reporting reads, missing-output failure, destination-local publication, rollback, exact bytes, SUMMARY ordering, overwrite rejection, and the absence of performance/network invocation.

`resultAffectingPostLockDiffCount` is `0`. The publication/evidence commit is `e0b0494d4745f50a99bbdef1404acdec8f3bb9f3`; the manifest records that commit as `publicationHeadSha`. The frozen evidence continues to identify `e4662257e512ea08fa2ded6b2d6a171079d02fb0` as its performance source.

The frozen result is `NO BASELINE-002 CANDIDATE — ROUND-008`, with `eligibleCandidateIds=[]` and `selectedCandidateId=null`. `baseline-002` remains `NOT_FROZEN`, M3-J remains `BLOCKED`, and M4 remains `NOT_STARTED`. No Binance access, performance rerun, selection rerun, or production change occurred during recovery. TradePulse remains advisory-only with automatic trading disabled.
