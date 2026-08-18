# TradePulse Test Plan

Status: M3-G, M3-G.1, M3-G.2, M3-H, and M3-I CLOSED / MERGED;
M3-R2-A and M3-R2-B are CLOSED / MERGED; M3-R2-C is INVALIDATED / STOPPED
with `ROUND_002_INVALIDATION_REQUIRED`; `baseline-002` remains NOT FROZEN;
M3-R2-D is CANCELLED FOR ROUND-002; M3-R3-A is UNDER REVIEW /
PRE-PERFORMANCE; M3-R3-B is NOT STARTED / NOT AUTHORIZED; `baseline-002`
remains NOT FROZEN; M3-J is BLOCKED / NOT STARTED, and M4 is not started.

## Test layers

### Unit tests

- Config constants preserve the approved five-symbol universe, score allocation,
  grade thresholds, and strategy version baseline-001.
- Candle completeness and validation functions reject forming, stale, missing, out-of-order, or malformed candles.
- EMA20/50/200 tests prove standard alpha, SMA seeding for each period,
  recurrence, and forming-candle exclusion.
- RSI14 tests prove Wilder SMA seeding, Wilder smoothing, and the exact
  average-loss/average-gain edge results 100, 0, and 50.
- ATR14 tests prove true-range selection, first high-low TR fallback, SMA
  seeding, Wilder smoothing, and forming-candle exclusion.
- Fail-closed denominator tests prove ATR14_1H = 0 makes a candidate
  ineligible and ATR14_4H = 0 prevents normalized regime or Trend Strength
  values from qualifying.
- Required-indicator validation tests prove missing, undefined, NaN, and
  infinite indicator/reference values make the candidate ineligible and never
  produce an Infinity, NaN, or fallback score.
- Warm-up tests prove insufficient EMA200 history, RSI14 history, or ATR14
  history makes the candidate ineligible without shortening a period,
  changing a seed, extrapolating, or using a fallback indicator.
- Volume denominator tests prove fewer than 20 prior fully closed quoteVolume
  candles and a previous20QuoteVolumeMean of 0 make the candidate ineligible.
- No-epsilon tests prove invalid ATR and volume denominators never use zero,
  epsilon, Infinity, or another substitute.
- Market regime tests have explicit LONG_ONLY, SHORT_ONLY, and NO_TRADE cases,
  including strict directional boundaries.
- BTC regime tests cover BTC_STRONG_BULL, BTC_STRONG_BEAR, BTC_NEUTRAL, and
  the exact directional gating table. BTCUSDT proves that cross-symbol gating
  is not applied to itself.
- Invalid BTCUSDT 4H input tests prove non-BTC candidates are blocked and the
  invalid input is never converted into BTC_NEUTRAL.
- Pullback tests cover EMA20/EMA50 touches, LOW versus HIGH directionality,
  every W_t position from t-1 through t-5, highest applicable depth, and
  recency bonuses.
- Breakout tests cover distance <= 0, the strict 0 to 0.10 interval, and the
  0.10, 0.25, and 0.50 thresholds for both directions.
- RSI candidate tests cover strict edges at 30, 50, and 70.
- Score component tests cover every threshold and prove that the five
  components sum to total_score.
- Entry/stop/TP tests prove the current closed-candle entry reference, exact
  W_t exclusion of the signal candle, stop offsets, inclusive stop_atr
  boundaries 0.8 and 3.0, rejection outside the guard, and fixed 2R TP.
- Grade boundaries cover exact totals 69, 70, 74, 75, 84, 85, and 100.
- Deterministic ranking tests prove total-score descending order followed by
  BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT tie order.
- Strategy Engine boundary tests prove no Binance URL/client, HTTP, database,
  email, or trading dependency and no side effects.
- As-of/look-ahead tests prove every consumed candle has `closeTime <=
  evaluationTime`, future 4H data fails closed before symbol/BTC regime or
  score calculation, and invalid evaluation time never falls back to the wall
  clock.
- Signal fingerprints and notification policy are deterministic.
- Score consistency tests prove the five components sum to `total_score` and that `signals.score` cannot differ from it in the persistence contract.
- Scan idempotency tests prove one stable run key per planned UTC cycle, duplicate-cycle skip behavior, and retry of the same row after failure or lease expiry.
- Email templates contain every required field and the no-trading disclaimer.

### Strategy tests

Every rule in docs/STRATEGY.md must have a fixed candle fixture with the
expected business result. Tests must prove that:

- a valid 4H LONG_ONLY fixture produces LONG eligibility;
- a valid 4H SHORT_ONLY fixture produces SHORT eligibility;
- an incomplete or mixed 4H condition produces NO_TRADE;
- BTC_STRONG_BULL blocks SHORT and permits LONG for non-BTC symbols;
- BTC_STRONG_BEAR blocks LONG and permits SHORT for non-BTC symbols;
- BTC_NEUTRAL permits both directions according to the symbol regime;
- BTCUSDT is not cross-gated by its own BTC regime;
- a forming 1H candle never produces a formal candidate;
- pullback, breakout, RSI, stop guard, and BTC gates are all required;
- the short mirror uses exact high/low, breakout, stop, and RSI intervals;
- strict RSI edges at 30, 50, and 70 are rejected where the candidate rule
  requires an open interval;
- all component thresholds and grade thresholds match the frozen tables;
- equal-score candidates use the fixed research-universe order;
- the engine returns serializable deterministic output without side effects.
- invalid BTC regime input blocks non-BTC candidates and cannot produce a
  BTC_NEUTRAL result;
- invalid ATR, volume, or warm-up input produces NO FORMAL SIGNAL.
- an as-of historical dataset and an equivalent realtime-shaped dataset produce
  the same result, while future candles produce `FUTURE_DATA`.

### Integration tests

- MarketDataProvider adapter maps public exchange responses to normalized candles.
- A normalized closed-candle fixture produces the same Strategy Engine result
  regardless of whether it is supplied by a realtime or backtest adapter.
