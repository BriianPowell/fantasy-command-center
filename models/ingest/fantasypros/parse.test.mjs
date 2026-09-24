import { describe, expect, it } from 'vitest'

import { parseCsvRows } from './csv.mjs'
import { parseAdvancedRows, parseStatisticsRows } from './parse.mjs'
import { getReport } from './schema.mjs'

/** Build rows for a report from its real header plus the given data lines. */
function rowsFor(id, dataLines) {
  const report = getReport(id)
  const header = report.versions[0].header
  const quoted = (line) => line.map((cell) => `"${cell}"`).join(',')
  return parseCsvRows([quoted(header), ...dataLines.map(quoted)].join('\n'))
}

function parseOne(id, dataLine, season = '2025') {
  const report = getReport(id)
  return parseStatisticsRows({
    rows: rowsFor(id, [dataLine]),
    columns: report.versions[0].columns,
    position: report.position,
    season,
    version: 'v1',
    importedAt: '2026-01-01T00:00:00.000Z',
  })
}

describe('parseStatisticsRows', () => {
  it('maps QB passing and rushing lines to distinct fields', () => {
    // Josh Allen's real 2025 line.
    const [record] = parseOne('statistics-qb', [
      '1',
      'Josh Allen (BUF)',
      '319',
      '460',
      '69.3',
      '3668',
      '8.0',
      '25',
      '10',
      '40',
      '112',
      '579',
      '14',
      '3',
      '17',
      '374.5',
      '22.0',
      '99.9%',
    ])

    expect(record).toMatchObject({
      playerName: 'Josh Allen',
      team: 'BUF',
      position: 'QB',
      season: '2025',
      games: 17,
      fantasyPoints: 374.5,
      fantasyPointsPerGame: 22,
      passingYards: 3668,
      passingTouchdowns: 25,
      interceptionsThrown: 10,
      carries: 112,
      rushingYards: 579,
      rushingTouchdowns: 14,
      fumblesLost: 3,
    })
  })

  it('captures RB rushing, receiving, and fumbles lost', () => {
    // Christian McCaffrey's real 2023 line.
    const [record] = parseOne(
      'statistics-rb',
      [
        '1',
        'Christian McCaffrey (SF)',
        '272',
        '1459',
        '5.4',
        '72',
        '9',
        '14',
        '83',
        '67',
        '564',
        '8.4',
        '7',
        '2',
        '16',
        '324.3',
        '20.3',
        '99.8%',
      ],
      '2023'
    )

    expect(record).toMatchObject({
      playerName: 'Christian McCaffrey',
      team: 'SF',
      carries: 272,
      rushingYards: 1459,
      rushingTouchdowns: 14,
      receivingTargets: 83,
      receptions: 67,
      receivingYards: 564,
      receivingTouchdowns: 7,
      fumblesLost: 2,
      fantasyPoints: 324.3,
    })
  })

  it('captures WR receiving, rushing, and target share', () => {
    // Puka Nacua's real 2025 line.
    const [record] = parseOne('statistics-wr', [
      '1',
      'Puka Nacua (LAR)',
      '166',
      '28.6',
      '129',
      '1715',
      '13.3',
      '27',
      '10',
      '10',
      '105',
      '1',
      '1',
      '16',
      '246.0',
      '15.4',
      '99.8%',
    ])

    expect(record).toMatchObject({
      receivingTargets: 166,
      targetShare: 28.6,
      receptions: 129,
      receivingYards: 1715,
      receivingTouchdowns: 10,
      carries: 10,
      rushingYards: 105,
      rushingTouchdowns: 1,
      fumblesLost: 1,
    })
  })

  it('maps team defense onto the DEF position and stashes its counting stats', () => {
    const [record] = parseOne('statistics-dst', [
      '1',
      'Seattle Seahawks (SEA)',
      '47',
      '18',
      '7',
      '7',
      '3',
      '0',
      '4',
      '17',
      '179.0',
      '10.5',
      '96.7%',
    ])

    expect(record.position).toBe('DEF')
    expect(record.playerName).toBe('Seattle Seahawks')
    expect(record.stats).toMatchObject({
      sacks: 47,
      interceptions: 18,
      fumbleRecoveries: 7,
    })
  })

  it('stashes kicking distance buckets rather than widening the record', () => {
    const [record] = parseOne('statistics-k', [
      '1',
      'Jason Myers (SEA)',
      '41',
      '48',
      '85.4',
      '57',
      '0',
      '5',
      '14',
      '13',
      '9',
      '48',
      '48',
      '17',
      '202.0',
      '11.9',
      '97.6%',
    ])

    expect(record.stats).toMatchObject({
      fieldGoalsMade: 41,
      fieldGoals50plus: 9,
      extraPointsMade: 48,
    })
    expect(record.fieldGoalsMade).toBeUndefined()
  })

  it('derives points per game when the column is blank', () => {
    const [record] = parseOne('statistics-qb', [
      '1',
      'Test Guy (BUF)',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '0',
      '4',
      '40.0',
      '',
      '0%',
    ])

    expect(record.fantasyPointsPerGame).toBe(10)
  })

  it('skips rows with no games or fantasy points', () => {
    const report = getReport('statistics-qb')
    const rows = rowsFor('statistics-qb', [
      [
        '1',
        'Real Guy (BUF)',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '17',
        '100.0',
        '5.9',
        '0%',
      ],
      [
        '2',
        'Ghost (FA)',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '0',
        '',
        '',
        '',
        '0%',
      ],
    ])

    const records = parseStatisticsRows({
      rows,
      columns: report.versions[0].columns,
      position: report.position,
      season: '2025',
      version: 'v1',
    })

    expect(records).toHaveLength(1)
    expect(records[0].playerName).toBe('Real Guy')
  })

  it('records the schema version it parsed under', () => {
    const [record] = parseOne('statistics-qb', [
      '1',
      'Josh Allen (BUF)',
      '319',
      '460',
      '69.3',
      '3668',
      '8.0',
      '25',
      '10',
      '40',
      '112',
      '579',
      '14',
      '3',
      '17',
      '374.5',
      '22.0',
      '99.9%',
    ])

    expect(record.source).toMatchObject({
      source: 'fantasypros',
      version: 'statistics-csv/v1',
    })
  })
})

