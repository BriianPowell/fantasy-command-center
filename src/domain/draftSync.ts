import type { DraftState, NormalizedLeagueData } from './types'

export interface DraftSyncStatus {
  lastUpdatedAt?: number
  message?: string
  state: 'idle' | 'syncing' | 'synced' | 'error'
}

export function mergeLeagueDraftState(
  leagues: NormalizedLeagueData[],
  leagueId: string,
  draft: DraftState
): NormalizedLeagueData[] {
  return leagues.map((league) =>
    league.league.id === leagueId ? { ...league, draft } : league
  )
}