- Invalid data prevents signal persistence and creates `DATA_ERROR` or `SCAN_FAILED`.
- The Strategy Engine performs no database write, email send, HTTP request, or
  trading action.
- Database migration applies to a disposable development database and RLS policies behave as designed.
- RLS isolation test design below proves an authenticated user without an authorization row cannot read global TradePulse tables, while an enabled authorized user can read them.
- Signal insertion is idempotent for the same version/symbol/direction/candle tuple.
- A duplicate planned scan cycle conflicts on `scan_runs.run_key` and does not create a second run row.
- Notification records transition PENDING → SENT or PENDING → FAILED.
- Forward tracker creates one terminal result and does not mutate the signal snapshot.

### Notification tests

- SMTP configuration rejects missing server-only values.
- Nodemailer is mocked; no CI test sends a real email.
- Timeout, retry limit, and exception capture are tested.
- A/B/C policy and safe mode are tested.
- The template contains required references and disclaimer without trading language.

### Cron security tests

- Missing secret returns 401/403.
- Wrong secret returns 401/403.
- Malformed or non-Bearer header returns 401/403.
- Correct secret permits the handler.
- Repeating the same scheduled hour cannot create a duplicate signal or email.

### M0 database/RLS test design

These cases are intended to run against an explicitly selected disposable Supabase project or local database after the migration is applied. M0 does not apply migrations to a remote project, so these database tests are designed but not executed here.

| Case | Session/role | Expected result |
| --- | --- | --- |
| Anonymous read of each global table | `anon` | Denied by grant and/or RLS |
| Authenticated user absent from `tradepulse_authorized_users` reads `signals`, `signal_scores`, `signal_results`, `notifications`, `scan_runs`, `system_events`, `strategy_versions`, `backtest_runs`, or `backtest_signals` | `authenticated`, `auth.uid() = user_a` | Empty result / denied; no global rows visible |
| Enabled owner reads global tables | `authenticated`, `auth.uid() = owner_id`, matching enabled row | Rows visible |
| Disabled owner reads global tables | `authenticated`, matching row with `enabled = false` | No global rows visible |
| Authorized user reads authorization table | `authenticated` | Only that user's authorization row visible |
| User decision read/write for own row | Authorized `user_a` | Own row allowed |
| User decision read/write for another user's row | Authorized `user_a`, row `user_b` | Denied by `auth.uid()` ownership predicate |
| Non-authorized user decision read/write | Authenticated `user_b` without allowlist row | Denied even when `user_id = user_b` |
| Score total mismatch | Database transaction | Component `CHECK` rejects a non-sum; deferred trigger rejects a mismatch with `signals.score` |
| Signal without score row | Database transaction commit | Deferred trigger rejects the incomplete signal snapshot |
| Duplicate scan claim | Two workers, same `run_key` | One unique row; second worker skips or retries the locked existing row according to lease/status |

The RLS assertions must inspect both table privileges and visible rows. Tests must not use a service-level key to simulate a browser session; service credentials bypass RLS and are server-only.

### Backtest regression tests

- The report records `strategyVersion = baseline-001` and
  `backtestPolicyVersion = bt-policy-001` separately; changing historical
  execution assumptions cannot change the Strategy Engine version.
- M3-B.1 freezes `backtestPolicyVersion = bt-policy-002` as a separate
  compatibility policy. M3-B.2 implements it without changing immutable
  `bt-policy-001`, and no DEV/OOS/COMBINED performance result exists for
  `bt-policy-002`.
- M3-D freezes `backtestPolicyVersion = bt-policy-003` with schema
  `m3-b-report-003` as a separate intrabar settlement policy. It inherits
  `bt-policy-002` except for the explicitly documented 1m resolution rules;
  no formal M3-C rerun is included here.
- DEV uses exactly `2023-01-01T00:00:00.000Z` through
  `2025-12-31T23:59:59.999Z`; OOS uses the locked range
  `2026-01-01T00:00:00.000Z` through `2026-08-15T23:59:59.999Z`.
- At least 205 fully closed 4H and 55 fully closed 1H warm-up candles are
  required before the first evaluation; warm-up rows never enter statistics.
- The CLI range helper separately requests 250 historical 1H and 250
  historical 4H candles before each first evaluation; DEV and OOS first
  evaluation fixtures must build a successful exact 250/250 StrategyInput.
- The base funding request ends at the exact frozen period end, includes an
  event at the final hour open plus one millisecond, and the OOS settlement-
  only funding request starts at the next millisecond and reaches the held
  #24 settlement boundary without assuming an 8-hour cadence.
- Binance server time is fetched once per historical study load. A candle
  with `closeTime < serverTime` is accepted; equal or later closeTime is
  `DATA_INCOMPLETE`, including a forming OOS settlement-tail candle. No
  partial High/Low may enter settlement.
- Period membership uses signal/evaluation time only. A DEV signal whose
  required held candle #24 closeTime is inside DEV is allowed; one whose held
  #24 closeTime crosses the DEV end is `PERIOD_END_CENSORED`, remains a formal
  signal, and is not an executed trade. No candle after held #24 is required.
- No OOS candle or OOS funding record settles a DEV signal. An OOS signal near
  the OOS end may use a manifest-marked settlement-only tail containing at
  most 24 held candles: the next-open entry is held #1 and held #24 is last.
  Post-OOS tail rows never generate Strategy Engine evaluations or OOS formal
  signals, and no held #25 exists.
- An incomplete required OOS settlement tail produces `DATA_INCOMPLETE` and
  prevents a complete OOS baseline result.
- The universe fixture contains exactly BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT,
  and BNBUSDT, and rejects private/alternate data sources.
- Historical fixtures reject non-chronological rows, duplicates, gaps,
  malformed/non-finite OHLC, forming or misaligned candles, and missing
  funding; no sort, gap fill, synthetic row, zero funding, or other fallback
  is allowed. The manifest includes provider, ranges, row count, retrieval
  time, checksum fields, and settlement-only tail identification.
