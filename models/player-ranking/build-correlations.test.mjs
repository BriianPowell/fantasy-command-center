import { describe, expect, it } from 'vitest'

import { buildCorrelations } from './build-correlations.mjs'

const SEASONS = ['2021', '2022', '2023', '2024', '2025']
const TEAMS = 32

/** Deterministic scramble, so an "uncoupled" league is reproducible. */
function scramble(index, seed) {
  return (index * 17 + seed * 7) % TEAMS
}

/**
 * A synthetic league where each team's line quality and QB quality both
 * rise with a quality index. `coupled: false` re-rolls the QB ordering
 * every season, so no fit learned on one season transfers to another.
 */
function makeLeague({ coupled = true } = {}) {
  const players = []
  const advanced = []

  SEASONS.forEach((season, seasonIndex) => {
    for (let i = 0; i < TEAMS; i += 1) {
      const team = `T${String(i).padStart(2, '0')}`
      const quality = coupled ? i : scramble(i, seasonIndex)

      advanced.push({
        season,
        position: 'QB',
        team,
        passAttempts: 500,
        sacksTaken: 30,
        knockdowns: 75 - 2 * i,
        hurries: 75 - 2 * i,
        pocketTime: 2.5,
      })
      advanced.push({
        season,
        position: 'RB',
        team,
        rushAttempts: 400,
        yardsBeforeContact: 400 + 20 * i,
        yardsAfterContact: 400,
      })

      players.push({
        playerName: `QB ${team}`,
        position: 'QB',
        season,
        team,
        games: 17,
        fantasyPoints: (10 + quality) * 17,
        fantasyPointsPerGame: 10 + quality,
        passingYards: 3000 + 40 * quality,
        passingTouchdowns: 10 + quality,
        rushingYards: 100 + 10 * quality,
        rushingTouchdowns: 1 + quality / 4,
      })
    }
  })

  return { seasons: SEASONS, players, advanced, importedAt: 'X' }
}

describe('buildCorrelations', () => {
  it('recovers a relationship that is there', () => {
    const { relationships, weights } = buildCorrelations(makeLeague())

    expect(relationships.olineToQb.r).toBeGreaterThan(0.9)
    expect(relationships.olineToQb.trusted).toBe(true)
    expect(relationships.olineToQb.validation.foldsBeatingBaseline).toBe(
      SEASONS.length
    )
    expect(weights.QB.offensiveLine).toBeGreaterThan(0.8)
  })

  it('refuses to weight a relationship that does not generalise', () => {
    const { relationships, weights } = buildCorrelations(
      makeLeague({ coupled: false })
    )

    expect(relationships.olineToQb.trusted).toBe(false)
    expect(weights.QB.offensiveLine).toBe(0)
    expect(weights.QB.historicalProduction).toBe(1)
  })

  it('splits every position between its driver and its own history', () => {
    const { weights } = buildCorrelations(makeLeague())

    for (const [position, positionWeights] of Object.entries(weights)) {
      const total = Object.values(positionWeights).reduce(
        (sum, value) => sum + value,
        0
      )
      expect(total, `${position} weights should sum to 1`).toBeCloseTo(1, 6)
    }
  })

  it('cross-validates against every season, not just the most recent', () => {
    const { relationships } = buildCorrelations(makeLeague())
    const { folds, latestSeason } = relationships.olineToQb.validation

    expect(folds.map((fold) => fold.testSeason)).toEqual(SEASONS)
    expect(folds[0].trainSeasons).toEqual(SEASONS.slice(1))
    expect(latestSeason.testSeason).toBe('2025')
  })

  it('measures each team by its starter, not its backup', () => {
    const league = makeLeague()
    const backups = league.players.map((player) => ({
      ...player,
      playerName: `${player.playerName} backup`,
      games: 8,
      // Uniformly awful, and always fewer points than the starter.
      fantasyPoints: 8 * 5,
      fantasyPointsPerGame: 5,
      passingYards: 800,
      passingTouchdowns: 2,
      rushingYards: 20,
      rushingTouchdowns: 0,
    }))

    const withBackups = buildCorrelations({
      ...league,
      players: [...league.players, ...backups],
    })

    // One point per team, and the fit is unchanged: the backups never
    // stood in for the starter they sat behind.
    for (const season of withBackups.relationships.olineToQb.bySeason) {
      expect(season.n).toBe(TEAMS)
    }
    expect(withBackups.relationships.olineToQb.r).toBeCloseTo(
      buildCorrelations(league).relationships.olineToQb.r,
      6
    )
  })

  it('reports both bounds on the line effect', () => {
    const { relationships } = buildCorrelations(makeLeague())

    expect(relationships.passProtectionToQb.caveat).toContain('upper bound')
    expect(relationships.runBlockingToQb.caveat).toContain('lower bound')
  })

  it('survives a position with no data', () => {
    const { relationships, weights } = buildCorrelations(makeLeague())

    expect(relationships.qbToLeadWr).toMatchObject({
      n: 0,
      r: 0,
      trusted: false,
    })
    expect(weights.WR.historicalProduction).toBe(1)
  })
})
