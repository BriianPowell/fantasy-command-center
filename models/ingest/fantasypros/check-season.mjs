#!/usr/bin/env node
/**
 * Pre-flight check for the raw FantasyPros exports. Run before importing.
 *
 *   npm run data:check
 *   npm run data:check -- --season 2026
 *   npm run data:check -- --source "/path/to/NFL Data"
 *
 * Reports, per season and report file: whether it exists, whether Nextcloud
 * has actually downloaded it, whether the header still matches a known
 * schema version, and whether the row count looks sane. Exits non-zero if
 * anything would break an import.
 */

import process from 'node:process'

import {
  listSeasons,
  resolveSourceRoot,
  SourceResolutionError,
} from './source.mjs'
import { summarizeCheck, validateSeason } from './validate.mjs'

const MARKS = { ok: '  ok  ', warn: ' warn ', error: 'ERROR ' }

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--season')
      args.seasons = argv[++i].split(',').map((s) => s.trim())
    else if (argv[i] === '--seasons')
      args.seasons = argv[++i].split(',').map((s) => s.trim())
    else if (argv[i] === '--source') args.source = argv[++i]
  }
  return args
}

async function main() {
  const { seasons: requested, source } = parseArgs(process.argv.slice(2))

  const { root, origin } = await resolveSourceRoot({ sourceArg: source })
  console.log(`Source: ${root}  (${origin})\n`)

  const available = await listSeasons(root)
  if (available.length === 0) {
    console.error(`No <season> subfolders found in ${root}.`)
    process.exitCode = 1
    return
  }

  const seasons = requested
    ? available.filter((s) => requested.includes(s))
    : available
  if (seasons.length === 0) {
    console.error(
      `None of the requested seasons exist. Available: ${available.join(', ')}`
    )
    process.exitCode = 1
    return
  }

  let totalErrors = 0
  let totalWarnings = 0

  for (const season of seasons) {
    const result = await validateSeason(root, season)
    totalErrors += result.errorCount
    totalWarnings += result.warnCount

    console.log(season)
    for (const file of result.files.map(summarizeCheck)) {
      const optional =
        file.required === false && file.status === 'missing'
          ? ' (optional)'
          : ''
      const online = file.onlineOnly ? ' [online-only until read]' : ''
      console.log(
        `  ${MARKS[file.level]} ${file.id.padEnd(16)} ${file.message}${optional}${online}`
      )
    }
    console.log()
  }

  const parts = [`${seasons.length} season(s) checked`]
  if (totalErrors > 0) parts.push(`${totalErrors} error(s)`)
  if (totalWarnings > 0) parts.push(`${totalWarnings} warning(s)`)
  if (totalErrors === 0 && totalWarnings === 0) parts.push('all clear')
  console.log(parts.join(', '))

  if (totalErrors > 0) process.exitCode = 1
}

main().catch((error) => {
  if (error instanceof SourceResolutionError) {
    console.error(error.message)
    process.exitCode = 1
    return
  }
  console.error(error)
  process.exitCode = 1
})
