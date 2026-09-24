/**
 * One read path for every downstream script.
 *
 * Resolves the source, validates each season, and parses the reports that
 * passed. Scripts that need the data (the importer, the team-profile
 * builder) call `loadSeasonData` rather than touching the CSVs themselves,
 * so they all fail on the same conditions and share one manifest.
 */

import process from 'node:process'
import { parseAdvancedRows, parseStatisticsRows } from './parse.mjs'
import { REPORTS } from './schema.mjs'
import { listSeasons, resolveSourceRoot } from './source.mjs'
import { summarizeCheck, validateSeason } from './validate.mjs'

/** Shared flags: `--season`/`--seasons`, `--source`, `--force`. */
export function parseCliArgs(argv = process.argv.slice(2)) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--seasons' || argv[i] === '--season') {
      args.seasons = argv[++i].split(',').map((season) => season.trim())
    } else if (argv[i] === '--source') {
      args.source = argv[++i]
    } else if (argv[i] === '--force') {
      args.force = true
    }
  }
  return args
}

/** Raised when the requested seasons don't exist under the source root. */
export class NoSeasonsError extends Error {}

/**
 * Load and parse every report for the requested seasons.
 *
 * Reports that failed validation are skipped and counted in `errorCount`;
 * the caller decides whether that's fatal. Returns statistics rows as
 * `HistoricalPlayerSeason` records and advanced rows as flat bags keyed by
 * the schema's column names.
 */
export async function loadSeasonData({
  sourceArg,
  seasons: requested,
  importedAt,
} = {}) {
  const stamp = importedAt ?? new Date().toISOString()
  const { root, origin } = await resolveSourceRoot({ sourceArg })

  const available = await listSeasons(root)
  const seasons = requested
    ? available.filter((season) => requested.includes(season))
    : available
  if (seasons.length === 0) {
    throw new NoSeasonsError(
      requested
        ? `None of the requested seasons exist. Available: ${available.join(', ') || '(none)'}`
        : `No <season> subfolders found in ${root}.`
    )
  }

  const players = []
  const advanced = []
  const manifestSeasons = []
  const errors = []

  for (const season of seasons) {
    const result = await validateSeason(root, season)

    for (const check of result.files) {
      if (check.level === 'error') {
        errors.push({ season, id: check.id, message: check.message })
        continue
      }
      // An optional report (advanced-wr/te) that isn't present is a warn,
      // not an error, and carries no rows to parse.
      if (!check.rows) continue

      const report = REPORTS.find((entry) => entry.id === check.id)
      const shared = {
        rows: check.rows,
        columns: check.columns,
        position: report.position,
        season,
      }

      if (report.kind === 'statistics') {
        players.push(
          ...parseStatisticsRows({
            ...shared,
            version: check.version,
            importedAt: stamp,
          })
        )
      } else {
        advanced.push(...parseAdvancedRows(shared))
      }
    }

    manifestSeasons.push({ season, files: result.files.map(summarizeCheck) })
  }

  return {
    root,
    origin,
    available,
    seasons,
    players,
    advanced,
    manifestSeasons,
    errors,
    errorCount: errors.length,
    importedAt: stamp,
  }
}
