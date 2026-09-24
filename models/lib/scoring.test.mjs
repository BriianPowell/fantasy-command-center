import { describe, expect, it } from 'vitest'

import {
  adjustFantasyPoints,
  computeFantasyPoints,
  computeScoringDelta,
  HALF_PPR_RULES,
  PPR_RULES,
  rulesForScoringType,
  STANDARD_RULES,
} from './scoring.mjs'

describe('computeScoringDelta / adjustFantasyPoints', () => {
  it('is zero under standard scoring, so the ingested FPTS passes through unchanged', () => {
    // Real ingested record (data/model/historical_player_seasons.json).
    // FantasyPros' own FPTS (240.6) does NOT equal a from-scratch standard
    // recompute here (237.3, see computeFantasyPoints test below) — proof
    // that a delta of zero, not a recompute, is what keeps "standard" exact.
    const jefferson2022 = {
      fantasyPoints: 240.6,
      receptions: 128,
      receivingYards: 1809,
      receivingTouchdowns: 8,
      rushingYards: 24,
      rushingTouchdowns: 1,
      fumblesLost: 0,
    }

    expect(computeScoringDelta(jefferson2022, STANDARD_RULES)).toBe(0)
    expect(adjustFantasyPoints(jefferson2022, STANDARD_RULES)).toBe(240.6)
  })

  it('adds exactly the reception credit under half-PPR and PPR', () => {
    const record = { fantasyPoints: 200, receptions: 80 }

    expect(adjustFantasyPoints(record, STANDARD_RULES)).toBe(200)
    expect(adjustFantasyPoints(record, HALF_PPR_RULES)).toBe(240)
    expect(adjustFantasyPoints(record, PPR_RULES)).toBe(280)
  })

  it('treats a rule key missing from a custom scoring_settings as unchanged from standard', () => {
    // A league that only customizes `rec` — passing/rushing/fumble scoring
    // should stay at the standard baseline, not fall back to zero.
    const record = {
      fantasyPoints: 150,
      receptions: 10,
      passingYards: 300,
      fumblesLost: 1,
    }

    expect(adjustFantasyPoints(record, { rec: 1 })).toBe(160)
  })

  it('separates every rule term independently for a fully custom league', () => {
    const record = { fantasyPoints: 100, passingTouchdowns: 3, receptions: 5 }
    // pass_td: 6 instead of the standard 4 adds 2 pts/TD; rec: 1 adds 5.
    const customRules = { pass_td: 6, rec: 1 }

    expect(adjustFantasyPoints(record, customRules)).toBe(100 + 3 * 2 + 5 * 1)
  })

  it('treats missing fields as zero rather than throwing', () => {
    expect(adjustFantasyPoints({}, STANDARD_RULES)).toBe(0)
    expect(adjustFantasyPoints({ fantasyPoints: 50 }, undefined)).toBe(50)
  })
})

describe('computeFantasyPoints', () => {
  it('matches a from-scratch standard-scoring stat line when there is no hidden bonus term', () => {
    // Christian McCaffrey, 2023 RB — one of the player-seasons where the
    // box-score terms alone do reproduce FantasyPros' FPTS exactly.
    const cmc2023 = {
      rushingYards: 1459,
      rushingTouchdowns: 14,
      receptions: 67,
      receivingYards: 564,
      receivingTouchdowns: 7,
      fumblesLost: 2,
    }

    expect(computeFantasyPoints(cmc2023, STANDARD_RULES)).toBeCloseTo(
      324.3,
      5
    )
  })

  it('can diverge from the real FPTS when FantasyPros applies a mechanic the box score does not capture', () => {
    // Justin Jefferson, 2022 WR — real FPTS is 240.6; the box-score-only
    // recompute lands at 237.3. This is exactly why `adjustFantasyPoints`
    // (delta from the ingested value), not this function, drives the
    // production-score pipeline.
    const jefferson2022 = {
      receivingYards: 1809,
      receivingTouchdowns: 8,
      rushingYards: 24,
      rushingTouchdowns: 1,
      fumblesLost: 0,
    }

    expect(computeFantasyPoints(jefferson2022, STANDARD_RULES)).toBeCloseTo(
      237.3,
      5
    )
  })

  it('credits a reception at 1 point under PPR and 0.5 under half-PPR', () => {
    const wr = { receptions: 100, receivingYards: 0, receivingTouchdowns: 0 }

    expect(computeFantasyPoints(wr, STANDARD_RULES)).toBe(0)
    expect(computeFantasyPoints(wr, HALF_PPR_RULES)).toBe(50)
    expect(computeFantasyPoints(wr, PPR_RULES)).toBe(100)
  })

  it('treats missing fields as zero rather than throwing', () => {
    expect(computeFantasyPoints({}, STANDARD_RULES)).toBe(0)
    expect(computeFantasyPoints({ receptions: 5 }, undefined)).toBe(0)
  })

  it('accepts a raw Sleeper-shaped scoring_settings object with no translation', () => {
    const leagueScoringSettings = {
      pass_yd: 0.04,
      pass_td: 4,
      pass_int: -1,
      rush_yd: 0.1,
      rush_td: 6,
      rec: 1,
      rec_yd: 0.1,
      rec_td: 6,
      fum_lost: -2,
    }

    const qb = {
      passingYards: 300,
      passingTouchdowns: 2,
      interceptionsThrown: 1,
      rushingYards: 20,
      rushingTouchdowns: 0,
    }

    // 300*0.04 + 2*4 - 1*1 + 20*0.1 = 12 + 8 - 1 + 2 = 21
    expect(computeFantasyPoints(qb, leagueScoringSettings)).toBeCloseTo(21, 5)
  })
})

describe('rulesForScoringType', () => {
  it('maps standard/half_ppr/ppr to the matching preset', () => {
    expect(rulesForScoringType('standard')).toBe(STANDARD_RULES)
    expect(rulesForScoringType('half_ppr')).toBe(HALF_PPR_RULES)
    expect(rulesForScoringType('ppr')).toBe(PPR_RULES)
  })

  it('returns undefined for custom, so callers use the league scoring_settings directly', () => {
    expect(rulesForScoringType('custom')).toBeUndefined()
  })
})
