#!/usr/bin/env node
/**
 * Score every player-season 0-100 within its position and season.
 *
 * Rates, not totals: each metric is per game, so a player who missed five
 * weeks is measured on how he played rather than how long he was healthy.
 * Availability is a real fantasy concern, but mixing it into the
 * production score would confound the correlations this feeds — an O-line
 * can't be blamed for a QB's bye-week appendectomy.
 *
 * Fantasy points per game carries the largest weight because it is the
 * outcome we actually care about; the category metrics beside it keep the
 * score from collapsing into a single league-scoring quirk.
 *
 * `fantasyPoints`/`fantasyPointsPerGame` are adjusted for the league's real
 * scoring format (see `../lib/scoring.mjs`) rather than trusted as-is from
 * FantasyPros' ingested FPTS column, which is fixed to standard (0-PPR)
 * scoring regardless of the league this model is actually informing. The
 * adjustment is additive — it starts from the ingested FPTS and adds only
 * what a rule actually changes (typically reception credit), so
 * `--scoring standard` (the default) passes the trusted ingested value
 * through unchanged. Pass `--scoring half_ppr`, `--scoring ppr`, or
 * `--scoring-settings <path-to-json>` (a raw Sleeper `scoring_settings`
 * object) to score under the league's real rules instead. K and DEF keep
 * their ingested FPTS as-is — kicking/defense scoring varies by league in
 * ways `adjustFantasyPoints` doesn't model.
 *
 * Usage:
 *   npm run data:scores
 *   npm run data:scores -- --seasons 2024,2025
 *   npm run data:scores -- --scoring ppr
 *   npm run data:scores -- --scoring-settings ./my-league-scoring.json
 */

import { readFile } from 'node:fs/promises'
import process from 'node:process'

import {
  loadSeasonData,
  NoSeasonsError,
  parseCliArgs,
} from '../ingest/fantasypros/load.mjs'
import { SourceResolutionError } from '../ingest/fantasypros/source.mjs'
import { writeModelJson } from '../lib/artifacts.mjs'
import {
  computeScoringDelta,
  rulesForScoringType,
  STANDARD_RULES,
} from '../lib/scoring.mjs'
import { percentileScores, ranksDescending, round } from '../lib/stats.mjs'

const SCORES_PATH = 'player_production_scores.json'

// Positions whose scoring `computeFantasyPoints` actually models. K/DEF keep
// their ingested FantasyPros FPTS untouched.
const RECOMPUTABLE_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE'])

/**
 * Adjust `fantasyPoints`/`fantasyPointsPerGame` for `rules` on positions
 * `computeScoringDelta` supports; pass every other record through
 * unchanged. When a record's delta is zero (standard scoring, the default)
 * this returns the original record untouched — including its ingested
 * `fantasyPointsPerGame`, rather than re-deriving it via division, so the
 * default run stays byte-identical to trusting FantasyPros' FPTS directly.
 */
export function applyScoringRules(players, rules) {
  return players.map((record) => {
    if (!RECOMPUTABLE_POSITIONS.has(record.position)) return record

    const delta = computeScoringDelta(record, rules)
    if (delta === 0) return record

    const fantasyPoints = round((record.fantasyPoints ?? 0) + delta, 1)
    const fantasyPointsPerGame =
      record.games > 0 ? round(fantasyPoints / record.games, 1) : 0

    return { ...record, fantasyPoints, fantasyPointsPerGame }
  })
}

/**
 * Resolve the `--scoring`/`--scoring-settings` CLI flags into a rule set and
 * a human-readable label for the output artifact's metadata. Defaults to
 * standard scoring, matching FantasyPros' own FPTS convention.
 */
export async function resolveScoringOption(argv = process.argv.slice(2)) {
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--scoring') {
      const value = argv[i + 1]
      const rules = rulesForScoringType(value)
      if (!rules) {
        throw new Error(
          `Unknown --scoring value '${value}'. Use standard, half_ppr, or ppr, or pass --scoring-settings <path>.`
        )
      }
      return { rules, label: value }
    }
    if (argv[i] === '--scoring-settings') {
      const path = argv[i + 1]
      const rules = JSON.parse(await readFile(path, 'utf8'))
      return { rules, label: `custom (${path})` }
    }
  }
  return { rules: STANDARD_RULES, label: 'standard (default)' }
}

const perGame = (key) => (record) =>
  record.games > 0 ? (record[key] ?? 0) / record.games : 0
const statPerGame = (key) => (record) =>
  record.games > 0 ? (record.stats?.[key] ?? 0) / record.games : 0

