import { describe, expect, it } from 'vitest'
import { getRecentDraftPicks, sortDraftPicks } from './draftPickUtils'
import type { DraftPick } from './types'

const picks: DraftPick[] = [
  { pickNo: 4, rosterId: 'team-2', round: 1 },
  { pickNo: 1, rosterId: 'team-1', round: 1 },
  { pickNo: 3, rosterId: 'team-1', round: 1 },
  { pickNo: 2, rosterId: 'team-2', round: 1 },
]

describe('sortDraftPicks', () => {
  it('sorts picks oldest first by default without mutating the input', () => {
    const sorted = sortDraftPicks(picks)

    expect(sorted.map((pick) => pick.pickNo)).toEqual([1, 2, 3, 4])
    expect(picks.map((pick) => pick.pickNo)).toEqual([4, 1, 3, 2])
  })

  it('sorts picks newest first when requested', () => {
    expect(
      sortDraftPicks(picks, 'newest_first').map((pick) => pick.pickNo)
    ).toEqual([4, 3, 2, 1])
  })
})

describe('getRecentDraftPicks', () => {
  it('returns the latest picks in oldest-first display order by default', () => {
    expect(
      getRecentDraftPicks(picks, { limit: 2 }).map((pick) => pick.pickNo)
    ).toEqual([3, 4])
  })

  it('filters recent picks by roster and supports newest-first display order', () => {
    expect(
      getRecentDraftPicks(picks, {
        limit: 2,
        order: 'newest_first',
        rosterId: 'team-1',
      }).map((pick) => pick.pickNo)
    ).toEqual([3, 1])
  })
})
