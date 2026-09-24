#!/usr/bin/env node
/**
 * Derive team offensive- and defensive-line profiles from the FantasyPros
 * exports.
 *
 * FantasyPros publishes no line grades, so both scales are proxies built
 * from the advanced player reports:
 *
 *   Pass protection  inverted pressure rate across the team's QBs, where
 *                    pressure = sacks + knockdowns + hurries per dropback.
 *   Run blocking     rushing yards before contact per attempt across the
 *                    team's RBs. Yards *before* contact is the blocking;
 *                    yards after contact belong to the runner, which is
 *                    exactly the split we need to avoid crediting the line
 *                    for a back who breaks tackles.
 *   Pass rush        team sack totals from the DST report.
 *
 * Both are noisy — a QB who holds the ball inflates his line's pressure
 * rate — so each profile carries notes naming its proxy.
 *
 * Usage:
 *   npm run data:profiles
 *   npm run data:profiles -- --seasons 2024,2025
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
  invertedPercentileScores,
  mean,
  percentileScores,
  ranksDescending,
  round,
  sum,
} from '../lib/stats.mjs'

const OLINE_PATH = 'team_oline_profiles.json'
const DLINE_PATH = 'team_dline_profiles.json'

/** Pass protection and run blocking contribute equally to the O-line score. */
const OLINE_WEIGHTS = { passProtection: 0.5, runBlocking: 0.5 }

/** Sacks carry the D-line score; takeaways are a smaller, noisier signal. */
const DLINE_WEIGHTS = { passRush: 0.65, takeaways: 0.35 }

/** Below these volumes a team's proxy is too thin to trust. */
const MIN_DROPBACKS = 200
const MIN_RUSH_ATTEMPTS = 150

const TIERS = [
  { max: 8, name: 'elite' },
  { max: 16, name: 'above average' },
  { max: 24, name: 'below average' },
  { max: Infinity, name: 'poor' },
]

function tierFor(rank) {
  return TIERS.find((tier) => rank <= tier.max).name
}

/**
 * Percentile score computed only from rows meeting `eligible`; ineligible
 * rows score `undefined` rather than being handed a value derived from a
 * near-empty sample.
 *
 * This matters most for pass protection, where "least pressure wins" would
 * otherwise hand a team with zero measured dropbacks a perfect score of
 * 100 — indistinguishable from a genuinely elite line.
 */
function percentileWithMinimum(values, eligible, { invert = false } = {}) {
  const pool = values.filter((_, i) => eligible[i])
  const poolScores = invert
    ? invertedPercentileScores(pool)
    : percentileScores(pool)

  const scores = new Array(values.length).fill(undefined)
  let cursor = 0
  for (let i = 0; i < values.length; i += 1) {
    if (eligible[i]) scores[i] = poolScores[cursor++]
  }
  return scores
}

/**
 * Blend the two component scores, redistributing weight to whichever one
 * is actually available. `undefined` when neither is — a team with no
 * usable data in either report gets no line grade rather than a fabricated
 * one.
 */
function blendAvailable(components, weights) {
  const available = Object.entries(weights).filter(
    ([key]) => components[key] !== undefined
  )
  if (available.length === 0) return undefined

  const totalWeight = sum(available.map(([, weight]) => weight))
  return available.reduce(
    (total, [key, weight]) => total + components[key] * (weight / totalWeight),
    0
  )
}

function groupBy(records, key) {
  const groups = new Map()
  for (const record of records) {
    const value = record[key]
    if (!value) continue
    const group = groups.get(value) ?? []
    group.push(record)
    groups.set(value, group)
  }
  return groups
}

/**
 * Pressure rate per dropback across a team's QBs.
 *
 * Volume-weighted by construction: totals are summed before dividing, so a
 * backup's three-snap cameo can't swing the team's rate.
 */