describe('parseAdvancedRows', () => {
  it('reads pressure columns from the unquoted advanced QB layout', () => {
    const report = getReport('advanced-qb')
    const header = report.versions[0].header.join(',')
    const line = [
      '1',
      'Josh Allen   BUF',
      '17',
      '319',
      '460',
      '69.0%',
      '3668',
      '8.0',
      '1972',
      '4.3',
      '141',
      '56',
      '20',
      '10',
      '4',
      '2.5',
      '40',
      '29',
      '30',
      '128',
      '58',
      '18',
      '61',
      '95',
    ].join(',')

    const [record] = parseAdvancedRows({
      rows: parseCsvRows(`${header}\n${line}`),
      columns: report.versions[0].columns,
      position: 'QB',
      season: '2025',
    })

    expect(record).toMatchObject({
      playerName: 'Josh Allen',
      team: 'BUF',
      passAttempts: 460,
      pocketTime: 2.5,
      sacksTaken: 40,
      knockdowns: 29,
      hurries: 30,
    })
  })

  it('reads yards before and after contact from the advanced RB layout', () => {
    const report = getReport('advanced-rb')
    const header = report.versions[0].header.join(',')
    const line = [
      '1',
      'Jonathan Taylor   IND',
      '17',
      '323',
      '1585',
      '4.9',
      '798',
      '2.5',
      '787',
      '2.4',
      '27',
      '28',
      '-54',
      '83',
      '36',
      '9',
      '5',
      '4',
      '3',
      '83',
      '46',
      '55',
      '4',
      '103',
    ].join(',')

    const [record] = parseAdvancedRows({
      rows: parseCsvRows(`${header}\n${line}`),
      columns: report.versions[0].columns,
      position: 'RB',
      season: '2025',
    })

    expect(record).toMatchObject({
      rushAttempts: 323,
      yardsBeforeContact: 798,
      yardsBeforeContactPerAttempt: 2.5,
      yardsAfterContactPerAttempt: 2.4,
    })
  })
})
