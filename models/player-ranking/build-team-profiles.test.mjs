import { describe, expect, it } from 'vitest'

import {
  buildDefensiveLineProfiles,
  buildOffensiveLineProfiles,
} from './build-team-profiles.mjs'

const SEASON = '2025'

function qb(
  team,
  { passAttempts, sacksTaken, knockdowns, hurries, pocketTime = 2.5 }
) {
  return {
    season: SEASON,
    position: 'QB',
    team,
    passAttempts,
    sacksTaken,
    knockdowns,
    hurries,
    pocketTime,
  }
}

function rb(team, { rushAttempts, yardsBeforeContact, yardsAfterContact = 0 }) {
  return {
    season: SEASON,
    position: 'RB',
    team,
    rushAttempts,
    yardsBeforeContact,
    yardsAfterContact,
  }
}

function defense(team, stats) {
  return {
    season: SEASON,
    position: 'DEF',
    team,
    playerName: `${team} D/ST`,
    stats,
  }
}

/** Three teams: AAA protects best and blocks best, CCC is worst at both. */
const ADVANCED = [
  qb('AAA', { passAttempts: 500, sacksTaken: 20, knockdowns: 20, hurries: 20 }),
  qb('BBB', { passAttempts: 500, sacksTaken: 40, knockdowns: 40, hurries: 40 }),
  qb('CCC', { passAttempts: 500, sacksTaken: 60, knockdowns: 60, hurries: 60 }),
  rb('AAA', {
    rushAttempts: 400,
    yardsBeforeContact: 1200,
    yardsAfterContact: 800,
  }),
  rb('BBB', {
    rushAttempts: 400,
    yardsBeforeContact: 800,
    yardsAfterContact: 800,
  }),
  rb('CCC', {
    rushAttempts: 400,
    yardsBeforeContact: 400,
    yardsAfterContact: 1600,
  }),
]

function byTeam(profiles) {
  return Object.fromEntries(profiles.map((profile) => [profile.team, profile]))
}

describe('buildOffensiveLineProfiles', () => {
  const profiles = byTeam(
    buildOffensiveLineProfiles({
      season: SEASON,
      advanced: ADVANCED,
      importedAt: 'X',
    })
  )

  it('ranks the least-pressured, best-blocking team first', () => {
    expect(profiles.AAA).toMatchObject({
      rank: 1,
      normalizedScore: 100,
      tier: 'elite',
    })
    expect(profiles.CCC).toMatchObject({ rank: 3, normalizedScore: 0 })
  })

  it('counts sacks as dropbacks when computing pressure rate', () => {
    // 60 pressures over 500 attempts + 20 sacks = 11.54%, not 12.00%.
    expect(profiles.AAA.inputs.pressureRate).toBeCloseTo(11.54, 2)
  })

  it('credits the line for yards before contact only', () => {
    expect(profiles.CCC.inputs.yardsBeforeContactPerAttempt).toBe(1)
    expect(profiles.CCC.runBlockingScore).toBe(0)
  })

  it('does not let yards after contact lift the run-blocking score', () => {
    // CCC's backs gained the most yards after contact and still rank last.
    expect(profiles.CCC.inputs.yardsAfterContactPerAttempt).toBe(4)
    expect(profiles.CCC.rank).toBe(3)
  })

  it('weights a team by volume rather than by player count', () => {
    const withBackup = buildOffensiveLineProfiles({
      season: SEASON,
      advanced: [
        ...ADVANCED,
        qb('AAA', {
          passAttempts: 3,
          sacksTaken: 3,
          knockdowns: 3,
          hurries: 3,
        }),
      ],
      importedAt: 'X',
    })

    expect(byTeam(withBackup).AAA.rank).toBe(1)
  })

  it('excludes a thin sample from ranking and flags it in the notes', () => {
    const thin = buildOffensiveLineProfiles({
      season: SEASON,
      advanced: [
        ...ADVANCED,
        qb('DDD', {
          passAttempts: 20,
          sacksTaken: 1,
          knockdowns: 1,
          hurries: 1,
        }),
        rb('DDD', { rushAttempts: 10, yardsBeforeContact: 30 }),
      ],
      importedAt: 'X',
    })

    const ddd = byTeam(thin).DDD
    const notes = ddd.notes.join(' ')
    expect(notes).toContain(
      'pass protection excluded from ranking: thin sample'
    )
    expect(notes).toContain('run blocking excluded from ranking: thin sample')
    // Excluded from the percentile pool entirely, not just annotated.
    expect(ddd.passProtectionScore).toBeUndefined()
    expect(ddd.runBlockingScore).toBeUndefined()
    expect(ddd.normalizedScore).toBeUndefined()
    expect(ddd.rank).toBeUndefined()
    expect(ddd.tier).toBeUndefined()
    expect(byTeam(thin).AAA.notes.join(' ')).not.toContain('thin')
  })

  it('does not let a team with zero measured dropbacks look elite', () => {
    // A team entirely missing from the advanced-qb report would otherwise
    // have pressureRate default to 0, and "least pressure wins" would rank
    // it #1 — indistinguishable from a genuinely great line.
    const withZeroSample = buildOffensiveLineProfiles({
      season: SEASON,
      advanced: [
        ...ADVANCED,
        rb('ZZZ', { rushAttempts: 400, yardsBeforeContact: 800 }),
      ],
      importedAt: 'X',
    })

    const zzz = byTeam(withZeroSample).ZZZ
    expect(zzz.inputs.dropbacks).toBe(0)
    expect(zzz.passProtectionScore).toBeUndefined()
    // Run blocking still has a real sample, so it scores normally and the
    // team's overall score comes from that alone.
    expect(zzz.runBlockingScore).toBeDefined()
    expect(zzz.normalizedScore).toBe(zzz.runBlockingScore)
    // Crucially: not ranked #1 on the strength of an absent pass sample.
    expect(zzz.rank).not.toBe(1)
  })

  it('gives no rank at all to a team with no usable data in either report', () => {
    const noData = buildOffensiveLineProfiles({
      season: SEASON,
      // A team appears only because groupBy requires a truthy team value;
      // give it a QB row so it's included in `teams`, but too little
      // volume in either report to trust.
      advanced: [
        ...ADVANCED,
        qb('EEE', {
          passAttempts: 3,
          sacksTaken: 0,
          knockdowns: 0,
          hurries: 0,
        }),
      ],
      importedAt: 'X',
    })

    const eee = byTeam(noData).EEE
    expect(eee.normalizedScore).toBeUndefined()
    expect(eee.rank).toBeUndefined()
    expect(eee.tier).toBeUndefined()
    // The other teams still rank normally among themselves.
    expect(byTeam(noData).AAA.rank).toBe(1)
  })

  it('ignores other seasons', () => {
    const profiles2024 = buildOffensiveLineProfiles({
      season: '2024',
      advanced: ADVANCED,
      importedAt: 'X',
    })

    expect(profiles2024).toEqual([])
  })
})

