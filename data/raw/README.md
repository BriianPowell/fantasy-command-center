# Raw Source Data

Store source snapshots here before normalization. **Everything under this
folder (other than this README) is gitignored.** FantasyPros' free/premium
API tiers are personal + non-commercial and do not include redistribution
rights, and this repo is public, so raw vendor data must never be committed.
Re-run the fetch scripts locally whenever you need fresh snapshots.

The **primary historical source** — the FantasyPros "Fantasy Football
Statistics" and "Advanced Stats Report" CSV exports — does not live here. Those
are downloaded by hand into Nextcloud, keeping their original filenames, and
read straight from there by the scripts under `models/`. See
`models/player-ranking/README.md` for the folder layout and the yearly runbook.

What does land here:

- `fantasypros/<season>/players.json`, `player-points-<position>.json`,
  `consensus-rankings-<position>.json` — optional live-API snapshots from
  `models/player-ranking/fetch-fantasypros.mjs`. Note `player-points` and
  `players` are capped to 10 records on the free tier, so they're a
  secondary/spot-check source, not the primary one. `consensus-rankings` is
  uncapped and useful for current-season ECR/ADP context.
- `pff/<season>-offensive-line-rankings.md` or `.json` — manually copied from
  PFF (no public API), since PFF requires a subscription and sign-in.
- `pff/<season>-defensive-line-rankings.md` or `.json` — same, for defense.

Do not commit credentials, cookies, API keys, or authenticated browser
session exports. Put `FANTASYPROS_API_KEY` in a local `.env` (see
`.env.example` at the repo root); it is read only by offline scripts, never
by the web app.
