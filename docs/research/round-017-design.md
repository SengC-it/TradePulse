# Round-017 DESIGN-ONLY — Thesis Lifecycle / Follow-up Edge Study

## Frozen boundary and decision

- `researchRoundId`: `baseline-002-research-round-017`
- accepted source: `0f5e24009f3301b8f2fb64d7e01161402a94f0b7`
- base: `research/round-015-beta-alpha-decomposition`
- seen-data boundary: `2026-08-15T23:59:59.999Z`
- universe: `BTCUSDT`, `ETHUSDT`, `SOLUSDT`, `XRPUSDT`, `BNBUSDT`
- directions: `LONG`, `SHORT`
- strategy version: `baseline-001`
- phase: design-only; performance and selection are not executed

The single active question is:

> Does retaining only the first baseline-001 formal advisory while a same-symbol/same-direction thesis is active improve net economics and signal efficiency while reducing advisory volume?

The falsifiable hypothesis is that same-symbol/same-direction follow-ups inside a predeclared four-hour thesis lifetime add no positive incremental net R after the unchanged `bt-policy-003` costs. The candidate must reduce retained email volume by at least 20% and pass every frozen economic, stability, symbol-breadth, and regime-breadth gate against the all-formal-signal control.

This is a research retention policy, not a Production strategy change. It does not create a new market signal, alter baseline-001, or activate shadow notifications.

## Evidence review: Round-014 through Round-016

The review used the committed RESULTS, SUMMARY, SELECTION, and AUDIT artifacts for each round. No new market data was acquired or inspected.

The exact reviewed artifact paths are frozen in the machine-readable design and must exist in accepted source `0f5e24009f3301b8f2fb64d7e01161402a94f0b7`:

| Round | RESULTS | SUMMARY | SELECTION | AUDIT |
| --- | --- | --- | --- | --- |
| 014 | `docs/M3_R14_ROUND_014_RESULTS.md` | `docs/evidence/M3_R14_ROUND_014_SUMMARY.json` | `docs/evidence/M3_R14_ROUND_014_SELECTION.json` | `docs/evidence/M3_R14_ROUND_014_AUDIT.json` |
| 015 | `docs/M3_R15_ROUND_015_RESULTS.md` | `docs/evidence/M3_R15_ROUND_015_SUMMARY.json` | `docs/evidence/M3_R15_ROUND_015_SELECTION.json` | `docs/evidence/M3_R15_ROUND_015_AUDIT.json` |
| 016 | `docs/M3_R16_ROUND_016_RESULTS.md` | `docs/evidence/M3_R16_ROUND_016_SUMMARY.json` | `docs/evidence/M3_R16_ROUND_016_SELECTION.json` | `docs/evidence/M3_R16_ROUND_016_AUDIT.json` |

### Round-014

Round-014 was an exact replay of the Round-013 forward-edge study and ended with `NO ROBUST FORWARD EDGE — ROUND-014`; its replay was marked `INVALIDATED / PERFORMANCE_ABORT_AFTER_LOCK`. All tested horizons were economically negative: 4h mean net ATR `-0.10947910401579543` with PF `0.771863416934108`, 8h `-0.14158844414404934` with PF `0.8059089801971371`, 12h `-0.181358849782422` with PF `0.8074144487943189`, and 24h `-0.15101974017324213` with PF `0.8911096823852761`. Cost-stress and latency-stress means were negative as well.

The evidence was complete and the study had broad observations, so the dominant failure is not missing-data insufficiency. It is a forward-edge/model and stability failure amplified by transaction costs; sample breadth was not the primary blocker.

### Round-015

Round-015 ended with `NO BETA-ALPHA DEVELOPMENT CANDIDATE — ROUND-015`. The combined selected set contained only 488 observations, with sparse validation fold breadth, mean net ATR `-0.13477565587312162`, PF `0.722668437831905`, cumulative net ATR `-65.77052006608335`, and maximum drawdown `-71.99492948598194`. Cost stress was mean `-0.212246707912189` with PF `0.601511731580027`; latency stress was `-0.13390640528283465`. Beta and alpha correlations were positive but small and did not translate into a stable economic candidate.

Round-015 therefore exposed model/edge weakness, fold stability, sample breadth, and cost sensitivity. It also documented a real information-availability boundary: H17 decision-time funding qualification was `DATA_NOT_AVAILABLE` and was correctly excluded rather than reconstructed. That missing-data result is not evidence for a new funding hypothesis.

### Round-016

