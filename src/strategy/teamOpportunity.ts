import type {
  PlayerContributionProfile,
  StrategyContext,
  StrategyDefaults,
  StrategyEvaluation,
  TeamOpportunityProfile,
} from './types'
import { comparePlayersBySearchRank } from '../domain/playerValueUtils'
import { getPrimaryPosition } from '../domain/positionUtils'
import type { Player, Position } from '../domain/types'

const inferredDepthChartCache = new WeakMap<
  Player[],
  StrategyContext['inferredDepthCharts']
>()
const DEFAULT_STRATEGY: StrategyDefaults = {
  preferTeamPointEngines: true,
  preferDepthChartUpside: true,
  boostRisingUsage: true,
  penalizeBuriedDepthChartPlayers: true,
  highValuePositionShare: 0.28,
  weights: {
    teamPositionValue: 18,
    depthChart: 8,
    playerContribution: 14,
    trend: 5,
  },
}

const DEFAULT_TEAM_OPPORTUNITY_PROFILES: Record<
  string,
  TeamOpportunityProfile
> = {}

export function buildStrategyContext({
  players,
  teamProfiles = DEFAULT_TEAM_OPPORTUNITY_PROFILES,
}: {
  players: Player[]
  teamProfiles?: Record<string, TeamOpportunityProfile>
}): StrategyContext {
  return {
    strategy: DEFAULT_STRATEGY,
    teamProfiles,
    inferredDepthCharts: getInferredDepthCharts(players),
  }
}

function getInferredDepthCharts(
  players: Player[]
): StrategyContext['inferredDepthCharts'] {
  const cachedDepthCharts = inferredDepthChartCache.get(players)

  if (cachedDepthCharts) {
    return cachedDepthCharts
  }

  const inferredDepthCharts = inferDepthCharts(players)
  inferredDepthChartCache.set(players, inferredDepthCharts)

  return inferredDepthCharts
}

export function evaluatePlayerStrategy(
  player: Player,
  context: StrategyContext | undefined
): StrategyEvaluation {
  if (!context || !player.team) {
    return {
      score: 0,
      notes: [],
    }
  }

  const primaryPosition = getPrimaryPosition(player.positions)
  if (!primaryPosition) {
    return {
      score: 0,
      notes: [],
    }
  }

  const teamProfile = context.teamProfiles[player.team]
  const positionProfile = teamProfile?.positions[primaryPosition]
  const depthChartRank = findDepthChartRank(player, context, teamProfile)
  const teamPositionShare = positionProfile?.fantasyPointShare
  const playerContribution = findPlayerContribution(
    player,
    positionProfile?.playerContributions
  )
  const playerContributionShare =
    playerContribution?.fantasyPointShare ??
    playerContribution?.opportunityShare
  const notes: string[] = []
  let score = 0

  if (context.strategy.preferTeamPointEngines && teamPositionShare) {
    score += teamPositionShare * context.strategy.weights.teamPositionValue

    if (teamPositionShare >= context.strategy.highValuePositionShare) {
      notes.push(
        `${player.team} generates a high share of points through ${primaryPosition}`
      )
    }
  }

  if (positionProfile?.opportunityGrade) {
    score +=
      positionProfile.opportunityGrade *
      context.strategy.weights.teamPositionValue *
      0.5
  }

  if (depthChartRank) {
    score += scoreDepthChart(depthChartRank, context.strategy)

    if (depthChartRank === 1) {
      notes.push(`${player.team} ${primaryPosition} depth chart leader`)
    } else if (depthChartRank <= 3 && context.strategy.preferDepthChartUpside) {
      notes.push(
        `${player.team} ${primaryPosition}${depthChartRank} with depth-chart upside`
      )
    } else if (
      depthChartRank >= 5 &&
      context.strategy.penalizeBuriedDepthChartPlayers
    ) {
      notes.push(`Buried on ${player.team} ${primaryPosition} depth chart`)
    }
  }

  if (playerContributionShare) {
    score +=
      playerContributionShare * context.strategy.weights.playerContribution
    notes.push(
      `${Math.round(playerContributionShare * 100)}% individual contribution signal`
    )
  }

  if (
    playerContribution?.trend === 'rising' &&
    context.strategy.boostRisingUsage
  ) {
    score += context.strategy.weights.trend
    notes.push('Usage trend rising')
  }

  if (playerContribution?.trend === 'falling') {
    score -= context.strategy.weights.trend
    notes.push('Usage trend falling')
  }

  return {
    score,
    notes,
    depthChartRank,
    teamPositionShare,
    playerContributionShare,
  }
}

