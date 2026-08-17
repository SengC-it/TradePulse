# M3-C bt-policy-002 Formal Historical Run #1

> **M3-C INCOMPLETE**

This document freezes the single formal COMBINED run executed from the authoritative merged main commit. It is signal-level evidence only; it is not a strategy change or a performance optimization.

## Formal identity and execution boundary

- Classification: **M3-C INCOMPLETE**
- Source Git SHA: `b28c9b191ad2acd74f8e74e87f51dc1a3eb9e443`
- strategyVersion: `baseline-001`
- backtestPolicyVersion: `bt-policy-002`
- schemaVersion: `m3-b-report-002`
- period: `COMBINED`
- Formal command: `npm run backtest:run -- --period COMBINED --policy bt-policy-002`
- Formal command execution count: exactly once
- Raw report: `.tmp/backtest/combined-report.json`
- formalReportSha256: `2116e8cf779f6dfdef3710ab264234807f56037dadc3851289c6dadd15ad1754`
- Report status: `INCOMPLETE`
- selectedPeriodAcceptance.status: `INCOMPLETE`
- overallAcceptance.status: `INCOMPLETE`
- OS: Windows NT 10.0.19045.0
- Node.js: v24.12.0
- npm: 11.6.2
- git: 2.53.0.windows.1
- proxyConfigured = true (proxy address and credentials intentionally omitted)

No baseline-001 tuning, bt-policy-002 modification, threshold/date/fee/slippage/funding-rule change, grid search, symbol removal, M4 work, trading, Binance private API, or alternate provider was used.

## Network and time gate

The gate used the same local Node process path and current configured proxy route. Only Binance USDⓈ-M Futures public endpoints were requested.

| Endpoint | HTTP | Latency | Result |
| --- | ---: | ---: | --- |
| /fapi/v1/ping | 200 | 2039 ms | success |
| /fapi/v1/time | 200 | 2843 ms | finite serverTime |
| /fapi/v1/klines?symbol=BTCUSDT&interval=1h&limit=1 | 200 | 615 ms | valid Kline |

- Binance serverTime recorded at the gate: `1786952615344` (2026-08-17T07:43:35.344Z).
- Strict threshold: `2026-08-16T23:59:59.999Z`
- Strict server-time gate: PASS.
- No HTTP 451, timeout, VPN, geographic bypass, private API, or API key was used.

## Preflight

| Check | Result |
| --- | --- |
| npm ci | PASS |
| npm run typecheck | PASS |
| npm run lint | PASS |
| npm test | PASS — 7 files, 95 tests |
| npm run build | PASS |
| git diff --check | PASS |

## Report schema and frozen policy

The report identity is valid for this run: `m3-b-report-002`, `baseline-001`, `bt-policy-002`, and `COMBINED`. The report contains the frozen 250-candle windows, 24 held candles, 5bps slippage, 5bps fee, 2R take-profit reference, and signal-level disclaimer.

The earlier bt-policy-001 attempt terminated before performance report generation because historical funding markPrice data was unavailable (MARK_PRICE_UNAVAILABLE); it produced no performance conclusion and is superseded by this explicitly selected bt-policy-002 run.

## Manifest audit

- Total manifests: 30.
- Required normal coverage: 5 symbols × base 1H, 5 symbols × base 4H, 5 symbols × base funding.
- Required COMBINED settlement coverage: 5 symbols × settlement-only 1H, 5 symbols × settlement-only funding.
- Actual mark-price fallback provenance: 2463 charges, all from the base mark-price segment; no settlement-tail fallback charge occurred.
- Therefore base mark-price manifests are required and present for all five symbols; unused settlement-tail mark-price manifests are absent and not required.

Frozen range cross-checks:

- Base mark-price range: `1668927600000` → `1786838399999`.
- Settlement-tail mark-price range (not used in this run): `1786838400000` → `1786924799999`, settlementOnly=`true`.
- All provided manifests use provider `binance-usdm-public`, the official source for their kind, valid 64-hex SHA-256 strings, approved symbols, and the exact frozen requested range.

