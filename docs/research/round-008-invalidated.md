# Round-008 invalidation record

Round-008 (`baseline-002-research-round-008`) is not an authoritative result.
Its single performance execution used source
`e4662257e512ea08fa2ded6b2d6a171079d02fb0` and triggered the performance lock.
The execution completed the research and selection work, but the result was
invalidated after the lock because the reporting path used the wrong Selection
Markdown location (`SELECTION_MARKDOWN_PATH_MISMATCH`). The publication-only
recovery fixed that path without changing result-affecting logic; the recovered
publication head was `532d3f544edeb61f133d55008fc4354a850e24c6`.

Round-009 is a new spec-conformance replay. It does not tune from Round-008
outcomes and does not copy or rewrite Round-008 evidence. The R9 replay uses
the seen-data boundary `2026-08-15T23:59:59.999Z`, preserves the public-data
and closed-candle constraints, and records its structural differences in the
machine-readable conformance file.

Round-008 remains `INVALIDATED_NON_AUTHORITATIVE`; no Round-008 performance,
selection, evidence, or Binance rerun is performed by this record.
