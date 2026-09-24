/**
 * Versioned column contract for the FantasyPros CSV exports.
 *
 * Header names repeat within a single report — the QB Statistics export has
 * `ATT`, `YDS` and `TD` for both passing and rushing — so columns have to be
 * read positionally. That is only safe if we also verify the header is the
 * one we expect, which is what `matchHeader` is for: if FantasyPros ever
 * inserts or reorders a column, ingestion fails loudly instead of silently
 * reading the wrong numbers into every record.
 *
 * When a layout does change, add a new entry to that report's `versions`
 * array rather than editing the existing one, so older exports still import.
 */

/** FantasyPros writes team defense as DST; the domain Position type uses DEF. */
export const POSITION_BY_TOKEN = {
  QB: 'QB',
  RB: 'RB',
  WR: 'WR',
  TE: 'TE',
  K: 'K',
  DST: 'DEF',
}

const STATISTICS_HEADERS = {
  QB: [
    'Rank',
    'Player',
    'CMP',
    'ATT',
    'PCT',
    'YDS',
    'Y/A',
    'TD',
    'INT',
    'SACKS',
    'ATT',
    'YDS',
    'TD',
    'FL',
    'G',
    'FPTS',
    'FPTS/G',
    'ROST',
  ],
  RB: [
    'Rank',
    'Player',
    'ATT',
    'YDS',
    'Y/A',
    'LG',
    '20+',
    'TD',
    'TGT',
    'REC',
    'YDS',
    'Y/R',
    'TD',
    'FL',
    'G',
    'FPTS',
    'FPTS/G',
    'ROST',
  ],
  WR: [
    'Rank',
    'Player',
    'TGT',
    'TGT %',
    'REC',
    'YDS',
    'Y/R',
    '20+',
    'TD',
    'ATT',
    'YDS',
    'TD',
    'FL',
    'G',
    'FPTS',
    'FPTS/G',
    'ROST',
  ],
  TE: [
    'Rank',
    'Player',
    'TGT',
    'TGT %',
    'REC',
    'YDS',
    'Y/R',
    '20+',
    'TD',
    'ATT',
    'YDS',
    'TD',
    'FL',
    'G',
    'FPTS',
    'FPTS/G',
    'ROST',
  ],
  K: [
    'Rank',
    'Player',
    'FG',
    'FGA',
    'PCT',
    'LG',
    '1-19',
    '20-29',
    '30-39',
    '40-49',
    '50+',
    'XPT',
    'XPA',
    'G',
    'FPTS',
    'FPTS/G',
    'ROST',
  ],
  DST: [
    'Rank',
    'Player',
    'SACK',
    'INT',
    'FR',
    'FF',
    'DEF TD',
    'SFTY',
    'SPC TD',
    'G',
    'FPTS',
    'FPTS/G',
    'ROST',
  ],
}

const ADVANCED_HEADERS = {
  QB: [
    'RK',
    'Player',
    'G',
    'PASSING COMP',
    'PASSING ATT',
    'PASSING PCT',
    'PASSING YDS',
    'PASSING Y/A',
    'PASSING AIR',
    'PASSING AIR/A',
    'DEEP BALL PASSING 10+ YDS',
    'DEEP BALL PASSING 20+ YDS',
    'DEEP BALL PASSING 30+ YDS',
    'DEEP BALL PASSING 40+ YDS',
    'DEEP BALL PASSING 50+ YDS',
    'PRESSURE PKT TIME',
    'PRESSURE SACK',
    'PRESSURE KNCK',
    'PRESSURE HRRY',
    'PRESSURE BLITZ',
    'MISC POOR',
    'MISC DROP',
    'MISC RZ ATT',
    'MISC RTG',
  ],
  RB: [
    'RK',
    'Player',
    'G',
    'RUSHING ATT',
    'RUSHING YDS',
    'RUSHING Y/ATT',
    'RUSHING YBCON',
    'RUSHING YBCON/ATT',
    'RUSHING YACON',
    'RUSHING YACON/ATT',
    'RUSHING BRKTKL',
    'RUSHING TK LOSS',
    'RUSHING TK LOSS YDS',
    'RUSHING LNG TD',
    'BIG RUSH PLAYS 10+ YDS',
    'BIG RUSH PLAYS 20+ YDS',
    'BIG RUSH PLAYS 30+ YDS',
    'BIG RUSH PLAYS 40+ YDS',
    'BIG RUSH PLAYS 50+ YDS',
    'BIG RUSH PLAYS LNG',
    'RECEIVING REC',
    'RECEIVING TGT',
    'RECEIVING RZ TGT',
    'RECEIVING YACON',
  ],
  WR: [
    'RK',
    'Player',
    'G',
    'RECEIVING REC',
    'RECEIVING YDS',
    'RECEIVING Y/R',
    'RECEIVING YBC',
    'RECEIVING YBC/R',
    'RECEIVING AIR',
    'RECEIVING AIR/R',
    'RECEIVING YAC',
    'RECEIVING YAC/R',
    'RECEIVING YACON',
    'RECEIVING YACON/R',
    'RECEIVING BRKTKL',
    'TARGETS TGT',
    'TARGETS % TM',
    'TARGETS CATCHABLE',
    'TARGETS DROP',
    'TARGETS RZ TGT',
    'BIG PLAYS 10+ YDS',
    'BIG PLAYS 20+ YDS',
    'BIG PLAYS 30+ YDS',
    'BIG PLAYS 40+ YDS',
    'BIG PLAYS 50+ YDS',
    'BIG PLAYS LNG',
  ],
  TE: [
    'RK',
    'Player',
    'G',
    'RECEIVING REC',
    'RECEIVING YDS',
    'RECEIVING Y/R',
    'RECEIVING YBC',
    'RECEIVING YBC/R',
    'RECEIVING AIR',
    'RECEIVING AIR/R',
    'RECEIVING YAC',
    'RECEIVING YAC/R',
    'RECEIVING YACON',
    'RECEIVING YACON/R',
    'RECEIVING BRKTKL',
    'TARGETS TGT',
    'TARGETS % TM',
    'TARGETS CATCHABLE',
    'TARGETS DROP',
    'TARGETS RZ TGT',
    'BIG PLAYS 10+ YDS',
    'BIG PLAYS 20+ YDS',
    'BIG PLAYS 30+ YDS',
    'BIG PLAYS 40+ YDS',
    'BIG PLAYS 50+ YDS',
    'BIG PLAYS LNG',
  ],
}

