import {
  getPrimaryPosition,
  isPositionConfiguredForLeague,
} from '../../domain/positionUtils'
import type {
  DraftRecommendation,
  LeagueSettings,
  Position,
} from '../../domain/types'

export {
  getPositionClass,
  getPrimaryPosition,
} from '../../domain/positionUtils'

const HIDDEN_DRAFT_POSITIONS = new Set<Position>(['DB', 'DL', 'LB', 'IDP'])
const PREFERRED_POSITION_ORDER: Position[] = [
  'QB',
  'RB',
  'WR',
  'TE',
  'K',
  'DEF',
]

export function groupRecommendationsByPosition(
  recommendations: DraftRecommendation[]
): Map<Position, DraftRecommendation[]> {
  const grouped = new Map<Position, DraftRecommendation[]>()

  for (const recommendation of recommendations) {
    const position = getPrimaryPosition(recommendation.player.positions)

    if (!position) {
      continue
    }

    grouped.set(position, [...(grouped.get(position) ?? []), recommendation])
  }

  return grouped
}

export function getVisiblePositions(
  groupedRecommendations: Map<Position, DraftRecommendation[]>,
  leagueSettings: LeagueSettings
): Position[] {
  const remainingPositions = Array.from(groupedRecommendations.keys()).filter(
    (position) => !PREFERRED_POSITION_ORDER.includes(position)
  )

  return [...PREFERRED_POSITION_ORDER, ...remainingPositions].filter(
    (position) =>
      !HIDDEN_DRAFT_POSITIONS.has(position) &&
      isPositionConfiguredForLeague(position, leagueSettings) &&
      (groupedRecommendations.get(position)?.length ?? 0) > 0
  )
}
