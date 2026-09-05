# Round-020 liquidation data acquisition preflight

- Final decision: **ROUND-020 DATA ACQUISITION INELIGIBLE**
- Source: `TARDIS_BINANCE_USDT_FUTURES_LIQUIDATIONS`
- Representations evaluated: normalized CSV and raw Binance forceOrder replay
- Metadata probes: 8
- Market-event body requests: 0
- Market-event bytes downloaded: 0
- Raw market events read: false

## Mandatory gates

- P01_ACCEPTED_SOURCE_DESIGN_INTEGRITY: **PASS** — Accepted research/design identity and design-only governance must remain exact.
- P02_TARGET_COVERAGE: **PASS** — Metadata must cover liquidations for all five symbols and the complete frozen period.
- P03_POINT_IN_TIME_TIMESTAMP_PROVENANCE: **FAIL** — Event and publication/arrival timestamp semantics must both be frozen for normalized and raw representations.
- P04_EXACT_EVENT_IDENTITY: **FAIL** — Every representation must prove immutable event identity or source sequence; empty normalized id cannot be replaced by a weaker identity.
- P05_COMPLETENESS_SNAPSHOT_GAP_SEMANTICS: **FAIL** — Snapshot sampling remains SAMPLED_EVENT_STREAM and disconnect/gap provenance must be proven for both representations.
- P06_SIDE_QUANTITY_SCHEMA_CONTRACT: **FAIL** — Liquidation side, execution side, price, quantity, and forceOrder-to-normalized mapping must be source-documented.
- P07_REVISION_ARCHIVE_LICENSE_REPRODUCIBILITY_ENTITLEMENT: **FAIL** — Revision/checksum/reproducibility policy and access entitlement must be verified before acquisition.

## Fail-closed conclusions

Target availability metadata is present, but immutable event identity, publication-time replay provenance, disconnect/gap evidence, side/quantity mapping, revision reproducibility, and entitlement are not all proven for both allowed representations. UNKNOWN or FAIL is ineligible; no event payload was read.

Production is unchanged. Performance, selection, candidate creation, economic inspection, and new market-data acquisition were not executed.
