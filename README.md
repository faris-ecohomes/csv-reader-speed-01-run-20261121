# csv-reader-speed-01-run-20261121

[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/faris-ecohomes/csv-reader-speed-01-run-20261121/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/faris-ecohomes/csv-reader-speed-01-run-20261121/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

A faster drop-in for csv-reader 1.0.0, built for make.fun's "Read broken CSV files faster" bounty ($100 in USDC).

`solve.js` returns exactly what csv-reader 1.0.0 returns for every `{text, header}` input — same broken-row policy (BOM drop, stray-CR errors, quoted-field rules with `unterminated_quote` re-read and `quote_junk`, `short_row`/`long_row` padding and cutting) — but scans in bulk with regex-delimiter search and `slice()` instead of walking one character at a time. On the kit's practice set (6 cases, ~10 MB) it parses in ~250 ms vs ~860 ms for the reference (~3.4x faster), with byte-identical answers; 3,068 randomized broken-CSV fuzz cases plus targeted edge cases show zero differences from the reference.

## Run it

```sh
MAKEFUN_INPUT_DIR=<dir with cases.json> MAKEFUN_OUTPUT_DIR=<out dir> node main.ts
```

`main.ts` is the kit's driver: it reads every case from `/input/cases.json`, answers each with `run()` from `solve.js`, and writes `/output/answers.json`.
