#!/usr/bin/env node
/**
 * Calibrate each position's production score into a forward point
 * projection: given a player's most recent 0-100 production score, what
 * fantasy points per game should we actually expect from him NEXT season,
 * and what's a reasonable floor/ceiling around that?
 *
 * This deliberately stays a calibration map, not a full opportunity-based
 * projection model (see issue #43). It does not project forward snaps,
 * targets, team volume, or Vegas totals (that's #41's job if it's ever
 * built) — it only answers "historically, when a player at THIS position
 * scored THIS well, how many points per game did he actually score the
 * following season?". That is a deliberate, agreed scope decision: this
 * model stays a validated grading/ranking tool with a point-value bridge
 * on top of it, not a rate x volume x adjustment projection engine.
 *
 * Method, reusing the same primitives and CV pattern as
 * build-production-weights.mjs:
 *   - Join each qualified season-N player at a position to his own
 *     season-N+1 record (matched by name; see collectScoreTransitionPairs).
 *   - Fit ONE pooled linear calibration curve per position:
 *     productionScore(season N) -> fantasyPointsPerGame(season N+1).
 *     A single linear fit, not a binned/quantile curve, is a deliberate
 *     choice: with ~30-150 pairs per position across 4 real transitions,
 *     splitting into deciles would leave too few points per bucket to
 *     trust. A single slope is the simplest model that could work, and it
 *     only ships if the CV gate below shows it actually does.
 *   - Validate with leave-one-transition-out cross-validation against a
 *     naive "predict the position's mean" baseline, gated the same way
 *     build-correlations.mjs and build-production-weights.mjs gate their
 *     relationships (cvImprovement > 0 and a majority of folds beating the
 *     baseline).
 *   - Floor/ceiling bands come from the POOLED out-of-fold residuals
 *     (actual minus each fold's held-out prediction) across all
 *     transitions: the 20th/80th percentile of real historical miss,
 *     added to the point estimate. This is an empirical ~60% interval
 *     grounded in what this exact calibration has actually gotten wrong
 *     before, not an assumed normal distribution.
 *   - The calibrated rate is scaled to a season-total `projectedPoints` by
 *     a flat ASSUMED_GAMES multiplier. This is intentionally NOT an
 *     availability-adjusted total — consistent with build-production-
 *     scores.mjs's "rates, not totals" design, injury/bye-week attrition
 *     is a separate, unmodeled concern (see issue #43's out-of-scope list).
 *
 * Usage:
 *   npm run data:projections
 */

import process from 'node:process'

import {
  loadSeasonData,
  NoSeasonsError,
  parseCliArgs,
} from '../ingest/fantasypros/load.mjs'
import { SourceResolutionError } from '../ingest/fantasypros/source.mjs'
import { writeModelJson } from '../lib/artifacts.mjs'
import {
  linearRegression,
  mean,
  meanAbsoluteError,
  quantile,
  round,
} from '../lib/stats.mjs'
import { buildProductionScores } from './build-production-scores.mjs'
import { buildTransitions, VALIDATED_POSITIONS } from './build-production-weights.mjs'

const PROJECTIONS_PATH = 'point_projections.json'

// Same threshold build-correlations.mjs and build-production-weights.mjs
// use before trusting a fit.
const MIN_OBSERVATIONS = 30

// An empirical ~60% interval: the middle 60% of real historical misses.
const FLOOR_QUANTILE = 0.2
const CEILING_QUANTILE = 0.8

// Flat games assumption for scaling a per-game rate to a season total.
// Not availability-adjusted — see this file's doc comment.
const ASSUMED_GAMES = 17

/**
 * Join every qualified season-N score at `position` to his own season-N+1
 * score. Matched by name only, same reasoning as
 * build-production-weights.mjs's collectTransitionPairs: a team change is
 * real predictive information, not a reason to drop the pair. Both sides
 * must be `qualified` (met the position's games floor) — an injury-
 * shortened outcome season is a different, unmodeled kind of noise than
 * "how good is this player when he plays."
 */
export function collectScoreTransitionPairs({ scores, position, seasons }) {
  const pairs = []

  for (const transition of buildTransitions(seasons)) {
    const [from, to] = transition.split('->')
    const seasonA = scores.filter(
      (score) =>
        score.season === from && score.position === position && score.qualified
    )
    const seasonBByName = new Map(
      scores
        .filter(
          (score) =>
            score.season === to && score.position === position && score.qualified
        )
        .map((score) => [score.playerName, score])
    )

    for (const scoreA of seasonA) {
      const scoreB = seasonBByName.get(scoreA.playerName)
      if (!scoreB) continue

      pairs.push({
        transition,
        playerName: scoreA.playerName,
        productionScore: scoreA.productionScore,
        fppgNext: scoreB.fantasyPointsPerGame,
      })
    }
  }

  return pairs
}

/**
 * Fit and cross-validate one position's calibration curve, and derive its
 * floor/ceiling band from pooled out-of-fold residuals.
 */