| Kind | Symbol | Timeframe | Settlement-only | Requested range (UTC ms) | Actual range (UTC ms) | Rows | SHA-256 |
| --- | --- | --- | ---: | --- | --- | ---: | --- |
| candles | BNBUSDT | 1h | false | 1671631200000 → 1786834800000 | 1671631200000 → 1786838399999 | 32002 | `8a4f47f7cee127e4772dace94274f335fe663ffcedbc9e43df91074caa4bd138` |
| candles | BNBUSDT | 1h | true | 1786838400000 → 1786921200000 | 1786838400000 → 1786924799999 | 24 | `1927a11def54bdfd570e0cef77522aa55729e5e188f0134522674619eb284419` |
| candles | BNBUSDT | 4h | false | 1668931200000 → 1786824000000 | 1668931200000 → 1786838399999 | 8188 | `3b6890ae063e91db5f52e1d1a0ba920d4080c41fea17d260190b1f46661a1365` |
| candles | BTCUSDT | 1h | false | 1671631200000 → 1786834800000 | 1671631200000 → 1786838399999 | 32002 | `d57efa7166b0642610ac0ecc0a73909b60baf2c8a161db2e865a4c38aa4f1b46` |
| candles | BTCUSDT | 1h | true | 1786838400000 → 1786921200000 | 1786838400000 → 1786924799999 | 24 | `3ba44676e659a067828a2e40c6dac6095bc53d9c7250544d1051de16a7553f85` |
| candles | BTCUSDT | 4h | false | 1668931200000 → 1786824000000 | 1668931200000 → 1786838399999 | 8188 | `e755d1f1b5694e03c80830b2ffc7efb87b3ee9d89ccb5905479421b84713603f` |
| candles | ETHUSDT | 1h | false | 1671631200000 → 1786834800000 | 1671631200000 → 1786838399999 | 32002 | `0389e6f7c97c32fb467f845a989c43cce023ba79a3af24f1bb9cd0039791f8ff` |
| candles | ETHUSDT | 1h | true | 1786838400000 → 1786921200000 | 1786838400000 → 1786924799999 | 24 | `71fbf65deb31de466c2313ca296289b3e161a33b1fc419ff68f369b44f0eb2d6` |
| candles | ETHUSDT | 4h | false | 1668931200000 → 1786824000000 | 1668931200000 → 1786838399999 | 8188 | `b33dbfe8317457b3732af8c921568731cda9504bbae9187876da53dc28fd2b10` |
| candles | SOLUSDT | 1h | false | 1671631200000 → 1786834800000 | 1671631200000 → 1786838399999 | 32002 | `d6ff77f069bb87650eb14ec58925dd5cc0e99f9da29e52d598b90451df68d28e` |
| candles | SOLUSDT | 1h | true | 1786838400000 → 1786921200000 | 1786838400000 → 1786924799999 | 24 | `1b80302bdfcda011619c596d13d6cd5f9b00a89acfc415c4c2ab2bbd9412952c` |
| candles | SOLUSDT | 4h | false | 1668931200000 → 1786824000000 | 1668931200000 → 1786838399999 | 8188 | `71c654dc67d3ea94b34680d26570a34360bc9ca12826ce4c992807163f8eaff9` |
| candles | XRPUSDT | 1h | false | 1671631200000 → 1786834800000 | 1671631200000 → 1786838399999 | 32002 | `47ce5b0b1a290e3bc0d1beeb9abf37a69bd1f98555e8802879c06d98204931b9` |
| candles | XRPUSDT | 1h | true | 1786838400000 → 1786921200000 | 1786838400000 → 1786924799999 | 24 | `6d4f7e6b324f576fc2bf5b2ba38fe779a15fdde831af1f20c63e31d2085553f8` |
| candles | XRPUSDT | 4h | false | 1668931200000 → 1786824000000 | 1668931200000 → 1786838399999 | 8188 | `dac830b5055e40dcaaefe25095ee42aaf948ddac7e0d30489eb15de2dcced334` |
| funding | BNBUSDT | funding | false | 1668931200000 → 1786838399999 | 1668931200004 → 1786809600000 | 4094 | `e8dcf61d024f6211e4ac0e8f9025f85038420d348e5969adea4cbd6359440e83` |
| funding | BNBUSDT | funding | true | 1786838400000 → 1786924799999 | 1786838400000 → 1786896000000 | 3 | `3b4e18d89f5c40abd96ce6841e2263bc045eee72ecf24547f3a2949a2375b115` |
| funding | BTCUSDT | funding | false | 1668931200000 → 1786838399999 | 1668931200004 → 1786809600000 | 4094 | `d88c69659fd267ae6fdda72516e67ad70b4ff318a75ccef378c81a2182aac8eb` |
| funding | BTCUSDT | funding | true | 1786838400000 → 1786924799999 | 1786838400000 → 1786896000000 | 3 | `40ae4a551a8dbd38fa757716f1236e3fad035cdb3e6c4e00680d5582bcf79185` |
| funding | ETHUSDT | funding | false | 1668931200000 → 1786838399999 | 1668931200004 → 1786809600000 | 4094 | `3a8fa881bd80f0d09706e2b3dc07870f1c0871b1f0ebd2464b89eef209d86e02` |
| funding | ETHUSDT | funding | true | 1786838400000 → 1786924799999 | 1786838400000 → 1786896000000 | 3 | `76ad966a262034a7c2481d2c1deca150acfbe170978f1b24ec3bfb7ff5cdf8fb` |
| funding | SOLUSDT | funding | false | 1668931200000 → 1786838399999 | 1668931200004 → 1786809600000 | 4094 | `b144e07451b1f82cabe5d636b6b89d6ef4436cc3e6125510826d39c5e21398d2` |
| funding | SOLUSDT | funding | true | 1786838400000 → 1786924799999 | 1786838400000 → 1786896000000 | 3 | `831234aa6c3738b042231696c4c2ae6c09f90df0d22fd45322cef5f15fe70bea` |
| funding | XRPUSDT | funding | false | 1668931200000 → 1786838399999 | 1668931200004 → 1786809600000 | 4094 | `7ad2f6a929bce5ff23ec821dc2fc975ad7c237fb5035fedf1e2c550ac326fc61` |
| funding | XRPUSDT | funding | true | 1786838400000 → 1786924799999 | 1786838400000 → 1786896000000 | 3 | `0390a353ecadb201c85aa65d63b700bb02144a6b67273f8b981fe58f394f40ec` |
| mark-price | BNBUSDT | 1h | false | 1668927600000 → 1786838399999 | 1668927600000 → 1786838399999 | 32753 | `3aa873c3da321e6f3ffe47ff2354d6eb1340f4291c9c2ad56fb60108f12dce67` |
| mark-price | BTCUSDT | 1h | false | 1668927600000 → 1786838399999 | 1668927600000 → 1786838399999 | 32753 | `195cd9072517a2513f56d69b7d171a4da38ad5c4864b6a3a06c3cd549bedae25` |
| mark-price | ETHUSDT | 1h | false | 1668927600000 → 1786838399999 | 1668927600000 → 1786838399999 | 32753 | `394d3f8e6fcf1c5026818421426a922010030e208e7f12e14812a3f2573cc059` |
| mark-price | SOLUSDT | 1h | false | 1668927600000 → 1786838399999 | 1668927600000 → 1786838399999 | 32753 | `f921c39e4fe6086a1d39d9e40949b272b974b6fe505c23c95f766109cfa769df` |
| mark-price | XRPUSDT | 1h | false | 1668927600000 → 1786838399999 | 1668927600000 → 1786838399999 | 32753 | `86f7a50f6ecfd76403663594a4f6a4f94ae629838bc5ed4add9bc70b6d4dee9d` |

