#!/usr/bin/env node
/**
 * Measure how much each upstream unit moves the players who depend on it,
 * and turn those measurements into model weights.
 *
 * Relationships, all on the shared 0-100 percentile scale:
 *
 *   pass protection -> QB     how much a clean pocket lifts a passer
 *   run blocking    -> QB     the same question asked with a metric the QB
 *                             cannot influence (see the caveat below)
 *   QB              -> WR/TE  how much the passer lifts his receivers
 *   run blocking    -> RB     how much the line lifts a back
 *
 * Caveat, recorded in the artifact too: the pass-protection proxy is built
 * from QB pressure data, so a quick-release passer flatters his own line.
 * That inflates the pass-protection -> QB number. Run blocking is derived
 * entirely from RB carries, so run blocking -> QB is a confound-free lower
 * bound on the line's effect, and the truth sits between the two.
 *
 * Weights come from r^2 — the share of a position's variance the driver
 * explains — with whatever is left over assigned to the player's own
 * production history. Every fit is validated against a held-out season.
 *
 * Usage:
 *   npm run data:correlations
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
  pearson,
  round,
} from '../lib/stats.mjs'
import { buildProductionScores } from './build-production-scores.mjs'
import { buildOffensiveLineProfiles } from './build-team-profiles.mjs'

const CORRELATIONS_PATH = 'correlations.json'

/** Below this many paired observations a fit is reported but not trusted. */
const MIN_OBSERVATIONS = 30

/**
 * A relationship earns a model weight only if it holds up out of sample
 * twice over: it must beat "predict the average" in a majority of the
 * held-out seasons, and gain ground on average across them.
 *
 * Both halves matter. A large in-sample r proves little here — with a
 * thousand observations an r of 0.1 clears any significance test while
 * predicting essentially nothing — and a single lucky fold proves less.
 */
function isTrusted({ cvImprovement, folds, foldsBeatingBaseline }, n) {
  return (
    n >= MIN_OBSERVATIONS &&
    cvImprovement > 0 &&
    foldsBeatingBaseline > folds.length / 2
  )
}

/**
 * The team's lead player at a position for one season: the qualified
 * scorer with the most fantasy points. Committees and mid-season injuries
 * make this imperfect, but the alternative — averaging a starter with his
 * backup — blurs exactly the signal we're measuring.
 */
function leadersByTeam(scores, season, position) {
  const leaders = new Map()
  for (const score of scores) {
    if (
      score.season !== season ||
      score.position !== position ||
      !score.qualified
    )
      continue
    const current = leaders.get(score.team)
    if (!current || score.fantasyPoints > current.fantasyPoints)
      leaders.set(score.team, score)
  }
  return leaders
}

/** Paired (x, y) observations for a relationship, tagged with their season. */
function collectPairs({
  seasons,
  scores,
  olineBySeason,
  driver,
  position,
  lead,
}) {
  const pairs = []

  for (const season of seasons) {
    const oline = olineBySeason.get(season)
    if (!oline) continue

    const targets = lead
      ? [...leadersByTeam(scores, season, position).values()]
      : scores.filter(
          (score) =>
            score.season === season &&
            score.position === position &&
            score.qualified
        )

    for (const target of targets) {
      const x = driver({ season, team: target.team, oline, scores })
      if (x === undefined) continue
      pairs.push({
        season,
        x,
        y: target.productionScore,
        label: target.playerName,
        team: target.team,
      })
    }
  }

  return pairs
}

/**
 * Train on every season but one and score the one left out.
 *
 * The baseline is "predict the average". If the regression can't beat
 * that on data it never saw, the relationship isn't worth a model weight
 * no matter how good its in-sample r looks.
 */
