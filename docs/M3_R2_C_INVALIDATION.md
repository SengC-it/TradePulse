# M3-R2-C Round-002 Invalidation Closure Record

Status: `ROUND_002_INVALIDATION_REQUIRED`

This is a documentation-only closure record for the invalidated
`baseline-002-research-round-002` execution. It does not authorize a rerun,
candidate derivation, gate application, baseline-002 selection, Round-003, or
M4.

## Authoritative execution record

- Repository: `SengC-it/TradePulse`
- Authoritative main base: `ce50fde82fdbed7c27668647915a2ea5b4c16f79`
- Invalidated PR: [#22](https://github.com/SengC-it/TradePulse/pull/22)
- Execution source SHA: `9df170b7f72a95971825e126d4096e1e4f16be5f`
- Source-freeze CI: Run #69 / ID `32103930135` / `SUCCESS`
- Research round: `baseline-002-research-round-002`
- Round-002 gate SHA: `9781635614e1be3703384c3b1d734278628ff156553e195e33842949bc1f10f0`
- Round-002 plan SHA: `82680d0cdbb08c1973eb4b5a4ef4dae81cd064d0cbe17ff85739d2def862d511`
- `studyServerTime`: `1787031883099`
- `FIRST_M3_R2_C_PERFORMANCE_RESULT_GENERATED`: `TRUE`

The authoritative CONTROL returned successfully and produced a validly
captured report with zero CONTROL diagnostics. Its economic result was not a
selection decision:

- CONTROL formal signals: `7500`
- CONTROL executed trades: `7495`
- CONTROL netR: `-737.8825430833317`
- CONTROL expectancyR: `-0.09844997239270603`
- CONTROL profit factor: `0.838943838026`
- CONTROL diagnostics count: `0`

Captured artifacts, retained locally for audit, are invalidated-round
artifacts rather than valid candidate evidence:

- `controlReportSha256`: `5ecfae3258d2ace774965eba12df25b888b04593b32e1b92a2593c41fdad8b33`
- `decisionSnapshotArtifactSha256`: `65a011d813c55f936f89069706730f5de33dfda9f2eba94f0dfb2b914818eec9`
- `round001EvidenceSha256`: `883001ac34470120cdbc754c2f47437bf13b6f13ce6ffb3e4f7795558a6a2fc7`
- Decision snapshot count: `7500`

Candidate performance and `docs/evidence/M3_R2_ROUND_002_SUMMARY.json` were
not generated. `M3-R2-D` was not started.

## Invalidation causes

Both defects were discovered after `runBacktest()` returned, so the
performance lock was already true.

### Root cause A — aggregate range filtering

`M3-R2-C baseVariant()` passed the complete baseline-001 CONTROL record set
directly to `calculateResearchDiagnostics()` together with an aggregate F1-F6
validation range. The diagnostics contract correctly rejects records outside
that inclusive range. The first observed failure was:

```text
BTCUSDT|LONG|1673341199999
2023-01-10T08:59:59.999Z
```

That record precedes the F1 start at
`2024-01-01T00:00:00.000Z`. The established Round-001 contract filters
records first using `startTime <= signalTime && signalTime <= endTime`, then
passes the filtered records and the range to the diagnostics calculator.

### Root cause B — identity hash ordering

`M3-R2-C identityHash()` used lexical `.sort()` ordering after converting
identities to strings. That is not the frozen Round-001 order. The required
order is signal time ascending, then `BTCUSDT`, `ETHUSDT`, `SOLUSDT`,
`XRPUSDT`, `BNBUSDT`, then `LONG`, `SHORT`, followed by serialization and
SHA-256. This could produce a false CONTROL parity drift even if Root Cause A
were corrected.

Both defects affect evidence calculation logic. They are not classified as a
network failure, `DATA_INCOMPLETE`, ordinary retry, strategy tuning, candidate
failure, or a gate result.

## Closure and reuse boundary

The same Round-002 MUST NOT be patched and rerun. PR #22 remains unmerged,
unchanged, and available as audit evidence; its branch must not be deleted.

The captured CONTROL and decision-snapshot files are classified as
`INVALIDATED_ROUND_CAPTURE_ARTIFACTS`:

- They are not valid Round-002 candidate evidence.
- They are not a baseline-002 result.
- They are not eligible for M3-R2-D.
- Reuse is not approved now.

`REUSE_ELIGIBILITY = CONDITIONAL_PENDING_NEW_ROUND_PROTOCOL_AND_SHA_VERIFICATION`.
Any future reuse requires a new predeclared round, exact raw-file SHA
verification, no previously generated candidate outcome, and fail-closed
validation of all reuse conditions.

## Milestone status

- M3-R2-A: `CLOSED`
- M3-R2-B: `CLOSED / MERGED`
- M3-R2-C: `INVALIDATED / STOPPED`
- Round-002: `INVALIDATED`
- M3-R2-D: `CANCELLED FOR ROUND-002`
- `baseline-002`: `NOT FROZEN`
- M3-J: `BLOCKED / NOT STARTED`
- M4: `NOT STARTED`
- Round-003: `NOT STARTED / NOT AUTHORIZED`

This record contains no source, test, package, strategy, backtest, network,
loader, evidence-generation, gate-application, or trading changes.