- As-of fixtures prove `evaluationTime = C_t.closeTime`, every candle supplied
  to `evaluateStrategy(...)` has `closeTime <= evaluationTime`, and future
  data fails closed with `FUTURE_DATA`.
- Historical indexes are built and cross-symbol 1H timelines are aligned once;
  binary right-most-closed lookup supplies `[index - 249, index]` exactly,
  with no expanding windows or per-hour full-history scans.
- Realtime-shaped and backtest-shaped fixtures call the same Strategy Engine
  and produce equivalent candidate and score output. All evaluations are
  retained, while below-70 evaluations produce no simulated trade.
- Entry fixtures prove `signalTime = C_t.closeTime`,
  `entryTime = nextCandle.openTime`, and that the signal candle close is never
  a fill. They prove adverse 5 bps LONG and SHORT slippage, strict stop/TP
  bracket validation, and `ENTRY_OUTSIDE_BRACKET` without a fabricated fill.
- Settlement fixtures prove TP-only, SL-only, LONG/SHORT stop and TP
  inequalities, that the next-open entry candle is held #1, that exactly 24
  held candles exist, conservative SL-first behavior when both are touched,
  and `TIME_EXIT` at the closeTime of held candle #24.
- Horizon fixtures prove no held #25 exists, DEV censorship is based only on
  held #24 closeTime, and the OOS settlement tail ends no later than held #24
  settlement plus required funding coverage.
- TP/SL exit fixtures use the first qualifying held candle and its closeTime
  only as the deterministic audit `exitTime`; they do not invent an intrabar
  trigger timestamp.
- Fee fixtures apply 5 bps on both entry and exit, and prove slippage is not
  charged a second time. Gross R equals price R and excludes fees/funding.
- Funding fixtures require finite funding rate, valid funding time, and finite
  positive official mark price; missing or invalid mark price is
  `DATA_INCOMPLETE` with no candle-price fallback.
- M3-B.2 compatibility fixtures prove the following before
  `bt-policy-002` implementation is accepted:
  - a valid funding-history `markPrice` is used with provenance
    `FUNDING_RATE_HISTORY`;
  - an empty, missing, `null`, non-finite, or non-positive funding-history
    `markPrice` falls back only to the official 1H
    `/fapi/v1/markPriceKlines` close immediately before the funding event;
  - the greatest eligible pre-event candle is selected and
    `closeTime == fundingTime` is rejected;
  - only future mark-price candles, or no fallback data, produce
    `DATA_INCOMPLETE` and never drop the funding event;
  - ordinary trading candles, spot/index/premium-index prices, interpolation,
    nearest future candles, current mark price, entry price, zero, and third-
    party data are rejected as fallback sources;
  - the existing LONG/SHORT funding PnL signs and event timing are unchanged;
  - direct and fallback provenance are retained on every funding charge;
  - fallback totals, direct/fallback counts, fallback rate, symbol/UTC-year
    breakdowns, and the mark-price manifest are required and deterministic;
  - normalized direct/fallback inputs produce byte-equivalent core reports;
  - no baseline-001 strategy file or threshold changes are present.
- `bt-policy-002` range fixtures require the base mark-price range to begin
  exactly one hour before `fundingRange.startTime` and end at
  `fundingRange.endTime`; the first funding event must be able to use that
  pre-range support candle.
- OOS/COMBINED settlement-tail fixtures require
  `settlementTail.markPriceRange.startTime = settlementTail.startTime`,
  `settlementTail.markPriceRange.endTime = settlementTail.fundingRange.endTime`,
  and `settlementOnly = true`.
- Mark-price integrity fixtures use the same authoritative study server time
  and reject `closeTime >= serverTime`, duplicate candles, 1H gaps, invalid
  timestamps, malformed/non-positive/non-finite OHLC, or invalid OHLC
  relationships. They prove that sorting, gap filling, interpolation, and
  synthetic candles are never used; required invalid/missing data is
  `DATA_INCOMPLETE`.
- Report schema fixtures serialize `bt-policy-001` only as
  `m3-b-report-001` and `bt-policy-002` only as `m3-b-report-002`, with the
  latter containing the funding provenance/fallback audit fields. They reject
  silently extending the legacy schema with incompatible fields.
- Usage-driven manifest fixtures require a fallback-used base charge to have
  a valid `kind = mark-price` manifest from `binance-usdm-public` at
  `/fapi/v1/markPriceKlines`, `timeframe = 1h`, with the exact frozen base
  range, matching symbol, and valid SHA-256. Settlement-tail fallback tests
  additionally require the exact tail range and `settlementOnly = true`.
  Missing, invalid-checksum, wrong-source, wrong-range, or wrong-settlement
  manifests fail closed as `INCOMPLETE`; direct-only `bt-policy-002` and all
  `bt-policy-001` runs do not require an unused mark-price manifest.
- Policy-selection fixtures require an explicit `--policy`: missing policy and
  unknown policy fail closed, `bt-policy-001` selects immutable legacy
  behavior, and explicit `bt-policy-002` selects compatibility behavior. The
  formal M3-C replacement command must include
  `--period COMBINED --policy bt-policy-002`.
- Under `bt-policy-002`, funding fixtures exclude `fundingTime == entryTime`,
  include funding at the TP/SL exit candle open when the entry is earlier, and
  mark funding strictly inside the TP/SL exit candle as
  `SETTLEMENT_AMBIGUOUS`. This legacy behavior remains unchanged.
- TIME_EXIT funding fixtures include events satisfying
  `entryTime < fundingTime <= exitTime`; positive and negative funding both
  use the frozen LONG/SHORT sign convention.
- R fixtures prove canonical signal stop distance, price/fee/funding/net R,
  and no double-counted slippage.
- Metric fixtures cover DEV/OOS/COMBINED evaluations, formal signals,
  executions, `ENTRY_OUTSIDE_BRACKET`, `PERIOD_END_CENSORED`, incomplete and
  ambiguous statuses, exits, gross/net R, win/loss/breakeven rates,
  expectancy, profit factor, medians, averages, extrema, fees, funding,
  symbol/direction/grade/regime/month breakdowns, overlap, top-symbol share,
  and largest-trade share.