## Funding compatibility audit

| Field | Value |
| --- | ---: |
| fundingEventsTotal | 11875 |
| fundingEventsDirectMarkPrice | 9412 |
| fundingEventsFallbackMarkPrice | 2463 |
| fundingFallbackRate | 0.20741052631578946 |
| direct + fallback = total | 11875 = 11875 (true) |

Fallback by symbol:

| Symbol | Fallback charges |
| --- | ---: |
| BTCUSDT | 474 |
| ETHUSDT | 453 |
| SOLUSDT | 492 |
| XRPUSDT | 508 |
| BNBUSDT | 536 |

Fallback by UTC year:

| UTC year | Fallback charges |
| --- | ---: |
| 2023 | 2463 |

Charge-level source audit: direct charges are `FUNDING_RATE_HISTORY`; fallback charges are `MARK_PRICE_KLINE_PRE_EVENT_CLOSE`; every fallback charge has `markPriceManifestSegment = base`; fallback provenance without a segment = 0.

## DEV / OOS / COMBINED metrics

The following values are copied from `metricsByPeriod` in the frozen report.

| Metric | DEV | OOS | COMBINED |
| --- | ---: | ---: | ---: |
| totalEvaluations | 26304 | 5448 | 31752 |
| totalFormalSignals | 6304 | 1196 | 7500 |
| executedTrades | 6115 | 1131 | 7246 |
| executionFillRate | 0.9707890141292269 | 0.9456521739130435 | 0.9667778519012675 |
| tpCount | 1384 | 267 | 1651 |
| slCount | 2938 | 527 | 3465 |
| timeExitCount | 1793 | 337 | 2130 |
| entryOutsideBracket | 0 | 0 | 0 |
| periodEndCensored | 5 | 0 | 5 |
| dataIncomplete | 0 | 0 | 0 |
| settlementAmbiguous | 184 | 65 | 249 |
| grossR | -200.61683884218542 | 45.21328616506125 | -155.403552677124 |
| netR | -663.4843958852147 | -47.848853691052405 | -711.3332495762683 |
| profitFactor | 0.822220144694 | 0.928106580041 | 0.838245443517 |
| profitFactorStatus | NORMAL | NORMAL | NORMAL |
| expectancyR | -0.10850112769995333 | -0.042306678771929625 | -0.0981690932343732 |
| medianR | -0.6928193069133856 | -0.5467807489724378 | -0.6672880435517701 |
| winRate | 0.38430089942763695 | 0.42528735632183906 | 0.3906983163124482 |
| averageWinR | 1.3057751990611957 | 1.284207405013029 | 1.3021107310508933 |
| averageLossR | -0.9912499637925726 | -1.0239271007727977 | -0.9960608673117445 |
| signalSequenceMaxDrawdownR | 688.3337813453887 | 118.17481473252906 | 727.6130135095876 |
| cumulativeFeeR | 442.15231923385676 | 90.69616628052286 | 532.84848551438 |
| cumulativeFundingR | -20.715237809172034 | -2.365973575590694 | -23.08121138476275 |
| overlappingSignalRate | 0.9862632869991823 | 0.9805481874447391 | 0.9853712393044438 |
| topSymbolShareOfPositiveNetR | 0.210134623187 | 0.236014587321 | 0.210549442365 |
| largestSingleTradeShareOfPositiveNetR | 0.000653903268 | 0.003155398133 | 0.000544329659 |

