import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { HALF_PPR_RULES, PPR_RULES, STANDARD_RULES } from '../lib/scoring.mjs'
import {
  applyScoringRules,
  buildProductionScores,
  resolveScoringOption,
  SCORED_POSITIONS,
} from './build-production-scores.mjs'

/** Build a receiver from per-game rates, so games and totals stay consistent. */
function wr(
  playerName,
  { games = 17, perGame, targetShare, season = '2025', position = 'WR' }
) {
  const [points, yards, catches, touchdowns] = perGame
  return {
    playerName,
    position,
    season,
    team: 'AAA',
    games,
    fantasyPoints: points * games,
    fantasyPointsPerGame: points,
    receivingYards: yards * games,
    receptions: catches * games,
    receivingTouchdowns: touchdowns * games,
    targetShare,
  }
}

const COHORT = [
  wr('Best', { perGame: [20, 100, 7, 0.7], targetShare: 28 }),
  wr('Middle', { perGame: [12, 60, 4.5, 0.35], targetShare: 20 }),
  wr('Worst', { perGame: [5, 25, 2, 0.06], targetShare: 12 }),
]

function byName(scores) {
  return Object.fromEntries(scores.map((score) => [score.playerName, score]))
}

describe('buildProductionScores', () => {
  it('spans 0-100 within a cohort and ranks best first', () => {
    const scores = byName(buildProductionScores(COHORT))

    expect(scores.Best).toMatchObject({
      productionScore: 100,
      positionRank: 1,
      qualified: true,
    })
    expect(scores.Middle.productionScore).toBeGreaterThan(0)
    expect(scores.Middle.productionScore).toBeLessThan(100)
    expect(scores.Worst).toMatchObject({ productionScore: 0, positionRank: 3 })
  })

  it('measures rate, not availability', () => {
    // Same per-game production over half a season ties the full-season player.
    const half = wr('Half', {
      games: 8,
      perGame: [12, 60, 4.5, 0.35],
      targetShare: 20,
    })
    const scores = byName(buildProductionScores([...COHORT, half]))

    expect(scores.Half.productionScore).toBeCloseTo(
      scores.Middle.productionScore,
      5
    )
  })

  it('keeps short seasons out of the percentile pool but still reports them', () => {
    const cameo = wr('Cameo', {
      games: 3,
      perGame: [40, 200, 12, 2],
      targetShare: 40,
    })
    const scores = byName(buildProductionScores([...COHORT, cameo]))

    expect(scores.Cameo).toMatchObject({
      productionScore: null,
      positionRank: null,
      qualified: false,
    })
    expect(scores.Cameo.note).toContain('6 games')
    // The cameo did not displace the real leader.
    expect(scores.Best.productionScore).toBe(100)
  })

  it('scores tight ends against tight ends', () => {
    const tightEnds = COHORT.map((record) => ({
      ...record,
      position: 'TE',
      playerName: `TE ${record.playerName}`,
    }))
    const scores = byName(buildProductionScores([...COHORT, ...tightEnds]))

    expect(scores['TE Best']).toMatchObject({
      position: 'TE',
      positionRank: 1,
      productionScore: 100,
    })
    expect(scores.Best).toMatchObject({
      position: 'WR',
      positionRank: 1,
      productionScore: 100,
    })
  })

  it('scores each season separately', () => {
    const previous = COHORT.map((record) => ({ ...record, season: '2024' }))
    const scores = buildProductionScores([...COHORT, ...previous])

    expect(scores.filter((score) => score.positionRank === 1)).toHaveLength(2)
  })

  it('ignores positions it has no scale for', () => {
    const scores = buildProductionScores([
      ...COHORT,
      { ...COHORT[0], position: 'P', playerName: 'Punter' },
    ])

    expect(
      scores.find((score) => score.playerName === 'Punter')
    ).toBeUndefined()
  })

  it('ranks the higher-FPTS/G back first even when a lower-scoring back has flashier category stats (issue #38 regression)', () => {
    // Real 2021 RB lines: Jonathan Taylor led all RBs in FPTS/G (19.6) but
    // ranked behind Austin Ekeler (17.1 FPTS/G) under the old hand-picked
    // weights, because Ekeler's touchdown rate and reception volume scored
    // higher on those individual components. The validated weights
    // (derived in build-production-weights.mjs) correct this: FPTS/G
    // dominates the score, so the back who actually scored more per game
    // outranks the back who merely had flashier category rates.
    const higherFppgLowerCategories = {
      playerName: 'Higher FPTS/G',
      position: 'RB',
      season: '2021',
      team: 'AAA',
      games: 17,
      fantasyPoints: 333.1,
      fantasyPointsPerGame: 19.6,
      rushingYards: 1811,
      rushingTouchdowns: 18,
      receptions: 40,
      receivingYards: 360,
      receivingTouchdowns: 2,
    }
    const lowerFppgHigherCategories = {
      playerName: 'Lower FPTS/G',
      position: 'RB',
      season: '2021',
      team: 'BBB',
      games: 16,
      fantasyPoints: 273.8,
      fantasyPointsPerGame: 17.1,
      rushingYards: 911,
      rushingTouchdowns: 12,
      receptions: 70,
      receivingYards: 520,
      receivingTouchdowns: 8,
    }

    const scores = byName(
      buildProductionScores([higherFppgLowerCategories, lowerFppgHigherCategories])
    )

    expect(scores['Higher FPTS/G'].productionScore).toBeGreaterThan(
      scores['Lower FPTS/G'].productionScore
    )
    expect(scores['Higher FPTS/G'].positionRank).toBe(1)
    expect(scores['Lower FPTS/G'].positionRank).toBe(2)
  })

  it('exposes the component percentiles behind each score', () => {
    const { Best } = byName(buildProductionScores(COHORT))

    expect(Best.components).toMatchObject({
      fantasyPointsPerGame: 100,
      receivingYardsPerGame: 100,
      receptionsPerGame: 100,
      receivingTouchdownsPerGame: 100,
    })
  })

  it('tolerates missing optional stats', () => {
    const sparse = [
      {
        playerName: 'Bare',
        position: 'QB',
        season: '2025',
        team: 'AAA',
        games: 17,
        fantasyPoints: 200,
        fantasyPointsPerGame: 11.8,
      },
      {
        playerName: 'Full',
        position: 'QB',
        season: '2025',
        team: 'BBB',
        games: 17,
        fantasyPoints: 400,
        fantasyPointsPerGame: 23.5,
        passingYards: 4500,
        passingTouchdowns: 35,
        rushingYards: 400,
        rushingTouchdowns: 5,
      },
    ]
    const scores = byName(buildProductionScores(sparse))

    expect(scores.Full.productionScore).toBe(100)
    expect(scores.Bare.productionScore).toBe(0)
  })

  it('covers every position the app ranks', () => {
    expect(SCORED_POSITIONS.sort()).toEqual([
      'DEF',
      'K',
      'QB',
      'RB',
      'TE',
      'WR',
    ])
  })

  it('recomputes fantasy points under a real league scoring format instead of trusting the ingested FPTS', () => {
    // A pass-catching RB and a between-the-tackles RB who reproduce the
    // exact same ingested (standard-scoring) total, but with very different
    // reception volume (500/10 + 4*6 + 400/10 + 1*6 = 120; 1200/10 = 120).
    const receiver = {
      playerName: 'Receiver Back',
      position: 'RB',
      season: '2025',
      team: 'AAA',
      games: 16,
      fantasyPoints: 120, // matches the standard-scoring math below exactly
      fantasyPointsPerGame: 7.5,
      rushingYards: 500,
      rushingTouchdowns: 4,
      receptions: 80,
      receivingYards: 400,
      receivingTouchdowns: 1,
      fumblesLost: 0,
    }
    const grinder = {
      playerName: 'Grinder Back',
      position: 'RB',
      season: '2025',
      team: 'BBB',
      games: 16,
      fantasyPoints: 120,
      fantasyPointsPerGame: 7.5,
      rushingYards: 1200,
      rushingTouchdowns: 0,
      receptions: 0,
      receivingYards: 0,
      receivingTouchdowns: 0,
      fumblesLost: 0,
    }

    const standard = byName(
      buildProductionScores([receiver, grinder], {
        scoringRules: STANDARD_RULES,
      })
    )
    // Under standard scoring both land on the same recomputed total,
    // ignoring the (irrelevant) ingested FantasyPros FPTS entirely.
    expect(standard['Receiver Back'].fantasyPoints).toBeCloseTo(120, 0)
    expect(standard['Grinder Back'].fantasyPoints).toBeCloseTo(120, 0)

    const ppr = byName(
      buildProductionScores([receiver, grinder], { scoringRules: PPR_RULES })
    )
    // Under PPR, 80 receptions add 80 points the standard total never counted.
    expect(ppr['Receiver Back'].fantasyPoints).toBeCloseTo(200, 0)
    expect(ppr['Grinder Back'].fantasyPoints).toBeCloseTo(120, 0)
    expect(ppr['Receiver Back'].productionScore).toBeGreaterThan(
      ppr['Grinder Back'].productionScore
    )
  })

  it('leaves K and DEF fantasy points untouched by scoring rules', () => {
    const kicker = {
      playerName: 'Reliable Kicker',
      position: 'K',
      season: '2025',
      team: 'AAA',
      games: 16,
      fantasyPoints: 150,
      fantasyPointsPerGame: 9.4,
      stats: { fieldGoalsMade: 30, fieldGoals50plus: 3 },
    }

    const scores = byName(
      buildProductionScores([kicker], { scoringRules: PPR_RULES })
    )

    expect(scores['Reliable Kicker'].fantasyPoints).toBe(150)
  })
})

