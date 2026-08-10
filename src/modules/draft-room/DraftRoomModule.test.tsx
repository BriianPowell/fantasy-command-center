import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DraftRoomModule } from './DraftRoomModule'
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
  injuryRisk: 3,
  needScore: 8,
  notes: ['Good value on the board.'],
  player: {
    fullName: 'Recommended Player',
    id: 'recommended-player',
    injuryStatus: 'Questionable',
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

const kickerRecommendation: DraftRecommendation = {
  ...recommendation,
  player: {
    fullName: 'Kicker Player',
    id: 'kicker-player',
    positions: ['K'],
    providerPlayerId: 'kicker-player',
    searchRank: 2,
  },
}

const defenseRecommendation: DraftRecommendation = {
  ...recommendation,
  player: {
    fullName: 'Defense Player',
    id: 'defense-player',
    positions: ['DEF'],
    providerPlayerId: 'defense-player',
    searchRank: 3,
  },
}

describe('DraftRoomModule', () => {
  it('renders the draft room, status chips, best available, and board columns', () => {
    const onRefreshDraftStatus = vi.fn()

    render(
      <DraftRoomModule
        boardMode="full_pool"
        data={leagueData}
        draftMode="redraft"
        draftSyncStatus={{ lastUpdatedAt: 1_786_248_000_000, state: 'synced' }}
        isMinimized={false}
        onRefreshDraftStatus={onRefreshDraftStatus}
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
    expect(screen.getByText('Sync')).toBeInTheDocument()
    expect(screen.getByText(/Updated/)).toBeInTheDocument()
    expect(screen.getByText('Best Available')).toBeInTheDocument()
    expect(screen.getAllByText('Recommended Player').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Questionable').length).toBeGreaterThan(0)
    expect(screen.getByText('Latest Picks')).toBeInTheDocument()
    expect(screen.getByText('Picked Player')).toBeInTheDocument()

    const phaseButton = screen.getByText('Drafting').closest('button')
    expect(phaseButton).toBeInTheDocument()

    if (!phaseButton) {
      throw new Error('Expected Phase chip to render as a button')
    }

    fireEvent.click(phaseButton)

    expect(onRefreshDraftStatus).toHaveBeenCalledOnce()
  })

  it('does not render columns for positions with no league roster slots', () => {
    render(
      <DraftRoomModule
        boardMode="full_pool"
        data={leagueData}
        draftMode="redraft"
        isMinimized={false}
        onToggleMinimized={vi.fn()}
        recommendations={[
          recommendation,
          kickerRecommendation,
          defenseRecommendation,
        ]}
        selectedTeamId="team-1"
      />
    )

    expect(screen.getByRole('heading', { name: 'RB' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'K' })).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'DEF' })
    ).not.toBeInTheDocument()
  })

  it('does not make the phase chip clickable for completed drafts', () => {
    const completeLeagueData: NormalizedLeagueData = {
      ...leagueData,
      draft: {
        ...leagueData.draft!,
        status: 'complete',
      },
    }

    render(
      <DraftRoomModule
        boardMode="full_pool"
        data={completeLeagueData}
        draftMode="redraft"
        isMinimized={false}
        onRefreshDraftStatus={vi.fn()}
        onToggleMinimized={vi.fn()}
        recommendations={[recommendation]}
        selectedTeamId="team-1"
      />
    )

    expect(screen.getByText('Complete')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /Phase Complete/ })
    ).not.toBeInTheDocument()
  })
})
