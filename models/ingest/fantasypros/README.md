# FantasyPros Ingestion

One read path for the FantasyPros CSV exports. Every offline script goes
through `loadSeasonData` rather than opening a CSV itself, so they all resolve
the same source, fail on the same conditions, and share one manifest.

| File               | Role                                                                                    |
| ------------------ | --------------------------------------------------------------------------------------- |
| `source.mjs`       | Resolve the Nextcloud folder from `--source`, `FANTASYPROS_DATA_DIR`, or auto-detection |
| `schema.mjs`       | The column contract: expected headers and named column maps for all ten reports         |
| `csv.mjs`          | Parsing primitives — quoted fields, player/team splitting, numeric coercion             |
| `validate.mjs`     | Per-file health checks: presence, materialization, header match, row count              |
| `parse.mjs`        | Validated rows to records                                                               |
| `load.mjs`         | The entry point everything else calls                                                   |
| `check-season.mjs` | `npm run data:check` — the doctor CLI                                                   |

## The column contract

Stats are read by column position, because the exports have duplicate header
names (a quarterback's passing and rushing lines both say `YDS`). That makes an
inserted column upstream a silent data-corruption bug rather than a crash, so
every file's header is compared against a recorded fingerprint before a single
value is read.

Each report in `schema.mjs` carries a list of `versions`, each pairing an exact
header array with the column indices that header implies. All ten reports have
been byte-identical across 2021–2025, so there is only `v1` today. When
FantasyPros does change a layout:

1. `npm run data:check` fails and names the first divergent column index.
2. Add a new `{ version: 'v2', header, columns }` entry **beside** the existing
   one rather than editing it. Old seasons keep parsing under `v1`, and each
   record records the version it was parsed under.

## Online-only files

Nextcloud can leave a file as a placeholder that reports a real size but
occupies no blocks. Reading one returns nothing useful, so `validate.mjs`
treats `blocks === 0 && size > 0` as an error telling you to materialize the
file rather than silently importing an empty season.
