import { describe, expect, it } from 'vitest'

import {
  buildPointProjections,
  collectScoreTransitionPairs,
} from './build-point-projections.mjs'

function score({
  playerName,
  position = 'RB',
  season,
  qualified = true,
  productionScore = 50,
  fantasyPointsPerGame = 10,
}) {
  return { playerName, position, season, qualified, productionScore, fantasyPointsPerGame }
}

describe('collectScoreTransitionPairs', () => {
  it('joins a qualified player to his own next-season score by name', () => {
    const scores = [
      score({ playerName: 'A', season: '2021', productionScore: 80, fantasyPointsPerGame: 18 }),
      score({ playerName: 'A', season: '2022', productionScore: 60, fantasyPointsPerGame: 14 }),
    ]

    const pairs = collectScoreTransitionPairs({
      scores,
      position: 'RB',
      seasons: ['2021', '2022'],
    })

    expect(pairs).toEqual([
      { transition: '2021->2022', playerName: 'A', productionScore: 80, fppgNext: 14 },
    ])
  })

  it('drops a player with no record the following season', () => {
    const scores = [score({ playerName: 'Retires', season: '2021' })]

    const pairs = collectScoreTransitionPairs({
      scores,
      position: 'RB',
      seasons: ['2021', '2022'],
    })

    expect(pairs).toEqual([])
  })

  it('excludes a pair when either side is unqualified', () => {
    const scores = [
      score({ playerName: 'HurtLater', season: '2021', qualified: true }),
      score({ playerName: 'HurtLater', season: '2022', qualified: false }),
      score({ playerName: 'HurtBefore', season: '2021', qualified: false }),
      score({ playerName: 'HurtBefore', season: '2022', qualified: true }),
    ]

    const pairs = collectScoreTransitionPairs({
      scores,
      position: 'RB',
      seasons: ['2021', '2022'],
    })

    expect(pairs).toEqual([])
  })

  it('ignores a player at a different position', () => {
    const scores = [
      score({ playerName: 'A', position: 'RB', season: '2021' }),
      score({ playerName: 'A', position: 'WR', season: '2022' }),
    ]

    const pairs = collectScoreTransitionPairs({
      scores,
      position: 'RB',
      seasons: ['2021', '2022'],
    })

    expect(pairs).toEqual([])
  })
})

describe('buildPointProjections', () => {
  // Same synthetic RB league as build-production-weights.test.mjs: 40
  // players x 4 seasons, a persistent "true talent" index reflected
  // noise-free in receptionsPerGame, and FPTS/G equal to that talent plus
  // a fresh, independent "luck" term each season. Since RB's production
  // score is ~99.5% driven by FPTS/G, a player's season-N score tracks his
  // talent (with noise) well enough to predict season-N+1 FPTS/G better
  // than a naive "predict the mean" baseline — exactly the property this
  // calibration map is supposed to detect and validate.
  function seededLuck(season, i) {
    const seed = (season * 7919 + i * 104729) % 97
    return ((seed % 41) - 20) * 1.5
  }

  function buildSyntheticPlayers() {
    const players = []
    const seasons = ['2021', '2022', '2023', '2024']
    seasons.forEach((season, seasonIndex) => {
      for (let i = 0; i < 40; i += 1) {
        const talent = 5 + 2 * i
        players.push({
          season,
          position: 'RB',
          playerName: `Player ${i}`,
          games: 16,
          fantasyPointsPerGame: talent + seededLuck(seasonIndex, i),
          rushingYards: 50 * 16,
          rushingTouchdowns: 0,
          receptions: i * 16,
          receivingYards: 30 * 16,
          receivingTouchdowns: 0,
        })
      }
    })
    return players
  }

  it('fits a trusted, positively-sloped calibration curve for RB', () => {
    const result = buildPointProjections({
      players: buildSyntheticPlayers(),
      seasons: ['2021', '2022', '2023', '2024'],
    })

    const rb = result.RB
    expect(rb.n).toBe(120) // 40 players x 3 transitions
    expect(rb.trusted).toBe(true)
    expect(rb.fit.slope).toBeGreaterThan(0)
    expect(rb.validation.cvImprovement).toBeGreaterThan(0)
    expect(rb.validation.foldsBeatingBaseline).toBeGreaterThan(
      rb.validation.folds.length / 2
    )
  })

  it('derives a floor/ceiling band that brackets the point estimate', () => {
    const result = buildPointProjections({
      players: buildSyntheticPlayers(),
      seasons: ['2021', '2022', '2023', '2024'],
    })

    const rb = result.RB
    expect(rb.ceilingOffset).toBeGreaterThan(rb.floorOffset)

    for (const projection of rb.projections) {
      expect(projection.projectedCeilingPerGame).toBeGreaterThanOrEqual(
        projection.projectedFantasyPointsPerGame
      )
      expect(projection.projectedFantasyPointsPerGame).toBeGreaterThanOrEqual(
        projection.projectedFloorPerGame
      )
    }
  })

  it('projects the most recent season only, ranked by projected FPTS/G, with points scaled to a season total', () => {
    const result = buildPointProjections({
      players: buildSyntheticPlayers(),
      seasons: ['2021', '2022', '2023', '2024'],
    })

    const rb = result.RB
    expect(rb.projections).toHaveLength(40) // every 2024 player, the latest season

    for (let i = 1; i < rb.projections.length; i += 1) {
      expect(rb.projections[i - 1].projectedFantasyPointsPerGame).toBeGreaterThanOrEqual(
        rb.projections[i].projectedFantasyPointsPerGame
      )
    }

    const top = rb.projections[0]
    expect(top.projectedPoints).toBeCloseTo(top.projectedFantasyPointsPerGame * 17, 1)
  })

  it('does not crash for a position with no season->season pairs', () => {
    const result = buildPointProjections({
      players: buildSyntheticPlayers(), // RB only
      seasons: ['2021', '2022', '2023', '2024'],
    })

    expect(result.WR.n).toBe(0)
    expect(result.WR.trusted).toBe(false)
    expect(result.WR.projections).toEqual([])
  })

  it('validates all four skill positions', () => {
    const result = buildPointProjections({
      players: buildSyntheticPlayers(),
      seasons: ['2021', '2022', '2023', '2024'],
    })

    expect(Object.keys(result).sort()).toEqual(['QB', 'RB', 'TE', 'WR'])
  })
})
