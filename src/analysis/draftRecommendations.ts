import { scoreDraftPlayerValue } from '../domain/playerValueUtils'
import type {
  DraftRecommendation,
  LeagueSettings,
  Player,
  PlayerNote,
  Position,
  Projection,
  Ranking,
  Roster,
} from '../domain/types'
import { evaluatePlayerStrategy } from '../strategy/teamOpportunity'
import type { StrategyContext } from '../strategy/types'

const FLEX_POSITIONS = new Set(['RB', 'WR', 'TE'])
const DRAFT_CANDIDATE_LIMITS: Partial<Record<Position, number>> = {
  QB: 50,
  RB: 120,
  WR: 150,
  TE: 70,
  K: 30,
  DEF: 30,
}

export interface DraftRecommendationInput {
  players: Player[]
  draftedPlayerIds: Set<string>
  roster?: Roster
  leagueSettings: LeagueSettings
  rankings: Ranking[]
  projections: Projection[]
  notes: PlayerNote[]
  strategyContext?: StrategyContext
}

export function buildDraftRecommendations(
  input: DraftRecommendationInput
): DraftRecommendation[] {
  const rankingByPlayer = new Map(
    input.rankings.map((ranking) => [ranking.playerId, ranking])
  )
  const projectionByPlayer = new Map(
    input.projections.map((projection) => [projection.playerId, projection])
  )
  const noteByPlayer = new Map(input.notes.map((note) => [note.playerId, note]))
  const playersById = new Map(
    input.players.map((player) => [player.id, player])
  )
  const rosterPositionCounts = input.roster
    ? countRosterPositions(input.roster, playersById)
    : new Map<string, number>()
  const rosterByeCounts = input.roster
    ? countRosterByeWeeks(input.roster, playersById)
    : new Map<number, number>()
  const draftCandidates = getDraftCandidates(
    input.players,
    input.draftedPlayerIds
  )
  const remainingByPosition = countRemainingByPosition(
    draftCandidates,
    input.draftedPlayerIds
  )

  return draftCandidates
    .map((player) => {
      const ranking = rankingByPlayer.get(player.id)
      const projection = projectionByPlayer.get(player.id)
      const note = noteByPlayer.get(player.id)
      const valueScore = scoreDraftPlayerValue(player, ranking, projection)
      const needScore = scoreNeed(
        player,
        rosterPositionCounts,
        input.roster,
        input.leagueSettings
      )
      const scarcityScore = scoreScarcity(player, remainingByPosition)
      const strategyEvaluation = evaluatePlayerStrategy(
        player,
        input.strategyContext
      )
      const byeRisk = scoreByeRisk(player, input.roster, rosterByeCounts)
      const noteBoost =
        note?.tag === 'target' ? 6 : note?.tag === 'avoid' ? -12 : 0

      return {
        player,
        score: Math.round(
          valueScore +
            needScore +
            scarcityScore +
            strategyEvaluation.score -
            byeRisk +
            noteBoost
        ),
        valueScore,
        needScore,
        scarcityScore,
        strategyScore: Math.round(strategyEvaluation.score),
        byeRisk,
        notes: [
          ...buildRecommendationNotes(
            player,
            ranking,
            projection,
            note,
            needScore,
            scarcityScore,
            byeRisk
          ),
          ...strategyEvaluation.notes,
        ],
      }
    })
    .sort((a, b) => b.score - a.score)
}

function getDraftCandidates(
  players: Player[],
  draftedPlayerIds: Set<string>
): Player[] {
  const playersByPosition = new Map<Position, Player[]>()

  for (const player of players) {
    const primaryPosition = player.positions[0]

    if (
      draftedPlayerIds.has(player.id) ||
      !DRAFT_CANDIDATE_LIMITS[primaryPosition]
    ) {
      continue
    }

    playersByPosition.set(primaryPosition, [
      ...(playersByPosition.get(primaryPosition) ?? []),
      player,
    ])
  }

  return Array.from(playersByPosition.entries()).flatMap(
    ([position, positionPlayers]) => {
      return positionPlayers
        .sort(compareSleeperSearchRank)
        .slice(0, DRAFT_CANDIDATE_LIMITS[position])
    }
  )
}

