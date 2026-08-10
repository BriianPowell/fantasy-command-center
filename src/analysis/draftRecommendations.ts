import {
  type DraftTimingContext,
  getDraftTimingContext,
  getTierUrgency,
  type TierUrgency,
} from './draftTimingContext'
import {
  defaultDraftBoardMode,
  shouldIncludePlayerInDraftBoard,
} from '../domain/draftBoardMode'
import type { DraftBoardMode } from '../domain/draftBoardMode'
import {
  buildDraftAvailabilityInsight,
  buildInjuryDetailLabels,
  formatPlayerInjuryRiskNote,
  scorePlayerInjuryRisk,
} from '../domain/injuryStatus'
import {
  comparePlayersBySearchRank,
  scoreDraftPlayerValue,
} from '../domain/playerValueUtils'
import {
  canFillFlexPosition,
  canFillSuperFlexPosition,
  getPrimaryPosition,
  isPositionConfiguredForLeague,
} from '../domain/positionUtils'
import type {
  DraftRecommendation,
  DraftState,
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

const DRAFT_CANDIDATE_LIMITS: Partial<Record<Position, number>> = {
  QB: 50,
  RB: 120,
  WR: 150,
  TE: 70,
  K: 30,
  DEF: 30,
}

interface RosterFit {
  currentDepth: number
  primaryPosition: Position
  requiredSlots: number
  targetDepth: number
}

export interface DraftRecommendationInput {
  boardMode?: DraftBoardMode
  draft?: DraftState
  players: Player[]
  selectedTeamId?: string
  unavailablePlayerIds: Set<string>
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
    input.unavailablePlayerIds,
    input.boardMode ?? defaultDraftBoardMode,
    input.leagueSettings
  )
  const remainingByPosition = countRemainingByPosition(
    draftCandidates,
    input.unavailablePlayerIds
  )

  const recommendations = draftCandidates.map((player) => {
    const ranking = rankingByPlayer.get(player.id)
    const projection = projectionByPlayer.get(player.id)
    const note = noteByPlayer.get(player.id)
    const valueScore = scoreDraftPlayerValue(player, ranking, projection)
    const rosterFit = getRosterFit(
      player,
      rosterPositionCounts,
      input.roster,
      input.leagueSettings
    )
    const needScore = scoreNeed(player, rosterFit)
    const scarcityScore = scoreScarcity(
      player,
      remainingByPosition,
      input.leagueSettings
    )
    const strategyEvaluation = evaluatePlayerStrategy(
      player,
      input.strategyContext
    )
    const byeRisk = scoreByeRisk(player, input.roster, rosterByeCounts)
    const injuryRisk = scorePlayerInjuryRisk(player)
    const noteBoost =
      note?.tag === 'target' ? 6 : note?.tag === 'avoid' ? -12 : 0

    return {
      player,
      score: Math.round(
        valueScore +
          needScore +
          scarcityScore +
          strategyEvaluation.score -
          byeRisk -
          injuryRisk +
          noteBoost
      ),
      valueScore,
      needScore,
      scarcityScore,
      strategyScore: Math.round(strategyEvaluation.score),
      byeRisk,
      injuryRisk,
      insight: buildRecommendationInsight(
        player,
        rosterFit,
        valueScore,
        scarcityScore,
        byeRisk,
        injuryRisk
      ),
      notes: [
        ...buildRecommendationNotes(
          player,
          ranking,
          projection,
          note,
          rosterFit,
          needScore,
          scarcityScore,
          byeRisk,
          injuryRisk
        ),
        ...strategyEvaluation.notes,
      ],
      suggestion: buildPickSuggestion({
        byeRisk,
        needScore,
        player,
        scarcityScore,
        injuryRisk,
        valueScore,
      }),
    }
  })

  return addAvailablePlayerContext(
    recommendations,
    getDraftTimingContext(input)
  ).sort((a, b) => b.score - a.score)
}

