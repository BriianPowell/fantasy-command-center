import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { defaultMinimizedModules } from './dashboardTypes'
import { LeagueDashboard } from './LeagueDashboard'
import type { DraftState, NormalizedLeagueData } from '../../domain/types'

const shadynastyLeagueId = '1357563614201933824'

function buildLeagueData(
  draftStatus: DraftState['status']
): NormalizedLeagueData {
  return {
    draft: {
      currentPick: 2,
      id: 'draft-1',
      picks: [
        {
          pickNo: 1,
          playerId: 'drafted-rookie',
          rosterId: 'team-1',
          round: 1,
        },
      ],
      rounds: 1,
      status: draftStatus,
      type: 'snake',
    },
    league: {
      id: shadynastyLeagueId,
      name: 'ShaDynasty',
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
          BN: 6,
        },
        scoringType: 'ppr',
        teams: 12,
      },
    },
    players: [
      {
        fullName: 'Starter Player',
        id: 'starter-player',
        positions: ['RB'],
        providerPlayerId: 'starter-player',
        searchRank: 5,
        yearsExperience: 3,
      },
      {
        fullName: 'Drafted Rookie',
        id: 'drafted-rookie',
        positions: ['WR'],
        providerPlayerId: 'drafted-rookie',
        searchRank: 20,
        yearsExperience: 0,
      },
      {
        fullName: 'Available Rookie',
        id: 'available-rookie',
        positions: ['RB'],
        providerPlayerId: 'available-rookie',
        searchRank: 30,
        yearsExperience: 0,
      },
      {
        fullName: 'Veteran Target',
        id: 'veteran-target',
        positions: ['RB'],
        providerPlayerId: 'veteran-target',
        searchRank: 1,
        yearsExperience: 5,
      },
    ],
    rosters: [
      {
        playerIds: ['starter-player'],
        starters: ['starter-player'],
        teamId: 'team-1',
      },
    ],
    teams: [
      {
        id: 'team-1',
        name: 'Configured Team',
        ownerName: 'boog',
        ownerUsername: 'boog',
      },
      {
        id: 'team-2',
        name: 'Other Team',
        ownerName: 'other',
      },
    ],
  }
}

describe('LeagueDashboard', () => {
  it('resolves ShaDynasty completed drafts to dynasty mode with the full player pool', () => {
    render(
      <LeagueDashboard
        data={buildLeagueData('complete')}
        minimizedModules={defaultMinimizedModules}
        onToggleModule={vi.fn()}
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Configured Team' })
    ).toBeInTheDocument()
    expect(screen.getByText('Dynasty')).toBeInTheDocument()
    expect(screen.getByText('Full pool')).toBeInTheDocument()
    expect(screen.getAllByText('Drafted Rookie').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Veteran Target').length).toBeGreaterThan(0)
  })

  it('resolves ShaDynasty active drafts to rookie draft mode with a rookies-only board', () => {
    render(
      <LeagueDashboard
        data={buildLeagueData('drafting')}
        minimizedModules={defaultMinimizedModules}
        onToggleModule={vi.fn()}
      />
    )

    expect(screen.getByText('Rookie draft')).toBeInTheDocument()
    expect(screen.getByText('Rookies')).toBeInTheDocument()
    expect(screen.getAllByText('Available Rookie').length).toBeGreaterThan(0)
    expect(screen.queryByText('Veteran Target')).not.toBeInTheDocument()
  })
})
