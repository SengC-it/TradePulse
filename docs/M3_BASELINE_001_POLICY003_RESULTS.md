# M3-E baseline-001 bt-policy-003 Formal Run #1

**Final classification: M3-E INCOMPLETE**

The formal runner produced a COMBINED report exactly once, but the final JSON does not record the authoritative study `serverTime` field. The preflight server time is not substituted for the study authority. Under the frozen fail-closed evidence rules, this makes the final M3-E evidence incomplete.

The report economic acceptance is `FAIL`; that is recorded as a performance result, but the final historical classification is `INCOMPLETE` because the required study-time audit evidence is absent.

## Identity and run provenance

| Field | Value |
| --- | --- |
| Source Git SHA | `e904d8e47b21f78233266da0f8281fe63d2606ca` |
| Strategy version | `baseline-001` |
| Backtest policy | `bt-policy-003` |
| Schema version | `m3-b-report-003` |
| Period | `COMBINED` |
| Formal command | `npm run backtest:run -- --period COMBINED --policy bt-policy-003` |
| Report path | `.tmp/backtest/combined-report.json` (not committed) |
| formalReportSha256 | `5B809693F9227C76A7D49E44B20CC20BB8119FEF8778C22980D957C49B46834F` |
| OS | Microsoft Windows 10 Professional 10.0.19045 (build 19045) |
| Node.js | `v24.12.0` |
| npm | `11.6.2` |
| Deterministic test count | 8 test files / 119 tests passed |
| Final report status | `FAIL` |
| Final M3-E classification | `M3-E INCOMPLETE` |

## Server-time gate

- Study report `serverTime`: **NOT RECORDED**; the report contains no `serverTime` field.
- Preflight-only Binance server time: `1786970728921` (HTTP 200; not accepted as the study authority).
- Required condition: the same authoritative study server time must govern 1H/4H data, funding, mark-price compatibility, and 1m settlement windows.
- Result: **INCOMPLETE** because the required study-time provenance cannot be verified.

## Network preflight

The current configured Node environment proxy path was used only for public Binance USDⓈ-M endpoints. `/fapi/v1/ping`, `/fapi/v1/time`, BTCUSDT 1h limit=1, and BTCUSDT 1m limit=1 returned HTTP 200 with valid responses. No private API, API key, trading API, VPN, alternate provider, or geographic bypass was used.

## Frozen assumptions

- Entry, exit, TP/SL, funding, fees, slippage, and 24-held-candle economics remain those frozen by the selected policy.
- Slippage: 5 bps per side; fees: 5 bps per side; funding uses the frozen direct/fallback compatibility rules.
- `bt-policy-003` changes settlement-resolution methodology only; `baseline-001` was not tuned.

THIS IS A SIGNAL-LEVEL BACKTEST, NOT A PORTFOLIO EQUITY SIMULATION.

Historical performance does not guarantee future results.

## DEV / OOS / COMBINED metrics

| Metric | DEV | OOS | COMBINED |
| --- | ---: | ---: | ---: |
| totalEvaluations | 26304 | 5448 | 31752 |
| totalFormalSignals | 6304 | 1196 | 7500 |
| executedTrades | 6299 | 1196 | 7495 |
| executionFillRate | 1 | 1 | 1 |
| tpCount | 1441 | 296 | 1737 |
| slCount | 3065 | 563 | 3628 |
| timeExitCount | 1793 | 337 | 2130 |
| entryOutsideBracket | 0 | 0 | 0 |
| periodEndCensored | 5 | 0 | 5 |
| dataIncomplete | 0 | 0 | 0 |
| settlementAmbiguous | 0 | 0 | 0 |
| grossR | -227.3903718145894 | 62.84393795454601 | -164.54643386004352 |
| netR | -703.2018748206831 | -34.68066826264698 | -737.8825430833317 |
| profitFactor | 0.818578233391 | 0.950839776896 | 0.838943838026 |
| profitFactorStatus | NORMAL | NORMAL | NORMAL |
| expectancyR | -0.11163706537873998 | -0.02899721426642724 | -0.09844997239270603 |
| medianR | -0.7530723661787696 | -0.5644243170256965 | -0.7286439440702068 |
| winRate | 0.38212414668995076 | 0.42642140468227424 | 0.3891927951967979 |
| averageWinR | 1.3181800372291135 | 1.3152574713768685 | 1.3176690641113065 |
| averageLossR | -0.9959047339237335 | -1.0283702312898686 | -1.0007695943853259 |
| signalSequenceMaxDrawdownR | 711.8194867954683 | 115.15422379014245 | 748.3537861709915 |
| cumulativeFeeR | 455.8030392043446 | 95.05107850875747 | 550.854117713102 |
| cumulativeFundingR | -20.00846380174844 | -2.473527708435525 | -22.48199151018399 |
| overlappingSignalRate | 0.9872995713605334 | 0.9824414715719063 | 0.9865243495663776 |
| topSymbolShareOfPositiveNetR | 0.208796799382 | 0.236028768527 | 0.209967643778 |
| largestSingleTradeShareOfPositiveNetR | 0.000632410345 | 0.002905717954 | 0.000522043878 |
| concentrationStatus | NORMAL | NORMAL | NORMAL |

### Acceptance gates

| Gate | DEV | OOS | COMBINED |
| --- | --- | --- | --- |
| minimumExecutedTrades | descriptive | true | true |
| positiveNetR | descriptive | false | false |
| positiveExpectancy | descriptive | false | false |
| minimumProfitFactor | descriptive | false | false |
| topSymbolConcentration | descriptive | true | true |
| largestTradeConcentration | descriptive | true | true |

- `overallAcceptance.status`: `FAIL`.
- Combined reasons: Net R is not positive.; Expectancy R is not positive.; Profit factor is below the frozen minimum of 1.25.
- OOS reasons: Net R is not positive.; Expectancy R is not positive.; Profit factor is below the frozen minimum of 1.1.
- Frozen precedence remains `INCOMPLETE > INSUFFICIENT_SAMPLE > FAIL > PASS`; the missing study `serverTime` makes the final M3-E classification `INCOMPLETE`.

## Intrabar settlement audit

| Audit field | Value |
| --- | ---: |
| intrabarSettlementWindowsLoaded | 171 |
| intrabarResolvedFundingOrderCount | 245 |
| conservativeSameMinuteCount | 4 |
| remainingSettlementAmbiguousCount | 0 |
| settlementAmbiguous COMBINED | 0 |
| settlementAmbiguous DEV | 0 |
| settlementAmbiguous OOS | 0 |

### Intrabar breakdowns

| Dimension | Values |
| --- | --- |
| Windows by symbol | `{"BNBUSDT":35,"BTCUSDT":32,"ETHUSDT":41,"SOLUSDT":30,"XRPUSDT":33}` |
| Windows by UTC year | `{"2023":42,"2024":19,"2025":66,"2026":44}` |
| Resolved order by symbol | `{"BNBUSDT":58,"BTCUSDT":39,"ETHUSDT":54,"SOLUSDT":44,"XRPUSDT":50}` |
| Resolved order by UTC year | `{"2023":66,"2024":30,"2025":87,"2026":62}` |
| Conservative same-minute by symbol | `{"BNBUSDT":0,"BTCUSDT":0,"ETHUSDT":4,"SOLUSDT":0,"XRPUSDT":0}` |
| Conservative same-minute by UTC year | `{"2023":1,"2026":3}` |
| Remaining ambiguous by symbol | `{"BNBUSDT":0,"BTCUSDT":0,"ETHUSDT":0,"SOLUSDT":0,"XRPUSDT":0}` |
| Remaining ambiguous by UTC year | `{}` |