/**
 * Per-position metrics and weights. Weights sum to 1 so every score lands
 * on the same 0-100 scale regardless of how many metrics a position uses.
 *
 * These weights are derived, not hand-picked: `build-production-weights.mjs`
 * cross-validates each metric as a predictor of a player's OWN next season
 * (leave-one-transition-out, 2021->22 ... 2024->25) and only credits it with
 * weight if it explains variance FPTS/G alone doesn't already capture — see
 * that file's doc comment for the full method. Regenerate with
 * `npm run data:weights` and compare `production_weight_validation.json`'s
 * `weights` against the constants below before changing either.
 *
 * The real result is a genuine surprise relative to the old hand-picked
 * splits (10-20% per category metric): FPTS/G alone already captures
 * 97-99.5% of a position's next-season predictive power, and no category
 * metric adds more than a couple percentage points on top of it. Target
 * share is the standout exception worth naming — it is the most valuable
 * incremental signal for both WR and TE, consistent with usage being
 * "stickier" than results in standard fantasy-analytics practice.
 */
const POSITION_SPECS = {
  QB: {
    minGames: 6,
    metrics: {
      fantasyPointsPerGame: {
        weight: 0.969,
        value: (r) => r.fantasyPointsPerGame,
      },
      passingYardsPerGame: { weight: 0, value: perGame('passingYards') },
      passingTouchdownsPerGame: {
        weight: 0.004,
        value: perGame('passingTouchdowns'),
      },
      rushingYardsPerGame: { weight: 0.021, value: perGame('rushingYards') },
      rushingTouchdownsPerGame: {
        weight: 0.006,
        value: perGame('rushingTouchdowns'),
      },
    },
  },
  RB: {
    minGames: 6,
    metrics: {
      fantasyPointsPerGame: {
        weight: 0.995,
        value: (r) => r.fantasyPointsPerGame,
      },
      rushingYardsPerGame: { weight: 0.001, value: perGame('rushingYards') },
      touchdownsPerGame: {
        weight: 0,
        value: (r) =>
          r.games > 0
            ? ((r.rushingTouchdowns ?? 0) + (r.receivingTouchdowns ?? 0)) /
              r.games
            : 0,
      },
      receptionsPerGame: { weight: 0.002, value: perGame('receptions') },
      receivingYardsPerGame: {
        weight: 0.002,
        value: perGame('receivingYards'),
      },
    },
  },
  WR: {
    minGames: 6,
    metrics: {
      fantasyPointsPerGame: {
        weight: 0.989,
        value: (r) => r.fantasyPointsPerGame,
      },
      receivingYardsPerGame: { weight: 0, value: perGame('receivingYards') },
      receptionsPerGame: { weight: 0.003, value: perGame('receptions') },
      receivingTouchdownsPerGame: {
        weight: 0,
        value: perGame('receivingTouchdowns'),
      },
      targetShare: { weight: 0.008, value: (r) => r.targetShare ?? 0 },
    },
  },
  K: {
    minGames: 8,
    metrics: {
      fantasyPointsPerGame: {
        weight: 0.6,
        value: (r) => r.fantasyPointsPerGame,
      },
      fieldGoalsMadePerGame: {
        weight: 0.25,
        value: statPerGame('fieldGoalsMade'),
      },
      longFieldGoalsPerGame: {
        weight: 0.15,
        value: statPerGame('fieldGoals50plus'),
      },
    },
  },
  DEF: {
    minGames: 1,
    metrics: {
      fantasyPointsPerGame: {
        weight: 0.55,
        value: (r) => r.fantasyPointsPerGame,
      },
      sacksPerGame: { weight: 0.25, value: statPerGame('sacks') },
      takeawaysPerGame: {
        weight: 0.2,
        value: (r) =>
          r.games > 0
            ? ((r.stats?.interceptions ?? 0) +
                (r.stats?.fumbleRecoveries ?? 0)) /
              r.games
            : 0,
      },
    },
  },
}

// Tight ends catch the same way receivers do, so they share WR's metric
// definitions — but their validated weights differ slightly (see the doc
// comment above POSITION_SPECS), so TE gets its own weight values rather
// than copying WR's spec wholesale.
POSITION_SPECS.TE = {
  minGames: POSITION_SPECS.WR.minGames,
  metrics: {
    fantasyPointsPerGame: {
      ...POSITION_SPECS.WR.metrics.fantasyPointsPerGame,
      weight: 0.99,
    },
    receivingYardsPerGame: {
      ...POSITION_SPECS.WR.metrics.receivingYardsPerGame,
      weight: 0.002,
    },
    receptionsPerGame: {
      ...POSITION_SPECS.WR.metrics.receptionsPerGame,
      weight: 0.001,
    },
    receivingTouchdownsPerGame: {
      ...POSITION_SPECS.WR.metrics.receivingTouchdownsPerGame,
      weight: 0,
    },
    targetShare: {
      ...POSITION_SPECS.WR.metrics.targetShare,
      weight: 0.007,
    },
  },
}

export const SCORED_POSITIONS = Object.keys(POSITION_SPECS)

// Exported so build-production-weights.mjs can validate these exact metric
// definitions against next-season outcomes, rather than a re-implemented
// copy that could silently drift from what actually scores players.
export { POSITION_SPECS }

