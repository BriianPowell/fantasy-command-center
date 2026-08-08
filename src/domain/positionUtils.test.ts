import { describe, expect, it } from 'vitest'
import { getPositionClass, getPrimaryPosition } from './positionUtils'

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
