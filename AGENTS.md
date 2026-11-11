# fantasy-command-center

Sleeper-first fantasy football command center (React + TypeScript + Vite): multi-league dashboards, Locker Room, Draft Room, and draft recommendations. A separate offline pipeline under `models/` builds player-ranking artifacts from FantasyPros CSVs; only hand-promoted files in `src/data/generated/` ship with the site.

## Verify before you finish

Run these and fix failures before reporting a task done. Report which ones you ran.

```sh
npm run lint
npm run test
npm run build
```

Same sequence as `.github/workflows/deploy-pages.yml` on `main`. After changing offline model scripts (`models/**/*.mjs`), `npm run test` still applies (Vitest picks up `models/**/*.test.mjs`).

Optional before commit: `npm run format:check`

## Commands

| Command                                   | Purpose                                                                 |
| ----------------------------------------- | ----------------------------------------------------------------------- |
| `npm run dev`                             | Local Vite dev server                                                   |
| `npm run preview`                         | Preview production build                                                |
| `npm run lint` / `npm run lint:fix`       | ESLint                                                                  |
| `npm run format` / `npm run format:check` | Prettier                                                                |
| `npm run deploy`                          | Build + `gh-pages` (manual; CI deploys on `main`)                       |
| `npm run data:check` … `data:promote`     | Offline ranking pipeline — runbook in `models/player-ranking/README.md` |

Node version: `.nvmrc` (used by CI).

## Layout

- **`src/`** — Application only (`tsconfig.json` `include`s `src`). Entry: `App.tsx` → `LeagueDashboard`. Sleeper: `src/providers/sleeper/`. Draft logic: `src/analysis/`, `src/strategy/`. Modules: `src/modules/draft-room/`, `locker-room/`, `film-room/`.
- **`models/`** — Offline Node scripts and tests; not part of the Vite bundle.
- **`data/raw/`**, **`data/model/`** — Gitignored vendor + derived JSON; never commit.
- **`src/data/generated/`** — Tracked TS stubs/exports promoted from the model (see GitHub issues #34 / #35).
- **`.cursor/rules/`** — Extra agent constraints (workflow, CSS, Sleeper shapes, draft scoring).

## How the pieces connect

1. **Live app:** Sleeper API → normalizers → domain types → modules. Default leagues: `src/config/fantasyConfig.ts`.
2. **Rankings (offline):** FantasyPros CSVs → `models/ingest/fantasypros/` → `data:import` / `scores` / `correlations` / `weights` / `projections` → JSON under `data/model/` → (manual) promote to `src/data/generated/*.ts` → `src/data/defaultInputs.ts` → Draft Room / value scoring.

## Conventions

- Track work in **GitHub issues**; close only when implementation and validation are known (see `.cursor/rules/project-workflow.mdc`).
- **Plain CSS** — shared tokens in `src/styles.css`; no new UI framework unless an issue changes direction.
- **Sleeper-first** — league/roster/draft shapes follow Sleeper; see `sleeper-data-model.mdc`.
- **Small diffs** — focused changes; don't revert user or local generated work unless asked.
- **Commits** — only when the user asks; don't skip git hooks unless they ask.
- **Tests** — domain/helpers + module smoke tests; see `testing-policy.mdc`.

## Do not touch

- **Secrets:** `.env`, API keys (`FANTASYPROS_API_KEY`, etc.) — never read, print, or commit.
- **Vendor data:** `data/raw/`, `data/model/`, FantasyPros/PFF bulk exports in a public repo.
- **PFF scraping/automation** — prohibited by their terms; use documented proxies in the model README instead.
- **Generated promotion** — don't hand-edit `src/data/generated/` for bulk model output without following the pipeline/issues (#34).

## Graph / orientation

- Refresh: `graphify update .` (writes gitignored `graphify-out/`).
- Detailed ranking runbook: `models/player-ranking/README.md`.
- Ingest contract: `models/ingest/fantasypros/README.md`, `data/README.md`.

Graph code edges are thin until tree-sitter JS/TS parsers are installed for graphify — rely on README + source for module boundaries.
