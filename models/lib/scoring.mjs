/**
 * Adjust a player-season's fantasy points for a different scoring format,
 * instead of trusting a vendor's baked-in FPTS column for every league.
 *
 * Why this exists: FantasyPros' "Fantasy Football Statistics" export FPTS
 * is fixed to standard (0 points/reception) scoring, but a real fantasy
 * league is rarely standard. The app already knows the user's actual league
 * rules at runtime (`league.scoring_settings` from Sleeper, surfaced via
 * `inferScoringType` in sleeperNormalizers.ts) — ranking players by
 * FantasyPros' FPTS silently re-grades every season under a scoring format
 * that may not be the one being played.
 *
 * The rule shape here intentionally mirrors Sleeper's `scoring_settings`
 * field names and per-unit convention (e.g. `pass_yd: 0.04` means 1 point
 * per 25 yards) so a league's real settings object can be passed straight
 * through with zero translation.
 *
 * ## Delta, not a from-scratch recompute
 *
 * `adjustFantasyPoints` starts from the ingested FPTS and adds only the
 * *difference* a rule change makes (e.g. `receptions * (rec - 0)` for
 * moving off standard scoring), rather than recomputing the total from raw
 * counting stats alone. That distinction matters: a from-scratch recompute
 * (`computeFantasyPoints`, below) does not reliably reproduce FantasyPros'
 * own standard-scoring FPTS. It matches exactly for some players —
 *
 *   Puka Nacua, 2025 WR: 1715 recYd/10 + 105 rushYd/10 + 11 TD*6 - 1 FL*2
 *     = 171.5 + 10.5 + 66 - 2 = 246.0 (reported FPTS: 246.0)
 *
 * — but not others:
 *
 *   Justin Jefferson, 2022 WR: 1809 recYd/10 + 24 rushYd/10 + 9 TD*6 - 0 FL*2
 *     = 180.9 + 2.4 + 54 = 237.3 (reported FPTS: 240.6 — off by 3.3)
 *
 * FantasyPros' real formula evidently includes at least one mechanic
 * (likely a per-game yardage or long-play bonus) that isn't visible in a
 * season-total export, so a from-scratch recompute can silently reorder
 * rankings even under "standard" scoring — which is exactly what a
 * `--scoring standard` run should never do. The delta approach sidesteps
 * this: when `rules` matches `STANDARD_RULES` term-for-term, the delta is
 * zero and the trusted ingested FPTS passes through unchanged, whatever
 * hidden mechanics produced it. Only the terms that actually change
 * (typically just `rec`, for PPR/half-PPR) are computed ourselves.
 */

/**
 * Standard (0-PPR) scoring — matches what FantasyPros' FPTS column already
 * uses. This is the baseline `adjustFantasyPoints` measures every other
 * rule set against; it does not need to be a perfectly accurate model of
 * FantasyPros' internal formula (see the Jefferson case above) because the
 * ingested FPTS is trusted directly whenever a term matches this baseline.
 */
export const STANDARD_RULES = {
  pass_yd: 0.04, // 1 pt / 25 yards
  pass_td: 4,
  pass_int: -2,
  rush_yd: 0.1, // 1 pt / 10 yards
  rush_td: 6,
  rec: 0,
  rec_yd: 0.1, // 1 pt / 10 yards
  rec_td: 6,
  fum_lost: -2,
}

export const HALF_PPR_RULES = { ...STANDARD_RULES, rec: 0.5 }

export const PPR_RULES = { ...STANDARD_RULES, rec: 1 }

const RULES_BY_SCORING_TYPE = {
  standard: STANDARD_RULES,
  half_ppr: HALF_PPR_RULES,
  ppr: PPR_RULES,
}

/**
 * Look up a built-in rule set by the app's `LeagueSettings['scoringType']`.
 * Returns `undefined` for `'custom'` — callers should pass the league's own
 * `scoring_settings` to `adjustFantasyPoints` directly in that case.
 */
export function rulesForScoringType(scoringType) {
  return RULES_BY_SCORING_TYPE[scoringType]
}

/** Per-unit rule keys `adjustFantasyPoints`/`computeFantasyPoints` know about. */
const RULE_KEYS = [
  ['passingYards', 'pass_yd'],
  ['passingTouchdowns', 'pass_td'],
  ['interceptionsThrown', 'pass_int'],
  ['rushingYards', 'rush_yd'],
  ['rushingTouchdowns', 'rush_td'],
  ['receptions', 'rec'],
  ['receivingYards', 'rec_yd'],
  ['receivingTouchdowns', 'rec_td'],
  ['fumblesLost', 'fum_lost'],
]

/**
 * The points a rule change adds or removes relative to `STANDARD_RULES`,
 * for the counting stats present on `record`. A rule key missing from
 * `rules` is treated as unchanged from standard (e.g. a custom league that
 * only sets `rec` leaves passing/rushing/fumble scoring at the standard
 * baseline rather than zeroing it out).
 */
export function computeScoringDelta(record, rules) {
  return RULE_KEYS.reduce((total, [statKey, ruleKey]) => {
    const statValue = record[statKey] ?? 0
    const standardRate = STANDARD_RULES[ruleKey] ?? 0
    const targetRate = rules?.[ruleKey] ?? standardRate
    return total + statValue * (targetRate - standardRate)
  }, 0)
}

/**
 * Adjust a player-season's ingested `fantasyPoints` for a different scoring
 * format. Returns the ingested value unchanged when `rules` is omitted or
 * matches standard scoring term-for-term (the common case: only `rec`
 * differs for PPR/half-PPR).
 */
export function adjustFantasyPoints(record, rules) {
  return (record.fantasyPoints ?? 0) + computeScoringDelta(record, rules)
}

/**
 * Recompute a player-season's fantasy points from raw counting stats alone,
 * with no reference to the ingested FPTS.
 *
 * Prefer `adjustFantasyPoints` for real player-seasons — see the module
 * doc comment above for why a from-scratch recompute can silently diverge
 * from FantasyPros' own standard-scoring total. This is useful for
 * synthetic/test data where there is no ingested FPTS to adjust, or for
 * sanity-checking a rule set against a known stat line.
 */
export function computeFantasyPoints(record, rules) {
  const r = rules ?? STANDARD_RULES
  return RULE_KEYS.reduce((total, [statKey, ruleKey]) => {
    const statValue = record[statKey] ?? 0
    const rate = r[ruleKey] ?? 0
    return total + statValue * rate
  }, 0)
}