## Funding compatibility audit

| Field | Value |
| --- | ---: |
| fundingEventsTotal | 12273 |
| fundingEventsDirectMarkPrice | 9699 |
| fundingEventsFallbackMarkPrice | 2574 |
| fundingFallbackRate | 0.2097286726961623 |
| fundingFallbackBySymbol | `{"BNBUSDT":569,"BTCUSDT":493,"ETHUSDT":485,"SOLUSDT":495,"XRPUSDT":532}` |
| fundingFallbackByUtcYear | `{"2023":2574}` |

The report preserves the frozen order: valid funding-history `markPrice` first; fallback only through official 1H mark-price data using the greatest candle with `closeTime < fundingTime`. Funding-order audits include `ONE_HOUR_UNAMBIGUOUS`, `ONE_MINUTE_RESOLVED`, and `CONSERVATIVE_SAME_MINUTE`; the four conservative same-minute events remain audit-visible and the frozen inclusion/exclusion rules are not changed.

## Breakdown coverage

Each breakdown below is copied from the final report and records `formalSignals`, `executedTrades`, and `netR` for every key.

### byBtcRegime

| Key | Formal signals | Executed trades | Net R |
| --- | ---: | ---: | ---: |
| BTC_NEUTRAL | 2935 | 2930 | -303.9451006182302 |
| BTC_STRONG_BEAR | 1802 | 1802 | -136.5619937516691 |
| BTC_STRONG_BULL | 2763 | 2763 | -297.3754487134309 |

### byDirection

| Key | Formal signals | Executed trades | Net R |
| --- | ---: | ---: | ---: |
| LONG | 4055 | 4055 | -354.31837248912746 |
| SHORT | 3445 | 3440 | -383.56417059420176 |

### byGrade

| Key | Formal signals | Executed trades | Net R |
| --- | ---: | ---: | ---: |
| A | 3360 | 3357 | -431.16375647674914 |
| B | 3487 | 3485 | -280.38832655829106 |
| C | 653 | 653 | -26.33046004828851 |

### bySymbol

| Key | Formal signals | Executed trades | Net R |
| --- | ---: | ---: | ---: |
| BNBUSDT | 1552 | 1552 | -144.67797733686768 |
| BTCUSDT | 1494 | 1494 | -236.2557473062416 |
| ETHUSDT | 1437 | 1437 | -112.7964102851289 |
| SOLUSDT | 1534 | 1533 | -129.08659516210216 |
| XRPUSDT | 1483 | 1479 | -115.06581299298948 |

### byUtcSignalMonth

| Key | Formal signals | Executed trades | Net R |
| --- | ---: | ---: | ---: |
| 2023-01 | 217 | 217 | -27.542009278820995 |
| 2023-02 | 134 | 134 | -60.21745721931815 |
| 2023-03 | 171 | 171 | 36.487993926866885 |
| 2023-04 | 123 | 123 | 0.32291432138363696 |
| 2023-05 | 153 | 153 | -29.136463315082096 |
| 2023-06 | 126 | 126 | -40.72200787118638 |
| 2023-07 | 155 | 155 | -39.56130410508362 |
| 2023-08 | 188 | 188 | -42.46250547158121 |
| 2023-09 | 224 | 224 | -75.67155527958174 |
| 2023-10 | 184 | 184 | -28.40329211159075 |
| 2023-11 | 231 | 231 | 4.033280026669617 |
| 2023-12 | 179 | 179 | 8.972033730133445 |
| 2024-01 | 170 | 170 | -18.84131539705501 |
| 2024-02 | 179 | 179 | -2.811185168509447 |
| 2024-03 | 257 | 257 | -42.126673282233526 |
| 2024-04 | 154 | 154 | -10.057659682350705 |
| 2024-05 | 149 | 149 | -21.303311661111714 |
| 2024-06 | 164 | 164 | -24.970912031725206 |
| 2024-07 | 142 | 142 | 0.4476650306600851 |
| 2024-08 | 116 | 116 | -37.80056957182653 |
| 2024-09 | 187 | 187 | -4.610817675558231 |
| 2024-10 | 135 | 135 | -3.003015939626059 |
| 2024-11 | 228 | 228 | 19.359949584858775 |
| 2024-12 | 205 | 205 | -14.440141478119147 |
| 2025-01 | 157 | 157 | -82.94125081518803 |
| 2025-02 | 155 | 155 | 43.55065534730369 |
| 2025-03 | 184 | 184 | -32.096317162135165 |
| 2025-04 | 150 | 150 | -25.118581641968202 |
| 2025-05 | 218 | 218 | -72.37278326066063 |
| 2025-06 | 167 | 167 | -36.840415896960565 |
| 2025-07 | 224 | 224 | 28.649243730800272 |
| 2025-08 | 171 | 171 | 31.033092752265656 |
| 2025-09 | 151 | 151 | -45.98102349407496 |
| 2025-10 | 152 | 152 | -0.4273938076320516 |
| 2025-11 | 246 | 246 | -52.44037104519113 |
| 2025-12 | 158 | 153 | -4.158369607452627 |
| 2026-01 | 133 | 133 | 11.842996389196902 |
| 2026-02 | 211 | 211 | 64.9577172622757 |
| 2026-03 | 137 | 137 | -26.732103462687082 |
| 2026-04 | 116 | 116 | -50.24432943899546 |
| 2026-05 | 175 | 175 | 7.38817307480553 |
| 2026-06 | 197 | 197 | 30.549588340517236 |
| 2026-07 | 121 | 121 | -58.94915465631405 |
| 2026-08 | 106 | 106 | -13.49355577144578 |

## Manifest audit

The final report contains 201 manifests. The read-only structural audit found zero invalid entries and every manifest has a 64-hex SHA-256 value.

| Kind | Count |
| --- | ---: |
| candles | 15 |
| funding | 10 |
| intrabar-settlement | 171 |
| mark-price | 5 |

The complete manifest inventory below records requested range, row count, settlement provenance, and SHA-256 for every manifest used by the report.

