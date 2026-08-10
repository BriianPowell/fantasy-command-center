import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LockerRoomModule } from './LockerRoomModule'
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
      injuryBodyPart: 'Knee',
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
    {
      fullName: 'Taxi Player',
      id: 'player-3',
      positions: ['WR'],
      providerPlayerId: 'player-3',
      searchRank: 15,
    },
  ],
  rosters: [
    {
      playerIds: ['player-1'],
      starters: ['player-1'],
      taxiPlayerIds: ['player-3'],
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

describe('LockerRoomModule', () => {
  it('renders team context, value metrics, and roster sections', () => {
    render(
      <LockerRoomModule
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
    expect(screen.getByText('Starter edge')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Starters' })
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bench' })).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Taxi Squad' })
    ).toBeInTheDocument()
    expect(screen.getByText('Taxi Player')).toBeInTheDocument()
    const weakSpotsSummary = screen.getByLabelText('Position weak spots')
    expect(within(weakSpotsSummary).getByText('Weak spots')).toBeInTheDocument()
    expect(within(weakSpotsSummary).getByText('QB')).toBeInTheDocument()
    expect(
      within(weakSpotsSummary).getByLabelText('Weak spot gap help')
    ).toHaveAttribute('data-tooltip', expect.stringContaining('Gap compares'))
    expect(
      screen.queryByRole('heading', { name: 'Position Gaps' })
    ).not.toBeInTheDocument()
    expect(screen.getByText('Starter Player')).toBeInTheDocument()
    expect(screen.getAllByText('Drafted Player').length).toBeGreaterThan(0)
    expect(screen.getByText(/Impact/)).toBeInTheDocument()
    expect(screen.getByText(/Draft total/)).toBeInTheDocument()
  })

  it('opens roster player insights when a player row is clicked', () => {
    render(
      <LockerRoomModule
        data={leagueData}
        isMinimized={false}
        onToggleMinimized={vi.fn()}
        roster={leagueData.rosters[0]}
        selectedTeamId="team-1"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Starter Player/ }))

    expect(screen.getByText('Roster Insight')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Starter Player' })
    ).toBeInTheDocument()
    expect(screen.getByText('Starter RB')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(screen.queryByText('Roster Insight')).not.toBeInTheDocument()
  })

  it('shows injury details on roster rows and player insights', () => {
    render(
      <LockerRoomModule
        data={leagueData}
        isMinimized={false}
        onToggleMinimized={vi.fn()}
        roster={leagueData.rosters[0]}
        selectedTeamId="team-1"
      />
    )

    expect(screen.getByText('Injury: Knee')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Starter Player/ }))

    const insightPanel = screen.getByText('Roster Insight').closest('aside')
    expect(insightPanel).toBeInTheDocument()
    expect(
      within(insightPanel as HTMLElement).getByText('Knee')
    ).toBeInTheDocument()
  })

  it('labels taxi squad player insights with the taxi role', () => {
    render(
      <LockerRoomModule
        data={leagueData}
        isMinimized={false}
        onToggleMinimized={vi.fn()}
        roster={leagueData.rosters[0]}
        selectedTeamId="team-1"
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /Taxi Player/ }))

    const insightPanel = screen.getByText('Roster Insight').closest('aside')
    expect(insightPanel).toBeInTheDocument()
    expect(
      within(insightPanel as HTMLElement).getByText('Taxi Squad')
    ).toBeInTheDocument()
  })
})
