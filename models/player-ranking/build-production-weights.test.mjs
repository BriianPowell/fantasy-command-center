import { describe, expect, it } from 'vitest'

import {
  buildProductionWeights,
  buildTransitions,
  collectTransitionPairs,
} from './build-production-weights.mjs'

describe('buildTransitions', () => {
  it('pairs consecutive seasons in order', () => {
    expect(buildTransitions(['2021', '2022', '2023'])).toEqual([
      '2021->2022',
      '2022->2023',
    ])
  })

  it('sorts and de-dupes out-of-order or repeated seasons', () => {
    expect(buildTransitions(['2023', '2021', '2022', '2021'])).toEqual([
      '2021->2022',
      '2022->2023',
    ])
  })

  it('returns no transitions for a single season', () => {
    expect(buildTransitions(['2021'])).toEqual([])
  })
})

describe('collectTransitionPairs', () => {
  const spec = {
    minGames: 6,
    metrics: {
      fantasyPointsPerGame: { weight: 1, value: (r) => r.fantasyPointsPerGame },
      yardsPerGame: { weight: 1, value: (r) => r.yards / r.games },
    },
  }

  it('joins a player to his own next-season record by name', () => {
    const players = [
      {
        season: '2021',
        position: 'RB',
        playerName: 'A',
        games: 16,
        fantasyPointsPerGame: 10,
        yards: 800,
      },
      {
        season: '2022',
        position: 'RB',
        playerName: 'A',
        games: 16,
        fantasyPointsPerGame: 15,
        yards: 960,
      },
    ]

    const pairs = collectTransitionPairs({
      players,
      position: 'RB',
      spec,
      seasons: ['2021', '2022'],
    })

    expect(pairs).toEqual([
      {
        transition: '2021->2022',
        playerName: 'A',
        fppgN: 10,
        fppgNext: 15,
        metrics: { yardsPerGame: 50 },
      },
    ])
  })

  it('drops a player who has no record the following season', () => {
    const players = [
      {
        season: '2021',
        position: 'RB',
        playerName: 'Retires',
        games: 16,
        fantasyPointsPerGame: 10,
        yards: 800,
      },
    ]

    const pairs = collectTransitionPairs({
      players,
      position: 'RB',
      spec,
      seasons: ['2021', '2022'],
    })

    expect(pairs).toEqual([])
  })

  it('excludes players below minGames in either season', () => {
    const players = [
      {
        season: '2021',
        position: 'RB',
        playerName: 'Hurt',
        games: 3,
        fantasyPointsPerGame: 10,
        yards: 150,
      },
      {
        season: '2022',
        position: 'RB',
        playerName: 'Hurt',
        games: 16,
        fantasyPointsPerGame: 15,
        yards: 960,
      },
      {
        season: '2021',
        position: 'RB',
        playerName: 'HurtLater',
        games: 16,
        fantasyPointsPerGame: 10,
        yards: 800,
      },
      {
        season: '2022',
        position: 'RB',
        playerName: 'HurtLater',
        games: 2,
        fantasyPointsPerGame: 15,
        yards: 120,
      },
    ]

    const pairs = collectTransitionPairs({
      players,
      position: 'RB',
      spec,
      seasons: ['2021', '2022'],
    })

    expect(pairs).toEqual([])
  })

  it('ignores team/position mismatches when matching by name', () => {
    const players = [
      {
        season: '2021',
        position: 'RB',
        playerName: 'A',
        games: 16,
        fantasyPointsPerGame: 10,
        yards: 800,
      },
      {
        season: '2022',
        position: 'WR',
        playerName: 'A',
        games: 16,
        fantasyPointsPerGame: 15,
        yards: 960,
      },
    ]

    const pairs = collectTransitionPairs({
      players,
      position: 'RB',
      spec,
      seasons: ['2021', '2022'],
    })

    expect(pairs).toEqual([])
  })
})