function analyzePosition({ scores, position, seasons }) {
  const pairs = collectScoreTransitionPairs({ scores, position, seasons })
  const transitions = buildTransitions(seasons)

  const overallFit = linearRegression(
    pairs.map((pair) => pair.productionScore),
    pairs.map((pair) => pair.fppgNext)
  )

  const outOfFoldResiduals = []
  const folds = transitions
    .map((testTransition) => {
      const train = pairs.filter((pair) => pair.transition !== testTransition)
      const test = pairs.filter((pair) => pair.transition === testTransition)
      if (train.length < MIN_OBSERVATIONS || test.length === 0) return null

      const fit = linearRegression(
        train.map((pair) => pair.productionScore),
        train.map((pair) => pair.fppgNext)
      )
      const naiveBaseline = mean(train.map((pair) => pair.fppgNext))

      const actual = test.map((pair) => pair.fppgNext)
      const predicted = test.map(
        (pair) => fit.intercept + fit.slope * pair.productionScore
      )
      const baselinePredicted = test.map(() => naiveBaseline)

      test.forEach((_, i) =>
        outOfFoldResiduals.push(actual[i] - predicted[i])
      )

      const mae = meanAbsoluteError(actual, predicted)
      const baselineMae = meanAbsoluteError(actual, baselinePredicted)
      const improvement =
        baselineMae === 0 ? 0 : ((baselineMae - mae) / baselineMae) * 100

      return {
        testTransition,
        n: test.length,
        mae: round(mae, 2),
        baselineMae: round(baselineMae, 2),
        improvement: round(improvement, 1),
      }
    })
    .filter((fold) => fold !== null)

  const cvImprovement = round(mean(folds.map((fold) => fold.improvement)), 1)
  const foldsBeatingBaseline = folds.filter(
    (fold) => fold.improvement > 0
  ).length
  const trusted =
    pairs.length >= MIN_OBSERVATIONS &&
    cvImprovement > 0 &&
    foldsBeatingBaseline > folds.length / 2

  return {
    n: pairs.length,
    fit: {
      intercept: round(overallFit.intercept, 3),
      slope: round(overallFit.slope, 3),
      r: round(overallFit.r, 3),
      r2: round(overallFit.r2, 3),
    },
    validation: { cvImprovement, folds, foldsBeatingBaseline },
    floorOffset: round(quantile(outOfFoldResiduals, FLOOR_QUANTILE), 1),
    ceilingOffset: round(quantile(outOfFoldResiduals, CEILING_QUANTILE), 1),
    trusted,
  }
}

/** Apply a position's calibration curve to its most recent qualified cohort. */
function projectLatestSeason({ scores, position, seasons, analysis }) {
  const latestSeason = seasons[seasons.length - 1]
  const candidates = scores.filter(
    (score) =>
      score.season === latestSeason &&
      score.position === position &&
      score.qualified
  )

  return candidates
    .map((player) => {
      const rate = Math.max(
        0,
        round(
          analysis.fit.intercept + analysis.fit.slope * player.productionScore,
          1
        )
      )
      const floorRate = Math.max(0, round(rate + analysis.floorOffset, 1))
      const ceilingRate = Math.max(0, round(rate + analysis.ceilingOffset, 1))

      return {
        playerName: player.playerName,
        team: player.team,
        productionScore: player.productionScore,
        projectedFantasyPointsPerGame: rate,
        projectedFloorPerGame: floorRate,
        projectedCeilingPerGame: ceilingRate,
        projectedPoints: round(rate * ASSUMED_GAMES, 1),
        projectedFloor: round(floorRate * ASSUMED_GAMES, 1),
        projectedCeiling: round(ceilingRate * ASSUMED_GAMES, 1),
      }
    })
    .sort(
      (a, b) => b.projectedFantasyPointsPerGame - a.projectedFantasyPointsPerGame
    )
}

/** Calibrate and project every validated position's most recent cohort. */
export function buildPointProjections({ players, seasons }) {
  const scores = buildProductionScores(players)
  const positions = {}

  for (const position of VALIDATED_POSITIONS) {
    const analysis = analyzePosition({ scores, position, seasons })
    positions[position] = {
      ...analysis,
      projections: projectLatestSeason({ scores, position, seasons, analysis }),
    }
  }

  return positions
}

function describe(position, result) {
  const { fit, validation, trusted, n } = result
  console.log(`\n${position}  (n=${n} season->season pairs)`)
  console.log(
    [
      `  fit: FPTS/G = ${fit.intercept} + ${fit.slope} * score`,
      `r=${fit.r}`,
      `r²=${fit.r2}`,
      trusted ? 'trusted' : 'WEAK',
      `cv ${validation.cvImprovement > 0 ? '+' : ''}${validation.cvImprovement}% vs naive baseline`,
      `(${validation.foldsBeatingBaseline}/${validation.folds.length} transitions)`,
    ].join('  ')
  )
  console.log(
    `  floor/ceiling offset: ${result.floorOffset} / +${result.ceilingOffset} FPTS/G`
  )
  const top = result.projections[0]
  if (top) {
    console.log(
      `  top projection: ${top.playerName} — ${top.projectedFantasyPointsPerGame} FPTS/G ` +
        `(${top.projectedFloorPerGame}-${top.projectedCeilingPerGame}), ${top.projectedPoints} season pts`
    )
  }
}

async function main() {
  const { seasons: requested, source } = parseCliArgs()
  const data = await loadSeasonData({ sourceArg: source, seasons: requested })

  console.log(`Source: ${data.root}  (${data.origin})`)
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

  if (data.seasons.length < 2) {
    console.error(
      'Need at least two seasons to validate a season->season transition.'
    )
    process.exitCode = 1
    return
  }

  const positions = buildPointProjections({
    players: data.players,
    seasons: data.seasons,
  })

  for (const [position, result] of Object.entries(positions)) {
    describe(position, result)
  }

  console.log(
    `\nWrote ${await writeModelJson(PROJECTIONS_PATH, {
      generatedAt: data.importedAt,
      seasons: data.seasons,
      minObservations: MIN_OBSERVATIONS,
      floorQuantile: FLOOR_QUANTILE,
      ceilingQuantile: CEILING_QUANTILE,
      assumedGames: ASSUMED_GAMES,
      positions,
    })}`
  )
}

// Guarded so the analysis functions above can be imported by tests.
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