function compareSleeperSearchRank(a: Player, b: Player): number {
  return (
    (a.searchRank ?? Number.MAX_SAFE_INTEGER) -
    (b.searchRank ?? Number.MAX_SAFE_INTEGER)
  )
}

function scoreNeed(
  player: Player,
  rosterCounts: Map<string, number>,
  roster: Roster | undefined,
  settings: LeagueSettings
): number {
  if (!roster) {
    return 10
  }

  const primaryPosition = player.positions[0]
  const requiredSlots = settings.rosterSlots[primaryPosition] ?? 0
  const flexSlots = player.positions.some((position) =>
    FLEX_POSITIONS.has(position)
  )
    ? (settings.rosterSlots.FLEX ?? 0)
    : 0
  const targetDepth = requiredSlots + flexSlots + benchBuffer(primaryPosition)
  const currentDepth = rosterCounts.get(primaryPosition) ?? 0

  if (currentDepth === 0 && requiredSlots > 0) {
    return 35
  }

  if (currentDepth < targetDepth) {
    return 22 - currentDepth * 3
  }

  return primaryPosition === 'K' || primaryPosition === 'DEF' ? -10 : 3
}

function countRosterPositions(
  roster: Roster,
  playersById: Map<string, Player>
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const playerId of roster.playerIds) {
    const position = playersById.get(playerId)?.positions[0] ?? 'UNKNOWN'
    counts.set(position, (counts.get(position) ?? 0) + 1)
  }

  return counts
}

function benchBuffer(position: string): number {
  if (position === 'RB' || position === 'WR') {
    return 2
  }

  if (position === 'QB' || position === 'TE') {
    return 1
  }

  return 0
}

function scoreScarcity(
  player: Player,
  remainingByPosition: Map<string, number>
): number {
  const primaryPosition = player.positions[0]
  const remainingAtPosition = remainingByPosition.get(primaryPosition) ?? 0

  if (primaryPosition === 'RB' || primaryPosition === 'TE') {
    return Math.max(0, 20 - remainingAtPosition / 6)
  }

  if (primaryPosition === 'WR') {
    return Math.max(0, 16 - remainingAtPosition / 8)
  }

  return Math.max(0, 10 - remainingAtPosition / 10)
}

function scoreByeRisk(
  player: Player,
  roster: Roster | undefined,
  rosterByeCounts: Map<number, number>
): number {
  if (!roster || !player.byeWeek) {
    return 0
  }

  const sameByeCount = rosterByeCounts.get(player.byeWeek) ?? 0

  return sameByeCount * 3
}

function countRemainingByPosition(
  players: Player[],
  draftedPlayerIds: Set<string>
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const player of players) {
    if (draftedPlayerIds.has(player.id)) {
      continue
    }

    const position = player.positions[0]
    counts.set(position, (counts.get(position) ?? 0) + 1)
  }

  return counts
}

function countRosterByeWeeks(
  roster: Roster,
  playersById: Map<string, Player>
): Map<number, number> {
  const counts = new Map<number, number>()

  for (const playerId of roster.playerIds) {
    const byeWeek = playersById.get(playerId)?.byeWeek

    if (!byeWeek) {
      continue
    }

    counts.set(byeWeek, (counts.get(byeWeek) ?? 0) + 1)
  }

  return counts
}

function buildRecommendationNotes(
  player: Player,
  ranking: Ranking | undefined,
  projection: Projection | undefined,
  note: PlayerNote | undefined,
  needScore: number,
  scarcityScore: number,
  byeRisk: number
): string[] {
  const notes: string[] = []

  if (ranking?.tier) {
    notes.push(`Tier ${ranking.tier}`)
  }

  if (!ranking && player.searchRank) {
    notes.push(`Sleeper search rank ${player.searchRank}`)
  }

  if (projection) {
    notes.push(`${projection.projectedPoints.toFixed(1)} projected points`)
  }

  if (needScore >= 25) {
    notes.push(`Fills a starting ${player.positions[0]} need`)
  }

  if (scarcityScore >= 14) {
    notes.push(`${player.positions[0]} scarcity boost`)
  }

  if (byeRisk > 0) {
    notes.push(`Bye week ${player.byeWeek} overlap`)
  }

  if (note) {
    notes.push(`${note.tag}: ${note.note ?? 'manual note'}`)
  }

  return notes
}
