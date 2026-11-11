#!/usr/bin/env node
/**
 * Promote offline model artifacts into tracked TypeScript under
 * `src/data/generated/` for Draft Room / Film Room (issue #34).
 *
 * Reads `data/model/player_production_scores.json` and
 * `data/model/point_projections.json`, matches each player to a Sleeper
 * `player_id`, and writes deterministic `modelRankings.ts`,
 * `modelProjections.ts`, and an empty-or-future `modelNotes.ts`.
 *
 * Sleeper's full player master list is cached under
 * `data/raw/sleeper/players-nfl.json` (gitignored). Pass `--refresh-sleeper`
 * to re-download.
 *
 * Usage:
 *   npm run data:promote
 *   npm run data:promote -- --season 2025
 */

import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

import { MODEL_DIR, writeModelJson } from '../lib/artifacts.mjs'
import { round } from '../lib/stats.mjs'
import { REPO_ROOT } from '../ingest/fantasypros/source.mjs'
import { SCORED_POSITIONS } from './build-production-scores.mjs'
import {
  indexSleeperPlayers,
  matchSleeperPlayer,
  resolveSleeperPlayers,
} from './sleeper-players.mjs'

const GENERATED_DIR = path.join(REPO_ROOT, 'src', 'data', 'generated')
const MATCH_REPORT_PATH = 'app_promote_match_report.json'

const PROJECTION_POSITIONS = new Set(['QB', 'RB', 'WR', 'TE'])

function parseCliArgs(argv = process.argv.slice(2)) {
  const args = { season: undefined, refreshSleeper: false }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--season') {
      args.season = argv[++i]
    } else if (argv[i] === '--refresh-sleeper') {
      args.refreshSleeper = true
    }
  }
  return args
}

async function readModelJson(fileName) {
  const filePath = path.join(MODEL_DIR, fileName)
  return JSON.parse(await readFile(filePath, 'utf8'))
}

function tierForPositionRank(positionRank) {
  if (!positionRank || positionRank < 1) return undefined
  return Math.floor((positionRank - 1) / 12) + 1
}

function projectionByName(projectionsArtifact, position) {
  const rows = projectionsArtifact.positions?.[position]?.projections ?? []
  return new Map(rows.map((row) => [row.playerName, row]))
}

/** True when `a` is the stronger row to keep for the same Sleeper player id. */
function isBetterRankingRow(a, b) {
  if (a.sortPoints !== b.sortPoints) return a.sortPoints > b.sortPoints
  if ((a.productionScore ?? 0) !== (b.productionScore ?? 0)) {
    return (a.productionScore ?? 0) > (b.productionScore ?? 0)
  }
  return (a.positionRank ?? 999) < (b.positionRank ?? 999)
}

/**
 * FantasyPros sometimes lists the same human twice (e.g. RB + WR rows). Sleeper
 * has one id — keep the row with the highest projected-season value signal.
 */
export function dedupeRankingRowsByPlayerId(rows) {
  const best = new Map()
  for (const row of rows) {
    const existing = best.get(row.playerId)
    if (!existing || isBetterRankingRow(row, existing)) {
      best.set(row.playerId, row)
    }
  }
  return [...best.values()]
}

export function dedupeProjectionRowsByPlayerId(rows) {
  const best = new Map()
  for (const row of rows) {
    const existing = best.get(row.playerId)
    if (!existing || row.projectedPoints > existing.projectedPoints) {
      best.set(row.playerId, row)
    }
  }
  return [...best.values()]
}

/** Build ranking + projection rows and a Sleeper match report for one season. */
export function buildAppArtifacts({
  scoresArtifact,
  projectionsArtifact,
  season,
  sleeperIndex,
}) {
  const cohort = scoresArtifact.scores.filter(
    (score) => score.season === season && score.qualified
  )

  const matchReport = []
  const rankingRows = []
  const projectionRows = []

  for (const player of cohort) {
    const match = matchSleeperPlayer(
      {
        playerName: player.playerName,
        position: player.position,
        team: player.team,
      },
      sleeperIndex
    )

    matchReport.push({
      playerName: player.playerName,
      position: player.position,
      team: player.team,
      status: match.status,
      playerId: match.playerId,
      candidates: match.candidates,
    })

    if (!match.playerId) continue

    const projRow = projectionByName(projectionsArtifact, player.position).get(
      player.playerName
    )

    rankingRows.push({
      playerId: match.playerId,
      rank: 0, // filled after global sort
      tier: tierForPositionRank(player.positionRank),
      positionRank: player.positionRank,
      position: player.position,
      productionScore: player.productionScore,
      sortPoints:
        projRow?.projectedPoints ??
        round((player.fantasyPointsPerGame ?? 0) * 17, 1),
    })

    if (PROJECTION_POSITIONS.has(player.position) && projRow) {
      projectionRows.push({
        playerId: match.playerId,
        projectedPoints: projRow.projectedPoints,
        floor: projRow.projectedFloor,
        ceiling: projRow.projectedCeiling,
        source: 'model:point-projections',
      })
    }
  }

  const rankingRowsDeduped = dedupeRankingRowsByPlayerId(rankingRows)
  const projectionRowsDeduped = dedupeProjectionRowsByPlayerId(projectionRows)

  rankingRowsDeduped.sort((a, b) => b.sortPoints - a.sortPoints)
  rankingRowsDeduped.forEach((row, index) => {
    row.rank = index + 1
  })

  const rankings = rankingRowsDeduped.map(
    ({ playerId, rank, tier, positionRank }) => ({
      playerId,
      rank,
      ...(tier ? { tier } : {}),
      ...(positionRank ? { positionRank } : {}),
      source: 'model:production-score',
    })
  )

  return {
    rankings,
    projections: projectionRowsDeduped,
    matchReport,
    dedupedRankingRows: rankingRows.length - rankingRowsDeduped.length,
    dedupedProjectionRows: projectionRows.length - projectionRowsDeduped.length,
  }
}

