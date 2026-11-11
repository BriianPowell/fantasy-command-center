import { describe, expect, it } from 'vitest'

import {
  indexSleeperPlayers,
  matchSleeperPlayer,
} from './sleeper-players.mjs'

describe('matchSleeperPlayer', () => {
  const players = {
    a1: {
      player_id: '111',
      full_name: 'Jonathan Taylor',
      position: 'RB',
      team: 'IND',
      active: true,
      search_rank: 5,
    },
    a2: {
      player_id: '222',
      full_name: 'Jonathan Taylor',
      position: 'WR',
      team: 'FA',
      active: true,
      search_rank: 900,
    },
  }

  const index = indexSleeperPlayers(players)

  it('matches name and position', () => {
    const match = matchSleeperPlayer(
      { playerName: 'Jonathan Taylor', position: 'RB', team: 'IND' },
      index
    )
    expect(match.status).toBe('matched')
    expect(match.playerId).toBe('111')
  })

  it('uses team to break an ambiguous name/position tie when possible', () => {
    const multi = {
      b1: {
        player_id: '1',
        full_name: 'Chris Jones',
        position: 'DL',
        team: 'KC',
        active: true,
      },
      b2: {
        player_id: '2',
        full_name: 'Chris Jones',
        position: 'DEF',
        team: 'KC',
        active: true,
        search_rank: 1,
      },
    }
    const idx = indexSleeperPlayers(multi)
    const match = matchSleeperPlayer(
      { playerName: 'Chris Jones', position: 'DEF', team: 'KC' },
      idx
    )
    expect(['matched', 'ambiguous']).toContain(match.status)
    expect(match.playerId).toBeDefined()
  })

  it('matches vendor nicknames via the alias table', () => {
    const aliasIndex = indexSleeperPlayers({
      wr: {
        player_id: '5848',
        full_name: 'Marquise Brown',
        position: 'WR',
        team: 'PHI',
        active: true,
        search_rank: 685,
      },
      wr2: {
        player_id: '11068',
        full_name: 'Mitch Tinsley',
        position: 'WR',
        team: 'CIN',
        active: true,
        search_rank: 608,
      },
    })

    expect(
      matchSleeperPlayer(
        { playerName: 'Hollywood Brown', position: 'WR', team: 'KC' },
        aliasIndex
      ).playerId
    ).toBe('5848')

    expect(
      matchSleeperPlayer(
        { playerName: 'Mitchell Tinsley', position: 'WR', team: 'CIN' },
        aliasIndex
      ).playerId
    ).toBe('11068')
  })

  it('matches FantasyPros generational suffixes to bare Sleeper names', () => {
    const withSuffix = indexSleeperPlayers({
      qb: {
        player_id: '4046',
        full_name: 'Patrick Mahomes',
        position: 'QB',
        team: 'KC',
        active: true,
        search_rank: 1,
      },
    })
    const match = matchSleeperPlayer(
      { playerName: 'Patrick Mahomes II', position: 'QB', team: 'KC' },
      withSuffix
    )
    expect(match.status).toBe('matched')
    expect(match.playerId).toBe('4046')
  })

  it('reports unmatched when no Sleeper candidate exists', () => {
    const match = matchSleeperPlayer(
      { playerName: 'Nobody Here', position: 'QB' },
      index
    )
    expect(match.status).toBe('unmatched')
    expect(match.playerId).toBeUndefined()
  })
})
