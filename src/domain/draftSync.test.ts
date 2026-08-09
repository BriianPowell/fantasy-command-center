import { describe, expect, it } from 'vitest'
import { mergeLeagueDraftState } from './draftSync'
import type { DraftState, NormalizedLeagueData } from './types'

const currentDraft: DraftState = {
  currentPick: 2,
  id: 'draft-1',
  picks: [
    {
      pickNo: 1,
      playerId: 'player-1',
      round: 1,
    },
  ],
  rounds: 2,
  status: 'drafting',
  type: 'snake',
}

const refreshedDraft: DraftState = {
  ...currentDraft,
  currentPick: 3,
  picks: [
    ...currentDraft.picks,
    {
      pickNo: 2,
      playerId: 'player-2',
      round: 1,
    },
  ],
}

function makeLeague(id: string, draft?: DraftState): NormalizedLeagueData {
  return {
    draft,
    league: {
      id,
      name: id,
      provider: 'sleeper',
      season: '2026',
      settings: {
        rosterSlots: {
          QB: 1,
          RB: 2,
          WR: 2,
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
      },
    },
    players: [],
    rosters: [],
    teams: [],
  }
}

describe('mergeLeagueDraftState', () => {
  it('updates only the matching league draft state', () => {
    const leagues = [
      makeLeague('league-1', currentDraft),
      makeLeague('league-2', currentDraft),
    ]

    const mergedLeagues = mergeLeagueDraftState(
      leagues,
      'league-1',
      refreshedDraft
    )
    const [updatedLeague, untouchedLeague] = mergedLeagues

    expect(updatedLeague?.draft).toEqual(refreshedDraft)
    expect(untouchedLeague?.draft).toEqual(currentDraft)
  })
})
