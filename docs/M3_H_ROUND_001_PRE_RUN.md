# M3-H Round-001 Stage-A Pre-Run Freeze

Status: STAGE A FROZEN; STAGE B COMPLETE; M3-H CLOSED / MERGED

This document records the machine-readable plan committed before any M3-H
performance output. It does not claim a CONTROL or candidate result.

```text
researchRoundId: baseline-002-research-round-001
authoritativeMainSha: 99e8f86207c0bd22facf66d557e2e6f792ba0b6e
selectionGateSha256: 11eb5e11333b11bb3d75f762fa6d9868db33ec378f59ac1a636530a81d0962fd
experimentPlanSha256: 2780b2e2d334b5a0f60e046e19073e09d28492fdf04c45a9e9917e686c1fe73a
planPath: src/lib/research/m3-h-round-001-plan.ts
evidenceSchema: m3-h-round-001-report-001
```

## Frozen execution boundary

- exactly one later `CONTROL_BASELINE_001` study uses `baseline-001`,
  `bt-policy-003`, `COMBINED`, and `m3-b-report-004`;
- exactly 13 predeclared single-mechanism variants are derived offline from
  that one raw CONTROL signal ledger;
- H1 cooldown values are 6h, 12h, and 24h;
- H4 top-N values are 1, 2, and 3;
- H2 cost-proxy thresholds are 0.10, 0.15, 0.20, and 0.25 R;
- H3 score thresholds are 75, 80, and 85, with equality included;
- H5 is diagnostic-only, and combinations are forbidden;
- candidate selectors receive only signal-time decision snapshots;
- inherited entry, stop, TP, fees, slippage, funding, exit, and netR remain
  exactly the CONTROL outcome; no candidate settlement or backtest rerun is
  permitted.

## Stage-A implementation

The Stage-A implementation contains:

- immutable registry and canonical plan serialization;
- outcome-blind decision-time selectors;
- deterministic offline result derivation and F1–F6 validation diagnostics;
- formal/executed identity hashes and CONTROL report hash provenance;
- deterministic compact JSON and Markdown evidence renderers;
- capture/derive CLI contracts with round, gate SHA, source SHA, schema, policy,
  and clean-worktree checks.

No historical market data, Binance request, CONTROL report, candidate
performance, M3-G.2 gate application, baseline-002 freeze, M3-I, M4, private
API, or trading action is part of this pre-run freeze. The subsequent Stage B
execution is recorded in `docs/M3_H_ROUND_001_STAGE_A.md`, the generated
evidence files under `docs/evidence/`, and the separate M3-I selection report.
