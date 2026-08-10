# Fantasy Command Center

A hosted fantasy football command center for Sleeper draft-day decisions, centered on your teams, roster context, live draft flow, and actionable recommendations.

## 1.0 Feature Set

Fantasy Command Center 1.0 focuses on two production-ready dashboard modules: Locker Room and Draft Room.

- GitHub Pages-ready React + TypeScript + Vite app.
- Multi-league Sleeper dashboards seeded with your league IDs.
- Configured Sleeper usernames so each league focuses on your team.
- Normalized league, roster, player, and draft models.
- Locker Room module with starters, bench, recent team picks, bye weeks, team value, weak spots, draft impact, and click-to-open roster player insights.
- Sleeper-style Draft Room module with dynamic position columns, shared player tiles, top targets, latest picks, live draft sync, tier urgency, scarcity, roster fit, and recommendation explanations.
- Sleeper provider coverage for NFL state, drafts, rosters, users, leagues, and player metadata used by the current dashboards.
- Built-in draft analysis defaults for team point engines, depth charts, player contribution, and rising usage.
- Plain-CSS glass, gradient, glow, and spotlight-style dashboard elements.

## Getting Started

Install dependencies once Node/npm are available:

```sh
npm install
npm run dev
```

The npm `allowScripts` entries in `package.json` are limited to optional native dependency helpers currently resolved in `package-lock.json`.

Build locally for GitHub Pages:

```sh
npm run build
```

Deployments are handled by `.github/workflows/deploy-pages.yml` when changes land on `main`. In the repository settings, configure GitHub Pages to use **GitHub Actions** as the source.

## Release Checklist

Before merging changes to `main`:

- Keep work grouped by GitHub issue when possible.
- Run `npm install` after dependency changes and review `package-lock.json` for expected churn.
- Run `npm run lint`, `npm run test`, and `npm run build` locally.
- Confirm active-draft refresh behavior from the Draft Room `Phase` chip if touching live draft sync.
- Confirm the GitHub Pages workflow passes after the merge.

Manual deploys through the `gh-pages` package are still available:

```sh
npm run deploy
```

## League Dashboards

The app reads its default league setup from `src/config/fantasyConfig.ts`:

```ts
export const fantasyConfig = {
  season: '2026',
  sleeperLeagueIds: [
    '1312240875861979136',
    '1357563614201933824',
    '1389723007303307266',
  ],
  sleeperUsernames: ['boog', 'BooooooooG'],
} as const
```

Configured leagues auto-load when the site opens. The main layout is a command center shell with top-bar tabs for each league and a read-only NFL state badge. League, roster, and draft data load first; the larger Sleeper player pool fills in afterward for draft recommendations. Each selected league dashboard focuses on the Locker Room and Draft Room modules. When one of the configured usernames owns a team in a league, the dashboard narrows to that team.

When Sleeper marks a draft as active, the Draft Room can refresh draft metadata and picks without reloading the full player pool. The `Phase` chip can manually check Sleeper for draft status before polling begins; completed drafts render the chip as read-only.

The week badge uses Sleeper's `state/nfl` endpoint. If Sleeper state is unavailable, the dashboard shows `Week TBD`.

## Data Sources

- [Sleeper API documentation](https://docs.sleeper.com/#introduction): primary reference for league, roster, draft, player, trending, transaction, matchup, and NFL state endpoints.
- ESPN NFL scoreboard API: schedule-derived source for team bye weeks, applied to Sleeper players by team.

## Module Structure

- `src/modules/draft/DraftPickHelperModule.tsx`: Sleeper-style draft room grouped by position, with best available targets, latest picks, live sync status, and recommendation details.
- `src/modules/locker-room/LockerRoomModule.tsx`: Locker Room selected-team roster tracker with starters, bench, recent team picks, weak spots, value metrics, and click-to-open player insights.
- `src/components/dashboard/`: shared UI primitives used across modules.

## UI Direction

The current UI uses plain CSS for glass panels, gradient borders, radial glows, dark dashboard surfaces, and hover spotlight cards.

Dashboard styling should stay on the plain-CSS path for now. Shared colors, borders, surfaces, chips, and muted text should use tokens in `src/styles.css`; module CSS should focus on layout and module-specific composition.

## Draft Analysis Defaults

The strategy analysis lives in `src/strategy/teamOpportunity.ts`. It is not shown as a dashboard module; it quietly biases draft scoring so the command center stays focused on decisions.

It currently uses:

- Inferred depth charts by team and position from Sleeper player metadata.
- Built-in weighting preferences for team point engines, depth chart upside, player contribution, and rising usage.

Draft recommendations use these defaults as a context layer alongside player value, roster fit, tier urgency, scarcity, bye risk, and manual notes.