describe('buildDefensiveLineProfiles', () => {
  const players = [
    defense('AAA', { sacks: 60, interceptions: 20, fumbleRecoveries: 10 }),
    defense('BBB', { sacks: 40, interceptions: 10, fumbleRecoveries: 5 }),
    defense('CCC', { sacks: 20, interceptions: 5, fumbleRecoveries: 2 }),
  ]
  const profiles = byTeam(
    buildDefensiveLineProfiles({ season: SEASON, players, importedAt: 'X' })
  )

  it('ranks by sacks and takeaways', () => {
    expect(profiles.AAA).toMatchObject({ rank: 1, passRushScore: 100 })
    expect(profiles.CCC).toMatchObject({ rank: 3, passRushScore: 0 })
  })

  it('leaves run defense absent rather than inventing it', () => {
    expect(profiles.AAA.runDefenseScore).toBeUndefined()
    expect(profiles.AAA.notes.join(' ')).toContain('no run-defense score')
  })

  it('weights pass rush above takeaways', () => {
    const conflicted = byTeam(
      buildDefensiveLineProfiles({
        season: SEASON,
        players: [
          defense('SACKS', {
            sacks: 60,
            interceptions: 0,
            fumbleRecoveries: 0,
          }),
          defense('TAKES', {
            sacks: 20,
            interceptions: 25,
            fumbleRecoveries: 10,
          }),
        ],
        importedAt: 'X',
      })
    )

    expect(conflicted.SACKS.rank).toBe(1)
  })

  it('tolerates a defense with no stats bag', () => {
    const sparse = buildDefensiveLineProfiles({
      season: SEASON,
      players: [
        {
          season: SEASON,
          position: 'DEF',
          team: 'AAA',
          playerName: 'AAA D/ST',
        },
      ],
      importedAt: 'X',
    })

    expect(sparse[0].inputs).toMatchObject({ sacks: 0, takeaways: 0 })
  })

  it('ignores non-defense records', () => {
    const mixed = buildDefensiveLineProfiles({
      season: SEASON,
      players: [
        ...players,
        { season: SEASON, position: 'QB', team: 'AAA', playerName: 'Someone' },
      ],
      importedAt: 'X',
    })

    expect(mixed).toHaveLength(3)
  })
})