Round-016 ended with `NO ROBUST MICROSTRUCTURE INFORMATION GAIN — ROUND-016`. Its control beta pooled Pearson was `0.066014505864532`; the microstructure model was `0.04905593789544725`, a delta of `-0.01695856796908475`, and it improved zero of six folds. Control alpha mean timestamp Spearman was `0.02289715516862349`; micro alpha was `0.02122411291386362`, also worse in zero of six folds. The micro top-bottom spread fell from `0.08723622099287304` to `0.07451779734589553`.

R16 data integrity was `COMPLETE` with pooled coverage `0.988437653211309`, but some basis, lookback, and taker windows were unavailable and were excluded, not fabricated. R16 is therefore negative evidence about the tested model utility and also records a bounded micro-data availability risk. Its frozen `round017DesignInput=false` remains unchanged. `OPEN_INTEREST`, `MARK_INDEX_BASIS`, and `TAKER_FLOW_PERSISTENCE` are not Round-017 defaults.

## Attribution and anti-deduplication boundary

Across R14–R16, failures fall into four different categories:

1. Information insufficiency: specifically the H17 historical funding qualification and some R16 microstructure windows. These are fail-closed data boundaries, not invitations to fill or infer data.
2. Model/edge weakness: R14 forward horizons, R15 beta/alpha decomposition, and R16 microstructure models did not produce robust positive economics.
3. Stability and breadth: R15 had sparse selected folds; R16 had no microstructure improvement in any fold; R14 was negative across all tested horizons.
4. Cost: R14 and R15 remained negative under cost stress, making a lower-volume advisory-efficiency question economically relevant.

Round-016 is used only as negative evidence. Round-017 does not tune its thresholds/windows, reweight its fields, or add an economic rescue filter.

## Candidate assessment

Three directions were assessed, with exactly one active:

| ID | Mechanism | Status | Decision reason |
| --- | --- | --- | --- |
| `R17-THESIS-LIFECYCLE-FIRST-ADVISORY` | `THESIS_LIFECYCLE_DEDUPLICATION` | ACTIVE | Uses only the chronological baseline formal event stream and tests incremental value of follow-ups. It is not a horizon sweep, beta/alpha model, or microstructure model. |
| `R17-SESSION-BOUNDARY-RETURN` | `UTC_SESSION_BOUNDARY_STATE` | REJECTED | Calendar/session fragmentation and breadth risk are not justified by the frozen evidence boundary. |
| `R17-DERIVATIVE-MICROSTRUCTURE-REWEIGHT` | `DERIVATIVE_MICROSTRUCTURE_REWEIGHT` | REJECTED | This would reuse R16 fields and tune a negative result. |

No combinations, optimizers, threshold sweeps, or alternative active directions are permitted.

## Frozen active protocol

### Control and candidate

`CONTROL` is `R17-CONTROL-ALL-BASELINE-001-FORMAL`: every complete baseline-001 formal advisory is retained and evaluated through the unchanged signal-settlement path.

`CANDIDATE` is `R17-THESIS-LIFECYCLE-FIRST-ADVISORY`: retain only `FIRST` events. A formal event is a `FOLLOW_UP` when its `(symbol, direction)` key has an active anchor and its event time is before the anchor time plus four hours. A follow-up is suppressed from the retained advisory stream; it does not create a new signal and its future result is never used to classify it.

The state machine is deterministic:

1. Sort formal events by `signalTime`, then symbol, then `LONG` before `SHORT`, then `signalId`.
2. The state key is `(symbol, direction)`.
3. If no anchor exists, or the four-hour lifetime has expired, classify `FIRST`, create/replace the anchor, and retain the event.
4. An observed opposite-direction formal event for the same symbol closes both direction anchors before the current event is classified.
5. If an anchor remains active, classify `FOLLOW_UP` and suppress the event.

All fields used here are available at event time. No candle after the decision, settlement result, production observation, post-boundary row, or future outcome may enter classification.

### Data, folds, and economics