/**
 * Score one position-season cohort.
 *
 * Players below the games threshold are returned unscored rather than
 * dropped, so callers can see who was excluded and why, but they are kept
 * out of the percentile pool: four hot games shouldn't set the ceiling a
 * full season is measured against.
 */
function scoreCohort(records, spec) {
  const qualified = records.filter((record) => record.games >= spec.minGames)
  const entries = Object.entries(spec.metrics)

  const scoresByMetric = new Map(
    entries.map(([name, metric]) => [
      name,
      percentileScores(qualified.map((record) => metric.value(record))),
    ])
  )

  const totals = qualified.map((_, i) =>
    entries.reduce(
      (total, [name, metric]) =>
        total + scoresByMetric.get(name)[i] * metric.weight,
      0
    )
  )
  const ranks = ranksDescending(totals)

  const scored = qualified.map((record, i) => ({
    playerName: record.playerName,
    team: record.team,
    position: record.position,
    season: record.season,
    games: record.games,
    fantasyPoints: record.fantasyPoints,
    fantasyPointsPerGame: record.fantasyPointsPerGame,
    productionScore: round(totals[i]),
    positionRank: ranks[i],
    qualified: true,
    components: Object.fromEntries(
      entries.map(([name]) => [name, round(scoresByMetric.get(name)[i])])
    ),
  }))

  const unqualified = records
    .filter((record) => record.games < spec.minGames)
    .map((record) => ({
      playerName: record.playerName,
      team: record.team,
      position: record.position,
      season: record.season,
      games: record.games,
      fantasyPoints: record.fantasyPoints,
      fantasyPointsPerGame: record.fantasyPointsPerGame,
      productionScore: null,
      positionRank: null,
      qualified: false,
      note: `fewer than ${spec.minGames} games`,
    }))

  return [...scored, ...unqualified]
}

/** Score every player-season, one position-and-season cohort at a time. */
export function buildProductionScores(players, { scoringRules } = {}) {
  const rated = scoringRules ? applyScoringRules(players, scoringRules) : players

  const cohorts = new Map()
  for (const player of rated) {
    if (!POSITION_SPECS[player.position]) continue
    const key = `${player.season}|${player.position}`
    const cohort = cohorts.get(key) ?? []
    cohort.push(player)
    cohorts.set(key, cohort)
  }

  const scores = []
  for (const [key, records] of cohorts) {
    scores.push(...scoreCohort(records, POSITION_SPECS[key.split('|')[1]]))
  }

  return scores.sort(
    (a, b) =>
      a.season.localeCompare(b.season) ||
      a.position.localeCompare(b.position) ||
      (a.positionRank ?? Infinity) - (b.positionRank ?? Infinity)
  )
}

async function main() {
  const { seasons: requested, source } = parseCliArgs()
  const { rules: scoringRules, label: scoringLabel } =
    await resolveScoringOption()
  const data = await loadSeasonData({ sourceArg: source, seasons: requested })

  console.log(`Source: ${data.root}  (${data.origin})`)
  console.log(`Scoring: ${scoringLabel}\n`)
  for (const error of data.errors) {
    console.error(`  ERROR ${error.season} ${error.id}: ${error.message}`)
  }
  if (data.errorCount > 0) {
    console.error(
      `\n${data.errorCount} validation error(s). Run 'npm run data:check' for detail.`
    )
    process.exitCode = 1
    return
  }

  const scores = buildProductionScores(data.players, { scoringRules })

  for (const season of data.seasons) {
    const leaders = SCORED_POSITIONS.map((position) => {
      const top = scores.find(
        (score) =>
          score.season === season &&
          score.position === position &&
          score.positionRank === 1
      )
      return top
        ? `${position} ${top.playerName} ${top.productionScore}`
        : `${position} —`
    })
    console.log(`${season}: ${leaders.join(', ')}`)
  }

  const qualified = scores.filter((score) => score.qualified).length
  console.log(
    `\nWrote ${await writeModelJson(SCORES_PATH, {
      generatedAt: data.importedAt,
      seasons: data.seasons,
      scoring: scoringLabel,
      weights: Object.fromEntries(
        Object.entries(POSITION_SPECS).map(([position, spec]) => [
          position,
          {
            minGames: spec.minGames,
            metrics: Object.fromEntries(
              Object.entries(spec.metrics).map(([name, metric]) => [
                name,
                metric.weight,
              ])
            ),
          },
        ])
      ),
      scoredCount: qualified,
      unscoredCount: scores.length - qualified,
      scores,
    })}`
  )
  console.log(
    `${qualified} scored, ${scores.length - qualified} below the games threshold`
  )
}

// Guarded so the scoring functions above can be imported by tests.
if (import.meta.main) {
  main().catch((error) => {
    if (
      error instanceof SourceResolutionError ||
      error instanceof NoSeasonsError
    ) {
      console.error(error.message)
      process.exitCode = 1
      return
    }
    console.error(error)
    process.exitCode = 1
  })
}
