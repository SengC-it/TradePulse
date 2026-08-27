# Round-008 model definition

R8 replays the exact R7 model definition:

- deterministic interpretable ridge model;
- ten frozen decision-time closed-candle features;
- lambda `10`, with no lambda search or optimizer;
- fold-local research-only standardization and fit;
- validation prediction only, with no refit or threshold update;
- predicted expected net-R threshold `+0.05`.

Model specification identity is hashed in the R8 protocol machine record.
The frozen model specification SHA-256 is
`0b07a7aae7a8d7d9e2fbac183b2f2cff9db3a5fbae488962ea0fb45d491d2f3f`.
No feature, threshold, training scope, or candidate definition is added,
removed, or tuned from invalidated Round-007 results.