function passProtectionInputs(qbRows) {
  const attempts = sum(qbRows.map((row) => row.passAttempts ?? 0))
  const sacks = sum(qbRows.map((row) => row.sacksTaken ?? 0))
  const knockdowns = sum(qbRows.map((row) => row.knockdowns ?? 0))
  const hurries = sum(qbRows.map((row) => row.hurries ?? 0))
  const dropbacks = attempts + sacks

  return {
    dropbacks,
    pocketTime: round(
      mean(qbRows.map((row) => row.pocketTime).filter(Boolean)),
      2
    ),
    pressureRate:
      dropbacks === 0
        ? 0
        : round(((sacks + knockdowns + hurries) / dropbacks) * 100, 2),
    sackRate: dropbacks === 0 ? 0 : round((sacks / dropbacks) * 100, 2),
  }
}

function runBlockingInputs(rbRows) {
  const attempts = sum(rbRows.map((row) => row.rushAttempts ?? 0))
  const yardsBeforeContact = sum(
    rbRows.map((row) => row.yardsBeforeContact ?? 0)
  )

  return {
    rushAttempts: attempts,
    yardsAfterContactPerAttempt: round(
      attempts === 0
        ? 0
        : sum(rbRows.map((row) => row.yardsAfterContact ?? 0)) / attempts,
      2
    ),
    yardsBeforeContactPerAttempt: round(
      attempts === 0 ? 0 : yardsBeforeContact / attempts,
      2
    ),
  }
}

export function buildOffensiveLineProfiles({ season, advanced, importedAt }) {
  const qbsByTeam = groupBy(
    advanced.filter((row) => row.season === season && row.position === 'QB'),
    'team'
  )
  const rbsByTeam = groupBy(
    advanced.filter((row) => row.season === season && row.position === 'RB'),
    'team'
  )

  const teams = [...new Set([...qbsByTeam.keys(), ...rbsByTeam.keys()])].sort()
  const rows = teams.map((team) => ({
    team,
    ...passProtectionInputs(qbsByTeam.get(team) ?? []),
    ...runBlockingInputs(rbsByTeam.get(team) ?? []),
  }))

  // Percentile pools exclude teams below the minimum sample so a team with
  // (near-)zero measured dropbacks or attempts can't default into looking
  // like the league's best or worst line.
  const passEligible = rows.map((row) => row.dropbacks >= MIN_DROPBACKS)
  const runEligible = rows.map((row) => row.rushAttempts >= MIN_RUSH_ATTEMPTS)

  const passProtection = percentileWithMinimum(
    rows.map((row) => row.pressureRate),
    passEligible,
    { invert: true }
  )
  const runBlocking = percentileWithMinimum(
    rows.map((row) => row.yardsBeforeContactPerAttempt),
    runEligible
  )
  const normalized = rows.map((_, i) =>
    blendAvailable(
      { passProtection: passProtection[i], runBlocking: runBlocking[i] },
      OLINE_WEIGHTS
    )
  )

  // Only teams with an actual score compete for rank; a team with no
  // usable data in either report gets neither a rank nor a fabricated one.
  const ranks = new Array(rows.length).fill(undefined)
  const rankable = normalized
    .map((score, i) => (score === undefined ? undefined : i))
    .filter((i) => i !== undefined)
  const rankableRanks = ranksDescending(rankable.map((i) => normalized[i]))
  rankable.forEach((i, position) => {
    ranks[i] = rankableRanks[position]
  })

  return rows.map((row, i) => {
    const notes = [
      `pass protection from ${row.pressureRate}% pressure rate on ${row.dropbacks} dropbacks`,
      `run blocking from ${row.yardsBeforeContactPerAttempt} yards before contact per attempt`,
    ]
    if (!passEligible[i]) {
      notes.push(
        `pass protection excluded from ranking: thin sample (${row.dropbacks} dropbacks)`
      )
    }
    if (!runEligible[i]) {
      notes.push(
        `run blocking excluded from ranking: thin sample (${row.rushAttempts} attempts)`
      )
    }

    return {
      team: row.team,
      season,
      normalizedScore:
        normalized[i] === undefined ? undefined : round(normalized[i]),
      passProtectionScore:
        passProtection[i] === undefined ? undefined : round(passProtection[i]),
      runBlockingScore:
        runBlocking[i] === undefined ? undefined : round(runBlocking[i]),
      rank: ranks[i],
      tier: ranks[i] === undefined ? undefined : tierFor(ranks[i]),
      inputs: row,
      notes,
      source: { source: 'fantasypros', importedAt, version: 'oline-proxy/v1' },
    }
  })
}