| # | Kind | Symbol | Timeframe | Settlement only | Requested start | Requested end | Rows | SHA-256 |
| ---: | --- | --- | --- | --- | ---: | ---: | ---: | --- |
| 1 | candles | BNBUSDT | 1h | false | 1671631200000 | 1786834800000 | 32002 | `8a4f47f7cee127e4772dace94274f335fe663ffcedbc9e43df91074caa4bd138` |
| 2 | candles | BNBUSDT | 1h | true | 1786838400000 | 1786921200000 | 24 | `1927a11def54bdfd570e0cef77522aa55729e5e188f0134522674619eb284419` |
| 3 | candles | BNBUSDT | 4h | false | 1668931200000 | 1786824000000 | 8188 | `3b6890ae063e91db5f52e1d1a0ba920d4080c41fea17d260190b1f46661a1365` |
| 4 | candles | BTCUSDT | 1h | false | 1671631200000 | 1786834800000 | 32002 | `d57efa7166b0642610ac0ecc0a73909b60baf2c8a161db2e865a4c38aa4f1b46` |
| 5 | candles | BTCUSDT | 1h | true | 1786838400000 | 1786921200000 | 24 | `3ba44676e659a067828a2e40c6dac6095bc53d9c7250544d1051de16a7553f85` |
| 6 | candles | BTCUSDT | 4h | false | 1668931200000 | 1786824000000 | 8188 | `e755d1f1b5694e03c80830b2ffc7efb87b3ee9d89ccb5905479421b84713603f` |
| 7 | candles | ETHUSDT | 1h | false | 1671631200000 | 1786834800000 | 32002 | `0389e6f7c97c32fb467f845a989c43cce023ba79a3af24f1bb9cd0039791f8ff` |
| 8 | candles | ETHUSDT | 1h | true | 1786838400000 | 1786921200000 | 24 | `71fbf65deb31de466c2313ca296289b3e161a33b1fc419ff68f369b44f0eb2d6` |
| 9 | candles | ETHUSDT | 4h | false | 1668931200000 | 1786824000000 | 8188 | `b33dbfe8317457b3732af8c921568731cda9504bbae9187876da53dc28fd2b10` |
| 10 | candles | SOLUSDT | 1h | false | 1671631200000 | 1786834800000 | 32002 | `d6ff77f069bb87650eb14ec58925dd5cc0e99f9da29e52d598b90451df68d28e` |
| 11 | candles | SOLUSDT | 1h | true | 1786838400000 | 1786921200000 | 24 | `1b80302bdfcda011619c596d13d6cd5f9b00a89acfc415c4c2ab2bbd9412952c` |
| 12 | candles | SOLUSDT | 4h | false | 1668931200000 | 1786824000000 | 8188 | `71c654dc67d3ea94b34680d26570a34360bc9ca12826ce4c992807163f8eaff9` |
| 13 | candles | XRPUSDT | 1h | false | 1671631200000 | 1786834800000 | 32002 | `47ce5b0b1a290e3bc0d1beeb9abf37a69bd1f98555e8802879c06d98204931b9` |
| 14 | candles | XRPUSDT | 1h | true | 1786838400000 | 1786921200000 | 24 | `6d4f7e6b324f576fc2bf5b2ba38fe779a15fdde831af1f20c63e31d2085553f8` |
| 15 | candles | XRPUSDT | 4h | false | 1668931200000 | 1786824000000 | 8188 | `dac830b5055e40dcaaefe25095ee42aaf948ddac7e0d30489eb15de2dcced334` |
| 16 | funding | BNBUSDT | N/A | false | 1668931200000 | 1786838399999 | 4094 | `e8dcf61d024f6211e4ac0e8f9025f85038420d348e5969adea4cbd6359440e83` |
| 17 | funding | BNBUSDT | N/A | true | 1786838400000 | 1786924799999 | 3 | `3b4e18d89f5c40abd96ce6841e2263bc045eee72ecf24547f3a2949a2375b115` |
| 18 | funding | BTCUSDT | N/A | false | 1668931200000 | 1786838399999 | 4094 | `d88c69659fd267ae6fdda72516e67ad70b4ff318a75ccef378c81a2182aac8eb` |
| 19 | funding | BTCUSDT | N/A | true | 1786838400000 | 1786924799999 | 3 | `40ae4a551a8dbd38fa757716f1236e3fad035cdb3e6c4e00680d5582bcf79185` |
| 20 | funding | ETHUSDT | N/A | false | 1668931200000 | 1786838399999 | 4094 | `3a8fa881bd80f0d09706e2b3dc07870f1c0871b1f0ebd2464b89eef209d86e02` |
| 21 | funding | ETHUSDT | N/A | true | 1786838400000 | 1786924799999 | 3 | `76ad966a262034a7c2481d2c1deca150acfbe170978f1b24ec3bfb7ff5cdf8fb` |
| 22 | funding | SOLUSDT | N/A | false | 1668931200000 | 1786838399999 | 4094 | `b144e07451b1f82cabe5d636b6b89d6ef4436cc3e6125510826d39c5e21398d2` |
| 23 | funding | SOLUSDT | N/A | true | 1786838400000 | 1786924799999 | 3 | `831234aa6c3738b042231696c4c2ae6c09f90df0d22fd45322cef5f15fe70bea` |
| 24 | funding | XRPUSDT | N/A | false | 1668931200000 | 1786838399999 | 4094 | `7ad2f6a929bce5ff23ec821dc2fc975ad7c237fb5035fedf1e2c550ac326fc61` |
| 25 | funding | XRPUSDT | N/A | true | 1786838400000 | 1786924799999 | 3 | `0390a353ecadb201c85aa65d63b700bb02144a6b67273f8b981fe58f394f40ec` |
| 26 | intrabar-settlement | BNBUSDT | 1m | false | 1673740800000 | 1673744399999 | 60 | `36772f7e2b49b13289b78ceddcb2d53c09cb691d039ee2c76d720d2c2ac20c01` |
| 27 | intrabar-settlement | BNBUSDT | 1m | false | 1673856000000 | 1673859599999 | 60 | `25c409f06ac0a928fb288f9582bb39e0dc6072e00fc90a9cb88a611131fac810` |
| 28 | intrabar-settlement | BNBUSDT | 1m | false | 1674748800000 | 1674752399999 | 60 | `c879705f1e21f12381560dd60fd08288465bc7c951c8d7eb2cf248d44811280f` |
| 29 | intrabar-settlement | BNBUSDT | 1m | false | 1675584000000 | 1675587599999 | 60 | `d9389b65b618d969bff9acc306b0451a4ded5bf2cadee1b1d977bdd623f8fd86` |
| 30 | intrabar-settlement | BNBUSDT | 1m | false | 1676217600000 | 1676221199999 | 60 | `09d75847800d9d78904fa1964a35be2dd1f1230ccbf0ac82d31826354d688002` |
| 31 | intrabar-settlement | BNBUSDT | 1m | false | 1676966400000 | 1676969999999 | 60 | `727fc7a707af4b1f924394db0555e211c62c435c800a4ab5b7e04377cb07dc82` |
| 32 | intrabar-settlement | BNBUSDT | 1m | false | 1679155200000 | 1679158799999 | 60 | `40039377ab8ee7d80f03fbb045c0011d980a0c853924f377c1cc490b919fd9d2` |
| 33 | intrabar-settlement | BNBUSDT | 1m | false | 1682352000000 | 1682355599999 | 60 | `c03b4c32a101cf734bef8b1e1be0aac0e64896d9bf7cbe3ac11710ac216520fe` |
| 34 | intrabar-settlement | BNBUSDT | 1m | false | 1682640000000 | 1682643599999 | 60 | `dd6ad3c3a21cb703ce9c5245dfc9fb72bb36f3d3f846dd16223e9f4f28787fde` |
| 35 | intrabar-settlement | BNBUSDT | 1m | false | 1684713600000 | 1684717199999 | 60 | `f72367978bb4a156d354d1b79aa3c2f6744ebff6ef7ddfc8b825d8010837b50d` |
| 36 | intrabar-settlement | BNBUSDT | 1m | false | 1704758400000 | 1704761999999 | 60 | `c34e813a182c3f6405c8237a8729e438ab16d0a094d6ac31999b960cb2f54897` |
| 37 | intrabar-settlement | BNBUSDT | 1m | false | 1705680000000 | 1705683599999 | 60 | `8221ae8cec55fb1762f7da6b4c71a934e6d924e1d311677ee57f625873823f25` |
| 38 | intrabar-settlement | BNBUSDT | 1m | false | 1707206400000 | 1707209999999 | 60 | `3cd55f4d84663c7c74c62373eab19cd4c04c92c047fac27941631c713a474cff` |
| 39 | intrabar-settlement | BNBUSDT | 1m | false | 1725897600000 | 1725901199999 | 60 | `4510a3e72e6ce1ddff9cc0b588ca5c156d63ae4822af23494efade823e12f63c` |
| 40 | intrabar-settlement | BNBUSDT | 1m | false | 1726761600000 | 1726765199999 | 60 | `480e59f0355c23c5d93aa766817afc525883c42bc80e5de6f93c67782e525cd1` |
| 41 | intrabar-settlement | BNBUSDT | 1m | false | 1730217600000 | 1730221199999 | 60 | `ff0a1198a87c0b2a8ad0aa5e07f24f94842019283e819198cc8479140d4066ef` |
| 42 | intrabar-settlement | BNBUSDT | 1m | false | 1733961600000 | 1733965199999 | 60 | `c6b9c340d8b8aa572b0f0c0fa950e3b6bdc3d8786958263237852b823bd48d38` |
| 43 | intrabar-settlement | BNBUSDT | 1m | false | 1748131200000 | 1748134799999 | 60 | `848f62362bdcb6e5e81185b0590dfdbded6cc82ae959b5cec83958fa58a1fc09` |
| 44 | intrabar-settlement | BNBUSDT | 1m | false | 1752710400000 | 1752713999999 | 60 | `571f6c6a735ca3f3e6ae06b7f157eac919518b1adfadbd8b3d6bd859e311adb2` |
| 45 | intrabar-settlement | BNBUSDT | 1m | false | 1754323200000 | 1754326799999 | 60 | `ac1caaa8a45fcd6e202cffa2efd1eda19228494268354910ed3d69a83ecabe09` |
| 46 | intrabar-settlement | BNBUSDT | 1m | false | 1754812800000 | 1754816399999 | 60 | `0baf02599f28f879d8fd0df49c9aa9445a94ccdbef9ce2e7db37b415e9e0e32a` |
| 47 | intrabar-settlement | BNBUSDT | 1m | false | 1755417600000 | 1755421199999 | 60 | `aa4893c586b10bc44c4d39d608c0e9356e2d7a6f27d3ce6b260f9b30f3f6309e` |
| 48 | intrabar-settlement | BNBUSDT | 1m | false | 1757923200000 | 1757926799999 | 60 | `85562ed87bb4fb2ab5c0a1f17a7be6d04528be8792467750b8ca98d8b84a4620` |
| 49 | intrabar-settlement | BNBUSDT | 1m | false | 1762704000000 | 1762707599999 | 60 | `f0230e7b6a47b36e00a7dd2a6a09c55c4a1aacfe1b73c3562fd13c56b2f63c54` |
| 50 | intrabar-settlement | BNBUSDT | 1m | false | 1763568000000 | 1763571599999 | 60 | `6b9609724d9969c5d53e4ad03cba9beb71f419e99002f40e66aafa96b4fd050d` |
| 51 | intrabar-settlement | BNBUSDT | 1m | false | 1764950400000 | 1764953999999 | 60 | `b71f0b12289a95510bda15675190211cc6ae8f4a1fd7401a9d87f91a3c957a99` |
| 52 | intrabar-settlement | BNBUSDT | 1m | false | 1765382400000 | 1765385999999 | 60 | `ffb8c11c124549c7c107fcce9238c094966e1df65f7bc8ba87b160bf8b004653` |
| 53 | intrabar-settlement | BNBUSDT | 1m | false | 1766304000000 | 1766307599999 | 60 | `0d927a3a7cca1c507b6d025173b97765151e026b63d2ffd8654fa7bd3a73bbf0` |
| 54 | intrabar-settlement | BNBUSDT | 1m | false | 1767081600000 | 1767085199999 | 60 | `def384fdda89b551ada698f1319321d542d22621ff45ef19cb4cc90f10b8cb34` |
| 55 | intrabar-settlement | BNBUSDT | 1m | false | 1770998400000 | 1771001999999 | 60 | `2294ceefde78be7dda6cff8bff6c26d600677385a4409552dd3b4ea46fe8644b` |
| 56 | intrabar-settlement | BNBUSDT | 1m | false | 1771804800000 | 1771808399999 | 60 | `0e98a22ed7b7582e667e7c00bd702dc03461973664597802ab805e7d0c9c7201` |
| 57 | intrabar-settlement | BNBUSDT | 1m | false | 1781164800000 | 1781168399999 | 60 | `24cd3ff4efa9fb39e29af529744897f31df05487cd9ad0a20c5874b36effc4fa` |
| 58 | intrabar-settlement | BNBUSDT | 1m | false | 1782201600000 | 1782205199999 | 60 | `8a0fe958175775cecdc85eeb2c9f5e6d700f107d16a03f5e70c0c3ebf0b0cdf0` |
| 59 | intrabar-settlement | BNBUSDT | 1m | false | 1783238400000 | 1783241999999 | 60 | `8fc31ba6531b109ffaf7706f8e004fc51232550674b1798ee28ad0051a9e9e72` |
| 60 | intrabar-settlement | BNBUSDT | 1m | false | 1785888000000 | 1785891599999 | 60 | `f02899a7bb9541a0d0407b8e4eaf341d54c222cc8f837311575173f3a8f72eb9` |
| 61 | intrabar-settlement | BTCUSDT | 1m | false | 1673856000000 | 1673859599999 | 60 | `aeefddb98677375bbeb050de324c1b2999f0c93a6b8e99613f58100862f802b1` |
| 62 | intrabar-settlement | BTCUSDT | 1m | false | 1676822400000 | 1676825999999 | 60 | `3cf3f2187e3a832e7c5d2c995c3340258057d93417651603e90af10605ccc9df` |
| 63 | intrabar-settlement | BTCUSDT | 1m | false | 1680076800000 | 1680080399999 | 60 | `62307b5ab91fe1de208a8aa047cc4b71b48f7f063f3754a19e162b36c3f0711e` |
| 64 | intrabar-settlement | BTCUSDT | 1m | false | 1681142400000 | 1681145999999 | 60 | `683e1eae608a247d8334f9e7d3716f1e4d769a6c74627eb3c692d8647f15272e` |
| 65 | intrabar-settlement | BTCUSDT | 1m | false | 1681430400000 | 1681433999999 | 60 | `62ba0d28fdbfa464064a6337ed134cc3a35608ec5cd9880c6551b000f863c45c` |
| 66 | intrabar-settlement | BTCUSDT | 1m | false | 1681689600000 | 1681693199999 | 60 | `5396afce86db12c27b2ade783b7fb8d323e6ec891f575be5f3862ea1e4eaac66` |
| 67 | intrabar-settlement | BTCUSDT | 1m | false | 1681891200000 | 1681894799999 | 60 | `fdc4ad9317f834a68b3d53c162f647eaf1d9e8ea831cf408d842bf6be9df8ce6` |
| 68 | intrabar-settlement | BTCUSDT | 1m | false | 1684713600000 | 1684717199999 | 60 | `133977789129a38e93a95112ac5c9cf8b6fd74db49132c3fbb2c2840d165a89e` |
| 69 | intrabar-settlement | BTCUSDT | 1m | false | 1697788800000 | 1697792399999 | 60 | `29ee7ea7e476cddbfc3234a0a5850d1beb27cd449a3a0c8b47ad4f9ef27c41ab` |
| 70 | intrabar-settlement | BTCUSDT | 1m | false | 1725897600000 | 1725901199999 | 60 | `fa5e21047458d95876b1c068baae4b6f728f29c63900eae051910b377452ae49` |
| 71 | intrabar-settlement | BTCUSDT | 1m | false | 1733932800000 | 1733936399999 | 60 | `e9091e435e16b08a37d156d85953f7bc5acf36718dffe62615797ffeb8f6c339` |
| 72 | intrabar-settlement | BTCUSDT | 1m | false | 1739376000000 | 1739379599999 | 60 | `3e42d9d90a918c31c2d568a29f71d0e83affb61b760a769ed8ddc40e97467f6f` |
| 73 | intrabar-settlement | BTCUSDT | 1m | false | 1743494400000 | 1743497999999 | 60 | `222b70978b9cca32d20e89d393eb615853b98f77081d871e1440f0066ab9f00d` |
| 74 | intrabar-settlement | BTCUSDT | 1m | false | 1745798400000 | 1745801999999 | 60 | `8da2c78a6b430cd8fdead23968653d22de2d8431f931470285f4fa8cd758bf72` |
| 75 | intrabar-settlement | BTCUSDT | 1m | false | 1748131200000 | 1748134799999 | 60 | `4e827397de1a3d37f578399ecd6d782ae6057bb130b20b69222ed845d1610967` |
| 76 | intrabar-settlement | BTCUSDT | 1m | false | 1751616000000 | 1751619599999 | 60 | `e6daf401af6823825a04d52edc97871d4a2f345fd123e3888b42ae2053249e80` |
| 77 | intrabar-settlement | BTCUSDT | 1m | false | 1753113600000 | 1753117199999 | 60 | `47c066d6b3bf3c32b41cc3cc562c1c92b64f8d613b54f976e8b9f3ed2f5057f7` |
| 78 | intrabar-settlement | BTCUSDT | 1m | false | 1753632000000 | 1753635599999 | 60 | `f5928b91951ad07104838c77ed5fe179fa72a2226d3ac3bd94f42e3afc05c99f` |
| 79 | intrabar-settlement | BTCUSDT | 1m | false | 1755446400000 | 1755449999999 | 60 | `fce63133cba12c55d13da6ea6132bca5db4d56b36acd6875fee6fcd33d63739e` |
| 80 | intrabar-settlement | BTCUSDT | 1m | false | 1760630400000 | 1760633999999 | 60 | `6df57eaa76a0c69f6f7c13b5024758e7cd0035ceda64f761169bdf895b4bbd70` |
| 81 | intrabar-settlement | BTCUSDT | 1m | false | 1763568000000 | 1763571599999 | 60 | `00ff52e6e2a85c019fd813a8de895ea83c36601fa621f08d3c119cd0240236de` |
| 82 | intrabar-settlement | BTCUSDT | 1m | false | 1764950400000 | 1764953999999 | 60 | `0289fafa51dfbdffc2bf1fa196e35f802bae9644c9b371bab51019ca3a11cc78` |
| 83 | intrabar-settlement | BTCUSDT | 1m | false | 1766304000000 | 1766307599999 | 60 | `6bf5617b96876387eb0e26661880b2a5e52ac92d3ce077c5de6bb97a7276777f` |
| 84 | intrabar-settlement | BTCUSDT | 1m | false | 1766966400000 | 1766969999999 | 60 | `fd6acc7ed9e3c4591fbfad5d387f8bf3a19afe9f481b7c7d479da2f1066e287d` |
| 85 | intrabar-settlement | BTCUSDT | 1m | false | 1769875200000 | 1769878799999 | 60 | `5eb79cb7e83a46bf5a558c7344f760990035c12c9a9b5f35af96ab8e37712a0d` |
| 86 | intrabar-settlement | BTCUSDT | 1m | false | 1770912000000 | 1770915599999 | 60 | `aa57a75dee4001a6f4512e950e48d62ba2d85d72d29b94088a8bc2e6264a0f16` |
| 87 | intrabar-settlement | BTCUSDT | 1m | false | 1771804800000 | 1771808399999 | 60 | `b1ee3e4f87ee4c22dd969d4d5351c636140576192ea7be51ba2a9664504510da` |
| 88 | intrabar-settlement | BTCUSDT | 1m | false | 1772553600000 | 1772557199999 | 60 | `f1605cb947bb6b7cc6b43f82c93cdebd5a63f48411d868d83767107b7eced87d` |
| 89 | intrabar-settlement | BTCUSDT | 1m | false | 1777248000000 | 1777251599999 | 60 | `5f3343156c2a2c5a9f998c895e79da09ba414581e33df53f5c33407d7c20f13e` |
| 90 | intrabar-settlement | BTCUSDT | 1m | false | 1780531200000 | 1780534799999 | 60 | `060be8cda114392e91ec5f64228da9ca1e7a67e5c8e85fa0d14accd2606a6d67` |
| 91 | intrabar-settlement | BTCUSDT | 1m | false | 1782201600000 | 1782205199999 | 60 | `8130b3f4208d9c0f73e041a6e08ffd2b639537f062fd1809d2942df5c7ee7245` |
| 92 | intrabar-settlement | BTCUSDT | 1m | false | 1782633600000 | 1782637199999 | 60 | `dd01f5da55a8ae4d916dd3b4e18fe5a4b92590423f6252e7dcdd1f9298f06685` |
| 93 | intrabar-settlement | ETHUSDT | 1m | false | 1673193600000 | 1673197199999 | 60 | `193a7465856f6b185b4165b2f015cd3e6ad32f842756d2aa629b47b25a5c2592` |
| 94 | intrabar-settlement | ETHUSDT | 1m | false | 1673856000000 | 1673859599999 | 60 | `cf2530a9aada301ce55948afcf310cd58f71f07be6c77195bb02ec3de37959d7` |
| 95 | intrabar-settlement | ETHUSDT | 1m | false | 1675785600000 | 1675789199999 | 60 | `31656d8a6c9153d640b60c0a48285993c2a4b76a33156fe51509d80d2005a8a7` |
| 96 | intrabar-settlement | ETHUSDT | 1m | false | 1676966400000 | 1676969999999 | 60 | `413acd46e5ba1be5e594b10e2b3e4a9decfbbc9aa59febfd3e487fb4441cf8b6` |
| 97 | intrabar-settlement | ETHUSDT | 1m | false | 1679097600000 | 1679101199999 | 60 | `1d2670a0488d7de8eabe2b6be8b05eafef3aaf1e33b847cbad43af72546e4e42` |
| 98 | intrabar-settlement | ETHUSDT | 1m | false | 1680076800000 | 1680080399999 | 60 | `b584fdf290da5836352675a007fd5e7b1ebc6be2f02f9f4252fcc80511f89e26` |
| 99 | intrabar-settlement | ETHUSDT | 1m | false | 1681372800000 | 1681376399999 | 60 | `8dcc4303982eb03ad277dee93ec0b64158f757552b7fd5365fd6c0f29ebb7a0a` |
| 100 | intrabar-settlement | ETHUSDT | 1m | false | 1684713600000 | 1684717199999 | 60 | `8bbb4af61a0a7017ee2652483d440bd23bc17a131d5ae482690c8b2423f9abe4` |
| 101 | intrabar-settlement | ETHUSDT | 1m | false | 1685923200000 | 1685926799999 | 60 | `0964f2985bb1a3581b6ab53b5c325efe6c6772a6d4347f8fbeb833582242c398` |
| 102 | intrabar-settlement | ETHUSDT | 1m | false | 1705680000000 | 1705683599999 | 60 | `886eb4516283c5aef9d2094d27796373bbccfbf9e20179b557124f9ff7b5927d` |
| 103 | intrabar-settlement | ETHUSDT | 1m | false | 1711526400000 | 1711529999999 | 60 | `261debfc84fa23997c4b2f323e5390fb37986b2765784c99520c968dfa4db13b` |
| 104 | intrabar-settlement | ETHUSDT | 1m | false | 1720512000000 | 1720515599999 | 60 | `1015219807c25752aff7e8dd74c3638ea6cb9f1398e0f4073f16ddbb7a975ca7` |
| 105 | intrabar-settlement | ETHUSDT | 1m | false | 1728201600000 | 1728205199999 | 60 | `2d732215c56442124005797f1366d23e653cb6c6bc8ee67fa27845579287038d` |
| 106 | intrabar-settlement | ETHUSDT | 1m | false | 1734969600000 | 1734973199999 | 60 | `822676388d6cdfa9f1f8ef6a91d3364cb30b954ea93b09a6fac3a88ce940ba61` |
| 107 | intrabar-settlement | ETHUSDT | 1m | false | 1739376000000 | 1739379599999 | 60 | `f914d9e15eb893641316a1404eb8277f0b5911ad5c181b22d74c6f8e605f1b3e` |
| 108 | intrabar-settlement | ETHUSDT | 1m | false | 1744444800000 | 1744448399999 | 60 | `debc0c802509b23b025f2facab3a129edb6eb035b6da4141dba5235949eab371` |
| 109 | intrabar-settlement | ETHUSDT | 1m | false | 1744905600000 | 1744909199999 | 60 | `1c5a5525fb782b07bcd08e42fbfdc63cfd6b87c9d577f547b992701adbf14706` |
| 110 | intrabar-settlement | ETHUSDT | 1m | false | 1746518400000 | 1746521999999 | 60 | `9b4b8c49fc1a69f4feec3bc087c79af202244230f3ae6452c9db064067305e4a` |
| 111 | intrabar-settlement | ETHUSDT | 1m | false | 1751184000000 | 1751187599999 | 60 | `a591388cbfdcaa8d92196d52e1fa600bb526e0d79b8ffd393065b1ec42d284f5` |
| 112 | intrabar-settlement | ETHUSDT | 1m | false | 1754265600000 | 1754269199999 | 60 | `3d20f3ce0afbb29c58fcfb423ef8cc4bf7c14d63f52d4dbf6a8a0338234f6caf` |
| 113 | intrabar-settlement | ETHUSDT | 1m | false | 1754323200000 | 1754326799999 | 60 | `b1577558f9b255a6e115001311852799c864432d6dff14784c51494b4c9dac7e` |
| 114 | intrabar-settlement | ETHUSDT | 1m | false | 1755417600000 | 1755421199999 | 60 | `2701d5533793703051205f3a8057dbdeb3750aa10f3b2c359ab8839c0dacfd36` |
| 115 | intrabar-settlement | ETHUSDT | 1m | false | 1757923200000 | 1757926799999 | 60 | `c31cad732e20bf342667035aff476a849c9950c2a6988bb15a3694cae2259308` |
| 116 | intrabar-settlement | ETHUSDT | 1m | false | 1758902400000 | 1758905999999 | 60 | `c936b2fe958196234c76d2e4523e8af470987d8a0e5276eedd3a02bfe86c7c1f` |
| 117 | intrabar-settlement | ETHUSDT | 1m | false | 1760515200000 | 1760518799999 | 60 | `64a87f305198eebd11b61de5827a9705dca1ae57c39ce7aa32ee6cdade5656ed` |
| 118 | intrabar-settlement | ETHUSDT | 1m | false | 1760630400000 | 1760633999999 | 60 | `896c2eaf4e1d99502e279141dc3f349123d60362924976486dd3a2599d183782` |
| 119 | intrabar-settlement | ETHUSDT | 1m | false | 1763568000000 | 1763571599999 | 60 | `faf8f3681dfc578dee4d8677ca42a5831a709da7a52433010cd6915995c53c1c` |
| 120 | intrabar-settlement | ETHUSDT | 1m | false | 1766304000000 | 1766307599999 | 60 | `f2c6b8f50842ea2ef99189de2608903ebc54bd4e8b1214a66213a2092ac18b01` |
| 121 | intrabar-settlement | ETHUSDT | 1m | false | 1766966400000 | 1766969999999 | 60 | `842680ed2c14ca06c49d581f6aa1b34d3baa3fadc88e21c8cbd78e5722b43f05` |
| 122 | intrabar-settlement | ETHUSDT | 1m | false | 1768665600000 | 1768669199999 | 60 | `a809d1c2ac63d2919ad7c201dea2430fde1bcb8657ecb2beee5c0757d124edc1` |
| 123 | intrabar-settlement | ETHUSDT | 1m | false | 1769356800000 | 1769360399999 | 60 | `2eecd20306e355c9f767165120e130e00f0a647cda2acb92944ce72cef45c3bf` |
| 124 | intrabar-settlement | ETHUSDT | 1m | false | 1770652800000 | 1770656399999 | 60 | `14cb8dfb87fc4a5dd14bb9adcaf099d9b3b6e672de55bc85a8c07cda75089fff` |
| 125 | intrabar-settlement | ETHUSDT | 1m | false | 1770969600000 | 1770973199999 | 60 | `ce336cb9b9ba46f757961e629865219ddf7a3aa9d724318ab4dcb405bf94dc4a` |
| 126 | intrabar-settlement | ETHUSDT | 1m | false | 1771344000000 | 1771347599999 | 60 | `15656832d9b261267a75b446449d729f5295996fbcfc9792b1b0c8a18bdb25fb` |
| 127 | intrabar-settlement | ETHUSDT | 1m | false | 1771516800000 | 1771520399999 | 60 | `123bd71205605e67cc7aa34b85c2b505498e59d8ac03974836c0675a72561f77` |
| 128 | intrabar-settlement | ETHUSDT | 1m | false | 1771804800000 | 1771808399999 | 60 | `e00a2ac77f085e17572f199fb3323f125b9c25d40ec335a377f167767f575f7e` |
| 129 | intrabar-settlement | ETHUSDT | 1m | false | 1772553600000 | 1772557199999 | 60 | `7f2c565183c93041958128a044c5e588a836a8715582459a6e4528b5785a75b7` |
| 130 | intrabar-settlement | ETHUSDT | 1m | false | 1772611200000 | 1772614799999 | 60 | `22c904a124a32a45639d70e97bd967a845d24c7d8ffac4cae07592c99a47a6a5` |
| 131 | intrabar-settlement | ETHUSDT | 1m | false | 1779264000000 | 1779267599999 | 60 | `a13035348953672676cf41adc413479e1f77b77332c81c7a0befea5a852fc837` |
| 132 | intrabar-settlement | ETHUSDT | 1m | false | 1781337600000 | 1781341199999 | 60 | `50544bf49db88df877fc8b3c4b2adbbea5634e3d2941139ae76461563c007865` |
| 133 | intrabar-settlement | ETHUSDT | 1m | false | 1782201600000 | 1782205199999 | 60 | `bf2e47363f8a612385838ccce97d6f072e7add5e10b416afd8773b39b09e2329` |
| 134 | intrabar-settlement | SOLUSDT | 1m | false | 1674748800000 | 1674752399999 | 60 | `b7ca45f7486b696133a6c0ff1a8b066750e254d192ee89a2970e7aa17748774c` |
| 135 | intrabar-settlement | SOLUSDT | 1m | false | 1675008000000 | 1675011599999 | 60 | `7698b6e527a48cea82c593bc6af8061252ac10f6223446cd1d78619008ed2590` |
| 136 | intrabar-settlement | SOLUSDT | 1m | false | 1676966400000 | 1676969999999 | 60 | `4db32fe3fdfb09498594113c3d8c5d257e1b6082a79385ad80511518d6d0efe0` |
| 137 | intrabar-settlement | SOLUSDT | 1m | false | 1705248000000 | 1705251599999 | 60 | `6e9e0462ae6dece8225640e0edf49afa8cd091a023ee0bb500c402a00e4a977b` |
| 138 | intrabar-settlement | SOLUSDT | 1m | false | 1710374400000 | 1710377999999 | 60 | `e8be751147a722c7e272e58f24174923bba03de225f9111826986fb11cce513c` |
| 139 | intrabar-settlement | SOLUSDT | 1m | false | 1711526400000 | 1711529999999 | 60 | `9ff38842fb71eb15c662630ea242021772d7c4c777ecbee3b76ea2cbfd6361f8` |
| 140 | intrabar-settlement | SOLUSDT | 1m | false | 1725897600000 | 1725901199999 | 60 | `e1ab9f01f8ea679095e8fc8d6c7c688c56f3775b70375caa814e19908facea3b` |
| 141 | intrabar-settlement | SOLUSDT | 1m | false | 1741708800000 | 1741712399999 | 60 | `e5009f1a926190fe56a2dfbe34f1a7c7b7d05a88c3001d99e3470e6c33289d9a` |
| 142 | intrabar-settlement | SOLUSDT | 1m | false | 1743494400000 | 1743497999999 | 60 | `e8da2539ba7710cf0ad8453983d5624c39d7c0eff9037a605ab1897ecff0541a` |
| 143 | intrabar-settlement | SOLUSDT | 1m | false | 1746633600000 | 1746637199999 | 60 | `744f2a12deb9841565cc685d7014dadc622b29e4914b7d036c249bbd675a3796` |
| 144 | intrabar-settlement | SOLUSDT | 1m | false | 1748131200000 | 1748134799999 | 60 | `040855b79c8007ece8b6359ea36398787856e28ccbd4f4f14785e690c524de54` |
| 145 | intrabar-settlement | SOLUSDT | 1m | false | 1751040000000 | 1751043599999 | 60 | `d542e37ea71a59af64af85250ac5d39ed0462e588fdb65af8a730a1c906806d5` |
| 146 | intrabar-settlement | SOLUSDT | 1m | false | 1752681600000 | 1752685199999 | 60 | `5de230d8fd1788a85bd3f8e9da2099b1bc182a5b9945f04166e07e3c5ea92132` |
| 147 | intrabar-settlement | SOLUSDT | 1m | false | 1757635200000 | 1757638799999 | 60 | `1a6613bb3552177d0eb00be691a9fcfc2e49076c2d56c5896df2856ac2429e83` |
| 148 | intrabar-settlement | SOLUSDT | 1m | false | 1758124800000 | 1758128399999 | 60 | `ffccbec8dcaa744486280bf15b68c3164bdc2464a0ad8660a73e1fad02218efb` |
| 149 | intrabar-settlement | SOLUSDT | 1m | false | 1760371200000 | 1760374799999 | 60 | `f0c3db8f170e0e548cf7dfa1a38f8ab3e174323a3e87b9a36c9ebe733bdcef6a` |
| 150 | intrabar-settlement | SOLUSDT | 1m | false | 1760515200000 | 1760518799999 | 60 | `01eecc2f5f9b05fa45bc66c32416335a9574f731a6ee053fdaae1fd2f1a0f459` |
| 151 | intrabar-settlement | SOLUSDT | 1m | false | 1764000000000 | 1764003599999 | 60 | `4666e14f55c781ee3ce2786b11f2970c33072a14e96ebbc7048121f81c99ba84` |
| 152 | intrabar-settlement | SOLUSDT | 1m | false | 1764950400000 | 1764953999999 | 60 | `17761f0eae1de220aadb0ed4ce79c92c9e3c14ad26b408ceea4a08a263ddbb10` |
| 153 | intrabar-settlement | SOLUSDT | 1m | false | 1768694400000 | 1768697999999 | 60 | `f7f6688b6c05a76db17e08f95f010cfcf325aaa019f591533151b532445c22e8` |
| 154 | intrabar-settlement | SOLUSDT | 1m | false | 1769846400000 | 1769849999999 | 60 | `80b476181f402c6c68c2211e8684f7a4fc4c386364bfb58f3433b5e46494ac83` |
| 155 | intrabar-settlement | SOLUSDT | 1m | false | 1769875200000 | 1769878799999 | 60 | `dfa3a85a6b149d93a7a2153afca489ddf3d2b991731874af64a5530e16885386` |
| 156 | intrabar-settlement | SOLUSDT | 1m | false | 1770969600000 | 1770973199999 | 60 | `7071fd59236e9ffe3f9e821d815a018323cd7415c75a78a694b60c15b6c9928f` |
| 157 | intrabar-settlement | SOLUSDT | 1m | false | 1771804800000 | 1771808399999 | 60 | `c43938754a4d11d178ce6baa8c568df3cb7cf5c4726f14cbcf8669652014c693` |
| 158 | intrabar-settlement | SOLUSDT | 1m | false | 1772208000000 | 1772211599999 | 60 | `ebd495f54e6af76d6d5a44d1eb4133143f91e2c6258a0036b87614ffbb9029cf` |
| 159 | intrabar-settlement | SOLUSDT | 1m | false | 1772553600000 | 1772557199999 | 60 | `9584e624c81fb1ab1af74ae3fb8b1832234bac60af332d64d6e18618dff64c5b` |
| 160 | intrabar-settlement | SOLUSDT | 1m | false | 1773360000000 | 1773363599999 | 60 | `5018134989f7b1d49fd1beb17479483c244be1d55cf10ef06317b4e18b968a9f` |
| 161 | intrabar-settlement | SOLUSDT | 1m | false | 1775750400000 | 1775753999999 | 60 | `2e065499c090186b6409c97ae44a000879c7bbeb37d6484296a649fc8072b3cf` |
| 162 | intrabar-settlement | SOLUSDT | 1m | false | 1782201600000 | 1782205199999 | 60 | `92d247f41f6b247517f41a9d5d9ffe10574144f8a2ae9556d1f84bbe9934bf91` |
| 163 | intrabar-settlement | SOLUSDT | 1m | false | 1783209600000 | 1783213199999 | 60 | `5a703f7e0101e34833920104b4b93dc203fd1671bee2a09cd629d09f56ea5c24` |
| 164 | intrabar-settlement | XRPUSDT | 1m | false | 1673856000000 | 1673859599999 | 60 | `194d57b458112efd3e998270d67b9ff8ffafe891ccd4598945a4068e5dc06bef` |
| 165 | intrabar-settlement | XRPUSDT | 1m | false | 1674028800000 | 1674032399999 | 60 | `6570abc687e269f7b100d9f27d7c72cf0608943f20c5aeb186efae7e69deefef` |
| 166 | intrabar-settlement | XRPUSDT | 1m | false | 1674460800000 | 1674464399999 | 60 | `6a7ba9be8fb824771b8c2bdc2f4fc77317e8070c689cd0a9076467a0a9d8cab4` |
| 167 | intrabar-settlement | XRPUSDT | 1m | false | 1675036800000 | 1675040399999 | 60 | `04b4b8eefd0a4058c0b361e98635de8c958105dbddbb6d87b026eccb4065f9b8` |
| 168 | intrabar-settlement | XRPUSDT | 1m | false | 1677254400000 | 1677257999999 | 60 | `10db9a1e758c0754591f7aa8207de65ff6ec1f02da6ad1aaaba9fdde5cf9e7e7` |
| 169 | intrabar-settlement | XRPUSDT | 1m | false | 1678636800000 | 1678640399999 | 60 | `30b774c38c583df37654022339d53eb8aaa663128291c481b5a458e43c2d8ce0` |
| 170 | intrabar-settlement | XRPUSDT | 1m | false | 1679904000000 | 1679907599999 | 60 | `83104e9405811c4ea1f4d6de7e06f86768563871388abc1eb09453d958c45fd0` |
| 171 | intrabar-settlement | XRPUSDT | 1m | false | 1681689600000 | 1681693199999 | 60 | `0f24895df4cb34cf4b7507a1ded07b1453180850c2bf2964dae76a739b0467e5` |
| 172 | intrabar-settlement | XRPUSDT | 1m | false | 1681891200000 | 1681894799999 | 60 | `88caeba89ab435783c8b70481e44e61566a0d9137495c5f336211d7bb35f7cff` |
| 173 | intrabar-settlement | XRPUSDT | 1m | false | 1683244800000 | 1683248399999 | 60 | `b65f1ac0ec3245d511af7273d3c8df448e0956656e11b12ae6ee47fae72c820d` |
| 174 | intrabar-settlement | XRPUSDT | 1m | false | 1685376000000 | 1685379599999 | 60 | `a10887357b1cec12bd63b9b6a18d2a1893d30b7d31fd5302ca577d31b93a4905` |
| 175 | intrabar-settlement | XRPUSDT | 1m | false | 1725897600000 | 1725901199999 | 60 | `55187db4cd49f845614d4b73b13ec47d8d055b51c5778cb00d6db56f879b8e60` |
| 176 | intrabar-settlement | XRPUSDT | 1m | false | 1743494400000 | 1743497999999 | 60 | `6f5b6c55bee60a1d2e06c0a689ece431b642e1ccc96a0cc4370f7f6c2e3232d5` |
| 177 | intrabar-settlement | XRPUSDT | 1m | false | 1747238400000 | 1747241999999 | 60 | `af8dc34ae10ea9c9d3a21706ed590789c4cebe1fbbe6a24fd62f235ad9236241` |
| 178 | intrabar-settlement | XRPUSDT | 1m | false | 1750406400000 | 1750409999999 | 60 | `994d6a70aa585109d810a5196fdd60a5cc304f730c2a98a9a26455125166a9d4` |
| 179 | intrabar-settlement | XRPUSDT | 1m | false | 1751299200000 | 1751302799999 | 60 | `4d34da316137cff07e178bdaed1e6ce6f3614c48d84b560e631d38d07711d030` |
| 180 | intrabar-settlement | XRPUSDT | 1m | false | 1752048000000 | 1752051599999 | 60 | `fbb045d49c3d87f82f4c7fad1ed144ff3b9546698cf5dda748849c4e2f406725` |
| 181 | intrabar-settlement | XRPUSDT | 1m | false | 1754265600000 | 1754269199999 | 60 | `d1b9693037f9b62b02e1b302b0ec926d9a35465f87a20db1c71e037005062490` |
| 182 | intrabar-settlement | XRPUSDT | 1m | false | 1755446400000 | 1755449999999 | 60 | `c88a5231e81aa5246a6b9c45a2e26b999d0a446c388e03373d9ea7e5f3c1bc84` |
| 183 | intrabar-settlement | XRPUSDT | 1m | false | 1756598400000 | 1756601999999 | 60 | `55ef440754b02068c76fc7e6079760f26d458d33c27b47d3dd74b7d5d8745b4c` |
| 184 | intrabar-settlement | XRPUSDT | 1m | false | 1762531200000 | 1762534799999 | 60 | `f95ed77e652e54ae1e1ee78d160b76cd44f92af085584c33cb1f27d60ffa79a4` |
| 185 | intrabar-settlement | XRPUSDT | 1m | false | 1763568000000 | 1763571599999 | 60 | `9a15c492a757ead12a1b69587f9850ec3fb6bc6b4f93b599019792ef2ddeeaa9` |
| 186 | intrabar-settlement | XRPUSDT | 1m | false | 1764000000000 | 1764003599999 | 60 | `03d70e6b891132770a63a6178b0802ab7b6f39027acb6833062e05c55c06109b` |
| 187 | intrabar-settlement | XRPUSDT | 1m | false | 1764259200000 | 1764262799999 | 60 | `de5938deca02615eb75153ff2523ba4feb966ad1e5f7e90b6d9469c0b1018e36` |
| 188 | intrabar-settlement | XRPUSDT | 1m | false | 1766649600000 | 1766653199999 | 60 | `af4325102c7e3d314467d8dedf1d44a9380256700e900774061097301483d673` |
| 189 | intrabar-settlement | XRPUSDT | 1m | false | 1767110400000 | 1767113999999 | 60 | `816ca87fe30318b0b46bbb4f625a295065fd5ef5476b0d7bc5d242bb761125a3` |
| 190 | intrabar-settlement | XRPUSDT | 1m | false | 1768320000000 | 1768323599999 | 60 | `a5050423ff144709937dba637b794cd483c710e55b6d5c1262c6b0936125f62d` |
| 191 | intrabar-settlement | XRPUSDT | 1m | false | 1769356800000 | 1769360399999 | 60 | `fe5887b6ca9a3487fd71e32e85a7f697f5cac347621003b3f6cfe33fe158a367` |
| 192 | intrabar-settlement | XRPUSDT | 1m | false | 1770652800000 | 1770656399999 | 60 | `3a837d46f51c674fd0bce60dee9e21902c122cf0178a5b08b90c0ea93d76a242` |
| 193 | intrabar-settlement | XRPUSDT | 1m | false | 1771344000000 | 1771347599999 | 60 | `6cc7f7f5fd43118f84770f7c9c03a55e728282e54518156feb32e2251ec23ba0` |
| 194 | intrabar-settlement | XRPUSDT | 1m | false | 1772553600000 | 1772557199999 | 60 | `66e46b2fc2b9606ae303106eeed1a70bc11716f53fed91965aac28c80cf5caf3` |
| 195 | intrabar-settlement | XRPUSDT | 1m | false | 1773360000000 | 1773363599999 | 60 | `960047ad51febcbd0e0ce8a4379a44b975e0ec313f601fab55c00c42177d4b29` |
| 196 | intrabar-settlement | XRPUSDT | 1m | false | 1781020800000 | 1781024399999 | 60 | `11fd0f5c952e28f493403e2fccd8cbd68f4a2d3c2292f64a88ad742b58889a36` |
| 197 | mark-price | BNBUSDT | 1h | false | 1668927600000 | 1786838399999 | 32753 | `3aa873c3da321e6f3ffe47ff2354d6eb1340f4291c9c2ad56fb60108f12dce67` |
| 198 | mark-price | BTCUSDT | 1h | false | 1668927600000 | 1786838399999 | 32753 | `195cd9072517a2513f56d69b7d171a4da38ad5c4864b6a3a06c3cd549bedae25` |
| 199 | mark-price | ETHUSDT | 1h | false | 1668927600000 | 1786838399999 | 32753 | `394d3f8e6fcf1c5026818421426a922010030e208e7f12e14812a3f2573cc059` |
| 200 | mark-price | SOLUSDT | 1h | false | 1668927600000 | 1786838399999 | 32753 | `f921c39e4fe6086a1d39d9e40949b272b974b6fe505c23c95f766109cfa769df` |
| 201 | mark-price | XRPUSDT | 1h | false | 1668927600000 | 1786838399999 | 32753 | `86f7a50f6ecfd76403663594a4f6a4f94ae629838bc5ed4add9bc70b6d4dee9d` |

## Final safeguards

- `baseline-001` unchanged.
- `bt-policy-001` unchanged.
- `bt-policy-002` unchanged.
- `bt-policy-003` was not changed during the formal run.
- No strategy tuning, parameter search, alternate provider, private Binance API, trading, or M4 work was performed.
- The report is retained under ignored `.tmp/backtest/`; this evidence document records its exact hash and is documentation-only.
