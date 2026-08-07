import { describe, expect, it } from 'vitest'
import { getCurrentNflWeek, nflWeekConfig } from './nflWeek'

describe('getCurrentNflWeek', () => {
  it('returns week 0 before Week 1 starts', () => {
    expect(getCurrentNflWeek(new Date('2026-09-09T12:00:00-04:00'))).toBe(0)
  })

  it('returns week 1 once Week 1 starts', () => {
    expect(getCurrentNflWeek(new Date(nflWeekConfig.weekOneStartDate))).toBe(1)
  })
})
