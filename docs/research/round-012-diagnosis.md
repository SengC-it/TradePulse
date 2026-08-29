# Round-012 diagnosis

Round-012 tests whether same-symbol/same-direction follow-up advisories
arriving while an earlier thesis remains active add incremental edge or
mostly add human signal load. The study is a historical research exercise;
production observations after `2026-08-15T23:59:59.999Z` are labelled
`SEEN_HYPOTHESIS_GENERATING_DIAGNOSTIC_ONLY` and cannot enter a Gate,
training, or selection.

The source is the exact baseline-001 formal signal stream. Entry, stop, take
profit, score, grade, regime, settlement, fee, slippage, funding, and the
`bt-policy-003` economics remain unchanged. Only retention is varied:

- `R12-D1-FIRST-ONLY` retains `FIRST`.
- `R12-D2-FIRST-PLUS-ONE` retains `FIRST` and `FOLLOWUP_1`.

An active thesis is keyed by `(symbol, direction)` and is anchored by its
first formal signal. The anchor ends at its own TP/SL settlement exit or
canonical NO_ENTRY terminal time; period-end censored anchors remain active
through the boundary. Follow-ups never extend the anchor. Terminal events at
the same timestamp are processed before a new signal, and opposite
directions are independent.

This round does not freeze baseline-002, begin M3-J, or begin M4. TradePulse
remains advisory-only and has no private Binance API or automatic trading.
