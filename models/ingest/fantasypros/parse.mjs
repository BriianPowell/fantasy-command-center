/**
 * Turn validated CSV rows into records.
 *
 * Callers resolve the schema first (see `matchHeader`) and pass the column
 * map in, so nothing here reads a hardcoded index.
 */

import { parsePlayerField, toNumber } from './csv.mjs'

/**
 * Column keys that map onto named `HistoricalPlayerSeason` fields. Anything
 * else in a report's column map (kicking distance buckets, team-defense
 * takeaways) lands in the record's `stats` bag instead of growing the
 * shared interface for one position's benefit.
 */
const CORE_STAT_KEYS = new Set([
  'carries',
  'fumblesLost',
  'interceptionsThrown',
  'passingTouchdowns',
  'passingYards',
  'receivingTargets',
  'receivingTouchdowns',
  'receivingYards',
  'receptions',
  'rushingTouchdowns',
  'rushingYards',
  'targetShare',
])

const IDENTITY_KEYS = new Set([
  'games',
  'fantasyPoints',
  'fantasyPointsPerGame',
])

/**
 * Statistics export -> `HistoricalPlayerSeason[]`.
 *
 * Rows without a name, games, or fantasy points are skipped: FantasyPros
 * pads these exports with placeholder entries for players who never
 * recorded a snap.
 */
export function parseStatisticsRows({
  rows,
  columns,
  position,
  season,
  version,
  importedAt,
}) {
  const records = []
  const stamp = importedAt ?? new Date().toISOString()

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i]
    if (cells.length < 3 || !cells[1]) continue

    const { name, team } = parsePlayerField(cells[1])
    const games = toNumber(cells[columns.games])
    const fantasyPoints = toNumber(cells[columns.fantasyPoints])
    if (!name || games === undefined || fantasyPoints === undefined) continue

    const fantasyPointsPerGame =
      toNumber(cells[columns.fantasyPointsPerGame]) ??
      (games > 0 ? fantasyPoints / games : 0)

    const record = {
      playerName: name,
      team,
      position,
      season,
      games,
      fantasyPoints,
      fantasyPointsPerGame,
      source: {
        source: 'fantasypros',
        importedAt: stamp,
        version: `statistics-csv/${version}`,
      },
    }

    const extras = {}
    for (const [key, index] of Object.entries(columns)) {
      if (IDENTITY_KEYS.has(key)) continue
      const value = toNumber(cells[index])
      if (value === undefined) continue
      if (CORE_STAT_KEYS.has(key)) record[key] = value
      else extras[key] = value
    }
    if (Object.keys(extras).length > 0) record.stats = extras

    records.push(record)
  }

  return records
}

/**
 * Advanced export -> flat per-player rows.
 *
 * These feed the team-level O-line proxies rather than the player model, so
 * they stay untyped bags of whatever the schema named.
 */
export function parseAdvancedRows({ rows, columns, position, season }) {
  const records = []

  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i]
    if (cells.length < 3 || !cells[1]) continue

    const { name, team } = parsePlayerField(cells[1])
    if (!name) continue

    const record = { playerName: name, team, position, season }
    for (const [key, index] of Object.entries(columns)) {
      const value = toNumber(cells[index])
      if (value !== undefined) record[key] = value
    }

    records.push(record)
  }

  return records
}