/**
 * Report descriptors. `rows` bounds are deliberately loose around the
 * 2021-2025 observed range — they exist to catch a truncated or wrong-report
 * download, not to police normal year-to-year drift in the player pool.
 */
export const REPORTS = [
  {
    id: 'statistics-qb',
    kind: 'statistics',
    token: 'QB',
    position: 'QB',
    required: true,
    rows: { min: 40, max: 150 },
    versions: [
      {
        version: 'v1',
        header: STATISTICS_HEADERS.QB,
        columns: {
          passingYards: 5,
          passingTouchdowns: 7,
          interceptionsThrown: 8,
          carries: 10,
          rushingYards: 11,
          rushingTouchdowns: 12,
          fumblesLost: 13,
          games: 14,
          fantasyPoints: 15,
          fantasyPointsPerGame: 16,
        },
      },
    ],
  },
  {
    id: 'statistics-rb',
    kind: 'statistics',
    token: 'RB',
    position: 'RB',
    required: true,
    rows: { min: 80, max: 320 },
    versions: [
      {
        version: 'v1',
        header: STATISTICS_HEADERS.RB,
        columns: {
          carries: 2,
          rushingYards: 3,
          rushingTouchdowns: 7,
          receivingTargets: 8,
          receptions: 9,
          receivingYards: 10,
          receivingTouchdowns: 12,
          fumblesLost: 13,
          games: 14,
          fantasyPoints: 15,
          fantasyPointsPerGame: 16,
        },
      },
    ],
  },
  {
    id: 'statistics-wr',
    kind: 'statistics',
    token: 'WR',
    position: 'WR',
    required: true,
    rows: { min: 120, max: 420 },
    versions: [
      {
        version: 'v1',
        header: STATISTICS_HEADERS.WR,
        columns: {
          receivingTargets: 2,
          targetShare: 3,
          receptions: 4,
          receivingYards: 5,
          receivingTouchdowns: 8,
          carries: 9,
          rushingYards: 10,
          rushingTouchdowns: 11,
          fumblesLost: 12,
          games: 13,
          fantasyPoints: 14,
          fantasyPointsPerGame: 15,
        },
      },
    ],
  },
  {
    id: 'statistics-te',
    kind: 'statistics',
    token: 'TE',
    position: 'TE',
    required: true,
    rows: { min: 70, max: 260 },
    versions: [
      {
        version: 'v1',
        header: STATISTICS_HEADERS.TE,
        columns: {
          receivingTargets: 2,
          targetShare: 3,
          receptions: 4,
          receivingYards: 5,
          receivingTouchdowns: 8,
          carries: 9,
          rushingYards: 10,
          rushingTouchdowns: 11,
          fumblesLost: 12,
          games: 13,
          fantasyPoints: 14,
          fantasyPointsPerGame: 15,
        },
      },
    ],
  },
  {
    id: 'statistics-k',
    kind: 'statistics',
    token: 'K',
    position: 'K',
    required: true,
    rows: { min: 20, max: 90 },
    versions: [
      {
        version: 'v1',
        header: STATISTICS_HEADERS.K,
        columns: {
          fieldGoalsMade: 2,
          fieldGoalsAttempted: 3,
          fieldGoalPct: 4,
          fieldGoals20to29: 7,
          fieldGoals30to39: 8,
          fieldGoals40to49: 9,
          fieldGoals50plus: 10,
          extraPointsMade: 11,
          games: 13,
          fantasyPoints: 14,
          fantasyPointsPerGame: 15,
        },
      },
    ],
  },
  {
    id: 'statistics-dst',
    kind: 'statistics',
    token: 'DST',
    position: 'DEF',
    required: true,
    // Every NFL team appears exactly once, so this one is pinned.
    rows: { min: 32, max: 32 },
    versions: [
      {
        version: 'v1',
        header: STATISTICS_HEADERS.DST,
        columns: {
          sacks: 2,
          interceptions: 3,
          fumbleRecoveries: 4,
          forcedFumbles: 5,
          defensiveTouchdowns: 6,
          safeties: 7,
          specialTeamsTouchdowns: 8,
          games: 9,
          fantasyPoints: 10,
          fantasyPointsPerGame: 11,
        },
      },
    ],
  },
  {
    id: 'advanced-qb',
    kind: 'advanced',
    token: 'QB',
    position: 'QB',
    // Required: the only source of pass-protection pressure data.
    required: true,
    rows: { min: 40, max: 150 },
    versions: [
      {
        version: 'v1',
        header: ADVANCED_HEADERS.QB,
        columns: {
          games: 2,
          passAttempts: 4,
          passingYards: 6,
          pocketTime: 15,
          sacksTaken: 16,
          knockdowns: 17,
          hurries: 18,
          blitzes: 19,
        },
      },
    ],
  },
  {
    id: 'advanced-rb',
    kind: 'advanced',
    token: 'RB',
    position: 'RB',
    // Required: the only source of yards-before-contact for run blocking.
    required: true,
    rows: { min: 70, max: 280 },
    versions: [
      {
        version: 'v1',
        header: ADVANCED_HEADERS.RB,
        columns: {
          games: 2,
          rushAttempts: 3,
          rushingYards: 4,
          yardsBeforeContact: 6,
          yardsBeforeContactPerAttempt: 7,
          yardsAfterContact: 8,
          yardsAfterContactPerAttempt: 9,
        },
      },
    ],
  },
  {
    id: 'advanced-wr',
    kind: 'advanced',
    token: 'WR',
    position: 'WR',
    // Optional: target share also comes from the Statistics export's TGT %.
    required: false,
    rows: { min: 100, max: 340 },
    versions: [
      {
        version: 'v1',
        header: ADVANCED_HEADERS.WR,
        columns: {
          games: 2,
          receptions: 3,
          receivingYards: 4,
          targets: 15,
          targetShare: 16,
        },
      },
    ],
  },
  {
    id: 'advanced-te',
    kind: 'advanced',
    token: 'TE',
    position: 'TE',
    // Optional: target share also comes from the Statistics export's TGT %.
    required: false,
    rows: { min: 50, max: 200 },
    versions: [
      {
        version: 'v1',
        header: ADVANCED_HEADERS.TE,
        columns: {
          games: 2,
          receptions: 3,
          receivingYards: 4,
          targets: 15,
          targetShare: 16,
        },
      },
    ],
  },
]

