import type { Player, Projection, Ranking } from './types'

export function comparePlayersBySearchRank(a: Player, b: Player): number {
  return (
    (a.searchRank ?? Number.MAX_SAFE_INTEGER) -
    (b.searchRank ?? Number.MAX_SAFE_INTEGER)
  )
}

export function scoreDraftPlayerValue(
  player: Player,
  ranking?: Ranking,
  projection?: Projection
): number {
  const rankScore = ranking
    ? Math.max(0, 120 - ranking.rank)
    : scoreSleeperSearchRank(player.searchRank)
  const projectionScore = projection ? projection.projectedPoints * 2 : 0
  const tierBonus = ranking?.tier ? Math.max(0, 12 - ranking.tier * 2) : 0

  return rankScore + projectionScore + tierBonus
}

export function formatDraftValueScore(score: number): string {
  const roundedScore = Math.round(score)

  return roundedScore > 0 ? `+${roundedScore}` : String(roundedScore)
}

function scoreSleeperSearchRank(searchRank: number | undefined): number {
  if (!searchRank) {
    return 20
  }

  return Math.max(0, 85 - Math.log2(searchRank + 1) * 8)
}
