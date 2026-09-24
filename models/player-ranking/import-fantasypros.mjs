#!/usr/bin/env node
/**
 * Normalize the raw FantasyPros CSV exports into historical player-season
 * records for the offline ranking model.
 *
 * Reading, the column contract, and validation live in
 * models/ingest/fantasypros/ — this is just the CLI around them.
 *
 * Reads `<source>/<season>/FantasyPros_*.csv`, where source resolves from
 * `--source`, `FANTASYPROS_DATA_DIR`, or an auto-detected Nextcloud folder
 * (see models/ingest/fantasypros/source.mjs). Writes gitignored artifacts
 * to data/model/ — see data/model/README.md.
 *
 * Usage:
 *   npm run data:import
 *   npm run data:import -- --seasons 2024,2025
 *   npm run data:import -- --force        # import despite validation errors
 */

import process from 'node:process'

import {
  loadSeasonData,
  NoSeasonsError,
  parseCliArgs,
} from '../ingest/fantasypros/load.mjs'
import { SourceResolutionError } from '../ingest/fantasypros/source.mjs'
import { writeModelJson } from '../lib/artifacts.mjs'

const SEASONS_PATH = 'historical_player_seasons.json'
const MANIFEST_PATH = 'ingest_manifest.json'

const POSITION_ORDER = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF']

/** "QB 84, RB 173, ..." for one season's parsed records. */
function describeSeason(players, season) {
  const counts = new Map()
  for (const player of players) {
    if (player.season !== season) continue
    counts.set(player.position, (counts.get(player.position) ?? 0) + 1)
  }
  return POSITION_ORDER.filter((position) => counts.has(position))
    .map((position) => `${position} ${counts.get(position)}`)
    .join(', ')
}

async function main() {
  const { seasons: requested, source, force } = parseCliArgs()
  const data = await loadSeasonData({ sourceArg: source, seasons: requested })

  console.log(`Source: ${data.root}  (${data.origin})\n`)
  for (const error of data.errors) {
    console.error(`  ERROR ${error.season} ${error.id}: ${error.message}`)
  }
  for (const season of data.seasons) {
    console.log(`${season}: ${describeSeason(data.players, season)}`)
  }

  if (data.errorCount > 0 && !force) {
    console.error(
      `\n${data.errorCount} validation error(s). Nothing written. ` +
        `Run 'npm run data:check' for detail, or re-run with --force to import anyway.`
    )
    process.exitCode = 1
    return
  }

  const seasonsPath = await writeModelJson(SEASONS_PATH, {
    generatedAt: data.importedAt,
    seasons: data.seasons,
    recordCount: data.players.length,
    records: data.players,
  })
  const manifestPath = await writeModelJson(MANIFEST_PATH, {
    generatedAt: data.importedAt,
    source: { root: data.root, origin: data.origin },
    seasons: data.manifestSeasons,
  })

  console.log(
    `\nWrote ${data.players.length} player-season records to ${seasonsPath}`
  )
  console.log(`Wrote ingest manifest to ${manifestPath}`)
  if (data.errorCount > 0) {
    console.log(
      `Imported with --force despite ${data.errorCount} validation error(s).`
    )
  }
}

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
