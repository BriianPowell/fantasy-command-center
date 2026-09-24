import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { fileNameFor, getReport, REPORTS } from './schema.mjs'
import { checkReportFile, summarizeCheck, validateSeason } from './validate.mjs'

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

/** Write a report file with `rowCount` rows, optionally mangling the header. */
async function writeReport(root, report, { rowCount, header } = {}) {
  const headerCells = header ?? report.versions[0].header
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

describe('checkReportFile', () => {
  let root

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'fcc-ingest-'))
    await mkdir(path.join(root, SEASON), { recursive: true })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('accepts a well-formed file', async () => {
    const report = getReport('statistics-dst')
    await writeReport(root, report, { rowCount: 32 })

    const check = await checkReportFile(root, SEASON, report)

    expect(check).toMatchObject({
      status: 'ok',
      level: 'ok',
      version: 'v1',
      rowCount: 32,
    })
    expect(check.rows).toHaveLength(33)
  })

  it('reports a missing required file as an error', async () => {
    const check = await checkReportFile(
      root,
      SEASON,
      getReport('statistics-qb')
    )

    expect(check).toMatchObject({ status: 'missing', level: 'error' })
  })

  it('reports a missing optional file as a warning', async () => {
    const check = await checkReportFile(root, SEASON, getReport('advanced-wr'))

    expect(check).toMatchObject({ status: 'missing', level: 'warn' })
  })

  it('rejects an empty file', async () => {
    const report = getReport('statistics-qb')
    await writeFile(path.join(root, SEASON, fileNameFor(report)), '', 'utf8')

    const check = await checkReportFile(root, SEASON, report)

    expect(check).toMatchObject({ status: 'empty', level: 'error' })
  })

  it('fails loudly when a column is inserted upstream', async () => {
    const report = getReport('statistics-qb')
    const header = [...report.versions[0].header]
    header.splice(5, 0, 'SURPRISE')
    await writeReport(root, report, { header })

    const check = await checkReportFile(root, SEASON, report)

    expect(check).toMatchObject({ status: 'header-drift', level: 'error' })
    expect(check.message).toContain('column 5')
  })

  it('warns when the row count falls outside the expected range', async () => {
    const report = getReport('statistics-dst')
    await writeReport(root, report, { rowCount: 30 })

    const check = await checkReportFile(root, SEASON, report)

    expect(check).toMatchObject({
      status: 'row-count',
      level: 'warn',
      rowCount: 30,
    })
  })
})

describe('validateSeason', () => {
  let root

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'fcc-ingest-'))
    await mkdir(path.join(root, SEASON), { recursive: true })
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('passes when every report is present and well-formed', async () => {
    for (const report of REPORTS) await writeReport(root, report)

    const result = await validateSeason(root, SEASON)

    expect(result.ok).toBe(true)
    expect(result.errorCount).toBe(0)
    expect(result.files).toHaveLength(REPORTS.length)
  })

  it('fails when a required report is missing', async () => {
    for (const report of REPORTS) {
      if (report.id !== 'advanced-qb') await writeReport(root, report)
    }

    const result = await validateSeason(root, SEASON)

    expect(result.ok).toBe(false)
    expect(
      result.files.find((file) => file.id === 'advanced-qb')
    ).toMatchObject({
      status: 'missing',
      level: 'error',
    })
  })

  it('stays ok when only optional reports are missing', async () => {
    for (const report of REPORTS) {
      if (report.required !== false) await writeReport(root, report)
    }

    const result = await validateSeason(root, SEASON)

    expect(result.ok).toBe(true)
    expect(result.warnCount).toBe(2)
  })
})

describe('summarizeCheck', () => {
  it('drops the parsed payload so the result can be serialised', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'fcc-ingest-'))
    await mkdir(path.join(root, SEASON), { recursive: true })
    const report = getReport('statistics-dst')
    await writeReport(root, report, { rowCount: 32 })

    const summary = summarizeCheck(await checkReportFile(root, SEASON, report))

    expect(summary.rows).toBeUndefined()
    expect(summary.columns).toBeUndefined()
    expect(summary.status).toBe('ok')

    await rm(root, { recursive: true, force: true })
  })
})
