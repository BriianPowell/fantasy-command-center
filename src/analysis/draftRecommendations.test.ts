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
  yearsExperience,
}: {
  id: string
  position: Position
  searchRank: number
  yearsExperience?: number
}): Player {
  return {
    id,
    providerPlayerId: id,
    fullName: id,
    positions: [position],
    searchRank,
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

    const recommendations = buildDraftRecommendations({
      leagueSettings,
      notes: [],
      players: [availableRunningBack, unavailableRunningBack, defensiveBack],
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