## COMBINED breakdowns

### By symbol

| Key | Formal signals | Executed trades | Net R |
| --- | ---: | ---: | ---: |
| BNBUSDT | 1552 | 1494 | -129.6000108719937 |
| BTCUSDT | 1494 | 1455 | -246.90551857904754 |
| ETHUSDT | 1437 | 1379 | -108.40398786284914 |
| SOLUSDT | 1534 | 1489 | -131.88177873315442 |
| XRPUSDT | 1483 | 1429 | -94.54195352922198 |

### By direction

| Key | Formal signals | Executed trades | Net R |
| --- | ---: | ---: | ---: |
| LONG | 4055 | 3934 | -347.13313012871714 |
| SHORT | 3445 | 3312 | -364.2001194475494 |

### By grade

| Key | Formal signals | Executed trades | Net R |
| --- | ---: | ---: | ---: |
| A | 3360 | 3246 | -427.3694018081303 |
| B | 3487 | 3368 | -257.43836500664474 |
| C | 653 | 632 | -26.52548276149032 |

### By BTC regime

| Key | Formal signals | Executed trades | Net R |
| --- | ---: | ---: | ---: |
| BTC_NEUTRAL | 2935 | 2811 | -299.1390985868722 |
| BTC_STRONG_BEAR | 1802 | 1740 | -133.02485239798366 |
| BTC_STRONG_BULL | 2763 | 2695 | -279.1692985914109 |

### By UTC signal month