/** Native FantasyPros download filename for a report — no renaming required. */
export function fileNameFor(report) {
  return report.kind === 'statistics'
    ? `FantasyPros_Fantasy_Football_Statistics_${report.token}.csv`
    : `FantasyPros_Fantasy_Football_Advanced_Stats_Report_${report.token}.csv`
}

export function getReport(id) {
  const report = REPORTS.find((entry) => entry.id === id)
  if (!report) throw new Error(`Unknown report id: ${id}`)
  return report
}

function sameHeader(expected, actual) {
  return (
    expected.length === actual.length &&
    expected.every((name, index) => name === actual[index])
  )
}

/** Human-readable description of the first place two headers diverge. */
function describeDrift(expected, actual) {
  const limit = Math.max(expected.length, actual.length)
  for (let index = 0; index < limit; index += 1) {
    if (expected[index] !== actual[index]) {
      return `column ${index}: expected ${JSON.stringify(expected[index] ?? '(none)')}, found ${JSON.stringify(actual[index] ?? '(none)')}`
    }
  }
  return 'headers differ in length only'
}

/**
 * Resolve an actual header against a report's known versions.
 *
 * Returns `{ matched: true, version, columns }` on success, or
 * `{ matched: false, expectedColumnCount, actualColumnCount, detail }`
 * describing the drift so the caller can print something actionable.
 */
export function matchHeader(report, actualHeader) {
  for (const candidate of report.versions) {
    if (sameHeader(candidate.header, actualHeader)) {
      return {
        matched: true,
        version: candidate.version,
        columns: candidate.columns,
      }
    }
  }

  const newest = report.versions[report.versions.length - 1]
  return {
    matched: false,
    expectedColumnCount: newest.header.length,
    actualColumnCount: actualHeader.length,
    detail: describeDrift(newest.header, actualHeader),
  }
}
