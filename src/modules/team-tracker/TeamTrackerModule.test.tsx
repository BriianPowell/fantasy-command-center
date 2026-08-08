import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TeamTrackerModule } from './TeamTrackerModule'
import type { NormalizedLeagueData } from '../../domain/types'

const leagueData: NormalizedLeagueData = {
  draft: {
    currentPick: 2,
    id: 'draft-1',
    picks: [
      {
        pickNo: 1,
        playerId: 'player-2',
        rosterId: 'team-1',
        round: 1,
      },
    ],
    rounds: 1,
    status: 'drafting',
    type: 'snake',
  },
  league: {
    id: 'league-1',
    name: 'League One',
    provider: 'sleeper',
    season: '2026',
    settings: {
      rosterSlots: {
        QB: 1,
        RB: 1,
        WR: 0,
        TE: 0,
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
      teams: 12,
    },
  },
  players: [
    {
      fullName: 'Starter Player',
      id: 'player-1',
      positions: ['RB'],
      providerPlayerId: 'player-1',
      searchRank: 1,
    },
    {
      fullName: 'Drafted Player',
      id: 'player-2',
      positions: ['WR'],
      providerPlayerId: 'player-2',
      searchRank: 10,
    },
  ],
  rosters: [
    {
      playerIds: ['player-1'],
      starters: ['player-1'],
      teamId: 'team-1',
    },
  ],
  teams: [
    {
      id: 'team-1',
      name: 'Team One',
      ownerName: 'Owner One',
    },
  ],
}

describe('TeamTrackerModule', () => {
  it('renders team context, value metrics, and roster sections', () => {
    render(
      <TeamTrackerModule
        data={leagueData}
        isMinimized={false}
        onToggleMinimized={vi.fn()}
        roster={leagueData.rosters[0]}
        selectedTeamId="team-1"
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Team One' })
    ).toBeInTheDocument()
    expect(screen.getByText('Team value')).toBeInTheDocument()
    expect(screen.getByText('Starter value')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Starters' })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bench' })).toBeInTheDocument()
    expect(screen.getByText('Starter Player')).toBeInTheDocument()
    expect(screen.getAllByText('Drafted Player').length).toBeGreaterThan(0)
  })
})