| Key | Formal signals | Executed trades | Net R |
| --- | ---: | ---: | ---: |
| 2023-01 | 217 | 194 | -18.843365687225017 |
| 2023-02 | 134 | 123 | -65.31672997663246 |
| 2023-03 | 171 | 165 | 28.01969607019966 |
| 2023-04 | 123 | 104 | 9.647778144932916 |
| 2023-05 | 153 | 148 | -31.739224502711124 |
| 2023-06 | 126 | 124 | -38.18330493248004 |
| 2023-07 | 155 | 155 | -39.56130410508362 |
| 2023-08 | 188 | 188 | -42.46250547158121 |
| 2023-09 | 224 | 224 | -75.67155527958174 |
| 2023-10 | 184 | 183 | -30.279486285119887 |
| 2023-11 | 231 | 231 | 4.033280026669617 |
| 2023-12 | 179 | 179 | 8.972033730133445 |
| 2024-01 | 170 | 159 | -12.808195031811792 |
| 2024-02 | 179 | 178 | -1.4598924463933087 |
| 2024-03 | 257 | 253 | -40.68180179483526 |
| 2024-04 | 154 | 154 | -10.057659682350705 |
| 2024-05 | 149 | 149 | -21.303311661111714 |
| 2024-06 | 164 | 164 | -24.970912031725206 |
| 2024-07 | 142 | 141 | 1.49160233680552 |
| 2024-08 | 116 | 116 | -37.80056957182653 |
| 2024-09 | 187 | 180 | -2.860281597935752 |
| 2024-10 | 135 | 133 | -3.576049271901768 |
| 2024-11 | 228 | 228 | 19.359949584858775 |
| 2024-12 | 205 | 201 | -16.012043966762544 |
| 2025-01 | 157 | 157 | -82.94125081518803 |
| 2025-02 | 155 | 153 | 45.754114842783224 |
| 2025-03 | 184 | 178 | -25.60274254960887 |
| 2025-04 | 150 | 146 | -20.629266631965784 |
| 2025-05 | 218 | 208 | -61.25731485891865 |
| 2025-06 | 167 | 162 | -30.969738168374516 |
| 2025-07 | 224 | 218 | 23.895068586992906 |
| 2025-08 | 171 | 159 | 27.15715239495722 |
| 2025-09 | 151 | 143 | -45.94256318540455 |
| 2025-10 | 152 | 146 | -2.8071183862210893 |
| 2025-11 | 246 | 234 | -54.34176674307218 |
| 2025-12 | 158 | 137 | 6.26488303227659 |
| 2026-01 | 133 | 125 | 0.4948373390185268 |
| 2026-02 | 211 | 189 | 62.720778617652336 |
| 2026-03 | 137 | 123 | -11.573188792891475 |
| 2026-04 | 116 | 114 | -50.85112392078137 |
| 2026-05 | 175 | 174 | 8.51367281468179 |
| 2026-06 | 197 | 183 | 13.546369988063077 |
| 2026-07 | 121 | 118 | -55.48822826561236 |
| 2026-08 | 106 | 105 | -15.21197147118293 |

## Acceptance cross-check

Frozen precedence is `INCOMPLETE > INSUFFICIENT_SAMPLE > FAIL > PASS`. `DEV` is descriptive unless incomplete.

| Gate | DEV | OOS | COMBINED |
| --- | --- | --- | --- |
| DATA_INCOMPLETE count | 0 | 0 | 0 |
| SETTLEMENT_AMBIGUOUS count | 184 | 65 | 249 |
| Sample gate (executed ≥ 100 combined / ≥ 30 OOS) | descriptive | 1131 ≥ 30: true | 7246 ≥ 100: true |
| Positive net R | descriptive | -47.848853691052405 > 0: false | -711.3332495762683 > 0: false |
| Positive expectancy | descriptive | -0.042306678771929625 > 0: false | -0.0981690932343732 > 0: false |
| Minimum PF (OOS ≥ 1.10 / combined ≥ 1.25) | descriptive | 0.928106580041 ≥ 1.10: false | 0.838245443517 ≥ 1.25: false |
| Top-symbol concentration ≤ 0.60 | descriptive | 0.236014587321 ≤ 0.60: true | 0.210549442365 ≤ 0.60: true |
| Largest-trade concentration ≤ 0.20 | descriptive | 0.003155398133 ≤ 0.20: true | 0.000544329659 ≤ 0.20: true |

The decisive incomplete gate is `SETTLEMENT_AMBIGUOUS > 0`: DEV=184, OOS=65, COMBINED=249. The runner therefore correctly reports `M3-C INCOMPLETE` before performance PASS/FAIL can be accepted. The performance gates are also negative for both OOS and COMBINED, but no threshold was changed to soften the result.

## Formal conclusion

**M3-C INCOMPLETE**

This is a signal-level backtest, not a portfolio equity simulation.

THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.

Historical performance does not guarantee future results.

The evidence branch/PR is documentation-only. No runtime or strategy source is changed, and the process stops at M3-C evidence review. M4 is not started.