- Execution fill fixtures use
  `eligibleExecutionSignals = formalSignals - PERIOD_END_CENSORED`, retain
  `ENTRY_OUTSIDE_BRACKET` in the denominator, and return a null fill rate when
  the denominator is zero.
- Rate fixtures return null rates when there are no executed trades. Profit
  factor fixtures return `null` with `NO_LOSSES` for zero negative R,
  including all-breakeven trades, `NO_TRADES` for zero trades, and `NORMAL`
  otherwise; they never output Infinity or NaN.
- Drawdown fixtures order executed trades by signalTime, fixed symbol order,
  and LONG before SHORT for an exact symbol/time tie; they use an equity-zero
  baseline and label the result `signalSequenceMaxDrawdownR`, never portfolio
  drawdown.
- Overlap fixtures use closed intervals `[entryTime, exitTime]`, count an
  executed trade once if it overlaps any other, report count and rate, and do
  not use pair count as the primary rate.
- Concentration fixtures sum only positive net R per symbol and trade, return
  null with `NO_POSITIVE_R` when the positive total is zero, and do not net
  negative trades against positive symbol contributions.
- Month breakdown fixtures attribute by UTC signalTime calendar month, not
  entry or exit month.
- Acceptance fixtures treat DEV as descriptive only; enforce COMBINED
  executed >=100 and OOS executed >=30, positive net R and expectancy,
  PF >=1.25 combined/PF >=1.10 OOS, and concentration limits separately for
  both COMBINED and OOS. Null concentration metrics and any
  `DATA_INCOMPLETE`/`SETTLEMENT_AMBIGUOUS` in a required run fail acceptance;
  failure is never converted to a pass by tuning.
- Overall acceptance fixtures enforce `INCOMPLETE > INSUFFICIENT_SAMPLE >
  FAIL > PASS`; a COMBINED report requires both COMBINED and OOS acceptance,
  while OOS overall acceptance equals OOS acceptance. The selected-period
  compatibility field must not mask a failed OOS gate.
- Manifest fixtures require base 1H, base 4H, and base funding manifests for
  every approved symbol, plus settlement-only 1H and funding manifests for
  OOS/COMBINED. Provider mismatch, missing coverage, invalid checksum, or
  missing tail boundary produces `INCOMPLETE` and never formal PASS.
- Funding compatibility fixtures cover the base-to-tail support boundary:
  direct-only base funding followed by a first tail fallback uses the final
  fully closed base mark-price candle; missing support data or its base
  manifest is `DATA_INCOMPLETE`/`INCOMPLETE`, while a later fallback uses a
  valid closed tail candle. Unused mark-price manifests remain optional, but a
  provided malformed checksum, provider, or source is rejected.
- Repeated-run fixtures produce byte-equivalent reports from the same
  historical inputs, manifest, versions, and policy assumptions; fixtures
  prove DEV/OOS separation, no OOS tuning, and zero private Binance API usage.

### M3-D.1 intrabar settlement-resolution implementation tests

The following deterministic tests implement the frozen `bt-policy-003`
contract. They do not authorize a formal historical backtest rerun:

1. Funding before `exitMinute.openTime` is included.
2. Funding after `exitMinute.closeTime` is excluded.
3. Funding exactly at `exitMinute.openTime` is included when
   `entryTime < fundingTime`.
4. Negative funding inside the exit minute is included with provenance
   `CONSERVATIVE_SAME_MINUTE`.
5. Positive funding inside the exit minute is excluded with provenance
   `CONSERVATIVE_SAME_MINUTE`.
6. Zero funding inside the exit minute has deterministic zero impact and the
   same provenance.
7. Every considered funding event has a separate audit record containing
   `fundingTime`, theoretical PnL, `included`, resolution, and applicable exit
   minute boundaries.
8. A positive same-minute funding event remains audited with `included=false`
   and no applied `fundingCharge` is required.
9. A negative same-minute funding event remains audited with `included=true`.
10. A 1H candle touching TP and SL freezes SL under `bt-policy-002`; if 1m TP
    occurs before 1m SL, the final exit reason remains SL.
11. A frozen SL with 1m data reproducing only TP produces `DATA_INCOMPLETE`.
12. A frozen TP with no 1m candle reproducing TP produces `DATA_INCOMPLETE`.
13. The opposite 1m bracket cannot redefine or substitute for the frozen 1H
    exit reason.
14. A 1m candle touching both brackets satisfies only the already-frozen
    reason; it does not create a new 1m SL-first decision.
15. An exact 60-row 1m window reconciles with its 1H candle on first open,
    last close, maximum high, and minimum low.
16. Any 1m/1H aggregate mismatch produces `DATA_INCOMPLETE`.
17. Fewer than 60 required minute candles produce `DATA_INCOMPLETE`.
18. A 1m continuity gap produces `DATA_INCOMPLETE`.
19. A duplicate 1m candle produces `DATA_INCOMPLETE`.
20. Malformed, non-finite, non-positive, or invalid-relationship OHLC produces
    `DATA_INCOMPLETE`.
21. A minute with `closeTime >= serverTime` is rejected.
22. A settlement-tail intrabar manifest requires `settlementOnly = true`.
23. A missing required intrabar manifest produces `INCOMPLETE`.
24. `conservativeSameMinuteCount` includes both included and excluded
    same-minute audit events.
25. `intrabarResolvedFundingOrderCount` counts `ONE_MINUTE_RESOLVED` audit
    records, and all intrabar counts reconcile with the audit records.
26. The `bt-policy-002` mark-price fallback rules remain unchanged.
27. Funding economics and LONG/SHORT funding signs remain unchanged.
28. `baseline-001` `StrategyInput` remains unchanged and never receives 1m
    candles.
29. `bt-policy-001` behavior remains unchanged.
30. `bt-policy-002` behavior remains unchanged, including its ambiguous result
    classification.
