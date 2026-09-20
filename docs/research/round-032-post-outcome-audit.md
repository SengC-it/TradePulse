# Round-032 post-outcome audit and full-suite closure

Classification: `POST_OUTCOME_AUDIT_AND_TEST_HYGIENE_ONLY`

Parent under audit: `d17f0643bb04c1e9a7625fe890fd3be5e57e2b89`

## Reprobe boundary

No Round-032 reprobe was run during closure. Network requests during closure: `0`. The frozen result remains `r32ExecutionCount=1` and `formalMappingExecutionCount=1`; no archive download, Node probe, CURL probe, formal mapping request, retry, transport change, or result recalculation occurred.

## Original artifact byte identity

The receipt, result JSON, and result Markdown are unchanged. The recorded canonical repository-byte SHA256 values are identical before and after closure:

| Artifact | SHA256 before | SHA256 after |
| --- | --- | --- |
| `docs/research/round-032-execution-receipt.json` | `5f2df92d1621f79ff5ea65f7cdd91e93c69ae1943c29a10623b09abe5f859e78` | same |
| `docs/research/round-032-binance-metrics-environment-result.json` | `7c8e6cee479b4ebba6e57890975d43428cc8d8cbf638a8f02ac3d52c3b99fcb4` | same |
| `docs/research/round-032-binance-metrics-environment-result.md` | `136a1e15f872632a4be8efd4205bf3fd3cfcfb32163fc858fa2058a936bfae12` | same |

`originalR32ResultChanged=false` and `numericR32ResultChanged=false`.

## Authoritative observed result

- Archive parser repair is authoritative: 5/5 archives had valid transport, checksum, schema, timestamp parser, and zero conflicting duplicates.
- Node preflight failed; CURL preflight succeeded; selected transport was `CURL`.
- Formal mapping made 25 logical requests: 24 successful and 1 failed.
- The only failure was `XRPUSDT/openInterestHist`, `NETWORK`, CURL exit 28, connection timeout.
- Historical classification remains `SOURCE_REPROBE_INCONCLUSIVE_DUE_TO_LIVE_REACHABILITY`.
- Historical next stage from the frozen result remains `LIVE_TRANSPORT_STABILITY_REQUIRED`.
- `historicalClassificationProtocolCompliant=true`.

## Mapping discriminator audit

The frozen implementation selects among `EXACT`, `ARCHIVE_MINUS_5M`, and `ARCHIVE_PLUS_5M` using `MAXIMUM_MATCHED_TIMESTAMP_ROWS`. On a complete daily 5-minute grid, `EXACT` typically matches 288 rows while either offset can match 287 because one boundary observation falls outside the day. Therefore `regularFiveMinuteGridBoundaryBias=true`, `timestampMatchCountAloneCanIdentifySemanticOffset=false`, and `timestampMappingDiscriminatorProtocolRobust=false`.

The successful `TOP_TRADER_ACCOUNT`, `TOP_TRADER_POSITION`, and `GLOBAL_LONG_SHORT` requests all had five successful symbols, full timestamp coverage, and `EXACT` selected by the frozen count-first rule, while numeric agreement remained below the admission threshold. `TAKER_RATIO` had five successful symbols but unresolved timestamp mapping. `OPEN_INTEREST` was incomplete because the XRP request timed out.

`successfulFieldNumericMismatchObserved=true`, but `mappingSemanticIncompatibilityAuthoritative=false`. This audit does not claim semantic incompatibility or require a paid source.

## Full-suite failure audit

The initial run in the R32 worktree showed `9 files / 12 tests` failing while the accepted R31 baseline was PASS. All 12 failures are category A: `CHECKOUT_LINE_ENDING_OR_BYTE_IDENTITY_ENVIRONMENT`. The R32 worktree used a CRLF checkout under `core.autocrlf=true`; the failures were frozen-byte/provenance comparisons. There were no category B missing-object, category C R32-boundary, category D actual R32 behavior, or category E nondeterminism failures.

The exact file/test/category/root-cause/evidence/resolution table is frozen in `round-032-post-outcome-audit.json`. A clean validation worktree with canonical LF checkout and the repository's required historical objects/alternates produced `124 files / 2254 tests PASS`, without changing expected hashes, deleting assertions, skipping tests, or changing R32 logic.

## Governance and next stage

`economicOutcomeFilesRead=false`, `economicEvaluationPerformed=false`, `tradingEconomicMetricsCalculated=false`, `modelFitCount=0`, `candidateCount=0`, `championCount=0`, `selectedAlertCount=0`, `candidateExecutableFrozen=false`, `forwardCandidateExists=false`, `forwardValidationAuthorized=false`, `forwardEconomicValuesRead=false`, `forwardReturnRead=false`, `performanceExecutionCount=0`, `automaticTrading=false`, `humanDecisionRequired=true`, Production unchanged, `emailRestorationAuthorized=false`, `baseline-002=NOT_FROZEN`, `M3-J=BLOCKED`, and `M4=NOT_STARTED`.

Audit recommendation only; not executed:

`LIVE_TRANSPORT_STABILITY_AND_TIMESTAMP_ALIGNMENT_REPROBE_REQUIRED`

The next round must complete `XRPUSDT/openInterestHist`, compare each allowed offset using timestamp coverage and numeric agreement/MAE, and require a unique semantic winner rather than selecting an offset only by matched-row count.