function holdOutSeason(pairs, seasons, testSeason) {
  const train = pairs.filter((pair) => pair.season !== testSeason)
  const test = pairs.filter((pair) => pair.season === testSeason)
  if (train.length < MIN_OBSERVATIONS || test.length === 0) return null

  const fit = linearRegression(
    train.map((p) => p.x),
    train.map((p) => p.y)
  )
  const trainMean = mean(train.map((pair) => pair.y))
  const actual = test.map((pair) => pair.y)

  const mae = meanAbsoluteError(
    actual,
    test.map((pair) => fit.intercept + fit.slope * pair.x)
  )
  const baselineMae = meanAbsoluteError(
    actual,
    test.map(() => trainMean)
  )

  return {
    testSeason,
    trainSeasons: seasons.filter((season) => season !== testSeason),
    n: test.length,
    mae: round(mae, 2),
    baselineMae: round(baselineMae, 2),
    improvement: round(
      baselineMae === 0 ? 0 : ((baselineMae - mae) / baselineMae) * 100,
      1
    ),
  }
}

/**
 * Fit a relationship and validate it.
 *
 * Every season takes a turn as the test set rather than holding out only
 * the most recent one: a single 32-team season is small enough that one
 * unusual year could condemn a real effect or bless a fluke. The weight
 * gate uses the average across those folds.
 */
function analyze(pairs, seasons) {
  const xs = pairs.map((pair) => pair.x)
  const ys = pairs.map((pair) => pair.y)
  const fit = linearRegression(xs, ys)

  const bySeason = seasons.map((season) => {
    const seasonPairs = pairs.filter((pair) => pair.season === season)
    return {
      season,
      n: seasonPairs.length,
      r: round(
        pearson(
          seasonPairs.map((p) => p.x),
          seasonPairs.map((p) => p.y)
        ),
        3
      ),
    }
  })

  const folds = seasons
    .map((season) => holdOutSeason(pairs, seasons, season))
    .filter((fold) => fold !== null)
  const validation = {
    cvImprovement: round(mean(folds.map((fold) => fold.improvement)), 1),
    folds,
    foldsBeatingBaseline: folds.filter((fold) => fold.improvement > 0).length,
    latestSeason:
      folds.find((fold) => fold.testSeason === seasons[seasons.length - 1]) ??
      null,
  }

  return {
    n: pairs.length,
    r: round(fit.r, 3),
    r2: round(fit.r2, 3),
    slope: round(fit.slope, 3),
    intercept: round(fit.intercept, 2),
    bySeason,
    validation,
    trusted: isTrusted(validation, pairs.length),
  }
}

/**
 * Split a position's weight between its drivers and its own history.
 *
 * Each driver claims the share of variance it explains (r^2); the
 * remainder is the player himself. Untrusted relationships claim nothing.
 */
function deriveWeights(drivers) {
  const weights = { historicalProduction: 1 }
  for (const [name, result] of Object.entries(drivers)) {
    const share = result.trusted ? result.r2 : 0
    weights[name] = round(share, 3)
    weights.historicalProduction -= share
  }
  weights.historicalProduction = round(weights.historicalProduction, 3)
  return weights
}

