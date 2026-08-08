import { describe, expect, it } from 'vitest'
import {
  buildDraftAwareRoster,
  getDraftedPlayerIds,
  getDraftedPlayerIdsForRoster,
  getDraftPicksForRoster,
  getRecentDraftPicks,
  sortDraftPicks,
} from './draftPickUtils'
import type { DraftPick } from './types'

const picks: DraftPick[] = [
  { pickNo: 4, playerId: 'player-4', rosterId: 'team-2', round: 1 },
  { pickNo: 1, playerId: 'player-1', rosterId: 'team-1', round: 1 },
  { pickNo: 3, playerId: 'player-3', rosterId: 'team-1', round: 1 },
  { pickNo: 2, playerId: 'player-2', rosterId: 'team-2', round: 1 },
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

describe('roster draft pick helpers', () => {
  it('filters picks and drafted player ids for a roster', () => {
    expect(
      getDraftPicksForRoster(picks, 'team-1').map((pick) => pick.pickNo)
    ).toEqual([1, 3])
    expect(getDraftedPlayerIdsForRoster(picks, 'team-1')).toEqual([
      'player-1',
      'player-3',
    ])
  })

  it('returns every drafted player id while skipping empty picks', () => {
    expect(getDraftedPlayerIds([...picks, { pickNo: 5, round: 2 }])).toEqual([
      'player-4',
      'player-1',
      'player-3',
      'player-2',
    ])
  })

  it('builds draft-aware rosters without duplicating already rostered players', () => {
    expect(
      buildDraftAwareRoster(
        {
          playerIds: ['player-1', 'player-existing'],
          starters: ['player-existing'],
          teamId: 'team-1',
        },
        picks,
        'team-1'
      )
    ).toEqual({
      playerIds: ['player-1', 'player-existing', 'player-3'],
      starters: ['player-existing'],
      teamId: 'team-1',
    })
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
