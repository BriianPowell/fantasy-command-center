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
  allRequiredPositionsFilled: boolean
  currentDepth: number
  primaryPosition: Position
  remainingRosterSlots: number
  requiredSlots: number
  superFlexSlots: number
  targetDepth: number
  unfilledSpecialistSlots: number
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
  const draftProgress = getDraftProgress(input.draft, input.leagueSettings)

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
    const needScore = scoreNeed(player, rosterFit, draftProgress)
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
    getDraftTimingContext(input),
    buildDraftRoomContext(input.draft, input.leagueSettings, playersById)
  ).sort((a, b) => b.score - a.score)
}

interface AvailablePlayerContext {
  currentRound?: number
  dropOffAfter?: number
  overallDropOffAfter?: number
  overallRank?: number
  picksUntilNextPick?: number
  positionRank: number
  positionRun?: DraftRoomPositionRun
  tierPlayersRemaining: number
  tierUrgency?: TierUrgency
  valueTier: number
}

interface DraftRoomContext {
  positionRuns: Map<Position, DraftRoomPositionRun>
}

interface DraftRoomPositionRun {
  count: number
  pressure: 'active' | 'watch'
  window: number
}

function addAvailablePlayerContext(
  recommendations: DraftRecommendation[],
  draftTimingContext: DraftTimingContext,
  draftRoomContext: DraftRoomContext
): DraftRecommendation[] {
  const contextsByPlayerId = new Map<string, AvailablePlayerContext>()
  const recommendationsByPosition = new Map<Position, DraftRecommendation[]>()
  const overallContexts = getOverallBoardContexts(recommendations)

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

  for (const [position, positionRecommendations] of recommendationsByPosition) {
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
        ...overallContexts.get(recommendation.player.id),
        positionRun: draftRoomContext.positionRuns.get(position),
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

  if (position && context.positionRun?.pressure === 'active') {
    return `${recommendation.insight} ${context.positionRun.count} of the last ${context.positionRun.window} picks were ${position}, so the room is actively attacking this position.`
  }

  if (
    position &&
    context.overallDropOffAfter !== undefined &&
    context.overallDropOffAfter >= 8 &&
    context.overallRank === 1 &&
    context.picksUntilNextPick !== undefined
  ) {
    return `${recommendation.insight} This player is near an overall board cliff with a ${Math.round(
      context.overallDropOffAfter
    )} point value drop after them.`
  }

  if (position && context.tierUrgency === 'take_now') {
    return `${recommendation.insight} Only ${context.tierPlayersRemaining} ${position} option${context.tierPlayersRemaining === 1 ? '' : 's'} remain in this value tier, and your next pick is estimated ${context.picksUntilNextPick} picks away.`
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

  if (position && canShowSafeToWait(recommendation, context)) {
    return `${recommendation.insight} This ${position} tier has enough similar options left that you may be able to wait.`
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
  const position = getPrimaryPosition(recommendation.player.positions)

  if (context.positionRun?.pressure === 'active' && position) {
    return `Take now: ${position} run`
  }

  if (
    context.overallDropOffAfter !== undefined &&
    context.overallDropOffAfter >= 8 &&
    context.overallRank === 1 &&
    context.picksUntilNextPick !== undefined
  ) {
    return 'Take value: board cliff'
  }

  if (context.tierUrgency === 'take_now') {
    return 'Take now: tier may not return'
  }

  if (
    context.valueTier === 1 &&
    context.dropOffAfter !== undefined &&
    context.dropOffAfter >= 8
  ) {
    return 'Beat tier drop'
  }

  if (canShowSafeToWait(recommendation, context)) {
    return 'Safe to wait'
  }

  return recommendation.suggestion
}

function canShowSafeToWait(
  recommendation: DraftRecommendation,
  context: AvailablePlayerContext
): boolean {
  return (
    context.tierUrgency === 'safe_to_wait' &&
    context.currentRound !== undefined &&
    context.currentRound > 3 &&
    context.positionRun?.pressure !== 'watch' &&
    recommendation.valueScore < 60
  )
}

function getOverallBoardContexts(
  recommendations: DraftRecommendation[]
): Map<
  string,
  Pick<AvailablePlayerContext, 'overallDropOffAfter' | 'overallRank'>
> {
  const contexts = new Map<
    string,
    Pick<AvailablePlayerContext, 'overallDropOffAfter' | 'overallRank'>
  >()
  const sortedRecommendations = [...recommendations].sort(
    (a, b) => b.valueScore - a.valueScore
  )

  sortedRecommendations.forEach((recommendation, index) => {
    const nextRecommendation = sortedRecommendations[index + 1]
    const overallDropOffAfter = nextRecommendation
      ? recommendation.valueScore - nextRecommendation.valueScore
      : undefined

    contexts.set(recommendation.player.id, {
      ...(overallDropOffAfter !== undefined ? { overallDropOffAfter } : {}),
      overallRank: index + 1,
    })
  })

  return contexts
}

function buildDraftRoomContext(
  draft: DraftState | undefined,
  leagueSettings: LeagueSettings,
  playersById: Map<string, Player>
): DraftRoomContext {
  if (!draft) {
    return {
      positionRuns: new Map(),
    }
  }

  const recentPickWindow = Math.min(Math.max(leagueSettings.teams, 6), 12)
  const recentPositions = draft.picks
    .filter((pick) => pick.playerId || pick.metadata?.position)
    .sort((a, b) => a.pickNo - b.pickNo)
    .slice(-recentPickWindow)
    .map((pick) => {
      if (pick.playerId) {
        return (
          getPrimaryPosition(playersById.get(pick.playerId)?.positions ?? []) ??
          pick.metadata?.position
        )
      }

      return pick.metadata?.position
    })
    .filter((position): position is Position => Boolean(position))
  const positionCounts = new Map<Position, number>()

  for (const position of recentPositions) {
    positionCounts.set(position, (positionCounts.get(position) ?? 0) + 1)
  }

  const positionRuns = new Map<Position, DraftRoomPositionRun>()

  for (const [position, count] of positionCounts) {
    const share = count / Math.max(recentPositions.length, 1)

    if (count >= 3 && share >= 0.34) {
      positionRuns.set(position, {
        count,
        pressure: 'active',
        window: recentPositions.length,
      })
    } else if (count >= 2 && share >= 0.25) {
      positionRuns.set(position, {
        count,
        pressure: 'watch',
        window: recentPositions.length,
      })
    }
  }

  return {
    positionRuns,
  }
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
  const superFlexSlots = player.positions.some((position) =>
    canFillSuperFlexPosition(position)
  )
    ? (settings.rosterSlots.SUPER_FLEX ?? 0)
    : 0
  const targetDepth =
    requiredSlots + flexSlots + benchBuffer(primaryPosition, settings)
  const currentDepth = rosterCounts.get(primaryPosition) ?? 0

  return {
    allRequiredPositionsFilled: areRequiredPositionsFilled(
      rosterCounts,
      settings
    ),
    currentDepth,
    primaryPosition,
    remainingRosterSlots: getRemainingRosterSlots(roster, settings),
    requiredSlots,
    superFlexSlots,
    targetDepth,
    unfilledSpecialistSlots: getUnfilledSpecialistSlots(rosterCounts, settings),
  }
}

function scoreNeed(
  player: Player,
  rosterFit: RosterFit | undefined,
  draftProgress: number | undefined
): number {
  const primaryPosition = getPrimaryPosition(player.positions)

  if (!rosterFit) {
    if (primaryPosition === 'K' || primaryPosition === 'DEF') {
      return draftProgress !== undefined && draftProgress >= 0.85 ? 18 : -12
    }

    return 10
  }

  if (primaryPosition === 'K' || primaryPosition === 'DEF') {
    if (rosterFit.currentDepth >= rosterFit.requiredSlots) {
      return -10
    }

    if (
      rosterFit.unfilledSpecialistSlots > 0 &&
      rosterFit.remainingRosterSlots <= rosterFit.unfilledSpecialistSlots
    ) {
      return 24
    }

    if (draftProgress !== undefined && draftProgress >= 0.85) {
      return 18
    }

    return rosterFit.allRequiredPositionsFilled ? 1 : -12
  }

  if (
    primaryPosition === 'QB' &&
    (rosterFit.requiredSlots > 0 || rosterFit.currentDepth > 0) &&
    rosterFit.currentDepth >= rosterFit.requiredSlots &&
    rosterFit.superFlexSlots === 0
  ) {
    return -12
  }

  if (rosterFit.currentDepth === 0 && rosterFit.requiredSlots > 0) {
    return 35
  }

  if (
    !rosterFit.allRequiredPositionsFilled &&
    rosterFit.requiredSlots > 0 &&
    rosterFit.currentDepth >= rosterFit.requiredSlots
  ) {
    return 4
  }

  if (rosterFit.currentDepth < rosterFit.targetDepth) {
    return 22 - rosterFit.currentDepth * 3
  }

  return 3
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

function getDraftProgress(
  draft: DraftState | undefined,
  leagueSettings: LeagueSettings
): number | undefined {
  if (!draft || leagueSettings.teams <= 0 || draft.rounds <= 0) {
    return undefined
  }

  const totalPicks = draft.rounds * leagueSettings.teams
  const completedPicks =
    draft.currentPick !== undefined
      ? Math.max(0, draft.currentPick - 1)
      : draft.picks.length

  return Math.min(completedPicks / totalPicks, 1)
}

function getRemainingRosterSlots(
  roster: Roster,
  settings: LeagueSettings
): number {
  return Math.max(0, getTotalRosterSlots(settings) - roster.playerIds.length)
}

function getTotalRosterSlots(settings: LeagueSettings): number {
  return Object.entries(settings.rosterSlots).reduce(
    (total, [, slots]) => total + Math.max(0, slots),
    0
  )
}

function getUnfilledSpecialistSlots(
  rosterCounts: Map<string, number>,
  settings: LeagueSettings
): number {
  return (
    Math.max(0, (settings.rosterSlots.K ?? 0) - (rosterCounts.get('K') ?? 0)) +
    Math.max(
      0,
      (settings.rosterSlots.DEF ?? 0) - (rosterCounts.get('DEF') ?? 0)
    )
  )
}

function areRequiredPositionsFilled(
  rosterCounts: Map<string, number>,
  settings: LeagueSettings
): boolean {
  return Object.entries(settings.rosterSlots).every(([position, slots]) => {
    if (slots <= 0 || position === 'BN' || position === 'FLEX') {
      return true
    }

    if (position === 'SUPER_FLEX') {
      const superFlexEligibleCount = (['QB', 'RB', 'WR', 'TE'] as Position[])
        .map((superFlexPosition) => rosterCounts.get(superFlexPosition) ?? 0)
        .reduce((total, count) => total + count, 0)

      return superFlexEligibleCount >= slots
    }

    return (rosterCounts.get(position) ?? 0) >= slots
  })
}

function benchBuffer(position: string, settings: LeagueSettings): number {
  if (position === 'RB' || position === 'WR') {
    return 2
  }

  if (position === 'QB') {
    return (settings.rosterSlots.SUPER_FLEX ?? 0) > 0 ? 1 : 0
  }

  if (position === 'TE') {
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
