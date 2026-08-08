import { describe, expect, it } from 'vitest'
import {
  canFillFlexPosition,
  canFillSuperFlexPosition,
  getPositionClass,
  getPrimaryPosition,
  isPositionConfiguredForLeague,
} from './positionUtils'
import type { LeagueSettings } from './types'

const leagueSettings: LeagueSettings = {
  rosterSlots: {
    QB: 1,
    RB: 0,
    WR: 0,
    TE: 1,
    K: 0,
    DEF: 0,
    DB: 0,
    DL: 0,
    LB: 0,
    IDP: 0,
    FLEX: 1,
    SUPER_FLEX: 0,
    BN: 6,
  },
  scoringType: 'ppr',
  teams: 12,
}

describe('getPrimaryPosition', () => {
  it('returns the first position when present', () => {
    expect(getPrimaryPosition(['WR', 'RB'])).toBe('WR')
  })

  it('returns undefined when no positions are present', () => {
    expect(getPrimaryPosition([])).toBeUndefined()
  })
})

describe('getPositionClass', () => {
  it('formats position names for CSS class suffixes', () => {
    expect(getPositionClass('DEF')).toBe('position-def')
    expect(getPositionClass('RB')).toBe('position-rb')
  })
})

describe('canFillFlexPosition', () => {
  it('allows running backs, wide receivers, and tight ends', () => {
    expect(canFillFlexPosition('RB')).toBe(true)
    expect(canFillFlexPosition('WR')).toBe(true)
    expect(canFillFlexPosition('TE')).toBe(true)
  })

  it('does not allow quarterbacks, kickers, or defenses', () => {
    expect(canFillFlexPosition('QB')).toBe(false)
    expect(canFillFlexPosition('K')).toBe(false)
    expect(canFillFlexPosition('DEF')).toBe(false)
  })
})

describe('canFillSuperFlexPosition', () => {
  it('allows quarterbacks and standard flex positions', () => {
    expect(canFillSuperFlexPosition('QB')).toBe(true)
    expect(canFillSuperFlexPosition('RB')).toBe(true)
    expect(canFillSuperFlexPosition('WR')).toBe(true)
    expect(canFillSuperFlexPosition('TE')).toBe(true)
  })

  it('does not allow kickers or defenses', () => {
    expect(canFillSuperFlexPosition('K')).toBe(false)
    expect(canFillSuperFlexPosition('DEF')).toBe(false)
  })
})

describe('isPositionConfiguredForLeague', () => {
  it('allows positions with direct roster slots', () => {
    expect(isPositionConfiguredForLeague('QB', leagueSettings)).toBe(true)
    expect(isPositionConfiguredForLeague('TE', leagueSettings)).toBe(true)
  })

  it('allows standard flex positions when FLEX slots exist', () => {
    expect(isPositionConfiguredForLeague('RB', leagueSettings)).toBe(true)
    expect(isPositionConfiguredForLeague('WR', leagueSettings)).toBe(true)
  })

  it('excludes positions without direct or flex eligibility', () => {
    expect(isPositionConfiguredForLeague('K', leagueSettings)).toBe(false)
    expect(isPositionConfiguredForLeague('DEF', leagueSettings)).toBe(false)
    expect(isPositionConfiguredForLeague('DB', leagueSettings)).toBe(false)
  })
})
