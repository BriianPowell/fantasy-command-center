# Offline Ranking Data

This folder is for player-ranking model inputs and generated artifacts.

- `raw/` stores source exports or copied source snapshots used for modeling.
- `model/` stores normalized, versioned artifacts produced from raw inputs.

Both `raw/` and `model/` are gitignored (only their READMEs are tracked).
FantasyPros' API terms restrict redistribution outside a commercial license,
and this repo is public, so vendor data snapshots and closely-derived
artifacts stay local-only. See `models/player-ranking/` for the fetch/build
scripts that regenerate them.

The website should not import raw vendor data directly. Draft Room should consume
generated TypeScript files under `src/data/generated/`.
