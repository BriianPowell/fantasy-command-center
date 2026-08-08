import type { DraftPick, Roster } from './types'

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

export function getDraftPicksForRoster(
  picks: DraftPick[],
  rosterId: string
): DraftPick[] {
  return picks.filter((pick) => pick.rosterId === rosterId)
}

export function getDraftedPlayerIds(picks: DraftPick[]): string[] {
  return picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : []))
}

export function getDraftedPlayerIdsForRoster(
  picks: DraftPick[],
  rosterId: string
): string[] {
  return getDraftedPlayerIds(getDraftPicksForRoster(picks, rosterId))
}

export function buildDraftAwareRoster(
  roster: Roster | undefined,
  picks: DraftPick[],
  rosterId: string
): Roster | undefined {
  if (!roster) {
    return undefined
  }

  return {
    ...roster,
    playerIds: Array.from(
      new Set([
        ...roster.playerIds,
        ...getDraftedPlayerIdsForRoster(picks, rosterId),
      ])
    ),
  }
}

export function sortDraftPicks(
  picks: DraftPick[],
  order: DraftPickDisplayOrder = 'oldest_first'
): DraftPick[] {
  return [...picks].sort((a, b) =>
    order === 'oldest_first' ? a.pickNo - b.pickNo : b.pickNo - a.pickNo
  )
}