interface AvailablePlayerContext {
  dropOffAfter?: number
  picksUntilNextPick?: number
  positionRank: number
  tierPlayersRemaining: number
  tierUrgency?: TierUrgency
  valueTier: number
}

function addAvailablePlayerContext(
  recommendations: DraftRecommendation[],
  draftTimingContext: DraftTimingContext
): DraftRecommendation[] {
  const contextsByPlayerId = new Map<string, AvailablePlayerContext>()
  const recommendationsByPosition = new Map<Position, DraftRecommendation[]>()

  for (const recommendation of recommendations) {
    const position = getPrimaryPosition(recommendation.player.positions)

    if (!position) {
      continue
    }

    recommendationsByPosition.set(position, [
      ...(recommendationsByPosition.get(position) ?? []),
      recommendation,
    ])
  }

  for (const positionRecommendations of recommendationsByPosition.values()) {
    const sortedRecommendations = [...positionRecommendations].sort(
      (a, b) => b.valueScore - a.valueScore
    )
    const positionContexts: {
      context: AvailablePlayerContext
      playerId: string
    }[] = []
    const tierCounts = new Map<number, number>()
    let valueTier = 1
    let previousValue = sortedRecommendations[0]?.valueScore

    sortedRecommendations.forEach((recommendation, index) => {
      if (
        previousValue !== undefined &&
        index > 0 &&
        previousValue - recommendation.valueScore >= 8
      ) {
        valueTier += 1
      }

      const nextRecommendation = sortedRecommendations[index + 1]
      const dropOffAfter = nextRecommendation
        ? recommendation.valueScore - nextRecommendation.valueScore
        : undefined
      const context = {
        ...(dropOffAfter !== undefined ? { dropOffAfter } : {}),
        ...draftTimingContext,
        positionRank: index + 1,
        tierPlayersRemaining: 0,
        valueTier,
      }

      positionContexts.push({
        context,
        playerId: recommendation.player.id,
      })
      tierCounts.set(valueTier, (tierCounts.get(valueTier) ?? 0) + 1)
      previousValue = recommendation.valueScore
    })

    positionContexts.forEach(({ context, playerId }) => {
      const tierPlayersRemaining = tierCounts.get(context.valueTier) ?? 1

      contextsByPlayerId.set(playerId, {
        ...context,
        tierPlayersRemaining,
        tierUrgency: getTierUrgency({
          ...context,
          tierPlayersRemaining,
        }),
      })
    })
  }

  return recommendations.map((recommendation) => {
    const context = contextsByPlayerId.get(recommendation.player.id)

    if (!context) {
      return recommendation
    }

    return {
      ...recommendation,
      ...context,
      insight: buildContextualRecommendationInsight(recommendation, context),
      notes: recommendation.notes,
      suggestion: buildContextualPickSuggestion(recommendation, context),
    }
  })
}

function buildContextualRecommendationInsight(
  recommendation: DraftRecommendation,
  context: AvailablePlayerContext
): string {
  const position = getPrimaryPosition(recommendation.player.positions)

  if (position && context.tierUrgency === 'take_now') {
    return `${recommendation.insight} Only ${context.tierPlayersRemaining} ${position} option${context.tierPlayersRemaining === 1 ? '' : 's'} remain in this value tier, and your next pick is estimated ${context.picksUntilNextPick} picks away.`
  }

  if (position && context.tierUrgency === 'safe_to_wait') {
    return `${recommendation.insight} This ${position} tier has enough similar options left that you may be able to wait.`
  }

  if (
    position &&
    context.dropOffAfter !== undefined &&
    context.dropOffAfter >= 8
  ) {
    return `${recommendation.insight} There is a ${Math.round(
      context.dropOffAfter
    )} point ${position} value drop after this tier.`
  }

  if (position && context.valueTier === 1 && context.positionRank <= 3) {
    return `${recommendation.insight} This is a top available ${position} option in the current pool.`
  }

  return recommendation.insight
}

