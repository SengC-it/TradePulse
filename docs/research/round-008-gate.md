# Round-008 Gate

The Gate is inherited byte-for-byte logically from the frozen Round-007
selection record. Its source remains
`src/lib/research/selection-gates-round-007.ts`; the R8 machine record stores
the inherited Gate SHA and requires zero result-affecting specification drift.

No threshold sweep, optimizer, post-result candidate replacement, or use of
Round-007 outcome values is allowed. Gate failures make candidates ineligible;
they do not change the structural evidence status.
