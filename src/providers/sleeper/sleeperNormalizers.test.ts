import { describe, expect, it } from 'vitest'
import {
  normalizeDraft,
  normalizeLeague,
  normalizePlayer,
  normalizeTeams,
  normalizeTransaction,
} from './sleeperNormalizers'

describe('normalizeLeague', () => {
  it('normalizes Sleeper league settings and roster slot counts', () => {
    expect(
      normalizeLeague({
        draft_id: 'draft-1',
        league_id: 'league-1',
        name: 'League One',
        roster_positions: ['QB', 'RB', 'RB', 'WR', 'FLEX', 'BN', 'BN'],
        scoring_settings: { rec: 0.5 },
        season: '2026',
        settings: { playoff_week_start: 15 },
        total_rosters: 12,
      })
    ).toEqual(
      expect.objectContaining({
        draftId: 'draft-1',
        id: 'league-1',
        name: 'League One',
        provider: 'sleeper',
        season: '2026',
        settings: expect.objectContaining({
          playoffWeekStart: 15,
          rosterSlots: expect.objectContaining({
            BN: 2,
            FLEX: 1,
            QB: 1,
            RB: 2,
            WR: 1,
          }),
          scoringType: 'half_ppr',
          teams: 12,
        }),
      })
    )
  })
})

describe('normalizeTeams', () => {
  it('prefers Sleeper team names and avatar URLs when user metadata exists', () => {
    expect(
      normalizeTeams(
        [
          {
            avatar: 'avatar-id',
            display_name: 'Display Name',
            metadata: { team_name: 'Team Name' },
            user_id: 'user-1',
            username: 'username',
          },
        ],
        [{ owner_id: 'user-1', roster_id: 3 }]
      )
    ).toEqual([
      {
        avatarUrl: 'https://sleepercdn.com/avatars/avatar-id',
        id: '3',
        name: 'Team Name',
        ownerId: 'user-1',
        ownerName: 'Display Name',
        ownerUsername: 'username',
      },
    ])
  })
})

describe('normalizeDraft', () => {
  it('normalizes draft status, type, current pick, rounds, and pick metadata', () => {
    expect(
      normalizeDraft(
        {
          draft_id: 'draft-1',
          status: 'paused',
          type: 'linear',
        },
        [
          {
            metadata: {
              first_name: 'Defense',
              last_name: 'Team',
              position: 'DST',
              team: 'PIT',
            },
            pick_no: 1,
            picked_by: 'user-1',
            player_id: 'player-1',
            roster_id: 2,
            round: 1,
          },
        ]
      )
    ).toEqual({
      currentPick: 2,
      id: 'draft-1',
      picks: [
        {
          metadata: {
            firstName: 'Defense',
            lastName: 'Team',
            position: 'DEF',
            team: 'PIT',
          },
          pickNo: 1,
          pickedBy: 'user-1',
          playerId: 'player-1',
          rosterId: '2',
          round: 1,
        },
      ],
      rounds: 1,
      status: 'unknown',
      type: 'linear',
    })
  })
})

describe('normalizePlayer', () => {
  it('normalizes player names, positions, and Sleeper metadata', () => {
    expect(
      normalizePlayer({
        age: 24,
        bye_week: 7,
        fantasy_positions: ['WR', 'RB'],
        first_name: 'First',
        injury_status: 'Questionable',
        last_name: 'Last',
        player_id: 'player-1',
        search_rank: 12,
        team: 'KC',
        years_exp: 2,
      })
    ).toEqual({
      age: 24,
      byeWeek: 7,
      firstName: 'First',
      fullName: 'First Last',
      id: 'player-1',
      injuryStatus: 'Questionable',
      lastName: 'Last',
      positions: ['WR', 'RB'],
      providerPlayerId: 'player-1',
      searchRank: 12,
      team: 'KC',
      yearsExperience: 2,
    })
  })

  it('filters players without supported positions or names', () => {
    expect(
      normalizePlayer({
        full_name: 'Unsupported Player',
        player_id: 'unsupported',
        position: 'P',
      })
    ).toBeUndefined()
    expect(
      normalizePlayer({
        player_id: 'nameless',
        position: 'RB',
      })
    ).toBeUndefined()
  })
})

describe('normalizeTransaction', () => {
  it('stringifies roster ids and nested transaction details', () => {
    expect(
      normalizeTransaction({
        adds: { 'player-1': 1 },
        draft_picks: [
          {
            owner_id: 2,
            previous_owner_id: 3,
            roster_id: 1,
            round: 2,
            season: '2027',
          },
        ],
        drops: { 'player-2': 2 },
        roster_ids: [1, 2],
        status: 'complete',
        transaction_id: 'transaction-1',
        type: 'trade',
        waiver_budget: [{ amount: 7, receiver: 2, sender: 1 }],
      })
    ).toEqual({
      adds: { 'player-1': '1' },
      draftPicks: [
        {
          ownerId: '2',
          previousOwnerId: '3',
          rosterId: '1',
          round: 2,
          season: '2027',
        },
      ],
      drops: { 'player-2': '2' },
      id: 'transaction-1',
      rosterIds: ['1', '2'],
      status: 'complete',
      type: 'trade',
      waiverBudget: [{ amount: 7, receiver: '2', sender: '1' }],
    })
  })
})
