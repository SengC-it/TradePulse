# Round-020 liquidation data acquisition preflight

- Final decision: **ROUND-020 DATA ACQUISITION INELIGIBLE**
- Source: `TARDIS_BINANCE_USDT_FUTURES_LIQUIDATIONS`
- Representations evaluated independently: normalized CSV and raw Binance forceOrder replay
- Metadata evidence items: 5
- Replayable metadata probe executed: false
- Market-event body requests: 0
- Market-event bytes downloaded: 0
- Raw market events read: false
- Preflight parent commit: `bff63214c9a31c516816d8756e560475a86e1746`
- Preflight execution commit: `a0fca0f86a53fbe989eed653aa31bdb25356134d`

## Coverage semantics

**P02_ADVERTISED_TARGET_COVERAGE** uses only exchange metadata advertised coverage. The exact daily-file matrix was not probed and is not asserted.

## Mandatory gates

- P01_ACCEPTED_SOURCE_DESIGN_INTEGRITY: **PASS** — Accepted research/design identity and design-only governance must remain exact.
- P02_ADVERTISED_TARGET_COVERAGE: **PASS** — ADVERTISED_TARGET_COVERAGE: exchange metadata advertises all five symbols and the frozen period; exact daily-file existence is not asserted.
- P03_POINT_IN_TIME_TIMESTAMP_PROVENANCE: **FAIL** — At least one independently evaluated representation must prove event/publication timestamp semantics and replay leakage exclusion.
- P04_EXACT_EVENT_IDENTITY: **FAIL** — At least one independently evaluated representation must prove immutable event identity or source sequence; no weaker fallback is allowed.
- P05_COMPLETENESS_SNAPSHOT_GAP_SEMANTICS: **FAIL** — At least one independently evaluated representation must preserve sampled-stream semantics and prove gap/disconnect handling.
- P06_SIDE_QUANTITY_SCHEMA_CONTRACT: **FAIL** — At least one independently evaluated representation must prove liquidation side, execution side, price, quantity, and mapping semantics.
- P07_REVISION_ARCHIVE_LICENSE_REPRODUCIBILITY_ENTITLEMENT: **FAIL** — At least one independently evaluated representation must prove revision/checksum/reproducibility policy and entitlement.

## Representation results

- TARDIS_NORMALIZED_LIQUIDATIONS_CSV: fullyQualified=false; pit=false; identity=false; gap=false; sideSchema=false; revision=false; entitlement=false
- TARDIS_RAW_BINANCE_FORCE_ORDER_REPLAY: fullyQualified=false; pit=false; identity=false; gap=false; sideSchema=false; revision=false; entitlement=false

- Qualifying representations: none
- Selection status: NO_QUALIFYING_REPRESENTATION
- Recommended representation: null

## Fail-closed conclusions

The current metadata evidence does not qualify either representation. UNKNOWN or FAIL is ineligible; no event payload was read. A future preflight must evaluate each representation independently and may recommend only one uniquely qualifying representation; two qualifying representations without a frozen tie-break remain fail-closed.

Production is unchanged. Performance, selection, candidate creation, economic inspection, and new market-data acquisition were not executed.