31. Historical M3-E output remains immutable as `m3-b-report-003`; the current
    `bt-policy-003` runner serializes as `m3-b-report-004` and never mutates
    `m3-b-report-002` or the historical report.
32. A complete `bt-policy-003` study has zero
    `remainingSettlementAmbiguousCount`; any remaining ambiguity keeps the
    formal result `INCOMPLETE`.

Additional M3-D fixtures require usage-driven loading only for ambiguous
`symbol + exitCandle.openTime` hours, exactly 60 1m rows per window, official
`/fapi/v1/klines` provenance, and reconciled intrabar counts by symbol and UTC
year for the historical `m3-b-report-003` output.

### M3-F study clock provenance hardening tests

The M3-F implementation adds deterministic tests proving that:

1. Current `bt-policy-003` reports serialize as `m3-b-report-004` with the
   exact `BacktestData.serverTime` in `studyServerTime`.
2. Missing, non-positive, non-safe-integer, NaN, or infinite study clocks fail
   closed.
3. Identical normalized inputs and identical study clocks serialize byte-for-
   byte identically.
4. Changing only the study clock changes only report provenance bytes; metrics,
   signal results, acceptance, breakdowns, funding audit, and intrabar audit
   remain unchanged.
5. `toBacktestData(study).serverTime` equals `study.serverTime`, and the exact
   same value is passed to intrabar settlement loading without another Binance
   `/fapi/v1/time` request.
6. `bt-policy-001`, `bt-policy-002`, and the committed M3-E
   `m3-b-report-003` evidence remain unchanged.

### M3-G baseline-002 research protocol and M3-G.1 tooling tests

M3-G is documentation-only and executes no historical research. M3-G.1 adds
the pure `src/lib/research/` module and the dedicated
`tests/m3-g1-research-tooling.test.ts` suite. It still uses synthetic fixtures
only; the dedicated suite contains 76 deterministic cases and covers:

1. exact calendar-based fold assignment using the frozen UTC boundaries, with
   no random time shuffle;
2. no future leakage into StrategyInput or fold results;
3. byte-stable baseline-001 control reproducibility;
4. append-only experiment registry records and immutable experiment IDs;
5. deterministic candidate ordering and predeclared parameter values;
6. signal-density, duplicate-window, overlap, and unique-signal-hour metrics;
7. deterministic score-bucket counts, outcomes, and monotonicity diagnostics;
8. gross, fee, funding, net, expectancy, and profit-factor cost metrics;
9. symbol, direction, BTC regime, symbol regime, score bucket, and UTC
   month/year breakdowns;
10. unchanged 5 bps entry/exit slippage, fees, and `bt-policy-003` funding and
    settlement economics;
11. retention of the authoritative `studyServerTime` in research provenance;
12. public market-data-only access, with no private or trading API;
13. absence of baseline-002 production code while the protocol is being tested;
14. seen-data terminology for all data through 2026-08-15 and rejection of an
    `OOS PASS` label for that interval;
15. the forward holdout boundary being recorded only after the final
    baseline-002 freeze commit/time.

These tests must not authorize parameter optimization or alter the immutable
M3-E evidence, baseline-001, or any frozen backtest policy. M3-G.2 now owns the
real round-001 gate values, while baseline-002 remains not frozen.

### M3-G.2 candidate-selection gate-freeze tests

M3-G.2 is a pre-performance specification gate. Its tests may use synthetic
fixtures only and must prove:

1. the record freezes exact values, units, denominators, and comparison rules
   for aggregate improvement, fold improvement, catastrophic folds, net
   expectancy, PF, symbol concentration, single-trade concentration, fee
   burden, redundancy improvement, minimum samples, and complexity/ties;
2. all applicable hard gates are conjunctive, the complete hard-gate identity
   list is SHA-covered, and `complexityTieThreshold` is excluded from
   eligibility;
3. N/A is represented as `NOT_APPLICABLE`, is excluded from the conjunction,
   and is not counted as pass; H1/H4 combinations require redundancy while
   pure H2/H3/H5 remain N/A;
4. aggregate PF status is machine-readable: NORMAL is numeric, NO_LOSSES
   requires all sample gates, NO_TRADES fails, and Infinity is not encoded;
5. the round ID and tooling source SHA are exact and the record is immutable;
6. the fold improvement delta is +0.02 and insufficient-sample folds do not
   count as improved;
7. catastrophic expectancy/PF/NO_TRADES/sample definitions, the explicit
   NO_LOSSES exception, and the zero-fold limit are exact;
8. aggregate validation is exactly the non-overlapping F1-F6 VALIDATION
   concatenation by signalTime, not an average, research-plus-validation, or
   alternate period;
9. all four complexity dimensions have the `NON_NEGATIVE_INTEGER` domain and
   preserve their frozen order;
10. aggregate formal and per-fold executed-trade floors are exact;
11. null concentration or fee burden, NO_TRADES PF, and failed applicable gates
   cannot pass;
12. the round becomes immutable at the first M3-H performance result, every
   listed semantic change invalidates the round, invalidation requires a new
   research round, and prior results remain `SEEN_DATA`;
13. a failed candidate cannot weaken the gates and the no-candidate outcome is
   `NO BASELINE-002 CANDIDATE`;
14. the frozen complexity dimensions and deterministic tie order are exact;
15. canonical serialization is byte-stable and its recomputed SHA-256 matches
   the canonical bytes exactly;
16. the record has no network, history loader, candidate result, optimizer,
   baseline-002 strategy, or M3-H execution path.

The catastrophic definition includes:

```text
noLossesIsCatastrophicSolelyBecausePfNull: false
```

The pure gate application/evaluator is intentionally deferred to the later
M3-I application boundary. Therefore this milestone does not mechanically
evaluate a candidate set or produce a `NO BASELINE-002 CANDIDATE` result; it
only freezes the record and validates its deterministic contract.

