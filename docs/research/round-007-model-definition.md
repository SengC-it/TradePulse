# Round-007 Model Definition

The model candidates use one deterministic interpretable ridge model per fold, fitted on that fold's research segment only.

- lambda: `10`;
- intercept: not penalized;
- ten fixed features, in machine-record order;
- standardization means and deviations are computed from research rows only;
- validation rows are predicted only; they never update coefficients, standardization, router cells, thresholds, or eligibility;
- no lambda search, optimizer, threshold sweep, or feature selection.

Features are decision-time closed-candle quantities: directional 4h EMA200 distance, 4h EMA50/EMA200 spread, 4h EMA slope, directional 1h EMA20/EMA50 spread, 1h EMA20 three-bar slope, price extension from 1h EMA20, prior-five-candle EMA interaction count, three-bar breakout/reclaim strength, clipped log volume ratio, and directional 12-hour symbol-minus-BTC return.

The production score is not modified. The model is a Round-007 research filter only.