/** Every relationship, plus the position weights they imply. */
export function buildCorrelations({ seasons, players, advanced, importedAt }) {
  const scores = buildProductionScores(players)
  const olineBySeason = new Map(
    seasons.map((season) => [
      season,
      new Map(
        buildOffensiveLineProfiles({ season, advanced, importedAt }).map(
          (profile) => [profile.team, profile]
        )
      ),
    ])
  )

  const fromOline =
    (key) =>
    ({ team, oline }) =>
      oline.get(team)?.[key]
  const fromLeadQb = ({ season, team, scores: all }) =>
    leadersByTeam(all, season, 'QB').get(team)?.productionScore

  const shared = { seasons, scores, olineBySeason }
  const relationships = {
    passProtectionToQb: {
      description: 'team pass-protection score -> lead QB production score',
      caveat:
        'the pass-protection proxy is derived from QB pressure data, so a quick-release passer flatters his own line; treat this as an upper bound',
      ...analyze(
        collectPairs({
          ...shared,
          driver: fromOline('passProtectionScore'),
          position: 'QB',
          lead: true,
        }),
        seasons
      ),
    },
    runBlockingToQb: {
      description: 'team run-blocking score -> lead QB production score',
      caveat:
        'derived entirely from RB carries, so the QB cannot influence it; a confound-free lower bound on the line effect',
      ...analyze(
        collectPairs({
          ...shared,
          driver: fromOline('runBlockingScore'),
          position: 'QB',
          lead: true,
        }),
        seasons
      ),
    },
    olineToQb: {
      description: 'combined O-line score -> lead QB production score',
      ...analyze(
        collectPairs({
          ...shared,
          driver: fromOline('normalizedScore'),
          position: 'QB',
          lead: true,
        }),
        seasons
      ),
    },
    qbToLeadWr: {
      description: 'lead QB production score -> lead WR production score',
      ...analyze(
        collectPairs({
          ...shared,
          driver: fromLeadQb,
          position: 'WR',
          lead: true,
        }),
        seasons
      ),
    },
    qbToWr: {
      description:
        'lead QB production score -> every qualified WR production score',
      caveat:
        'includes WR3s and depth pieces, whose usage is driven more by role than by passer',
      ...analyze(
        collectPairs({ ...shared, driver: fromLeadQb, position: 'WR' }),
        seasons
      ),
    },
    qbToLeadTe: {
      description: 'lead QB production score -> lead TE production score',
      ...analyze(
        collectPairs({
          ...shared,
          driver: fromLeadQb,
          position: 'TE',
          lead: true,
        }),
        seasons
      ),
    },
    qbToTe: {
      description:
        'lead QB production score -> every qualified TE production score',
      ...analyze(
        collectPairs({ ...shared, driver: fromLeadQb, position: 'TE' }),
        seasons
      ),
    },
    runBlockingToRb: {
      description: 'team run-blocking score -> lead RB production score',
      ...analyze(
        collectPairs({
          ...shared,
          driver: fromOline('runBlockingScore'),
          position: 'RB',
          lead: true,
        }),
        seasons
      ),
    },
  }

  // Each position draws its weight from the relationship that actually
  // describes it: the combined line score for a QB, run blocking for a
  // back, and the lead-receiver fit for pass catchers, which isolates the
  // passer's effect from the depth-chart noise in the all-receivers fit.
  const weights = {
    QB: deriveWeights({ offensiveLine: relationships.olineToQb }),
    RB: deriveWeights({ offensiveLine: relationships.runBlockingToRb }),
    WR: deriveWeights({ quarterback: relationships.qbToLeadWr }),
    TE: deriveWeights({ quarterback: relationships.qbToLeadTe }),
  }

  return { relationships, weights }
}

function describe(name, result) {
  const { cvImprovement, folds, foldsBeatingBaseline } = result.validation
  return [
    name.padEnd(20),
    `n=${String(result.n).padStart(4)}`,
    `r=${String(result.r).padStart(6)}`,
    `r²=${String(result.r2).padStart(5)}`,
    result.trusted ? 'trusted' : 'WEAK   ',
    `cv ${cvImprovement > 0 ? '+' : ''}${cvImprovement}% vs baseline`,
    `(${foldsBeatingBaseline}/${folds.length} seasons)`,
  ].join('  ')
}

async function main() {
  const { seasons: requested, source } = parseCliArgs()
  const data = await loadSeasonData({ sourceArg: source, seasons: requested })

  console.log(`Source: ${data.root}  (${data.origin})\n`)
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

  const { relationships, weights } = buildCorrelations(data)

  for (const [name, result] of Object.entries(relationships))
    console.log(describe(name, result))
  console.log('\nDerived weights:')
  for (const [position, positionWeights] of Object.entries(weights)) {
    console.log(`  ${position.padEnd(3)} ${JSON.stringify(positionWeights)}`)
  }

  console.log(
    `\nWrote ${await writeModelJson(CORRELATIONS_PATH, {
      generatedAt: data.importedAt,
      seasons: data.seasons,
      minObservations: MIN_OBSERVATIONS,
      relationships,
      weights,
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