The test plan must continue to reject any implementation that executes a
historical research run, changes frozen execution economics, modifies
baseline-001, or introduces baseline-002 production code during M3-G.2.

### M3-H Stage-A and Stage-B evidence tests

M3-H Stage A uses synthetic fixtures only and must prove:

1. the plan contains exactly one `CONTROL_BASELINE_001` plus the 13 authorized
   R1-H1, R2-H4, R3-H2, and R4-H3 identities, with no combinations or H5
   candidate;
2. the plan records the exact selection-gate SHA, score buckets, parameters,
   selector boundaries, complexity tuples, and deterministic candidate order;
3. the plan canonical bytes and SHA-256 are reproducible before any historical
   result exists;
4. cooldown state spans fold boundaries and suppresses `0 < delta <= hours`;
5. top-N ranking uses score, frozen symbol order, and LONG-before-SHORT;
6. the cost proxy uses only finite positive decision-time fields and fails
   invalid input closed, while score threshold equality passes;
7. selectors receive no future outcome fields, and changing synthetic future
   outcomes cannot change selected identities;
8. one frozen CONTROL result set can derive all candidates without Strategy
   Engine, backtest, settlement, or Binance reruns;
9. evidence includes deterministic schema, aggregate F1-F6 concatenation,
   per-fold diagnostics, identity hashes, control hash, and descriptive-only
   `DEFER_TO_M3_I_FROZEN_GATE_APPLICATION` decisions;
10. the capture command requires the exact round and selection-gate SHA, rejects
    a dirty worktree or mismatched source/gate, and verifies m3-b-report-004 /
    bt-policy-003 before writing the single raw CONTROL report.

Stage A.1 additionally proves that the global 5-second/3-attempt market-data
defaults remain unchanged while the M3-H capture-only client uses a 15-second
timeout and three client attempts, keeps the official Binance provider/domain,
uses `getServerTime()` for the study clock, and fails closed after timeout
exhaustion. It also revalidates the frozen plan and selection-gate hashes.

Stage B evidence for round-001 is generated from exactly one `bt-policy-003`
CONTROL report and 13 offline candidate derivations. The evidence must contain
the deterministic report schema, source/plan/gate/control hashes, exactly 14
identities, all required diagnostics, and only the descriptive decision
`DEFER_TO_M3_I_FROZEN_GATE_APPLICATION`. It must not apply M3-I gates, freeze
`baseline-002`, or rerun a candidate backtest.

The M3-H performance command was authorized only after the Stage-A source was
committed, pushed, reviewed, and its CI passed. M3-H is now closed / merged;
M3-I consumes its committed evidence without rerunning performance.

### M3-I mechanical selection tests

M3-I must prove, with offline deterministic fixtures and the committed real
evidence:

1. exact M3-H provenance, selection-gate hash, plan hash, study clock, policy,
   schema, F1-F6 ranges, and exactly 13 candidate identities are required;
2. incomplete, duplicated, non-finite, or mismatched evidence fails closed as
   `INCOMPLETE_EVIDENCE`;
3. all 11 hard gates emit `PASS`, `FAIL`, or `NOT_APPLICABLE` with actual value,
   frozen threshold, applicability, and comparison;
4. H1/H4 redundancy is required, while H2/H3 N/A is excluded from the
   conjunction and never counted as PASS;
5. inclusive boundaries are covered for improvement, improved folds, expectancy,
   PF, fee burden, formal signals, and per-fold executed trades;
6. PF `NORMAL`, `NO_LOSSES`, and `NO_TRADES`, null concentration, catastrophic
   folds, and invalid fee ratios follow the frozen semantics;
7. selection tie-breaks are deterministic across improved folds, expectancy,
   complexity, PF, and experiment ID, and CONTROL can never be selected;
8. the committed real evidence produces exactly `NO BASELINE-002 CANDIDATE`,
   with no candidate labeled eligible and no M3-J implementation decision.

The CLI `npm run research:m3i:select` reads only
`docs/evidence/M3_H_ROUND_001_SUMMARY.json` and the frozen repository
definitions. It performs no network request, historical load, backtest, or
Strategy Engine call.

### M3-R2-A Round-002 protocol-freeze checks

M3-R2-A is documentation-only and generates no historical performance. Its
consistency review must confirm:

1. `researchRoundId` is exactly `baseline-002-research-round-002`;
2. the research universe is exactly 2023-01-01 through
   2026-08-15T23:59:59.999Z and is classified as
   `RESEARCH_AVAILABLE_SEEN_DATA`;
3. Round-001 evidence, gates, experiment plan, candidate results, and the
   `NO BASELINE-002 CANDIDATE` decision remain immutable;
4. the unchanged five-symbol, 1H/4H, indicator, baseline-001, bt-policy-003,
   funding, fee, slippage, 24-held-candle, settlement, R-normalization, and
   F1-F6 contracts are recorded;
5. H6, H7, H8, H9, and H10 use exactly the frozen formulas, including H7's
   ATR-normalized thresholds, H8's t-1/t-2 window, H9's t-20/t-1 volume mean,
   and H10's single 0.10 ATR buffer;
6. the registry contains exactly one baseline-001 CONTROL and exactly the nine
   declared Round-002 candidates, with no result-dependent additions;
7. every candidate is a strict baseline-001 eligibility subset and selector
   inputs contain contemporaneous decision-time features only, never outcome
   or future fields;
8. Round-002 gate values and semantics are required to be canonically
   equivalent to Round-001, with a separate machine gate record merged before
   any performance output;
9. exact chronological F1-F6 folds and the no-run boundary are retained;
10. the frozen sequence is M3-R2-A -> M3-R2-B -> M3-R2-C -> M3-R2-D, and
    zero eligible candidates would produce exactly
    `NO BASELINE-002 CANDIDATE — ROUND-002`;
11. the invalidation rule requires `ROUND_002_INVALIDATION_REQUIRED` after a
    result-affecting defect is found post-performance, rather than patching
    and rerunning the same research round; and
