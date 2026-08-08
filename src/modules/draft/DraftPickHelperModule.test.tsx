import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DraftPickHelperModule } from './DraftPickHelperModule'
import type {
  DraftRecommendation,
  NormalizedLeagueData,
} from '../../domain/types'

const leagueData: NormalizedLeagueData = {
  draft: {
    currentPick: 2,
    id: 'draft-1',
    picks: [
      {
        pickNo: 1,
        playerId: 'picked-player',
        rosterId: 'team-2',
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
      fullName: 'Picked Player',
      id: 'picked-player',
      positions: ['WR'],
      providerPlayerId: 'picked-player',
      searchRank: 8,
    },
  ],
  rosters: [],
  teams: [],
}

const recommendation: DraftRecommendation = {
  byeRisk: 0,
  insight: 'Fits the current roster build.',
  needScore: 8,
  notes: ['Good value on the board.'],
  player: {
    fullName: 'Recommended Player',
    id: 'recommended-player',
    positions: ['RB'],
    providerPlayerId: 'recommended-player',
    searchRank: 1,
  },
  scarcityScore: 4,
  score: 90,
  strategyScore: 1,
  suggestion: 'Prioritize',
  valueScore: 77,
}

describe('DraftPickHelperModule', () => {
  it('renders the draft room, status chips, best available, and board columns', () => {
    render(
      <DraftPickHelperModule
        boardMode="full_pool"
        data={leagueData}
        draftMode="redraft"
        isMinimized={false}
        onToggleMinimized={vi.fn()}
        recommendations={[recommendation]}
        selectedTeamId="team-1"
      />
    )

    expect(
      screen.getByRole('heading', { name: 'Draft Room' })
    ).toBeInTheDocument()
    expect(screen.getByText('Redraft')).toBeInTheDocument()
    expect(screen.getByText('Full pool')).toBeInTheDocument()
    expect(screen.getByText('Board pool')).toBeInTheDocument()
    expect(screen.getByText('Best Available')).toBeInTheDocument()
    expect(screen.getAllByText('Recommended Player').length).toBeGreaterThan(0)
    expect(screen.getByText('Latest Picks')).toBeInTheDocument()
    expect(screen.getByText('Picked Player')).toBeInTheDocument()
  })
})
