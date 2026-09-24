/**
 * Pre-flight checks for a season's raw exports.
 *
 * Run this before importing. It answers the questions that otherwise only
 * surface as weird model output months later: is every file here, did
 * Nextcloud actually download it, does the header still match the schema,
 * and is the row count in the right ballpark.
 */

import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'

import { parseCsvRows } from './csv.mjs'
import { fileNameFor, matchHeader, REPORTS } from './schema.mjs'

/** @typedef {'ok'|'missing'|'empty'|'unreadable'|'header-drift'|'row-count'} CheckStatus */

function levelFor(status, required) {
  if (status === 'ok') return 'ok'
  if (status === 'row-count') return 'warn'
  if (status === 'missing' && !required) return 'warn'
  return 'error'
}

/**
 * Check one report file.
 *
 * Reading is what forces a Nextcloud placeholder to materialise, so a
 * dataless file is reported rather than silently triggering a download
 * mid-import.
 */
export async function checkReportFile(root, season, report) {
  const fileName = fileNameFor(report)
  const filePath = path.join(root, season, fileName)
  const base = { id: report.id, fileName, filePath, required: report.required }

  let stats
  try {
    stats = await stat(filePath)
  } catch {
    return {
      ...base,
      status: 'missing',
      level: levelFor('missing', report.required),
      message: 'file not found',
    }
  }

  if (stats.size === 0) {
    return {
      ...base,
      status: 'empty',
      level: 'error',
      message: 'file is 0 bytes',
    }
  }

  // macOS File Provider reports the real size for online-only files but
  // allocates no local blocks until something reads them.
  const onlineOnly = stats.blocks === 0

  let rows
  try {
    rows = parseCsvRows(await readFile(filePath, 'utf8'))
  } catch (error) {
    return {
      ...base,
      status: 'unreadable',
      level: 'error',
      message: onlineOnly
        ? `could not read (file is online-only in Nextcloud; open the folder to download it): ${error.message}`
        : `could not read: ${error.message}`,
    }
  }

  if (rows.length === 0) {
    return { ...base, status: 'empty', level: 'error', message: 'no rows' }
  }

  const match = matchHeader(report, rows[0])
  if (!match.matched) {
    return {
      ...base,
      status: 'header-drift',
      level: 'error',
      message:
        `header does not match any known schema version ` +
        `(expected ${match.expectedColumnCount} columns, found ${match.actualColumnCount}) — ${match.detail}`,
    }
  }

  const rowCount = rows.length - 1
  const { min, max } = report.rows
  const outOfRange = rowCount < min || rowCount > max

  // `rows` and `columns` ride along so the importer can reuse this single
  // read instead of opening every file twice.
  return {
    ...base,
    status: outOfRange ? 'row-count' : 'ok',
    level: outOfRange ? 'warn' : 'ok',
    version: match.version,
    rowCount,
    onlineOnly,
    message: outOfRange
      ? `${rowCount} rows is outside the expected ${min}-${max}`
      : `${rowCount} rows, schema ${match.version}`,
    rows,
    columns: match.columns,
  }
}

/** Drop the parsed payload so a check can be logged or serialised. */
export function summarizeCheck(check) {
  const summary = { ...check }
  delete summary.rows
  delete summary.columns
  return summary
}

/**
 * Check every known report for one season.
 *
 * `files` keeps the parsed rows attached; use `summarizeCheck` before
 * printing or writing to disk.
 */
export async function validateSeason(root, season) {
  const files = []
  for (const report of REPORTS) {
    files.push(await checkReportFile(root, season, report))
  }

  return {
    season,
    files,
    errorCount: files.filter((file) => file.level === 'error').length,
    warnCount: files.filter((file) => file.level === 'warn').length,
    ok: files.every((file) => file.level !== 'error'),
  }
}