12. no Round-002 source code, selector, runner, CLI, evidence JSON, Binance
    request, historical load, backtest, optimizer, or M3-J/M4 work is present.

The same checks must explicitly prove that:

- every inherited Round-001 gate value, formula, semantic rule, sample floor,
  PF status rule, aggregate-validation construction, fold-improvement and
  catastrophic-fold definition, concentration rule, fee-burden rule, and
  selection tie rule is unchanged;
- `requiredRedundancyImprovement` is `NOT_APPLICABLE` for all nine Round-002
  candidates because none declares H1 or H4, and `NOT_APPLICABLE` is never
  counted as `PASS`;
- the exact five-step tie rule is greater improved folds, expectancy only when
  the difference is greater than 0.01 R, lexicographically smaller complexity
  tuple when the difference is at most 0.01 R, higher PF, then lexical
  `experimentId`;
- M3-R2-B freezes a non-negative-integer complexity tuple for every candidate
  before performance and no tuple can change afterward; and
- no gate-change escape hatch exists: an actual structural incompatibility
  stops the round and requires a new research-round decision rather than an
  in-round gate modification.

The protocol document is `docs/BASELINE_002_RESEARCH_R2.md`. M3-R2-A stops
after documentation verification and CI with M3-I closed/merged,
`baseline-002` not frozen, M3-J blocked/not started, and M4 not started.

### M3-R2-B Round-002 machine gate and pure selector tests

M3-R2-B is pre-performance and uses synthetic fixtures only. The dedicated
file `tests/m3-r2-b-round002.test.ts` contains exactly **97 tests** covering:

- Round-001 gate/plan inheritance, Round-002 identity, exact numeric gates,
  the 13 invalidating categories, canonical gate SHA, and the
  `NOT_APPLICABLE`/never-`PASS` redundancy contract;
- the exact control plus nine-candidate registry, ordering, mechanism IDs,
  single-value parameters, combination inheritance, complexity tuples, plan
  SHA, and `NOT_GENERATED` status;
- decision snapshots from exactly 250 closed 1H and 250 closed 4H candles,
  finite/positive OHLC and continuity, future-data rejection, final-candle
  identity, ATR/indicator/pullback/breakout fail-closed behavior, and the
  current quote volume versus previous-20 `Candle.quoteVolume` mean contract;
- H6-H10 inclusive thresholds, long/short mirrors, exact AND combinations
  C1-C4, strict-subset reference preservation, duplicate identity rejection,
  deterministic time/symbol/direction ordering, and no input mutation; and
- discriminating H7 LONG and SHORT fixtures proving that close distance uses
  EMA200 rather than EMA50, independent equality/just-below boundary tests for
  close distance, EMA spread, and EMA200 slope, and selector behavior sourced
  from the canonical H6-H10 machine specifications; and
- static safety checks proving no Binance request, historical loader,
  backtest/settlement runner, optimizer, evidence generation, `Date.now`,
  randomness, or baseline-002 Strategy Engine implementation is introduced.

The source modules are limited to the Round-002 research namespace and are
exported through `src/lib/research/index.ts`. The suite does not run CONTROL,
the historical loader, the backtest CLI, or any market-data endpoint.

The H7 correction was identified and completed before any Round-002
performance output. It corrects the implementation to the frozen formula and
is not strategy tuning.

### M3-R2-C Round-002 invalidation closure checks

The M3-R2-C invalidation closure is documentation-only. The authoritative
CONTROL completed exactly once on the source-freeze commit and triggered
`FIRST_M3_R2_C_PERFORMANCE_RESULT_GENERATED = TRUE`. Offline derivation then
failed closed after performance was generated. The closure record must retain:

1. the exact source SHA, source-freeze CI result, study server time, CONTROL
   report SHA, decision-snapshot SHA, Round-001 evidence SHA, and snapshot
   count;
2. the exact first range-filter failure
   `BTCUSDT|LONG|1673341199999`, which is before F1's validation range;
3. the independent identity-hash ordering defect: frozen time/symbol/direction
   order is required instead of lexical identity-string sorting;
4. `ROUND_002_INVALIDATION_REQUIRED`, with no patch or rerun of the same round;
5. candidate performance and Round-002 evidence marked NOT GENERATED;
6. captured files marked `INVALIDATED_ROUND_CAPTURE_ARTIFACTS`, with reuse only
   `CONDITIONAL_PENDING_NEW_ROUND_PROTOCOL_AND_SHA_VERIFICATION`;
7. M3-R2-D cancelled for Round-002, `baseline-002` not frozen, M3-J blocked,
   M4 not started, and Round-003 not started/not authorized.

The complete documentation record is `docs/M3_R2_C_INVALIDATION.md`. These
checks do not run Binance, a historical loader, CONTROL, backtest, candidate
derivation, gate application, or any result-affecting code.

### M3-R3-A Round-003 offline recovery tests

M3-R3-A is pre-performance and must use synthetic fixtures plus exact local
artifact bytes only; it must not run Binance, the historical loader, CONTROL,
backtest, settlement/funding, candidate derivation, or gate application. The
dedicated `tests/m3-r3-a-recovery.test.ts` must prove:

1. the new `baseline-002-research-round-003` identity, exact nine unchanged
   candidate IDs, inherited Round-002 gate/plan SHAs, exact F1-F6 folds,
   selector specs, complexity tuple, and pre-performance status;
2. Round-003 gate values and semantic fields are equivalent to Round-002
   apart from round/source provenance, with all nine redundancy gates still
   `NOT_APPLICABLE`;
3. a pre-F1 signal is removed before aggregate diagnostics, while the
   inclusive F1 start and F6 end remain included;
4. the exact invalidating signal timestamp `1673341199999` is excluded from
   aggregate validation;
5. formal identity hashes include all statuses, executed hashes include only
   `EXECUTED`, ordering is signal time ascending then frozen symbol order then
   LONG before SHORT, duplicate identities fail closed, and no lexical
   default sort is used;