function buildContextualPickSuggestion(
  recommendation: DraftRecommendation,
  context: AvailablePlayerContext
): string {
  if (context.tierUrgency === 'take_now') {
    return 'Take now: tier may not return'
  }

  if (context.tierUrgency === 'safe_to_wait') {
    return 'Safe to wait'
  }

  if (
    context.valueTier === 1 &&
    context.dropOffAfter !== undefined &&
    context.dropOffAfter >= 8
  ) {
    return 'Beat tier drop'
  }

  return recommendation.suggestion
}

function getDraftCandidates(
  players: Player[],
  unavailablePlayerIds: Set<string>,
  boardMode: DraftBoardMode,
  leagueSettings: LeagueSettings
): Player[] {
  const playersByPosition = new Map<Position, Player[]>()

  for (const player of players) {
    const primaryPosition = getPrimaryPosition(player.positions)

    if (!primaryPosition) {
      continue
    }

    if (
      unavailablePlayerIds.has(player.id) ||
      !isPlayerOnNflTeam(player) ||
      !shouldIncludePlayerInDraftBoard(player, boardMode) ||
      !isPositionConfiguredForLeague(primaryPosition, leagueSettings) ||
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
        .sort(comparePlayersBySearchRank)
        .slice(0, DRAFT_CANDIDATE_LIMITS[position])
    }
  )
}

function isPlayerOnNflTeam(player: Player): boolean {
  return Boolean(player.team && player.team !== 'FA')
}

function getRosterFit(
  player: Player,
  rosterCounts: Map<string, number>,
  roster: Roster | undefined,
  settings: LeagueSettings
): RosterFit | undefined {
  if (!roster) {
    return undefined
  }

  const primaryPosition = getPrimaryPosition(player.positions)
  if (!primaryPosition) {
    return undefined
  }

  const requiredSlots = settings.rosterSlots[primaryPosition] ?? 0
  const flexSlots = player.positions.some((position) =>
    canFillFlexPosition(position)
  )
    ? (settings.rosterSlots.FLEX ?? 0)
    : 0
  const targetDepth = requiredSlots + flexSlots + benchBuffer(primaryPosition)
  const currentDepth = rosterCounts.get(primaryPosition) ?? 0

  return {
    currentDepth,
    primaryPosition,
    requiredSlots,
    targetDepth,
  }
}

function scoreNeed(player: Player, rosterFit: RosterFit | undefined): number {
  if (!rosterFit) {
    return 10
  }

  const primaryPosition = getPrimaryPosition(player.positions)

  if (rosterFit.currentDepth === 0 && rosterFit.requiredSlots > 0) {
    return 35
  }

  if (rosterFit.currentDepth < rosterFit.targetDepth) {
    return 22 - rosterFit.currentDepth * 3
  }

  return primaryPosition === 'K' || primaryPosition === 'DEF' ? -10 : 3
}

function countRosterPositions(
  roster: Roster,
  playersById: Map<string, Player>
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const playerId of roster.playerIds) {
    const position =
      getPrimaryPosition(playersById.get(playerId)?.positions ?? []) ??
      'UNKNOWN'
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
  remainingByPosition: Map<string, number>,
  leagueSettings: LeagueSettings
): number {
  const primaryPosition = getPrimaryPosition(player.positions)
  if (!primaryPosition) {
    return 0
  }

  const remainingAtPosition = remainingByPosition.get(primaryPosition) ?? 0
  const leagueDemand = getLeaguePositionDemand(primaryPosition, leagueSettings)
  const bufferedDemand = Math.max(leagueDemand * 1.5, 1)
  const availabilityPressure = Math.max(
    0,
    (bufferedDemand - remainingAtPosition) / bufferedDemand
  )

  return availabilityPressure * getPositionScarcityWeight(primaryPosition)
}

