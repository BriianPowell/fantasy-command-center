import { describe, expect, it } from 'vitest'
import { buildDraftRecommendations } from './draftRecommendations'
import type {
  DraftState,
  LeagueSettings,
  Player,
  Position,
} from '../domain/types'

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
  injuryStatus,
  injuryNotes,
  position,
  searchRank,
  team = 'DET',
  yearsExperience,
}: {
  id: string
  injuryStatus?: string
  injuryNotes?: string
  position: Position
  searchRank: number
  team?: string
  yearsExperience?: number
}): Player {
  return {
    id,
    providerPlayerId: id,
    fullName: id,
    injuryNotes,
    injuryStatus,
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

  it('deprioritizes filled required positions until every starter position is covered', () => {
    const rosteredQuarterback = makePlayer({
      id: 'rostered-qb',
      position: 'QB',
      searchRank: 1,
    })
    const rosteredRunningBacks = Array.from({ length: 2 }, (_, index) =>
      makePlayer({
        id: `rostered-rb-${index + 1}`,
        position: 'RB',
        searchRank: index + 2,
      })
    )
    const rosteredReceivers = Array.from({ length: 2 }, (_, index) =>
      makePlayer({
        id: `rostered-wr-${index + 1}`,
        position: 'WR',
        searchRank: index + 4,
      })
    )
    const rosteredTightEnd = makePlayer({
      id: 'rostered-te',
      position: 'TE',
      searchRank: 6,
    })
    const availableRunningBack = makePlayer({
      id: 'available-rb',
      position: 'RB',
      searchRank: 30,
    })
    const availableReceiver = makePlayer({
      id: 'available-wr',
      position: 'WR',
      searchRank: 31,
    })
    const partialRosterRecommendations = buildDraftRecommendations({
      leagueSettings,
      notes: [],
      players: [
        rosteredQuarterback,
        ...rosteredRunningBacks,
        availableRunningBack,
        availableReceiver,
      ],
      projections: [],
      rankings: [],
      roster: {
        playerIds: [
          rosteredQuarterback.id,
          ...rosteredRunningBacks.map((player) => player.id),
        ],
        starters: [],
        teamId: 'team-1',
      },
      unavailablePlayerIds: new Set([
        rosteredQuarterback.id,
        ...rosteredRunningBacks.map((player) => player.id),
      ]),
    })
    const completeRosterRecommendations = buildDraftRecommendations({
      leagueSettings,
      notes: [],
      players: [
        rosteredQuarterback,
        ...rosteredRunningBacks,
        ...rosteredReceivers,
        rosteredTightEnd,
        availableRunningBack,
      ],
      projections: [],
      rankings: [],
      roster: {
        playerIds: [
          rosteredQuarterback.id,
          ...rosteredRunningBacks.map((player) => player.id),
          ...rosteredReceivers.map((player) => player.id),
          rosteredTightEnd.id,
        ],
        starters: [],
        teamId: 'team-1',
      },
      unavailablePlayerIds: new Set([
        rosteredQuarterback.id,
        ...rosteredRunningBacks.map((player) => player.id),
        ...rosteredReceivers.map((player) => player.id),
        rosteredTightEnd.id,
      ]),
    })
    const partialRosterRunningBack = partialRosterRecommendations.find(
      (recommendation) => recommendation.player.id === availableRunningBack.id
    )
    const partialRosterReceiver = partialRosterRecommendations.find(
      (recommendation) => recommendation.player.id === availableReceiver.id
    )
    const completeRosterRunningBack = completeRosterRecommendations.find(
      (recommendation) => recommendation.player.id === availableRunningBack.id
    )

    expect(partialRosterRunningBack?.needScore).toBe(4)
    expect(partialRosterReceiver?.needScore).toBe(35)
    expect(completeRosterRunningBack?.needScore).toBeGreaterThan(
      partialRosterRunningBack?.needScore ?? 0
    )
  })

  it('keeps kickers and defenses low priority even when those slots are required', () => {
    const quarterback = makePlayer({
      id: 'qb',
      position: 'QB',
      searchRank: 1,
    })
    const kicker = makePlayer({
      id: 'kicker',
      position: 'K',
      searchRank: 2,
    })
    const defense = makePlayer({
      id: 'defense',
      position: 'DEF',
      searchRank: 3,
    })
    const receiver = makePlayer({
      id: 'receiver',
      position: 'WR',
      searchRank: 4,
    })
    const recommendations = buildDraftRecommendations({
      leagueSettings: {
        ...leagueSettings,
        rosterSlots: {
          ...leagueSettings.rosterSlots,
          DEF: 1,
          K: 1,
        },
      },
      notes: [],
      players: [quarterback, kicker, defense, receiver],
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set(),
    })
    const quarterbackRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === quarterback.id
    )
    const kickerRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === kicker.id
    )
    const defenseRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === defense.id
    )

    expect(kickerRecommendation?.needScore).toBeLessThan(
      quarterbackRecommendation?.needScore ?? 0
    )
    expect(defenseRecommendation?.needScore).toBeLessThan(
      quarterbackRecommendation?.needScore ?? 0
    )
    expect(kickerRecommendation?.suggestion).toBe('Late-round target')
    expect(defenseRecommendation?.suggestion).toBe('Late-round target')
  })

  it('brings kickers and defenses back after 85 percent of the draft is complete', () => {
    const kicker = makePlayer({
      id: 'kicker',
      position: 'K',
      searchRank: 120,
    })
    const defense = makePlayer({
      id: 'defense',
      position: 'DEF',
      searchRank: 121,
    })
    const draft: DraftState = {
      currentPick: 103,
      id: 'draft-1',
      picks: [],
      rounds: 10,
      status: 'drafting',
      type: 'snake',
    }
    const recommendations = buildDraftRecommendations({
      draft,
      leagueSettings: {
        ...leagueSettings,
        rosterSlots: {
          ...leagueSettings.rosterSlots,
          DEF: 1,
          K: 1,
        },
      },
      notes: [],
      players: [kicker, defense],
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set(),
    })
    const kickerRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === kicker.id
    )
    const defenseRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === defense.id
    )

    expect(kickerRecommendation?.needScore).toBe(18)
    expect(defenseRecommendation?.needScore).toBe(18)
  })

  it('brings kickers and defenses back when they are the only roster slots left', () => {
    const rosterPlayers = [
      makePlayer({ id: 'qb', position: 'QB', searchRank: 1 }),
      makePlayer({ id: 'rb', position: 'RB', searchRank: 2 }),
      makePlayer({ id: 'wr', position: 'WR', searchRank: 3 }),
      makePlayer({ id: 'te', position: 'TE', searchRank: 4 }),
      makePlayer({ id: 'bench-rb', position: 'RB', searchRank: 5 }),
      makePlayer({ id: 'bench-wr', position: 'WR', searchRank: 6 }),
    ]
    const kicker = makePlayer({
      id: 'kicker',
      position: 'K',
      searchRank: 120,
    })
    const defense = makePlayer({
      id: 'defense',
      position: 'DEF',
      searchRank: 121,
    })
    const lateSpecialistSettings: LeagueSettings = {
      ...leagueSettings,
      rosterSlots: {
        ...leagueSettings.rosterSlots,
        BN: 2,
        DEF: 1,
        FLEX: 0,
        K: 1,
        RB: 1,
        TE: 1,
        WR: 1,
      },
    }
    const recommendations = buildDraftRecommendations({
      leagueSettings: lateSpecialistSettings,
      notes: [],
      players: [...rosterPlayers, kicker, defense],
      projections: [],
      rankings: [],
      roster: {
        playerIds: rosterPlayers.map((player) => player.id),
        starters: rosterPlayers.slice(0, 4).map((player) => player.id),
        teamId: 'team-1',
      },
      unavailablePlayerIds: new Set(rosterPlayers.map((player) => player.id)),
    })
    const kickerRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === kicker.id
    )
    const defenseRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === defense.id
    )

    expect(kickerRecommendation?.needScore).toBe(24)
    expect(defenseRecommendation?.needScore).toBe(24)
  })

  it('deprioritizes backup quarterbacks in non-superflex leagues', () => {
    const rosteredQuarterback = makePlayer({
      id: 'rostered-qb',
      position: 'QB',
      searchRank: 1,
    })
    const availableQuarterback = makePlayer({
      id: 'available-qb',
      position: 'QB',
      searchRank: 2,
    })
    const availableRunningBack = makePlayer({
      id: 'available-rb',
      position: 'RB',
      searchRank: 20,
    })
    const recommendations = buildDraftRecommendations({
      leagueSettings,
      notes: [],
      players: [
        rosteredQuarterback,
        availableQuarterback,
        availableRunningBack,
      ],
      projections: [],
      rankings: [],
      roster: {
        playerIds: [rosteredQuarterback.id],
        starters: [rosteredQuarterback.id],
        teamId: 'team-1',
      },
      unavailablePlayerIds: new Set([rosteredQuarterback.id]),
    })
    const quarterbackRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === availableQuarterback.id
    )
    const runningBackRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === availableRunningBack.id
    )

    expect(quarterbackRecommendation?.needScore).toBe(-12)
    expect(quarterbackRecommendation?.score ?? 0).toBeLessThan(
      runningBackRecommendation?.score ?? 0
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
    expect(eliteRecommendation?.insight).toContain('RB value drop')

    expect(nextRecommendation?.positionRank).toBe(2)
    expect(nextRecommendation?.valueTier).toBe(2)

    expect(receiverRecommendation?.positionRank).toBe(1)
    expect(receiverRecommendation?.valueTier).toBe(1)
  })

  it('flags a tier as urgent when it may not return by the next pick', () => {
    const topRunningBack = makePlayer({
      id: 'top-rb',
      position: 'RB',
      searchRank: 1,
    })
    const tierEndRunningBack = makePlayer({
      id: 'tier-end-rb',
      position: 'RB',
      searchRank: 2,
    })
    const nextTierRunningBack = makePlayer({
      id: 'next-tier-rb',
      position: 'RB',
      searchRank: 20,
    })
    const draft: DraftState = {
      currentPick: 3,
      id: 'draft-1',
      picks: [
        {
          pickNo: 2,
          rosterId: 'team-2',
          round: 1,
        },
      ],
      rounds: 3,
      status: 'drafting',
      type: 'snake',
    }

    const recommendations = buildDraftRecommendations({
      draft,
      leagueSettings: {
        ...leagueSettings,
        teams: 4,
      },
      notes: [],
      players: [nextTierRunningBack, tierEndRunningBack, topRunningBack],
      projections: [],
      rankings: [],
      selectedTeamId: 'team-2',
      unavailablePlayerIds: new Set(),
    })
    const tierEndRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === tierEndRunningBack.id
    )

    expect(tierEndRecommendation?.picksUntilNextPick).toBe(4)
    expect(tierEndRecommendation?.tierPlayersRemaining).toBe(2)
    expect(tierEndRecommendation?.tierUrgency).toBe('take_now')
    expect(tierEndRecommendation?.suggestion).toBe(
      'Take now: tier may not return'
    )
  })

  it('raises urgency when the room is actively drafting a position', () => {
    const pickedRunningBacks = Array.from({ length: 4 }, (_, index) =>
      makePlayer({
        id: `picked-rb-${index + 1}`,
        position: 'RB',
        searchRank: index + 1,
      })
    )
    const pickedReceivers = Array.from({ length: 2 }, (_, index) =>
      makePlayer({
        id: `picked-wr-${index + 1}`,
        position: 'WR',
        searchRank: index + 10,
      })
    )
    const availableRunningBack = makePlayer({
      id: 'available-rb',
      position: 'RB',
      searchRank: 20,
    })
    const availableReceiver = makePlayer({
      id: 'available-wr',
      position: 'WR',
      searchRank: 21,
    })
    const draft: DraftState = {
      currentPick: 7,
      id: 'draft-1',
      picks: [
        ...pickedRunningBacks.map((player, index) => ({
          pickNo: index + 1,
          playerId: player.id,
          rosterId: `team-${index + 1}`,
          round: 1,
        })),
        ...pickedReceivers.map((player, index) => ({
          pickNo: index + 5,
          playerId: player.id,
          rosterId: `team-${index + 5}`,
          round: 1,
        })),
      ],
      rounds: 3,
      status: 'drafting',
      type: 'snake',
    }

    const recommendations = buildDraftRecommendations({
      draft,
      leagueSettings,
      notes: [],
      players: [
        ...pickedRunningBacks,
        ...pickedReceivers,
        availableRunningBack,
        availableReceiver,
      ],
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set([
        ...pickedRunningBacks.map((player) => player.id),
        ...pickedReceivers.map((player) => player.id),
      ]),
    })
    const runningBackRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === availableRunningBack.id
    )

    expect(runningBackRecommendation?.suggestion).toBe('Take now: RB run')
    expect(runningBackRecommendation?.insight).toContain(
      'room is actively attacking this position'
    )
  })

  it('does not call early-round top-tier depth safe to wait', () => {
    const receivers = Array.from({ length: 8 }, (_, index) =>
      makePlayer({
        id: `wr-${index + 1}`,
        position: 'WR',
        searchRank: index + 1,
      })
    )
    const draft: DraftState = {
      currentPick: 5,
      id: 'draft-1',
      picks: [
        {
          pickNo: 2,
          rosterId: 'team-2',
          round: 1,
        },
      ],
      rounds: 3,
      status: 'drafting',
      type: 'snake',
    }

    const recommendations = buildDraftRecommendations({
      draft,
      leagueSettings: {
        ...leagueSettings,
        teams: 4,
      },
      notes: [],
      players: receivers,
      projections: [],
      rankings: [],
      selectedTeamId: 'team-2',
      unavailablePlayerIds: new Set(),
    })
    const topReceiverRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === receivers[0].id
    )

    expect(topReceiverRecommendation?.tierUrgency).toBe('safe_to_wait')
    expect(topReceiverRecommendation?.suggestion).not.toBe('Safe to wait')
  })

  it('surfaces an overall board cliff before same-position waiting advice', () => {
    const topReceiver = makePlayer({
      id: 'top-wr',
      position: 'WR',
      searchRank: 1,
    })
    const nextReceiver = makePlayer({
      id: 'next-wr',
      position: 'WR',
      searchRank: 35,
    })
    const laterRunningBack = makePlayer({
      id: 'later-rb',
      position: 'RB',
      searchRank: 36,
    })
    const draft: DraftState = {
      currentPick: 3,
      id: 'draft-1',
      picks: [
        {
          pickNo: 1,
          rosterId: 'team-1',
          round: 1,
        },
      ],
      rounds: 3,
      status: 'drafting',
      type: 'snake',
    }

    const recommendations = buildDraftRecommendations({
      draft,
      leagueSettings: {
        ...leagueSettings,
        teams: 4,
      },
      notes: [],
      players: [laterRunningBack, nextReceiver, topReceiver],
      projections: [],
      rankings: [],
      selectedTeamId: 'team-1',
      unavailablePlayerIds: new Set(),
    })
    const topReceiverRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === topReceiver.id
    )

    expect(topReceiverRecommendation?.suggestion).toBe(
      'Take value: board cliff'
    )
    expect(topReceiverRecommendation?.insight).toContain('overall board cliff')
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

  it('accounts for injury status in draft scores and notes', () => {
    const healthyReceiver = makePlayer({
      id: 'healthy-wr',
      position: 'WR',
      searchRank: 10,
    })
    const injuredReceiver = makePlayer({
      id: 'injured-wr',
      injuryNotes: 'Expected to miss multiple weeks',
      injuryStatus: 'Out',
      position: 'WR',
      searchRank: 10,
    })

    const recommendations = buildDraftRecommendations({
      leagueSettings,
      notes: [],
      players: [injuredReceiver, healthyReceiver],
      projections: [],
      rankings: [],
      unavailablePlayerIds: new Set(),
    })
    const healthyRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === healthyReceiver.id
    )
    const injuredRecommendation = recommendations.find(
      (recommendation) => recommendation.player.id === injuredReceiver.id
    )

    expect(healthyRecommendation).toBeDefined()
    expect(injuredRecommendation).toBeDefined()

    if (!healthyRecommendation || !injuredRecommendation) {
      throw new Error('Expected healthy and injured recommendations')
    }

    expect(injuredRecommendation.injuryRisk).toBe(12)
    expect(injuredRecommendation.notes).toContain('Injury: Out')
    expect(injuredRecommendation.notes).toContain(
      'Expected to miss multiple weeks'
    )
    expect(injuredRecommendation.insight).toContain(
      'Expected to miss multiple weeks'
    )
    expect(injuredRecommendation.score).toBeLessThan(
      healthyRecommendation.score
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