describe('applyScoringRules', () => {
  it('recomputes recomputable positions and passes everything else through unchanged', () => {
    const wrRecord = {
      playerName: 'Some WR',
      position: 'WR',
      games: 10,
      fantasyPoints: 80, // ingested, standard-scoring total: 500/10 + 5*6
      receptions: 50,
      receivingYards: 500,
      receivingTouchdowns: 5,
    }
    const kRecord = {
      playerName: 'Some K',
      position: 'K',
      games: 10,
      fantasyPoints: 90,
      fantasyPointsPerGame: 9,
    }

    const [rated, untouched] = applyScoringRules([wrRecord, kRecord], PPR_RULES)

    // Standard total (80) plus 50 receptions * 1 pt under PPR.
    expect(rated.fantasyPoints).toBeCloseTo(130, 1)
    expect(rated.fantasyPointsPerGame).toBeCloseTo(13, 1)
    expect(untouched).toEqual(kRecord)
  })
})

describe('resolveScoringOption', () => {
  let tempDir

  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true })
    tempDir = undefined
  })

  it('defaults to standard scoring when no flag is given', async () => {
    const { rules, label } = await resolveScoringOption([])
    expect(rules).toBe(STANDARD_RULES)
    expect(label).toBe('standard (default)')
  })

  it('maps --scoring to the matching preset', async () => {
    expect((await resolveScoringOption(['--scoring', 'half_ppr'])).rules).toBe(
      HALF_PPR_RULES
    )
    expect((await resolveScoringOption(['--scoring', 'ppr'])).rules).toBe(
      PPR_RULES
    )
  })

  it('rejects an unknown --scoring value', async () => {
    await expect(
      resolveScoringOption(['--scoring', 'bogus'])
    ).rejects.toThrow(/Unknown --scoring value/)
  })

  it('reads a custom scoring_settings object from --scoring-settings', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'scoring-settings-'))
    const path = join(tempDir, 'league.json')
    await writeFile(path, JSON.stringify({ rec: 1, rec_yd: 0.1 }))

    const { rules, label } = await resolveScoringOption([
      '--scoring-settings',
      path,
    ])

    expect(rules).toEqual({ rec: 1, rec_yd: 0.1 })
    expect(label).toBe(`custom (${path})`)
  })
})
