import type { DraftPick } from './types'

export type DraftPickDisplayOrder = 'newest_first' | 'oldest_first'

export function getRecentDraftPicks(
  picks: DraftPick[],
  {
    limit,
    order = 'oldest_first',
    rosterId,
  }: {
    limit: number
    order?: DraftPickDisplayOrder
    rosterId?: string
  }
): DraftPick[] {
  const recentPicks = picks
    .filter((pick) => !rosterId || pick.rosterId === rosterId)
    .sort((a, b) => b.pickNo - a.pickNo)
    .slice(0, limit)

  return sortDraftPicks(recentPicks, order)
}

export function sortDraftPicks(
  picks: DraftPick[],
  order: DraftPickDisplayOrder = 'oldest_first'
): DraftPick[] {
  return [...picks].sort((a, b) =>
    order === 'oldest_first' ? a.pickNo - b.pickNo : b.pickNo - a.pickNo
  )
}
