# Fantasy Command Center

A hosted fantasy football command center for Sleeper draft-day decisions, centered on your teams, roster context, and draft-room recommendations.

## Current Features

- GitHub Pages-ready React + TypeScript + Vite app.
- Multi-league Sleeper dashboards seeded with your league IDs.
- Configured Sleeper usernames so each league focuses on your team.
- Normalized league, roster, player, and draft models.
- Team Tracker module with starters, bench, recent team picks, bye weeks, and value context.
- Sleeper-style Draft Room module with position columns, shared player tiles, top targets, and latest picks.
- Sleeper provider coverage for NFL state, matchups, transactions, traded picks, trending players, drafts, rosters, users, leagues, and player metadata.
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

Configured leagues auto-load when the site opens. The main layout is a command center shell with top-bar tabs for each league and a read-only NFL state badge. League, roster, and draft data load first; the larger Sleeper player pool fills in afterward for draft recommendations. The Sleeper provider also exposes lazy methods for NFL state, matchups, transactions, traded picks, and trending players as later modules need them. Each selected league dashboard currently focuses on the Team Tracker and Draft Room modules. When one of the configured usernames owns a team in a league, the dashboard narrows to that team.

The week badge prefers Sleeper's `state/nfl` endpoint and falls back to `src/utils/nflWeek.ts` if the Sleeper request fails.

## Data Sources

- [Sleeper API documentation](https://docs.sleeper.com/#introduction): primary reference for league, roster, draft, player, trending, transaction, matchup, and NFL state endpoints.

## Module Structure

- `src/modules/draft/DraftPickHelperModule.tsx`: Sleeper-style draft room grouped by position, with best available targets and latest picks.
- `src/modules/team-tracker/TeamTrackerModule.tsx`: selected-team roster tracker with starters, bench, and recent team picks.
- `src/components/dashboard/`: shared UI primitives used across modules.

## UI Direction

The current UI uses plain CSS for glass panels, gradient borders, radial glows, dark dashboard surfaces, and hover spotlight cards.

## Open Source Inspiration

- [Sleeper Draft Assistant](https://github.com/itsreverence/sleeper-draft-assistant): local-first Sleeper draft assistant with deterministic recommendation evidence, roster construction, scarcity, ADP, tiers, and CSV imports.
- [Fantasy Football Analyzer](https://github.com/Krool/FantasyFootballAnalyzer): static-site-friendly draft and league analysis ideas, including draft grades, points-left-on-board, rankings, and live Sleeper sync.
- [Draft Assist App](https://github.com/PreferencePopular821/draftassistapp/): simple browser draft board with CSV rankings, recent picks, manual drafted tracking, and tier breaks.
- [Fantasy Football Manager](https://github.com/kbains09/FantasyManager): VORP-style free agent and trade recommendations that could inspire our pickup scoring.
- [Fantasy Sports Toolkit](https://github.com/michaelfromyeg/fantasy-sports-toolkit): reusable lineup and waiver logic ideas that can be adapted to Sleeper data.

## Draft Analysis Defaults

The strategy analysis lives in `src/strategy/teamOpportunity.ts`. It is not shown as a dashboard module; it quietly biases draft scoring so the command center stays focused on decisions.

It currently uses:

- Inferred depth charts by team and position from Sleeper player metadata.
- Built-in weighting preferences for team point engines, depth chart upside, player contribution, and rising usage.
- Optional team opportunity profiles for team point engines, player contribution share, opportunity share, red zone share, and usage trends when stronger defaults are added.

The app infers depth charts from Sleeper player metadata. Built-in team profiles can be added to `src/strategy/teamOpportunity.ts` where stronger defaults or better data are available.

Example team profile:

```ts
DET: {
  team: "DET",
  label: "Run game creates RB value",
  positions: {
    RB: {
      fantasyPointShare: 0.34,
      opportunityGrade: 0.9,
      depthChart: [
        { playerName: "Jahmyr Gibbs", rank: 1, role: "explosive starter" },
        { playerName: "David Montgomery", rank: 2, role: "goal-line / early-down" }
      ],
      playerContributions: [{ playerName: "Jahmyr Gibbs", fantasyPointShare: 0.22, trend: "rising" }]
    }
  }
}
```

Draft recommendations use these defaults as a context layer. Tune the built-in profiles over time as the player synthesis gets richer.
