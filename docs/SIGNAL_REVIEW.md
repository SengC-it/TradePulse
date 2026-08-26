# M6 Daily Signal Review Engine V1

## Frozen boundary

- review_version: daily-review-001
- Schedule: 00:15 Asia/Shanghai daily
- Cloudflare UTC schedule to add later: 15 16 * * *
- This PR does not change Cloudflare.
- Existing 5 * * * * and 10 * * * * jobs continue to call only GET /api/cron/signal-advisory.
- The future 15 16 * * * job must call only POST /api/cron/signal-review.
- All requests use the existing CRON_SECRET Bearer authentication.

Only tp_signal_advisories.delivery_status = SENT enters review. The review
engine has its own tp_advisory_reviews ledger and never joins or mutates the
legacy tp_signal_results / tp_signals result path.

## Deterministic review rules

1. The engine uses Binance USD-M Futures public 1m klines only.
2. A candle is usable only when it is fully closed at the observed server time.
3. tracking_start is the first 1m candle with
   open_time >= ceil(sent_at to the next minute).
4. The entry window is
   tracking_start <= candle.open_time <= signal_valid_until. `signal_valid_until`
   limits only the first entry; once entry is recorded, it does not limit holding
   or TP/SL continuation.
5. Entry occurs when low <= suggested_entry_reference <= high.
6. A LONG resolves to TP when high >= take_profit and to SL when
   low <= stop_loss. A SHORT uses the mirrored conditions.
7. TP is +2R; SL is -1R.
8. If TP and SL occur in the same candle, the result is AMBIGUOUS with
   result_r = null. If the entry candle touches TP or SL, it is also
   AMBIGUOUS; intraminute ordering is never inferred.
9. If no entry occurs by signal_valid_until, the terminal state is NO_ENTRY
   with result_r = null.
10. OPEN remains open across daily runs. A daily run first evaluates the entry
    window, then continues any newly entered or already OPEN review through the
    latest closed 1m candle available at Binance server time. V1 deliberately has
    no TIME_EXIT.
11. Gaps, malformed data, forming candles, unordered candles, duplicate candles,
    or a missing range boundary fail closed. If required market data is unavailable,
    the affected review is not advanced and the run is PARTIAL.

## Storage and idempotency

public.tp_advisory_reviews is keyed by the text advisory signal_id, not the
UUID identity used by tp_signal_results. public.tp_review_runs owns the daily
key daily-review:YYYY-MM-DD where the date is Asia/Shanghai local date. The
database-side lease claim is atomic, so concurrent or retried invocations
cannot process one daily key twice.

Missing review rows for existing SENT advisories are created lazily on the
first daily run. FAILED and PENDING advisories are excluded. Original advisory
rows are not updated.

## API

POST /api/cron/signal-review runs exactly one idempotent review iteration and
returns only a safe operational summary. GET is 405; missing or invalid
authorization is 401; responses are Cache-Control: no-store.

## Dashboard

The Reviews page reads the advisory ledger and the new review ledger
independently. It shows 待首次复盘, 待入场, 观察中, 止盈, 止损, 未入场失效,
and 结果不确定 without inventing values.

Performance uses only TP and SL rows from public.tp_advisory_reviews. Pending
review counts include SENT advisories with no review row yet, plus
WAITING_ENTRY and OPEN rows; TP, SL, NO_ENTRY, and AMBIGUOUS are complete.
It excludes WAITING_ENTRY, OPEN, NO_ENTRY, and AMBIGUOUS from win rate, profit
factor, average R, cumulative R, and drawdown. Resolved rows are ordered by
exit candle time before maximum drawdown is calculated. R remains theoretical
signal performance; it is never converted to USD/USDT and does not claim
actual trading profitability.