export function summarizeTeamStrategy(
  player: Player,
  context: StrategyContext | undefined
): string | undefined {
  if (!context || !player.team) {
    return undefined
  }

  const primaryPosition = getPrimaryPosition(player.positions)
  if (!primaryPosition) {
    return undefined
  }

  const profile = context.teamProfiles[player.team]?.positions[primaryPosition]
  const share = profile?.fantasyPointShare
  const depthChartRank = findDepthChartRank(
    player,
    context,
    context.teamProfiles[player.team]
  )

  if (share && depthChartRank) {
    return `${player.team} ${primaryPosition}: ${Math.round(share * 100)}% point share, depth rank ${depthChartRank}`
  }

  if (share) {
    return `${player.team} ${primaryPosition}: ${Math.round(share * 100)}% point share`
  }

  if (depthChartRank) {
    return `${player.team} ${primaryPosition}: inferred depth rank ${depthChartRank}`
  }

  return undefined
}

function inferDepthCharts(
  players: Player[]
): StrategyContext['inferredDepthCharts'] {
  const teamDepthCharts = new Map<string, Map<Position, Player[]>>()

  for (const player of players) {
    if (!player.team) {
      continue
    }

    const position = getPrimaryPosition(player.positions)
    if (!position) {
      continue
    }

    const teamPositions =
      teamDepthCharts.get(player.team) ?? new Map<Position, Player[]>()
    teamPositions.set(position, [
      ...(teamPositions.get(position) ?? []),
      player,
    ])
    teamDepthCharts.set(player.team, teamPositions)
  }

  for (const teamPositions of teamDepthCharts.values()) {
    for (const [position, positionPlayers] of teamPositions) {
      teamPositions.set(
        position,
        [...positionPlayers].sort(comparePlayersBySearchRank)
      )
    }
  }

  return teamDepthCharts
}

function findDepthChartRank(
  player: Player,
  context: StrategyContext,
  teamProfile: TeamOpportunityProfile | undefined
): number | undefined {
  const primaryPosition = getPrimaryPosition(player.positions)
  if (!primaryPosition) {
    return undefined
  }

  const manualEntry = teamProfile?.positions[primaryPosition]?.depthChart?.find(
    (entry) => {
      if (entry.playerId) {
        return entry.playerId === player.id
      }

      return normalizeName(entry.playerName) === normalizeName(player.fullName)
    }
  )

  if (manualEntry) {
    return manualEntry.rank
  }

  const inferredDepthChart = player.team
    ? context.inferredDepthCharts.get(player.team)?.get(primaryPosition)
    : undefined
  const inferredIndex =
    inferredDepthChart?.findIndex((candidate) => candidate.id === player.id) ??
    -1

  return inferredIndex >= 0 ? inferredIndex + 1 : undefined
}

function findPlayerContribution(
  player: Player,
  contributions: PlayerContributionProfile[] | undefined
) {
  return contributions?.find((contribution) => {
    if (contribution.playerId) {
      return contribution.playerId === player.id
    }

    return contribution.playerName
      ? normalizeName(contribution.playerName) ===
          normalizeName(player.fullName)
      : false
  })
}

function scoreDepthChart(
  depthChartRank: number,
  strategy: StrategyDefaults
): number {
  if (depthChartRank === 1) {
    return strategy.weights.depthChart
  }

  if (depthChartRank <= 3 && strategy.preferDepthChartUpside) {
    return strategy.weights.depthChart * 0.55
  }

  if (depthChartRank >= 5 && strategy.penalizeBuriedDepthChartPlayers) {
    return -strategy.weights.depthChart * 0.65
  }

  return 0
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}
