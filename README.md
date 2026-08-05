# Fantasy Football Tooling

A hosted fantasy football dashboard for draft-day decisions and week-by-week roster analysis.

## Current Features

- GitHub Pages-ready React + TypeScript + Vite app.
- Multi-league Sleeper dashboards seeded with your league IDs.
- Configured Sleeper usernames so each league focuses on your team.
- Normalized league, roster, player, and draft models.
- Module 1: draft pick helper grouped into expandable position sections, with compact player rows plus your picks and latest picks.
- Module 2: week-by-week player analysis for your selected team.
- Module 3: free agent pickup recommendations from Sleeper context and strategy scoring.
- Personal strategy scoring for team point engines, depth charts, player contribution, and rising usage.
- Aceternity-inspired glass, gradient, glow, and spotlight-style dashboard elements.
- Yahoo Sports provider path documented for a future OAuth backend.

## Getting Started

Install dependencies once Node/npm are available:

```sh
npm install
npm run dev
```

Build for GitHub Pages:

```sh
npm run build
```

Deploy to GitHub Pages:

```sh
npm run deploy
```

## League Dashboards

The app reads its default league setup from `src/config/fantasyConfig.ts`:

```ts
export const fantasyConfig = {
  season: "2026",
  sleeperLeagueIds: ["1389723007303307266", "1357563614201933824", "1312240875861979136"],
  sleeperUsernames: ["boog", "BooooooooG"]
} as const;
```

Configured leagues auto-load when the site opens. The main layout is a dashboard shell with top-bar tabs for each league and a read-only week badge. League, roster, and draft data render first; the larger Sleeper player pool fills in afterward for draft and free agent recommendations. Each selected league dashboard has three main modules: draft helper by position, weekly analysis for your team, and free agent pickup recommendations. When one of the configured usernames owns a team in a league, the dashboard narrows to that team. Free agent pickup recommendations exclude players already rostered in that league and can rank players from strategy fit even when no projection feed is connected.

The week badge is calculated by `src/utils/nflWeek.ts`. Before the configured Week 1 kickoff date, the dashboard starts at week `0`; after kickoff it advances one week every seven days.

## Module Structure

- `src/modules/draft/DraftPickHelperModule.tsx`: draft pick helper grouped by position with accordion-style sections.
- `src/modules/weekly/WeeklyTeamAnalysisModule.tsx`: weekly analysis for the selected team roster.
- `src/modules/free-agents/FreeAgentPickupModule.tsx`: free agent pickup recommendations.
- `src/components/dashboard/`: shared UI primitives used across modules.

## UI Direction

The current UI uses an Aceternity-inspired visual style in plain CSS: glass panels, gradient borders, radial glows, dark dashboard surfaces, and hover spotlight cards. A full Aceternity UI migration would add Tailwind CSS plus `motion`, `clsx`, and `tailwind-merge`, then copy selected components into `src/components/ui`.

## Open Source Inspiration

- [Sleeper Draft Assistant](https://github.com/itsreverence/sleeper-draft-assistant): local-first Sleeper draft assistant with deterministic recommendation evidence, roster construction, scarcity, ADP, tiers, and CSV imports.
- [Fantasy Football Analyzer](https://github.com/Krool/FantasyFootballAnalyzer): static-site-friendly draft and league analysis ideas, including draft grades, points-left-on-board, rankings, and live Sleeper sync.
- [Draft Assist App](https://github.com/PreferencePopular821/draftassistapp/): simple browser draft board with CSV rankings, recent picks, manual drafted tracking, and tier breaks.
- [Fantasy Football Manager](https://github.com/kbains09/FantasyManager): VORP-style free agent and trade recommendations that could inspire our pickup scoring.
- [Fantasy Sports Toolkit](https://github.com/michaelfromyeg/fantasy-sports-toolkit): provider-swappable approach for Sleeper/Yahoo data with reusable lineup and waiver logic.

## Yahoo Support

The static app should not store Yahoo OAuth credentials. See `docs/yahoo-backend.md` for the backend contract and frontend adapter path.

## Configurable Strategy Bias

The strategy layer lives in `src/config/personalStrategy.ts`. It is not shown as a dashboard module; it quietly biases draft and free agent scoring so the dashboard stays focused on decisions.

Use it to maintain:

- Which NFL teams generate fantasy points through each position.
- Manual depth charts by team and position.
- Individual player contribution share, opportunity share, red zone share, and usage trend.
- Your weighting preferences for team point engines, depth chart upside, player contribution, and rising usage.

The app also infers a depth chart from Sleeper player metadata when no manual team profile exists. Manual profiles should be added where you have stronger opinions or better data.

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

Draft recommendations and free agent pickups use this config as a personal bias layer. Tune the weights and team profiles over time as you fine tune the application.
