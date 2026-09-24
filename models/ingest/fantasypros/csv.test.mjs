import { describe, expect, it } from 'vitest'

import {
  parseCsvLine,
  parseCsvRows,
  parsePlayerField,
  toNumber,
} from './csv.mjs'

describe('parseCsvLine', () => {
  it('splits quoted fields', () => {
    expect(parseCsvLine('"1","Josh Allen (BUF)","319"')).toEqual([
      '1',
      'Josh Allen (BUF)',
      '319',
    ])
  })

  it('splits unquoted fields', () => {
    expect(parseCsvLine('1,Josh Allen   BUF,17')).toEqual([
      '1',
      'Josh Allen   BUF',
      '17',
    ])
  })

  it('keeps commas inside quotes', () => {
    expect(parseCsvLine('"1","Smith, Jr.","2"')).toEqual([
      '1',
      'Smith, Jr.',
      '2',
    ])
  })

  it('unescapes doubled quotes', () => {
    expect(parseCsvLine('"He said ""hi"""')).toEqual(['He said "hi"'])
  })
})

describe('parseCsvRows', () => {
  it('drops the trailing empty quoted rows FantasyPros appends', () => {
    const contents = '"Rank","Player"\r\n"1","Josh Allen (BUF)"\r\n""\r\n""\r\n'
    expect(parseCsvRows(contents)).toEqual([
      ['Rank', 'Player'],
      ['1', 'Josh Allen (BUF)'],
    ])
  })

  it('strips a leading BOM', () => {
    expect(parseCsvRows('\uFEFF"Rank","Player"\n')[0]).toEqual([
      'Rank',
      'Player',
    ])
  })
})

describe('parsePlayerField', () => {
  it('reads the Statistics "Name (TEAM)" layout', () => {
    expect(parsePlayerField('Josh Allen (BUF)')).toEqual({
      name: 'Josh Allen',
      team: 'BUF',
    })
  })

  it('reads the Advanced "Name   TEAM" layout', () => {
    expect(parsePlayerField('Josh Allen   BUF')).toEqual({
      name: 'Josh Allen',
      team: 'BUF',
    })
  })

  it('handles multi-word team names', () => {
    expect(parsePlayerField('Seattle Seahawks (SEA)')).toEqual({
      name: 'Seattle Seahawks',
      team: 'SEA',
    })
  })

  it('leaves team undefined when absent', () => {
    expect(parsePlayerField('Free Agent Guy')).toEqual({
      name: 'Free Agent Guy',
      team: undefined,
    })
  })
})

describe('toNumber', () => {
  it('parses plain and decimal numbers', () => {
    expect(toNumber('17')).toBe(17)
    expect(toNumber('22.0')).toBe(22)
  })

  it('strips percent signs and thousands separators', () => {
    expect(toNumber('28.6%')).toBe(28.6)
    expect(toNumber('1,585')).toBe(1585)
  })

  it('treats blanks and dashes as absent', () => {
    expect(toNumber('')).toBeUndefined()
    expect(toNumber('-')).toBeUndefined()
    expect(toNumber(undefined)).toBeUndefined()
  })

  it('keeps negative values', () => {
    expect(toNumber('-0.9')).toBe(-0.9)
  })
})