/**
 * Defensive line profiles.
 *
 * The DST export carries sacks and takeaways but nothing about yards
 * allowed, so `runDefenseScore` stays absent rather than being faked from
 * an unrelated column.
 */
export function buildDefensiveLineProfiles({ season, players, importedAt }) {
  const defenses = players.filter(
    (row) => row.season === season && row.position === 'DEF'
  )

  const rows = defenses.map((defense) => {
    const stats = defense.stats ?? {}
    return {
      team: defense.team,
      sacks: stats.sacks ?? 0,
      takeaways: (stats.interceptions ?? 0) + (stats.fumbleRecoveries ?? 0),
      forcedFumbles: stats.forcedFumbles ?? 0,
    }
  })

  const passRush = percentileScores(rows.map((row) => row.sacks))
  const takeaways = percentileScores(rows.map((row) => row.takeaways))
  const normalized = rows.map(
    (_, i) =>
      passRush[i] * DLINE_WEIGHTS.passRush +
      takeaways[i] * DLINE_WEIGHTS.takeaways
  )
  const ranks = ranksDescending(normalized)

  return rows.map((row, i) => ({
    team: row.team,
    season,
    normalizedScore: round(normalized[i]),
    passRushScore: round(passRush[i]),
    rank: ranks[i],
    tier: tierFor(ranks[i]),
    inputs: row,
    notes: [
      `pass rush from ${row.sacks} sacks, takeaways from ${row.takeaways} interceptions + fumble recoveries`,
      'no run-defense score: the FantasyPros DST export carries no yards-allowed columns',
    ],
    source: { source: 'fantasypros', importedAt, version: 'dline-proxy/v1' },
  }))
}

async function main() {
  const { seasons: requested, source } = parseCliArgs()
  const data = await loadSeasonData({ sourceArg: source, seasons: requested })

  console.log(`Source: ${data.root}  (${data.origin})\n`)
  for (const error of data.errors)
    console.error(`  ERROR ${error.season} ${error.id}: ${error.message}`)
  if (data.errorCount > 0) {
    console.error(
      `\n${data.errorCount} validation error(s). Run 'npm run data:check' for detail.`
    )
    process.exitCode = 1
    return
  }

  const oline = []
  const dline = []
  for (const season of data.seasons) {
    const seasonOline = buildOffensiveLineProfiles({ ...data, season })
    const seasonDline = buildDefensiveLineProfiles({ ...data, season })
    oline.push(...seasonOline)
    dline.push(...seasonDline)

    const best = seasonOline.find((profile) => profile.rank === 1)
    const topRush = seasonDline.find((profile) => profile.rank === 1)
    const bestLabel = best
      ? `${best.team} ${best.normalizedScore}`
      : 'none rankable'
    const topRushLabel = topRush
      ? `${topRush.team} ${topRush.normalizedScore}`
      : 'none rankable'
    console.log(
      `${season}: ${seasonOline.length} O-lines (best ${bestLabel}), ` +
        `${seasonDline.length} D-lines (best ${topRushLabel})`
    )

    if (seasonOline.length !== 32)
      console.warn(`  warn ${season}: expected 32 O-lines`)
    if (seasonDline.length !== 32)
      console.warn(`  warn ${season}: expected 32 D-lines`)
  }

  const meta = { generatedAt: data.importedAt, seasons: data.seasons }
  console.log(
    `\nWrote ${await writeModelJson(OLINE_PATH, { ...meta, weights: OLINE_WEIGHTS, profiles: oline })}`
  )
  console.log(
    `Wrote ${await writeModelJson(DLINE_PATH, { ...meta, weights: DLINE_WEIGHTS, profiles: dline })}`
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
