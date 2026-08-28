# Round-007 Authoritative Plan

The machine-readable plan is `src/lib/research/m3-r7-round-007-plan.ts`. Round-007 uses the seen-data boundary `2026-08-15T23:59:59.999Z`, six frozen walk-forward folds, the five-symbol public Binance universe, `baseline-001`, and `bt-policy-003`.

The run sequence is:

1. Validate source, clean worktree, frozen plan/gate, accepted cache identity, and absent outputs.
2. Reuse only validated Round-006 coarse pages and declared settlement windows.
3. Freeze the complete dataset and all intrabar dependencies.
4. Trigger the performance lock.
5. Execute CONTROL once, derive all five candidate streams, apply frozen gates, and mechanically select.
6. Publish compact audit, results, selection, and summary artifacts atomically.

No production endpoint, email, Supabase, Cloudflare schedule, private Binance API, or automatic execution path is called.
