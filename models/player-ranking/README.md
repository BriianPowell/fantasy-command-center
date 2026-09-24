# Player Ranking Model

Offline workspace for building fantasy player ranking artifacts. Nothing here
runs in the web app; the scripts write gitignored JSON to `data/model/`, and
only hand-promoted exports under `src/data/generated/` cross into the site.

## Where the data comes from

Season data arrives as FantasyPros CSV exports that you download by hand and
drop into Nextcloud, one folder per season:

```
<source>/2025/FantasyPros_Fantasy_Football_Statistics_QB.csv
<source>/2025/FantasyPros_Fantasy_Football_Advanced_Stats_Report_QB.csv
...
```

Keep the filenames exactly as FantasyPros writes them. The source folder
resolves in this order:

1. `--source <path>` on any script
2. `FANTASYPROS_DATA_DIR` in the environment or `.env`
3. a single auto-detected `~/Library/CloudStorage/Nextcloud-<account>` that
   contains an `NFL Data` folder

Ten reports per season: Statistics for QB, RB, WR, TE, K, and DST, plus the
Advanced Stats Report for QB, RB, WR, and TE. The Statistics and advanced QB
and RB reports are required; advanced WR and TE are optional, since target
share is already in the Statistics export.

Vendor CSVs are licensed for personal, non-commercial use and are never
committed — see `data/raw/README.md`.

## Yearly runbook

Once a season ends, download the ten exports, drop them in a new season
folder, and run:

```
npm run data:check          # validate before importing anything
npm run data:import         # historical_player_seasons.json + ingest_manifest.json
npm run data:profiles       # team_oline_profiles.json + team_dline_profiles.json
npm run data:scores         # player_production_scores.json
npm run data:correlations   # correlations.json, including the derived weights
```

Every script takes `--seasons 2024,2025` to narrow the run and `--source` to
point somewhere other than Nextcloud.

`data:scores` also takes `--scoring standard|half_ppr|ppr` (default:
`standard`) or `--scoring-settings <path-to-json>` for a league's actual
Sleeper `scoring_settings`. FantasyPros' ingested FPTS is standard (0-PPR)
scoring — see "How the scores are built" below for why `fantasyPoints` is
_adjusted_ from that trusted value rather than recomputed from scratch, and
why that distinction matters.

`npm run data:check` is the one to run first. It verifies each file exists, is
materialized rather than an online-only Nextcloud placeholder, matches its
recorded column header exactly, and carries a plausible row count. Because
every stat is read by column position, a single inserted column upstream would
otherwise corrupt the whole import silently. The header fingerprints live in
`../ingest/fantasypros/schema.mjs`; when FantasyPros does change a layout,
`data:check` names the offending column and you add a new `version` entry
beside the existing one rather than editing it.

## Artifacts

| File                             | Produced by         | Contents                                              |
| -------------------------------- | ------------------- | ----------------------------------------------------- |
| `historical_player_seasons.json` | `data:import`       | `HistoricalPlayerSeason[]` for every player-season    |
| `ingest_manifest.json`           | `data:import`       | Per-file validation status for the run                |
| `team_oline_profiles.json`       | `data:profiles`     | Pass-protection and run-blocking scores, ranks, tiers |
| `team_dline_profiles.json`       | `data:profiles`     | Pass-rush and takeaway scores, ranks, tiers           |
| `player_production_scores.json`  | `data:scores`       | 0–100 production score per player-season              |
| `correlations.json`              | `data:correlations` | Fitted relationships and the model weights they imply |

## How the scores are built

**Scoring format.** FantasyPros' ingested `fantasyPoints` is fixed to
standard (0 points/reception) scoring, which may not match the league this
model is actually informing. `data:scores` adjusts it for the requested
format by adding only the _delta_ a rule change makes (e.g.
`receptions * rec_points` for PPR/half-PPR) rather than recomputing the total
from raw stats — a from-scratch recompute does not reliably reproduce
FantasyPros' own FPTS (it matches some player-seasons exactly and misses
others by a few points, likely from an unmodeled per-game bonus mechanic), so
`--scoring standard` stays an exact pass-through of the trusted ingested
value instead of silently drifting from it. See `../lib/scoring.mjs` for the
full explanation and a concrete example of the mismatch.

**Production score.** Each player-season is ranked against its own position
and season on per-game rates, then blended by weight (fantasy points per game
carries the most, with the category stats beside it). Percentile ranks rather
than z-scores, so one 2,000-yard rusher can't compress everyone else. Players
below a games threshold are reported but kept out of the percentile pool.

**Line profiles.** FantasyPros publishes no line grades, so both scales are
proxies from the advanced reports. Pass protection is the inverted pressure
rate across a team's quarterbacks (sacks plus knockdowns plus hurries per
dropback). Run blocking is rushing yards _before_ contact per attempt — yards
after contact belong to the runner, so excluding them keeps the line from
getting credit for a back who breaks tackles. Pass rush is team sacks.

**Correlations.** Three relationships on the shared 0–100 scale: line to
quarterback, quarterback to lead receiver, run blocking to lead back. Each is
fitted by ordinary least squares and validated by holding out one season at a
time. A relationship earns a model weight only if it beats a predict-the-
average baseline in a majority of those folds _and_ gains ground on average;
the weight it earns is the share of variance it explains, with the remainder
assigned to the player's own history.

Two caveats are recorded in the artifact itself. The pass-protection proxy is
derived from quarterback pressure data, so a quick-release passer flatters his
own line and that fit is an upper bound. Run blocking comes entirely from
running back carries, so it is a confound-free lower bound.

## FantasyPros API access

There is also an official REST API (`api.fantasypros.com`), but its free tier
caps `players` and `player-points` at 10 records per request
(`public_api_limited: true`), which is why historical data comes from the CSV
exports instead. The uncapped `consensus-rankings` endpoint is still useful
for current-season expert consensus and ADP context:

1. Request a free key at <https://secure.fantasypros.com/api-keys/request/>
2. Copy `.env.example` (repo root) to `.env` and set `FANTASYPROS_API_KEY`.
3. Run `node models/player-ranking/fetch-fantasypros.mjs --season 2025`, which
   writes gitignored snapshots under `data/raw/fantasypros/<season>/`.

## On PFF

PFF publishes line rankings but has no API, and its Terms of Use prohibit
scraping and automated extraction. It also isn't needed: the advanced exports
already supply pass-protection, run-blocking, and pass-rush proxies for every
season we have. If you ever want PFF grades in the model, copy them in by hand
under `data/raw/pff/<season>-*.md`.