function serializeRankings(rankings) {
  const lines = rankings.map((ranking) => {
    const fields = [
      `playerId: '${ranking.playerId}'`,
      `rank: ${ranking.rank}`,
      ranking.tier !== undefined ? `tier: ${ranking.tier}` : null,
      ranking.positionRank !== undefined
        ? `positionRank: ${ranking.positionRank}`
        : null,
      `source: '${ranking.source}'`,
    ].filter(Boolean)
    return `  { ${fields.join(', ')} },`
  })

  return `import type { Ranking } from '../../domain/types'

// Generated by models/player-ranking/promote-app-artifacts.mjs — do not edit by hand.
export const modelRankings: Ranking[] = [
${lines.join('\n')}
]
`
}

function serializeProjections(projections) {
  const lines = projections.map((projection) => {
    const fields = [
      `playerId: '${projection.playerId}'`,
      `projectedPoints: ${projection.projectedPoints}`,
      projection.floor !== undefined ? `floor: ${projection.floor}` : null,
      projection.ceiling !== undefined ? `ceiling: ${projection.ceiling}` : null,
      `source: '${projection.source}'`,
    ].filter(Boolean)
    return `  { ${fields.join(', ')} },`
  })

  return `import type { Projection } from '../../domain/types'

// Generated by models/player-ranking/promote-app-artifacts.mjs — do not edit by hand.
export const modelProjections: Projection[] = [
${lines.join('\n')}
]
`
}

const MODEL_NOTES_STUB = `import type { PlayerNote } from '../../domain/types'

// Generated by models/player-ranking/promote-app-artifacts.mjs — do not edit by hand.
export const modelNotes: PlayerNote[] = []
`

async function writeGenerated(fileName, contents) {
  const filePath = path.join(GENERATED_DIR, fileName)
  await writeFile(filePath, contents, 'utf8')
  return path.relative(REPO_ROOT, filePath)
}

async function main() {
  const { season: requestedSeason, refreshSleeper } = parseCliArgs()
  const scoresArtifact = await readModelJson('player_production_scores.json')
  const projectionsArtifact = await readModelJson('point_projections.json')

  const season =
    requestedSeason ?? scoresArtifact.seasons?.[scoresArtifact.seasons.length - 1]
  if (!season) {
    console.error('No season found in player_production_scores.json')
    process.exitCode = 1
    return
  }

  const { players: sleeperPlayers, origin, cachedAt } =
    await resolveSleeperPlayers({ refresh: refreshSleeper })
  const sleeperIndex = indexSleeperPlayers(sleeperPlayers)

  const {
    rankings,
    projections,
    matchReport,
    dedupedRankingRows,
    dedupedProjectionRows,
  } = buildAppArtifacts({
    scoresArtifact,
    projectionsArtifact,
    season,
    sleeperIndex,
  })

  const matched = matchReport.filter((row) => row.status === 'matched').length
  const ambiguous = matchReport.filter((row) => row.status === 'ambiguous').length
  const unmatched = matchReport.filter((row) => row.status === 'unmatched').length

  console.log(`Season: ${season}`)
  console.log(`Sleeper players: ${origin}${cachedAt ? ` (${cachedAt})` : ''}`)
  console.log(
    `Cohort: ${matchReport.length} qualified (${SCORED_POSITIONS.join('/')})`
  )
  console.log(
    `Match: ${matched} matched, ${ambiguous} ambiguous (best guess), ${unmatched} unmatched`
  )
  console.log(
    `Wrote rankings=${rankings.length}, projections=${projections.length}` +
      (dedupedRankingRows + dedupedProjectionRows > 0
        ? ` (deduped ${dedupedRankingRows} ranking + ${dedupedProjectionRows} projection duplicate Sleeper id(s))`
        : '')
  )

  const reportRelative = await writeModelJson(MATCH_REPORT_PATH, {
    generatedAt: scoresArtifact.generatedAt,
    season,
    sleeperOrigin: origin,
    matched,
    ambiguous,
    unmatched,
    entries: matchReport,
  })

  const rankingPath = await writeGenerated(
    'modelRankings.ts',
    serializeRankings(rankings)
  )
  const projectionPath = await writeGenerated(
    'modelProjections.ts',
    serializeProjections(projections)
  )
  const notesPath = await writeGenerated('modelNotes.ts', MODEL_NOTES_STUB)

  console.log(`\n${rankingPath}`)
  console.log(projectionPath)
  console.log(notesPath)
  console.log(`Match report: ${reportRelative}`)

  if (unmatched > 0) {
    console.log(
      `\n${unmatched} vendor player-season(s) did not match Sleeper (stats stay out of src/data/generated/).`
    )
    console.log(
      `Review the match report at ${reportRelative} — gitignored under data/model/, so open it via path or terminal, not only the file tree.`
    )
    console.log(
      `Quick list: node -e "const r=require('./${reportRelative}'); r.entries.filter(e=>e.status!=='matched').forEach(e=>console.log(e.position,e.playerName,e.team))"`
    )
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