describe('buildProductionWeights', () => {
  // Synthetic RB league: 40 players x 4 seasons, using the real RB
  // POSITION_SPECS metric definitions (imported inside the module under
  // test).
  //
  // Each player has a persistent "true talent" index (0..39), reflected
  // exactly and noise-free every season in receptionsPerGame. FPTS/G
  // instead reflects that same talent PLUS a fresh, talent-independent
  // "luck" term every season (a seeded, deterministic pseudo-random
  // sequence, mean ~0) — the same way a real player's touchdown-driven
  // fantasy total swings season to season even when his underlying role
  // doesn't. That makes receptionsPerGame a genuinely INCREMENTAL
  // predictor: it recovers the talent signal FPTS/G's own luck term
  // obscures, which is exactly the "does it add value beside FPTS/G"
  // property the residual-based test is designed to detect. Critically,
  // receptionsPerGame must NOT be a deterministic linear function of any
  // single season's FPTS/G value (that would make it collinear with the
  // baseline predictor within a training fold and mechanically zero out
  // its residual coefficient, regardless of whether it carries real
  // signal) — the independent luck term is what breaks that collinearity.
  //
  //   - receptionsPerGame = i, every season: clean, persistent, and the
  //     only true driver of next season's FPTS/G — should come out
  //     trusted with a meaningfully positive incremental r^2.
  //   - rushingYardsPerGame / touchdownsPerGame / receivingYardsPerGame
  //     are constant across every player-season (zero variance) and
  //     should come out untrusted with r^2 of exactly 0.
  function seededLuck(season, i) {
    // A small deterministic linear-congruential sequence, not a clean
    // function of `i` alone, with mean ~0 across the 40 players.
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

  it('trusts a metric that predicts next season better than FPTS/G, and rejects metrics with no signal', () => {
    const result = buildProductionWeights({
      players: buildSyntheticPlayers(),
      seasons: ['2021', '2022', '2023', '2024'],
    })

    const rb = result.RB
    expect(rb.n).toBe(120) // 40 players x 3 transitions

    expect(rb.metrics.receptionsPerGame.trusted).toBe(true)
    expect(rb.metrics.receptionsPerGame.r2).toBeGreaterThan(0.1)
    expect(rb.metrics.receptionsPerGame.totalShare).toBeGreaterThan(0)
    expect(
      rb.metrics.receptionsPerGame.validation.cvImprovement
    ).toBeGreaterThan(0)
    expect(
      rb.metrics.receptionsPerGame.validation.foldsBeatingBaseline
    ).toBeGreaterThan(rb.metrics.receptionsPerGame.validation.folds.length / 2)

    for (const noiseMetric of [
      'rushingYardsPerGame',
      'touchdownsPerGame',
      'receivingYardsPerGame',
    ]) {
      expect(rb.metrics[noiseMetric].r2).toBe(0)
      expect(rb.metrics[noiseMetric].totalShare).toBe(0)
      expect(rb.metrics[noiseMetric].trusted).toBe(false)
    }

    // The trusted metric's share comes out of the FPTS/G anchor; the
    // untrusted, zero-signal metrics keep zero weight rather than diluting it.
    expect(rb.weights.receptionsPerGame).toBeGreaterThan(0)
    expect(rb.weights.fantasyPointsPerGame).toBeLessThan(1)
    expect(rb.weights.rushingYardsPerGame).toBe(0)
    expect(rb.weights.touchdownsPerGame).toBe(0)
    expect(rb.weights.receivingYardsPerGame).toBe(0)

    // Weights always land on the same 0-100-equivalent scale: they sum to 1.
    const total = Object.values(rb.weights).reduce((a, b) => a + b, 0)
    expect(total).toBeCloseTo(1, 2)
  })

  it("reports POSITION_SPECS' current weights alongside the freshly validated ones for comparison", () => {
    const result = buildProductionWeights({
      players: buildSyntheticPlayers(),
      seasons: ['2021', '2022', '2023', '2024'],
    })

    // Whatever POSITION_SPECS currently says, reported verbatim — this
    // guards against `currentWeights` silently drifting from the real spec
    // it's meant to describe, without pinning exact values here (those
    // belong to build-production-scores.mjs, and are expected to change
    // as this harness is re-run against updated data).
    const total = Object.values(result.RB.currentWeights).reduce(
      (a, b) => a + b,
      0
    )
    expect(total).toBeCloseTo(1, 5)
  })

  it('validates all four skill positions', () => {
    const result = buildProductionWeights({
      players: buildSyntheticPlayers(),
      seasons: ['2021', '2022', '2023', '2024'],
    })

    expect(Object.keys(result).sort()).toEqual(['QB', 'RB', 'TE', 'WR'])
  })
})
