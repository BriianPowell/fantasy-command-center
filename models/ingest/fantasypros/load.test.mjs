import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadSeasonData, NoSeasonsError, parseCliArgs } from './load.mjs'
import { fileNameFor, REPORTS } from './schema.mjs'

const SEASON = '2025'

/** A syntactically valid row of zeroes, long enough for the report. */
function fillerRow(report, rank) {
  const width = report.versions[0].header.length
  const cells = Array.from({ length: width }, () => '0')
  cells[0] = String(rank)
  cells[1] = `Player ${rank} (BUF)`
  const { columns } = report.versions[0]
  cells[columns.games] = '17'
  cells[columns.fantasyPoints] = '100.0'
  cells[columns.fantasyPointsPerGame] = '5.9'
  return cells.map((cell) => `"${cell}"`).join(',')
}

/** Write a report file with `rowCount` rows into `<root>/<season>/`. */
async function writeReport(root, report, { rowCount } = {}) {
  const headerCells = report.versions[0].header
  const rows = Array.from({ length: rowCount ?? report.rows.min }, (_, i) =>
    fillerRow(report, i + 1)
  )
  const contents = [
    headerCells.map((cell) => `"${cell}"`).join(','),
    ...rows,
  ].join('\r\n')
  await writeFile(
    path.join(root, SEASON, fileNameFor(report)),
    `${contents}\r\n`,
    'utf8'
  )
}

describe('loadSeasonData', () => {
  let root

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'fcc-load-'))
    await mkdir(path.join(root, SEASON), { recursive: true })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('parses every report when everything is present', async () => {
    for (const report of REPORTS) await writeReport(root, report)

    const data = await loadSeasonData({ sourceArg: root })

    expect(data.errorCount).toBe(0)
    expect(data.seasons).toEqual([SEASON])
    // 6 statistics reports x report.rows.min rows each.
    expect(data.players.length).toBeGreaterThan(0)
    // 4 advanced reports (qb, rb, wr, te) x report.rows.min rows each.
    expect(data.advanced.length).toBeGreaterThan(0)
  })

  it('continues gracefully when an optional report is missing, rather than throwing', async () => {
    for (const report of REPORTS) {
      if (report.id === 'advanced-wr') continue
      await writeReport(root, report)
    }

    // Regression test: before the fix, load.mjs called parseAdvancedRows
    // with an undefined `rows` for a missing-but-optional report and threw
    // "Cannot read properties of undefined (reading 'length')".
    const data = await loadSeasonData({ sourceArg: root })

    expect(data.errorCount).toBe(0)
    const advancedWr = data.advanced.filter(
      (row) => row.season === SEASON && row.position === 'WR'
    )
    expect(advancedWr).toEqual([])
  })

  it('continues gracefully when both optional reports are missing', async () => {
    for (const report of REPORTS) {
      if (report.id === 'advanced-wr' || report.id === 'advanced-te') continue
      await writeReport(root, report)
    }

    const data = await loadSeasonData({ sourceArg: root })

    expect(data.errorCount).toBe(0)
    expect(data.players.length).toBeGreaterThan(0)
  })

  it('records an error and skips a missing required report, without throwing', async () => {
    for (const report of REPORTS) {
      if (report.id === 'advanced-qb') continue
      await writeReport(root, report)
    }

    const data = await loadSeasonData({ sourceArg: root })

    expect(data.errorCount).toBe(1)
    expect(data.errors[0]).toMatchObject({ season: SEASON, id: 'advanced-qb' })
    // The rest of the season still parsed.
    expect(data.players.length).toBeGreaterThan(0)
  })

  it('throws NoSeasonsError when the requested season does not exist', async () => {
    for (const report of REPORTS) await writeReport(root, report)

    await expect(
      loadSeasonData({ sourceArg: root, seasons: ['2099'] })
    ).rejects.toThrow(NoSeasonsError)
  })

  it('narrows to the requested seasons', async () => {
    for (const report of REPORTS) await writeReport(root, report)
    await mkdir(path.join(root, '2024'), { recursive: true })
    for (const report of REPORTS) {
      const headerCells = report.versions[0].header
      const rows = Array.from({ length: report.rows.min }, (_, i) =>
        fillerRow(report, i + 1)
      )
      const contents = [
        headerCells.map((c) => `"${c}"`).join(','),
        ...rows,
      ].join('\r\n')
      await writeFile(
        path.join(root, '2024', fileNameFor(report)),
        `${contents}\r\n`,
        'utf8'
      )
    }

    const data = await loadSeasonData({ sourceArg: root, seasons: ['2025'] })

    expect(data.seasons).toEqual(['2025'])
    expect(data.available).toEqual(['2024', '2025'])
  })

  it('stamps every player record with the same importedAt', async () => {
    for (const report of REPORTS) await writeReport(root, report)

    const data = await loadSeasonData({ sourceArg: root, importedAt: 'FIXED' })

    expect(
      data.players.every((player) => player.source.importedAt === 'FIXED')
    ).toBe(true)
  })
})

describe('parseCliArgs', () => {
  it('parses --season, --source, and --force', () => {
    expect(
      parseCliArgs(['--season', '2024,2025', '--source', '/tmp/x', '--force'])
    ).toEqual({
      seasons: ['2024', '2025'],
      source: '/tmp/x',
      force: true,
    })
  })

  it('accepts --seasons as an alias for --season', () => {
    expect(parseCliArgs(['--seasons', '2025'])).toEqual({ seasons: ['2025'] })
  })

  it('returns an empty object for no flags', () => {
    expect(parseCliArgs([])).toEqual({})
  })
})
