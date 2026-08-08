import { describe, expect, it } from 'vitest'
import {
  comparePlayersBySearchRank,
  formatDraftValueScore,
  scoreDraftPlayerValue,
} from './playerValueUtils'
import type { Player } from './types'

const player: Player = {
  id: 'player-1',
  providerPlayerId: 'player-1',
  fullName: 'Player One',
  positions: ['RB'],
}

describe('scoreDraftPlayerValue', () => {
  it('falls back to a baseline score when no ranking or search rank exists', () => {
    expect(scoreDraftPlayerValue(player)).toBe(20)
  })

  it('scores Sleeper search rank when no custom ranking is supplied', () => {
    expect(scoreDraftPlayerValue({ ...player, searchRank: 1 })).toBe(77)
  })

  it('combines ranking, tier, and projection inputs when available', () => {
    expect(
      scoreDraftPlayerValue(
        player,
        {
          playerId: player.id,
          rank: 25,
          source: 'test',
          tier: 2,
        },
        {
          playerId: player.id,
          projectedPoints: 12,
          source: 'test',
        }
      )
    ).toBe(127)
  })
})

describe('formatDraftValueScore', () => {
  it('adds a plus sign only for positive scores', () => {
    expect(formatDraftValueScore(10.4)).toBe('+10')
    expect(formatDraftValueScore(0)).toBe('0')
    expect(formatDraftValueScore(-2.6)).toBe('-3')
  })
})

describe('comparePlayersBySearchRank', () => {
  it('orders lower Sleeper search ranks first and missing ranks last', () => {
    const sortedPlayers = [
      { ...player, id: 'unranked' },
      { ...player, id: 'rank-25', searchRank: 25 },
      { ...player, id: 'rank-3', searchRank: 3 },
    ].sort(comparePlayersBySearchRank)

    expect(sortedPlayers.map((sortedPlayer) => sortedPlayer.id)).toEqual([
      'rank-3',
      'rank-25',
      'unranked',
    ])
  })
})
