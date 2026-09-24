#!/usr/bin/env node
/**
 * Validate each production-score component metric as a predictor of NEXT
 * season's fantasy output, and derive weights from that instead of the
 * hand-picked percentages currently hardcoded in `POSITION_SPECS`
 * (build-production-scores.mjs).
 *
 * The production score is meant to inform draft/waiver decisions for a
 * season that hasn't happened yet, so a metric only earns weight if it
 * predicts a player's OWN next season better than his own fantasy points
 * per game already does. That is a deliberately high bar: FPTS/G is by far
 * the single best predictor of future FPTS/G, so every category metric
 * beside it (rushing yards/g, TD rate/g, receptions/g, ...) has to prove it
 * adds real signal on top of that, not just correlate with the season that
 * already happened.
 *
 * Method, mirroring build-correlations.mjs's OLS + leave-one-out gate:
 *   - Join each qualified season-N player to his own season-N+1 record
 *     (matched by name + position; a team change doesn't disqualify him,
 *     since that is real information a predictive model must ride out).
 *   - Fit the baseline: FPTS/G(season N) -> FPTS/G(season N+1).
 *   - For each candidate metric, test whether it explains next season's
 *     FPTS/G BEYOND what the baseline already does — not whether it wins a
 *     1-vs-1 contest against FPTS/G. Concretely: regress the metric against
 *     the baseline's residuals (actual minus FPTS/G-predicted). Because
 *     `POSITION_SPECS` blends FPTS/G with category metrics additively
 *     rather than replacing it, this "does it earn a seat beside FPTS/G"
 *     question is the one that actually matters — and, by the
 *     Frisch-Waugh-Lovell theorem, regressing a residual against a second
 *     predictor recovers the same coefficient a proper multivariate
 *     regression of both predictors together would, using only the
 *     bivariate primitives already in `stats.mjs`. A metric that is mostly
 *     redundant with FPTS/G (e.g. a component that FPTS/G is partly built
 *     from) will explain little of what FPTS/G gets wrong, and correctly
 *     earns little weight even if its own raw correlation with next
 *     season's outcome looks strong in isolation.
 *   - Validate with leave-one-transition-out cross-validation (2021->22
 *     ... 2024->25): does FPTS/G + this metric's residual fit beat FPTS/G
 *     alone out of sample? Gate on the SAME criteria build-correlations.mjs
 *     uses: cvImprovement > 0 and a majority of folds beating baseline.
 *   - A trusted metric's weight is the share of the position's TOTAL
 *     outcome variance its residual fit explains — i.e. its residual r^2
 *     scaled by how much variance the baseline left over
 *     (`r2_resid * (1 - r2_baseline)`) — so it is directly comparable to
 *     the baseline's own share and to build-correlations.mjs's weights.
 *     The anchor (FPTS/G itself) keeps whatever share is left over.
 *
 * This intentionally does NOT add an explicit "sticky vs. volatile" input
 * classification (see issue #38's remaining scope) — the trusted gate
 * already produces that effect empirically: a metric that doesn't predict
 * itself season-over-season (the textbook definition of "volatile", e.g.
 * touchdown rate) will fail to beat the FPTS/G baseline and be zeroed out
 * or down-weighted on its own, with real numbers rather than an assumed
 * sticky/volatile list.
 *
 * Scoring format: this validates against FantasyPros' ingested (standard
 * scoring) FPTS/G, matching build-correlations.mjs's default. A league's
 * real scoring format shifts the absolute FPTS/G scale but not which
 * category metrics predict a player's own future output, so re-deriving
 * weights per scoring format is not expected to matter and isn't wired up.
 *
 * Usage:
 *   npm run data:weights
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
  round,
} from '../lib/stats.mjs'
import { POSITION_SPECS } from './build-production-scores.mjs'

const WEIGHTS_PATH = 'production_weight_validation.json'

// Below this many paired observations a fit is reported but not trusted —
// same threshold and same reasoning as build-correlations.mjs.
const MIN_OBSERVATIONS = 30

const ANCHOR_METRIC = 'fantasyPointsPerGame'
export const VALIDATED_POSITIONS = ['QB', 'RB', 'WR', 'TE']

/** Consecutive season pairs present in the data, e.g. "2021->2022". */
export function buildTransitions(seasons) {
  const sorted = [...new Set(seasons)].sort()
  const transitions = []
  for (let i = 0; i < sorted.length - 1; i += 1) {
    transitions.push(`${sorted[i]}->${sorted[i + 1]}`)
  }
  return transitions
}

/**
 * Join every qualified season-N player at `position` to his own season-N+1
 * record. Matched by name only — a trade or team change is real predictive
 * information, not a reason to drop the pair. Players with no match the
 * following season (retired, injured, fell below the games floor) are
 * simply excluded from that transition's pairs.
 */
export function collectTransitionPairs({ players, position, spec, seasons }) {
  const metricNames = Object.keys(spec.metrics).filter(
    (name) => name !== ANCHOR_METRIC
  )
  const pairs = []

  for (const transition of buildTransitions(seasons)) {
    const [from, to] = transition.split('->')
    const seasonA = players.filter(
      (player) =>
        player.season === from &&
        player.position === position &&
        player.games >= spec.minGames
    )
    const seasonBByName = new Map(
      players
        .filter(
          (player) =>
            player.season === to &&
            player.position === position &&
            player.games >= spec.minGames
        )
        .map((player) => [player.playerName, player])
    )

    for (const playerA of seasonA) {
      const playerB = seasonBByName.get(playerA.playerName)
      if (!playerB) continue

      pairs.push({
        transition,
        playerName: playerA.playerName,
        fppgN: spec.metrics[ANCHOR_METRIC].value(playerA),
        fppgNext: spec.metrics[ANCHOR_METRIC].value(playerB),
        metrics: Object.fromEntries(
          metricNames.map((name) => [name, spec.metrics[name].value(playerA)])
        ),
      })
    }
  }

  return pairs
}