- The only feature family is `FORMAL_SIGNAL_EVENT_SEQUENCE_STATE`; R16 microstructure fields are excluded.
- Labels use the unchanged baseline-001 entry/stop/TP/direction and `bt-policy-003` four-hour settlement/economics after the event.
- The five-symbol universe, LONG/SHORT scope, six chronological folds (`F1`–`F6`), 24-hour purge, and 24-hour embargo are frozen. Fold identity is mechanically bound to `0f5e24009f3301b8f2fb64d7e01161402a94f0b7` `src/lib/research/folds.ts#RESEARCH_FOLDS` (source SHA-256 `f9017ab7b9326353535366465861f4ccd4e276ffd6fb49e61afed75e44e62b2`), inherited by `src/lib/research/m3-r13-round-013-protocol.ts#R13_FOLDS` and `src/lib/research/m3-r15-round-015-protocol.ts#R15_FOLD_IDS`. Future R17 code may not redefine fold boundaries.
- Regime identity is mechanically bound to `0f5e24009f3301b8f2fb64d7e01161402a94f0b7` `src/lib/strategy/regimes.ts#calculateBTCRegime` (source SHA-256 `6d5b17c7035c39f65b64cdc70153e0d9f576f587aa20d9f9c31199c5a655709e`). `BTC_STRONG_BULL` requires the frozen close/EMA ordering and normalized thresholds `1`, `0.5`, `0.1`; `BTC_STRONG_BEAR` uses the corresponding mirrored rules; all other valid inputs are `BTC_NEUTRAL`, while invalid/nonpositive-ATR inputs return null. Threshold adjustment after freeze is forbidden.
- Data may come only from identity-matched accepted historical cache/public archive inputs. If required bounded inputs are incomplete, the result is `DATA_NOT_AVAILABLE`; no substitution or reconstruction is allowed.
- Every candidate metric is reported next to CONTROL on identical labels, folds, fees, slippage, funding, and settlement. A separate fixed +25% fee/slippage stress is required.
- Candidate breadth requires at least 500 aggregate observations, 50 per fold, 20 per symbol, and 50 in each of `BTC_STRONG_BULL`, `BTC_NEUTRAL`, and `BTC_STRONG_BEAR`.

### Metric identity and follow-up audit

- `meanNetR` is `sum(settled netR) / retainedAdvisoryCount` for either CONTROL or CANDIDATE; a zero denominator or incomplete required label is `DATA_NOT_AVAILABLE`.
- `meanNetRPerRetainedAdvisory` is the exact same retained-advisory arithmetic mean and is a reporting alias of `meanNetR`, not independent economic evidence.
- `netRPerEmail` is `sum(settled netR) / modeled deliveredEmailCount`. The design freezes one retained advisory to one delivered email without duplicates, so this is mathematically an alias of `meanNetR` in this study. `G15` reports the comparison but is not an additional hard gate; `G07` is the independent mean-net-R economic gate.
- The report also includes `followUpCount`, `followUpMeanNetR`, and `followUpCumulativeNetR` for events classified and suppressed as `FOLLOW_UP`. These are reporting-only diagnostics and cannot change candidate classification or introduce tunable parameters.

### Frozen hard gates

All gates are frozen in the machine-readable design before any performance result. `G01`–`G14` are hard gates and all must pass:

- complete data/provenance and zero integrity errors;
- zero look-ahead or leakage;
- aggregate candidate count `>= 500`;
- every fold count `>= 50`;
- every symbol count `>= 20`;
- every regime bucket count `>= 50`;
- candidate mean net R minus control mean net R `>= 0.02`;
- candidate PF `>= 1.10`;
- candidate cumulative net R is not below control;
- candidate drawdown is no worse than control by more than 5% of control drawdown magnitude;
- candidate mean net R is at least control in 4/6 folds and has at most one catastrophic fold;
- fixed cost stress has candidate mean net R `>= 0` and PF `>= 1.05`;
- frozen funding stress is no worse than control by more than `0.02` mean net R;
- suppression is at least 20% and candidate volume is below control;
- `G15` net R per email is reported beside control as a non-gating alias metric because of the frozen one-to-one delivery mapping.

There is no “best of several” selection. The candidate is either eligible after all gates or the round produces no admissible candidate.

## Authoritative execution governance (frozen, not executed)

The future ledger contract is frozen in `docs/research/round-017-design.json`:

- one round-global lock for `baseline-002-research-round-017`;
- execution count derived from the ledger, never a hard-coded constant;
- first claim freezes one authoritative execution directory;
- alternate `--execution-directory` values are forbidden;
- only the same execution ID and frozen directory may continue after a crash;
- completed fold checkpoints must match identity and hash and are reused, never recomputed;
- missing/corrupt checkpoints abort fail-closed and may not rebuild from zero;
- a second execution ID remains rejected even if evidence outputs are deleted;
- the final summary marker is published last.

No ledger, performance checkpoint, performance evidence, selection artifact, or Round-017 result was created in this design-only task.

## Status and boundaries

- Round-017 authoritative performance: **NOT EXECUTED**.
- Round-017 selection: **NOT EXECUTED**.
- Round-016: negative evidence only; `round017DesignInput=false` remains frozen.
- Production: unchanged.
- baseline-001: unchanged.
- baseline-002: `NOT_FROZEN`.
- M3-J: `BLOCKED`.
- M4: `NOT_STARTED`.
- automatic trading: `false`.

The exact machine-readable protocol is in [`round-017-design.json`](round-017-design.json). No reserved Round-017 performance or selection output exists.
