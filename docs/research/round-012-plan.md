# Round-012 frozen plan

- Research round: `baseline-002-research-round-012`
- Accepted base source: `8c38c3eb9a97e9f92654fc4f211c5a8aad96c225`
- Boundary: `2026-08-15T23:59:59.999Z`
- Universe: the existing five baseline-001 symbols and frozen F1–F6 folds
- Data: `RESEARCH_AVAILABLE_SEEN_DATA`, `bt-policy-003`, accepted complete
  Round-006 cache reused after identity validation
- CONTROL: every baseline-001 formal signal, executed exactly once

The two candidates are retention filters over the same CONTROL records. Their
settlement identity is the CONTROL result for each retained signal; candidate
settlement is never rerun. Cohort diagnostics (FIRST, FOLLOWUP_1,
FOLLOWUP_2_PLUS) and their descriptive bins cannot affect selection.

The canonical Gate SHA-256 is
`0fe5c32de12a5b9306d27f794008514bcff910674fa50a3a8bb187ddfa62b8d0`; the
canonical Plan SHA-256 is
`8fd4818a4032fcad52749d97ff0a0580683bf7b32c2fde1a6541410d6db204ef`.
Performance is not authorized in this frozen definition; the execution
source is populated only by the one post-freeze run.