function getLeaguePositionDemand(
  position: Position,
  leagueSettings: LeagueSettings
): number {
  const requiredSlots = leagueSettings.rosterSlots[position] ?? 0
  const flexSlots = canFillFlexPosition(position)
    ? (leagueSettings.rosterSlots.FLEX ?? 0)
    : 0
  const superFlexSlots = canFillSuperFlexPosition(position)
    ? (leagueSettings.rosterSlots.SUPER_FLEX ?? 0)
    : 0

  return (requiredSlots + flexSlots + superFlexSlots) * leagueSettings.teams
}

function getPositionScarcityWeight(position: Position): number {
  if (position === 'RB' || position === 'TE') {
    return 20
  }

  if (position === 'WR') {
    return 18
  }

  if (position === 'QB') {
    return 14
  }

  return 8
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
  unavailablePlayerIds: Set<string>
): Map<string, number> {
  const counts = new Map<string, number>()

  for (const player of players) {
    if (unavailablePlayerIds.has(player.id)) {
      continue
    }

    const position = getPrimaryPosition(player.positions)
    if (!position) {
      continue
    }

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
  rosterFit: RosterFit | undefined,
  needScore: number,
  scarcityScore: number,
  byeRisk: number,
  injuryRisk: number
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

  if (scarcityScore >= 14) {
    notes.push(`${getPrimaryPosition(player.positions)} scarcity boost`)
  }

  if (byeRisk > 0) {
    notes.push(`Bye week ${player.byeWeek} overlap`)
  }

  if (injuryRisk > 0) {
    const injuryNote = formatPlayerInjuryRiskNote(player)

    if (injuryNote) {
      notes.push(injuryNote)
    }

    notes.push(...buildInjuryDetailLabels(player))
  }

  if (note) {
    notes.push(`${note.tag}: ${note.note ?? 'manual note'}`)
  }

  return notes
}

function buildRecommendationInsight(
  player: Player,
  rosterFit: RosterFit | undefined,
  valueScore: number,
  scarcityScore: number,
  byeRisk: number,
  injuryRisk: number
): string {
  const primaryPosition = getPrimaryPosition(player.positions)
  const injuryInsight = buildDraftAvailabilityInsight(player)

  if (injuryInsight && injuryRisk >= 8) {
    return injuryInsight
  }

  if (rosterFit && rosterFit.currentDepth < rosterFit.targetDepth) {
    return `${primaryPosition} depth is ${rosterFit.currentDepth}/${rosterFit.targetDepth}, so this pick directly improves roster construction.`
  }

  if (scarcityScore >= 14) {
    return `${primaryPosition} pool is thinning relative to the current draftable player set.`
  }

  if (valueScore >= 60 && player.searchRank) {
    return `Sleeper search rank ${player.searchRank} keeps this player near the top of the available value pool.`
  }

  if (byeRisk >= 6) {
    return `Bye week ${player.byeWeek} overlaps with several players already on your roster.`
  }

  return `Score combines Sleeper value, roster fit, positional scarcity, bye-week overlap, and strategy context.`
}

function buildPickSuggestion({
  byeRisk,
  needScore,
  player,
  scarcityScore,
  injuryRisk,
  valueScore,
}: {
  byeRisk: number
  needScore: number
  player: Player
  scarcityScore: number
  injuryRisk: number
  valueScore: number
}): string {
  const primaryPosition = getPrimaryPosition(player.positions)

  if (primaryPosition === 'K' || primaryPosition === 'DEF') {
    return 'Late-round target'
  }

  if (needScore >= 25) {
    return 'Fill starter need'
  }

  if (valueScore >= 65 && scarcityScore >= 14) {
    return 'Priority target'
  }

  if (valueScore >= 60) {
    return 'Best value'
  }

  if (byeRisk >= 6) {
    return 'Bye-week caution'
  }

  if (injuryRisk >= 8) {
    return 'Injury caution'
  }

  if (needScore > 0) {
    return 'Depth target'
  }

  return 'Bench upside'
}
