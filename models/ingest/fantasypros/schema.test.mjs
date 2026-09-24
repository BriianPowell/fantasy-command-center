import { describe, expect, it } from 'vitest'

import { fileNameFor, getReport, matchHeader, REPORTS } from './schema.mjs'

/** The header a report currently expects, as FantasyPros writes it. */
function currentHeader(id) {
  const report = getReport(id)
  return [...report.versions[report.versions.length - 1].header]
}

describe('fileNameFor', () => {
  it('uses the native Statistics download name', () => {
    expect(fileNameFor(getReport('statistics-qb'))).toBe(
      'FantasyPros_Fantasy_Football_Statistics_QB.csv'
    )
  })

  it('uses the native Advanced download name', () => {
    expect(fileNameFor(getReport('advanced-rb'))).toBe(
      'FantasyPros_Fantasy_Football_Advanced_Stats_Report_RB.csv'
    )
  })

  it('writes team defense as DST in the filename but DEF as the position', () => {
    const report = getReport('statistics-dst')
    expect(fileNameFor(report)).toContain('_DST.csv')
    expect(report.position).toBe('DEF')
  })
})

describe('matchHeader', () => {
  it('matches every report against its own current header', () => {
    for (const report of REPORTS) {
      const result = matchHeader(report, currentHeader(report.id))
      expect(result.matched, `${report.id} should match its own header`).toBe(
        true
      )
    }
  })

  it('detects an inserted column and names the index', () => {
    const header = currentHeader('statistics-qb')
    header.splice(5, 0, 'NEW')

    const result = matchHeader(getReport('statistics-qb'), header)

    expect(result.matched).toBe(false)
    expect(result.actualColumnCount).toBe(result.expectedColumnCount + 1)
    expect(result.detail).toContain('column 5')
  })

  it('detects a removed column', () => {
    const header = currentHeader('statistics-dst')
    header.splice(2, 1)

    const result = matchHeader(getReport('statistics-dst'), header)

    expect(result.matched).toBe(false)
    expect(result.detail).toContain('column 2')
  })

  it('detects a renamed column without a length change', () => {
    const header = currentHeader('advanced-rb')
    header[7] = 'RUSHING YBC/ATT'

    const result = matchHeader(getReport('advanced-rb'), header)

    expect(result.matched).toBe(false)
    expect(result.detail).toContain('RUSHING YBCON/ATT')
  })
})

describe('column contract', () => {
  it('points every named column at a real header slot', () => {
    for (const report of REPORTS) {
      for (const version of report.versions) {
        for (const [name, index] of Object.entries(version.columns)) {
          expect(
            version.header[index],
            `${report.id} ${version.version} column ${name} at index ${index}`
          ).toBeDefined()
        }
      }
    }
  })

  it('reads QB passing and rushing yards from different columns', () => {
    const { columns } = getReport('statistics-qb').versions[0]
    expect(columns.passingYards).not.toBe(columns.rushingYards)
  })
})
