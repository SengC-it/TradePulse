# Round-021 positioning crowding hypothesis design

Phase: **HYPOTHESIS_DESIGN_ONLY**
Final decision: **ROUND-021 POSITIONING CROWDING HYPOTHESIS DESIGN ACCEPTED**

## Accepted source and boundary

The only accepted research source is commit `3b12136faf9219070609174ca4af226c07f15a9e` on `research/round-015-beta-alpha-decomposition`.

Round-020 remains closed negative evidence. Its accepted artifact is `docs/research/round-020-liquidation-data-preflight.json`, with final decision `ROUND-020 DATA ACQUISITION INELIGIBLE` and `recommendedRepresentation=null`. Liquidation data is not reopened.

The target is Binance USD-M perpetuals for exactly BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, and BNBUSDT from `2023-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`. No date shortening or symbol removal is permitted.

## One mechanism family and one hypothesis

The sole active family is `POSITIONING_CROWDING_STATE`.

The sole hypothesis is `R21-TOP-TRADER-POSITION-CONCENTRATION-UNWIND`:

> If top-trader position size is more one-sided than top-trader account participation, and that account participation is more one-sided than the global account population, the participant state may represent crowding that later produces contrarian unwind pressure.

This is **CONTRARIAN CROWD-UNWIND**, never continuation. A future result cannot flip the frozen thesis.

This mechanism is structurally independent from R13-R20: it describes participant position-size distribution and account-population ordering. It does not describe aggregate open interest, funding/carry, aggressor flow, price return or momentum, volatility/range, volume, symbol-relative movement, lifecycle deduplication, component consensus, or forced liquidation execution.

## Exact zero-tuned predicate

Only these three primitives are allowed:

- `topTraderAccountLongShortRatio`
- `topTraderPositionLongShortRatio`
- `globalAccountLongShortRatio`

Every ratio must be finite and greater than zero. After the permitted log transform:

```text
A = ln(topTraderAccountLongShortRatio)
P = ln(topTraderPositionLongShortRatio)
G = ln(globalAccountLongShortRatio)
```

Long crowd:

```text
P > 0 && P > A && A > G
```

The advisory direction is `SHORT`.

Short crowd:

```text
P < 0 && P < A && A < G
```

The advisory direction is `LONG`.

All other cases are `NO_SIGNAL`. There are no percentiles, z-scores, magnitude thresholds, optimized cutoffs, score weights, top-N rules, symbol-specific thresholds, calendar/session filters, or horizon rescue rules.

## Source and point-in-time contract

The preferred source family is `BINANCE_VISION_USDM_METRICS_ARCHIVE`. The candidate archive metric names are recorded only as documentation candidates:

- `count_toptrader_long_short_ratio`
- `sum_toptrader_long_short_ratio`
- `count_long_short_ratio`

`sourceFieldMappingStatus=REQUIRES_SOURCE_DOCUMENTATION_PROOF`. Field names alone cannot establish which metric is top-trader account ratio, top-trader position ratio, or global account ratio. That proof belongs to the next `DATA_ACQUISITION_DESIGN` stage.

The point-in-time rules are frozen as:

```text
sourceSnapshotTime <= decisionTime
publicationAvailableTime <= decisionTime
```

`publicationProvenanceStatus=REQUIRES_DATA_ACQUISITION_DESIGN_PROOF`. Current download time, current `Last-Modified`, or current file existence cannot be used to infer historical availability. Until publication provenance is proven, the design is fail-closed and performance is unauthorized.

Decision cadence and primary holding horizon remain `NOT_YET_FROZEN_PENDING_SOURCE_CADENCE`; exactly one horizon must be frozen before any forward/economic value is read, and no horizon sweep is allowed.

## Historical mechanism-ledger audit

The R13-R19 novelty audit is bound to the accepted artifact
`docs/research/round-020-space-reset.json` at commit
`3b12136faf9219070609174ca4af226c07f15a9e`. Its authoritative identity field is
`mechanismFamilyLedger[].mechanismFamilyId`; the 33 IDs from that field are copied
into `historicalMechanismLedgerBinding.authoritativePriorMechanismFamilyIds` and
each is covered exactly once by
`priorInformationFamilyExclusion[].authoritativeMechanismFamilyId`. The test reads
the accepted artifact itself and checks the exact set, duplicate count, missing
count, and unknown-ID count. Alias IDs cannot satisfy this audit.

Round-020 is covered separately, without reopening it, by
`docs/research/round-020-liquidation-data-preflight.json` at the same accepted
source commit. Its required identity is
`FORCED_DELEVERAGING_LIQUIDATION_STATE` with final decision
`ROUND-020 DATA ACQUISITION INELIGIBLE` and `recommendedRepresentation=null`.

## Frozen design gates

- **D01 SOURCE_INTEGRITY — PASS:** exact accepted source commit is frozen.
- **D02 NOVEL_FAMILY — PASS:** exact accepted R13-R19 ledger coverage, separate closed R20 coverage, and `POSITIONING_CROWDING_STATE` are required; a self-attested independence flag is not sufficient.
- **D03 ONE_HYPOTHESIS — PASS:** exactly one active hypothesis exists.
- **D04 ZERO_TUNED_STRUCTURE — PASS:** only the P/A/G ordinal/sign predicate is allowed.
- **D05 DATA_CONTRACT — PASS:** exactly three primitives are frozen; mapping remains an explicit proof obligation.
- **D06 PIT_FAIL_CLOSED — PASS:** unproven publication provenance blocks performance.
- **D07 GOVERNANCE — PASS:** design-only operations are the only permitted operations.

## Governance and stopping boundary

This task fetched no new market data, downloaded no market-data payload, executed no preflight, performance, backtest, or selection, and read no forward or economic values. The performance ledger is absent and no ledger claim is allowed. Production is unchanged, `baseline-002=NOT_FROZEN`, `M3-J=BLOCKED`, `M4=NOT_STARTED`, and `automaticTrading=false`.

The only permitted next stage is `DATA_ACQUISITION_DESIGN`. This task stops here and does not enter that stage.