/** Fit FPTS/G(season N) -> FPTS/G(season N+1) on a set of pairs. */
function fitBaseline(pairs) {
  return linearRegression(
    pairs.map((pair) => pair.fppgN),
    pairs.map((pair) => pair.fppgNext)
  )
}

/** Actual minus baseline-predicted, for a set of pairs already fit. */
function residualsOf(pairs, baselineFit) {
  return pairs.map(
    (pair) => pair.fppgNext - (baselineFit.intercept + baselineFit.slope * pair.fppgN)
  )
}

/**
 * Cross-validate one metric's INCREMENTAL value beyond the FPTS/G-only
 * baseline, transition by transition, and gate it the same way
 * build-correlations.mjs gates its relationships.
 */
function analyzeMetric({ pairs, metricName, transitions }) {
  // Pooled fit, for the descriptive r/r2 and the total-variance weight
  // share reported alongside the CV verdict.
  const baselineOverall = fitBaseline(pairs)
  const residualFit = linearRegression(
    pairs.map((pair) => pair.metrics[metricName]),
    residualsOf(pairs, baselineOverall)
  )
  const totalShare = residualFit.r2 * (1 - baselineOverall.r2)

  const folds = transitions
    .map((testTransition) => {
      const train = pairs.filter((pair) => pair.transition !== testTransition)
      const test = pairs.filter((pair) => pair.transition === testTransition)
      if (train.length < MIN_OBSERVATIONS || test.length === 0) return null

      const baseFit = fitBaseline(train)
      const trainResiduals = residualsOf(train, baseFit)
      const residFit = linearRegression(
        train.map((pair) => pair.metrics[metricName]),
        trainResiduals
      )

      const actual = test.map((pair) => pair.fppgNext)
      const basePredicted = test.map(
        (pair) => baseFit.intercept + baseFit.slope * pair.fppgN
      )
      const combinedPredicted = test.map(
        (pair, i) =>
          basePredicted[i] +
          residFit.intercept +
          residFit.slope * pair.metrics[metricName]
      )

      const baselineMae = meanAbsoluteError(actual, basePredicted)
      const combinedMae = meanAbsoluteError(actual, combinedPredicted)
      const improvement =
        baselineMae === 0
          ? 0
          : ((baselineMae - combinedMae) / baselineMae) * 100

      return {
        testTransition,
        n: test.length,
        mae: round(combinedMae, 2),
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
    r: round(residualFit.r, 3),
    r2: round(residualFit.r2, 3),
    totalShare: round(Math.max(totalShare, 0), 3),
    validation: { cvImprovement, folds, foldsBeatingBaseline },
    trusted,
  }
}

/**
 * Split a position's weight between FPTS/G (the anchor) and whichever
 * category metrics actually earned a trusted, validated share of it.
 */
function deriveWeights(anchor, metrics) {
  const weights = { [anchor]: 1 }
  for (const [name, result] of Object.entries(metrics)) {
    const share = result.trusted ? result.totalShare : 0
    weights[name] = round(share, 3)
    weights[anchor] -= share
  }
  weights[anchor] = round(Math.max(weights[anchor], 0), 3)
  return weights
}

/** Validate every position's candidate metrics and derive its weights. */
export function buildProductionWeights({ players, seasons }) {
  const positions = {}

  for (const position of VALIDATED_POSITIONS) {
    const spec = POSITION_SPECS[position]
    const pairs = collectTransitionPairs({ players, position, spec, seasons })
    const transitions = buildTransitions(seasons)
    const metricNames = Object.keys(spec.metrics).filter(
      (name) => name !== ANCHOR_METRIC
    )

    const metrics = {}
    for (const name of metricNames) {
      metrics[name] = analyzeMetric({ pairs, metricName: name, transitions })
    }

    positions[position] = {
      n: pairs.length,
      metrics,
      weights: deriveWeights(ANCHOR_METRIC, metrics),
      currentWeights: Object.fromEntries(
        Object.entries(spec.metrics).map(([name, metric]) => [
          name,
          metric.weight,
        ])
      ),
    }
  }

  return positions
}

function describe(position, result) {
  console.log(`\n${position}  (n=${result.n} season->season pairs)`)
  for (const [name, metric] of Object.entries(result.metrics)) {
    const { cvImprovement, folds, foldsBeatingBaseline } = metric.validation
    console.log(
      [
        `  ${name.padEnd(28)}`,
        `incremental r=${String(metric.r).padStart(6)}`,
        `r²=${String(metric.r2).padStart(5)}`,
        `share=${String(metric.totalShare).padStart(5)}`,
        metric.trusted ? 'trusted' : 'WEAK   ',
        `cv ${cvImprovement > 0 ? '+' : ''}${cvImprovement}% vs FPTS/G baseline`,
        `(${foldsBeatingBaseline}/${folds.length} transitions)`,
      ].join('  ')
    )
  }
  console.log(`  validated weights: ${JSON.stringify(result.weights)}`)
  console.log(`  current weights:   ${JSON.stringify(result.currentWeights)}`)
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

  const positions = buildProductionWeights({
    players: data.players,
    seasons: data.seasons,
  })

  for (const [position, result] of Object.entries(positions)) {
    describe(position, result)
  }

  console.log(
    `\nWrote ${await writeModelJson(WEIGHTS_PATH, {
      generatedAt: data.importedAt,
      seasons: data.seasons,
      minObservations: MIN_OBSERVATIONS,
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
