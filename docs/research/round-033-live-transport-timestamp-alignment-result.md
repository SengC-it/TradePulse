# Round-033 Live Transport + Timestamp Semantic Alignment

- Classification: `BINANCE_METRICS_PARTIAL_CURRENT_REGIME_MAPPING_ESTABLISHED`
- Next stage: `ADMITTED_FIELDS_HISTORICAL_AUDIT_REQUIRED`
- r33ExecutionCount: `1`
- Archive version drift: `false`
- Live requests: `25/25` successful

## Archive

- BTCUSDT: frozenSHA=3558afea198d8579ea1fa8c176726ed2204770dbdd2dd05a5dfed6c83d8c7be3, localSHA=3558afea198d8579ea1fa8c176726ed2204770dbdd2dd05a5dfed6c83d8c7be3, versionMatch=true, checksum=true, rows=288
- ETHUSDT: frozenSHA=689c8d44f3f3f98091007a25ffa71f218d23583277bf3817c527e6bfd6b52e5a, localSHA=689c8d44f3f3f98091007a25ffa71f218d23583277bf3817c527e6bfd6b52e5a, versionMatch=true, checksum=true, rows=288
- SOLUSDT: frozenSHA=4fddfea48dfbaf59cc6a2b677f67372d862f0533a339a355dc392fa1524ab3b4, localSHA=4fddfea48dfbaf59cc6a2b677f67372d862f0533a339a355dc392fa1524ab3b4, versionMatch=true, checksum=true, rows=288
- XRPUSDT: frozenSHA=b5d88e786808b80441b4cd16d43404f2a77a2b3e61799f2e93718da37c838e88, localSHA=b5d88e786808b80441b4cd16d43404f2a77a2b3e61799f2e93718da37c838e88, versionMatch=true, checksum=true, rows=288
- BNBUSDT: frozenSHA=ac6121e416d6a4f5d0e03bc4208f759f8324dc039923bb0aab7bf9c10d00a0ea, localSHA=ac6121e416d6a4f5d0e03bc4208f759f8324dc039923bb0aab7bf9c10d00a0ea, versionMatch=true, checksum=true, rows=288

## Field results

- OPEN_INTEREST: status=FIELD_MAPPING_ADMITTED_CURRENT_REGIME, admitted=true, selectedOffset=ARCHIVE_PLUS_5M
- TOP_TRADER_ACCOUNT: status=FIELD_NUMERIC_SEMANTIC_MISMATCH, admitted=false, selectedOffset=null
- TOP_TRADER_POSITION: status=FIELD_MAPPING_ADMITTED_CURRENT_REGIME, admitted=true, selectedOffset=ARCHIVE_PLUS_5M
- GLOBAL_LONG_SHORT: status=FIELD_NUMERIC_SEMANTIC_MISMATCH, admitted=false, selectedOffset=null
- TAKER_RATIO: status=FIELD_NUMERIC_SEMANTIC_MISMATCH, admitted=false, selectedOffset=null

## Evidence

- Manifest: `docs/research/round-033-evidence-manifest.json`
- archiveEvidenceFiles: `5`
- liveEvidenceFiles: `25`

## PIT and governance

- historicalFeatureAvailableTime: `archiveCreateTime + 5 minutes`
- historicalRegimeMappingEstablished: `false`
- economicOutcomeFilesRead: `false`
- economicEvaluationPerformed: `false`
- forwardEconomicValuesRead: `false`
- performanceExecutionCount: `0`
- automaticTrading: `false`
- Production unchanged: `true`
