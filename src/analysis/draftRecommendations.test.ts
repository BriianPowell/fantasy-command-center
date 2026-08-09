import { describe, expect, it } from 'vitest'
import { buildDraftRecommendations } from './draftRecommendations'
import type { LeagueSettings, Player, Position } from '../domain/types'

const leagueSettings: LeagueSettings = {
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
}

function makePlayer({
  id,
  position,
  searchRank,
  team = 'DET',
  yearsExperience,
}: {
  id: string
  position: Position
  searchRank: number
  team?: string
  yearsExperience?: number
}): Player {
  return {
    id,
    providerPlayerId: id,
    fullName: id,
    positions: [position],
    searchRank,
    team,
    yearsExperience,
  }
}

describe('buildDraftRecommendations', () => {
  it('excludes unavailable players and non-draft-board positions', () => {
    const availableRunningBack = makePlayer({
      id: 'available-rb',
      position: 'RB',
      searchRank: 10,
    })
    const unavailableRunningBack = makePlayer({
      id: 'unavailable-rb',
      position: 'RB',
      searchRank: 1,
    })
    const defensiveBack = makePlayer({
      id: 'defensive-back',
      position: 'DB',
      searchRank: 2,
    })
    const kicker = makePlayer({
      id: 'kicker',
      position: 'K',
      searchRank: 3,
    })
    const defense = makePlayer({
      id: 'defense',
      position: 'DEF',
      searchRank: 4,
    })

    const recommendations = buildDraftRecommendations({
      leagueSettings,
      notes: [],
      players: [
        availableRunningBack,
        unavailableRunningBack,
        defensiveBack,
        kicker,
        defense,
      ],
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set([unavailableRunningBack.id]),
    })

    expect(
      recommendations.map((recommendation) => recommendation.player.id)
    ).toEqual([availableRunningBack.id])
  })

  it('orders recommendations by Sleeper search-rank value when other inputs are equal', () => {
    const topWideReceiver = makePlayer({
      id: 'top-wr',
      position: 'WR',
      searchRank: 1,
    })
    const laterWideReceiver = makePlayer({
      id: 'later-wr',
      position: 'WR',
      searchRank: 60,
    })

    const recommendations = buildDraftRecommendations({
      leagueSettings,
      notes: [],
      players: [laterWideReceiver, topWideReceiver],
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set(),
    })

    expect(
      recommendations.map((recommendation) => recommendation.player.id)
    ).toEqual([topWideReceiver.id, laterWideReceiver.id])
    expect(recommendations[0].valueScore).toBeGreaterThan(
      recommendations[1].valueScore
    )
  })

  it('adds available position tier, rank, and drop-off context', () => {
    const eliteRunningBack = makePlayer({
      id: 'elite-rb',
      position: 'RB',
      searchRank: 1,
    })
    const nextRunningBack = makePlayer({
      id: 'next-rb',
      position: 'RB',
      searchRank: 5,
    })
    const laterRunningBack = makePlayer({
      id: 'later-rb',
      position: 'RB',
      searchRank: 45,
    })
    const topReceiver = makePlayer({
      id: 'top-wr',
      position: 'WR',
      searchRank: 2,
    })

    const recommendations = buildDraftRecommendations({
      leagueSettings,
      notes: [],
      players: [
        laterRunningBack,
        topReceiver,
        nextRunningBack,
        eliteRunningBack,
      ],
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set(),
    })

    const eliteRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === eliteRunningBack.id
    )
    const nextRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === nextRunningBack.id
    )
    const receiverRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === topReceiver.id
    )

    expect(eliteRecommendation?.positionRank).toBe(1)
    expect(eliteRecommendation?.valueTier).toBe(1)
    expect(eliteRecommendation?.dropOffAfter).toBeGreaterThanOrEqual(8)
    expect(eliteRecommendation?.suggestion).toBe('Beat tier drop')
    expect(eliteRecommendation?.notes).toContain('Tier 1 RB value')
    expect(eliteRecommendation?.insight).toContain('RB value drop')

    expect(nextRecommendation?.positionRank).toBe(2)
    expect(nextRecommendation?.valueTier).toBe(2)

    expect(receiverRecommendation?.positionRank).toBe(1)
    expect(receiverRecommendation?.valueTier).toBe(1)
  })

  it('scales scarcity by league size and roster demand', () => {
    const tightEnds = Array.from({ length: 5 }, (_, index) =>
      makePlayer({
        id: `te-${index + 1}`,
        position: 'TE',
        searchRank: index + 1,
      })
    )
    const smallerLeagueSettings = {
      ...leagueSettings,
      teams: 8,
    }
    const largerLeagueSettings = {
      ...leagueSettings,
      teams: 12,
    }

    const smallerLeagueRecommendations = buildDraftRecommendations({
      leagueSettings: smallerLeagueSettings,
      notes: [],
      players: tightEnds,
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set(),
    })
    const largerLeagueRecommendations = buildDraftRecommendations({
      leagueSettings: largerLeagueSettings,
      notes: [],
      players: tightEnds,
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set(),
    })
    const smallerTopTightEnd = smallerLeagueRecommendations.find(
      (recommendation) => recommendation.player.id === 'te-1'
    )
    const largerTopTightEnd = largerLeagueRecommendations.find(
      (recommendation) => recommendation.player.id === 'te-1'
    )

    expect(smallerTopTightEnd).toBeDefined()
    expect(largerTopTightEnd).toBeDefined()

    if (!smallerTopTightEnd || !largerTopTightEnd) {
      throw new Error('Expected top tight end recommendations')
    }

    expect(largerTopTightEnd.scarcityScore).toBeGreaterThan(
      smallerTopTightEnd.scarcityScore
    )
  })

  it('excludes players without a current NFL team', () => {
    const rosteredReceiver = makePlayer({
      id: 'rostered-wr',
      position: 'WR',
      searchRank: 10,
    })
    const freeAgentReceiver = makePlayer({
      id: 'free-agent-wr',
      position: 'WR',
      searchRank: 1,
      team: 'FA',
    })
    const teamlessReceiver = {
      ...makePlayer({
        id: 'teamless-wr',
        position: 'WR',
        searchRank: 2,
      }),
      team: undefined,
    }

    const recommendations = buildDraftRecommendations({
      leagueSettings,
      notes: [],
      players: [freeAgentReceiver, teamlessReceiver, rosteredReceiver],
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set(),
    })

    expect(
      recommendations.map((recommendation) => recommendation.player.id)
    ).toEqual([rosteredReceiver.id])
  })

  it('filters veterans out of rookie-only board mode', () => {
    const rookie = makePlayer({
      id: 'rookie-rb',
      position: 'RB',
      searchRank: 20,
      yearsExperience: 0,
    })
    const veteran = makePlayer({
      id: 'veteran-rb',
      position: 'RB',
      searchRank: 1,
      yearsExperience: 4,
    })

    const recommendations = buildDraftRecommendations({
      boardMode: 'rookies_only',
      leagueSettings,
      notes: [],
      players: [veteran, rookie],
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set(),
    })

    expect(
      recommendations.map((recommendation) => recommendation.player.id)
    ).toEqual([rookie.id])
  })

  it('keeps veterans available in full-pool board mode', () => {
    const rookie = makePlayer({
      id: 'rookie-rb',
      position: 'RB',
      searchRank: 20,
      yearsExperience: 0,
    })
    const veteran = makePlayer({
      id: 'veteran-rb',
      position: 'RB',
      searchRank: 1,
      yearsExperience: 4,
    })

    const recommendations = buildDraftRecommendations({
      boardMode: 'full_pool',
      leagueSettings,
      notes: [],
      players: [rookie, veteran],
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set(),
    })

    expect(
      recommendations.map((recommendation) => recommendation.player.id)
    ).toContain(veteran.id)
  })
})
