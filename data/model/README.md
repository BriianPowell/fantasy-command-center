# Normalized Model Artifacts

Store normalized ranking model artifacts here. **Everything under this
folder (other than this README) is gitignored**, for the same redistribution
reason as `data/raw/` — these artifacts are derived closely enough from raw
FantasyPros/PFF data that they should stay local rather than committed to
the public repo. Regenerate them locally before building rankings; the source
CSVs live in Nextcloud rather than in this repo, so see
`models/player-ranking/README.md` for the runbook.

Current artifacts:

| File                             | Produced by                 |
| -------------------------------- | --------------------------- |
| `historical_player_seasons.json` | `npm run data:import`       |
| `ingest_manifest.json`           | `npm run data:import`       |
| `team_oline_profiles.json`       | `npm run data:profiles`     |
| `team_dline_profiles.json`       | `npm run data:profiles`     |
| `player_production_scores.json`  | `npm run data:scores`       |
| `correlations.json`              | `npm run data:correlations` |

Still to come: `modeled_rankings.json` and `player_match_report.json`.

These files are deterministic outputs of the scripts under `models/`. Only the
final, heavily-transformed app-ready TypeScript exports under
`src/data/generated/` are committed.