6. artifact reuse requires exact raw SHA-256 values and the exact Round-002
   envelope (`studyServerTime = 1787031883099`, `snapshotCount = 7500`,
   source SHA, source gate SHA, source plan SHA, and source round) parsed from
   the same SHA-verified bytes;
7. the CONTROL is parsed from raw bytes and requires schema-004, policy-003,
   baseline-001, COMBINED, 7,500 formal results, 7,495 executed results,
   zero diagnostics, and no incomplete/ambiguous statuses;
8. any artifact, envelope, CONTROL, identity, or parity mismatch fails closed
   with no fallback;
9. the recovery source and `scripts/m3-r3-a-verify-reuse.ts` import no
   market-data, historical-loader, backtest, settlement, network, or
   candidate-execution path.

The expected control SHA is
`5ecfae3258d2ace774965eba12df25b888b04593b32e1b92a2593c41fdad8b33` and the
expected decision-snapshot SHA is
`65a011d813c55f936f89069706730f5de33dfda9f2eba94f0dfb2b914818eec9`.
The machine gate and plan SHAs are recorded in the two Round-003 protocol
documents. These tests do not produce candidate diagnostics or performance
metrics; M3-R3-B remains not authorized.

### M3-B implemented test coverage

M3-B.2 additionally tests explicit policy selection, preservation of invalid
direct funding mark prices, direct-only legacy behavior, official mark-price
Kline fallback and pre-event binary lookup, strict mark-price OHLC/continuity/
server-time validation, exact base and settlement-tail ranges, provenance,
fallback counts and UTC-year/symbol reconciliation, policy-specific report
schemas, mark-price manifests, and exclusion of fallback candles from
`StrategyInput`.

The M3-B implementation adds deterministic tests in
`tests/m3-backtest.test.ts` for the following executable contracts:

- Binance historical Kline pagination advances by the next accepted open time
  and rejects duplicate, gap, malformed, and non-progressing data;
- the formal CLI range helper requests 250/250 history, covers exact period
  and settlement funding boundaries, and the server-time closure guard rejects
  forming candles;
- official funding records require finite rate, valid time, and finite positive
  `markPrice`; no candle-price fallback is accepted;
- every Strategy Engine invocation is built from exactly 250 latest fully
  closed 1H candles and exactly 250 latest fully closed 4H candles for all five
  symbols, with `closeTime <= evaluationTime`;
- the next-open entry is held #1, held #24 is the final held candle, and no
  held #25 exists;
- TIME_EXIT, SL-first same-candle resolution, DEV #24 period censorship,
  bracket rejection, funding inclusion, and funding-order ambiguity;
- deterministic R/fee/funding metrics, no Infinity/NaN serialization,
  positive-only concentration, exact acceptance boundaries, overall
  COMBINED+OOS acceptance, required manifest coverage, and byte-stable reports.

The test transport is mocked. No CI test downloads historical data or calls
Binance.

## M3-A and M3-B execution boundary

M3-A was documentation-only and is closed. M3-B adds only the historical
loader, deterministic backtest adapter, metrics, acceptance evaluator, report
serializer, CLI, and mocked tests described above. It does not add a new
strategy, alter baseline-001, add persistence, API routes, Cron,
notifications, deployment, optimization, or M3-C historical evidence.

## M3-D.1 execution boundary

M3-D is closed as the documentation freeze. M3-D.1 implements only that frozen
`bt-policy-003` contract: usage-driven 1m settlement windows, fail-closed 1m
integrity, deterministic exit-minute selection, conservative same-minute
funding ordering, provenance, manifests, and audit metrics. It does not rerun
M3-C, overwrite the immutable `bt-policy-002` evidence, tune `baseline-001`,
change funding economics, start M4, or add trading/private API capability.

## M2-B execution boundary

M2-A was documentation-only and is closed. M2-B implements the pure indicator,
candidate, score, ranking, and engine tests described above. The implemented
tests use deterministic in-memory Candle fixtures only; they do not call
Binance, Supabase, HTTP, SMTP, or any other external service.

The M2-B suite currently contains 51 passing tests across the existing M0/M1
coverage and the new indicator/Strategy Engine coverage. Realtime-shaped and
backtest-shaped normalized inputs are both evaluated through the same engine
and are asserted to produce deeply equivalent results.

### E2E tests

After the private dashboard exists:

- anonymous user is redirected or rejected;
- authenticated user can view signals and detail;
- authenticated user can create/update only their own manual decision;
- no page includes buy/sell/order/wallet/account-balance controls;
- System view explains scan and notification outcomes.

## M1 market-data tests

M1 adds deterministic tests in `tests/market-data.test.ts` for:

- 1h/4h interval definitions and Binance twelve-field Kline normalization;
- closed-candle filtering using Binance server time, including forming-candle exclusion;
- exact 250-candle history selection and deterministic freshness boundaries;
- numeric, timestamp, OHLC, ordering, duplicate, gap, and insufficient-history failures;
- documented request parameters for `/fapi/v1/klines` and server-time diagnostics, including operation versus final-attempt timing;
- bounded 429/5xx retry, `Retry-After` below/equal/above the maximum, invalid `Retry-After`, ordinary 4xx fail-fast behavior, timeout classification, and HTTP 451 access restriction classification;
- a mocked Binance provider contract for all five symbols and both timeframes;
- partial snapshot behavior when one approved symbol is unavailable.

The M1 tests never call Binance. The manual public smoke test is separate:

```powershell
npm run market:smoke
```

It is allowed to access only Binance public market-data endpoints and requires no credentials.

## M0 executed checks

The M0 repository must pass:

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

M0 unit tests cover fixed configuration, health redaction, cron authorization, score consistency, and scan-run idempotency. Database/RLS, domain, SMTP, and E2E tests are planned or designed for their milestones because the corresponding systems are intentionally not implemented yet.

## Test data and safety

- Use deterministic fixtures and mocked transport.
- Never commit live credentials, real App Passwords, or production database URLs.
- Never use a real recipient in automated tests.
- Production SMTP smoke tests are manual, explicitly approved, and run only after environment review.
