import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FilmRoomModule } from './FilmRoomModule'
import type { NormalizedLeagueData } from '../../domain/types'

const baseLeagueData: NormalizedLeagueData = {
  league: {
    id: 'league-1',
    name: 'League One',
    provider: 'sleeper',
    season: '2026',
    settings: {
      rosterSlots: {
        QB: 1,
        RB: 1,
        WR: 1,
        TE: 1,
        K: 0,
        DEF: 0,
        DB: 0,
        DL: 0,
        LB: 0,
        IDP: 0,
        FLEX: 1,
        SUPER_FLEX: 0,
        BN: 4,
      },
      scoringType: 'ppr',
      teams: 2,
    },
  },
  players: [
    {
      fullName: 'Starting Quarterback',
      id: 'starter-qb',
      positions: ['QB'],
      providerPlayerId: 'starter-qb',
      searchRank: 10,
      team: 'BUF',
    },
    {
      fullName: 'Trending Receiver',
      id: 'trending-wr',
      positions: ['WR'],
      providerPlayerId: 'trending-wr',
      searchRank: 40,
      team: 'KC',
    },
  ],
  rosters: [
    {
      playerIds: ['starter-qb'],
      starters: ['starter-qb'],
      teamId: 'team-1',
    },
  ],
  teams: [
    {
      id: 'team-1',
      name: 'Team One',
      ownerName: 'Owner One',
    },
    {
      id: 'team-2',
      name: 'Team Two',
      ownerName: 'Owner Two',
    },
  ],
}

describe('FilmRoomModule', () => {
  it('renders useful empty states when weekly data is unavailable', () => {
    render(
      <FilmRoomModule
        data={baseLeagueData}
        isMinimized={false}
        onToggleMinimized={vi.fn()}
        selectedTeamId="team-1"
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Film Room' })
    ).toBeInTheDocument()
    expect(screen.getByText('Week TBD')).toBeInTheDocument()
    expect(
      screen.getByText('Matchup data has not loaded yet.')
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Start/sit signals will appear once weekly matchup starters are available.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'Trending free-agent targets will appear once weekly data loads.'
      )
    ).toBeInTheDocument()
  })

  it('renders matchup, starter, and free-agent target content', () => {
    render(
      <FilmRoomModule
        data={{
          ...baseLeagueData,
          weekly: {
            matchups: [
              {
                matchupId: 1,
                playerIds: ['starter-qb'],
                playerPoints: { 'starter-qb': 12 },
                points: 88.4,
                starterPoints: [12],
                starters: ['starter-qb'],
                teamId: 'team-1',
              },
              {
                matchupId: 1,
                playerIds: [],
                playerPoints: {},
                points: 77.2,
                starterPoints: [],
                starters: [],
                teamId: 'team-2',
              },
            ],
            transactions: [],
            trendingAdds: [
              { count: 345, playerId: 'trending-wr', type: 'add' },
            ],
            week: 1,
          },
        }}
        isMinimized={false}
        onToggleMinimized={vi.fn()}
        selectedTeamId="team-1"
      />
    )

    expect(screen.getByText('Week 1')).toBeInTheDocument()
    expect(screen.getByText('Team Two')).toBeInTheDocument()
    expect(screen.getByText('Starting Quarterback')).toBeInTheDocument()
    expect(screen.getByText('Trending Receiver')).toBeInTheDocument()
    expect(screen.getByText('345 adds')).toBeInTheDocument()
  })
})
