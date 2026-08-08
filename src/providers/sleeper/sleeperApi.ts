import type {
  SleeperDraft,
  SleeperLeague,
  SleeperMatchup,
  SleeperNflState,
  SleeperPick,
  SleeperPlayer,
  SleeperRoster,
  SleeperTradedPick,
  SleeperTransaction,
  SleeperTrendingPlayer,
  SleeperUser,
} from './sleeperTypes'

const SLEEPER_API_BASE = 'https://api.sleeper.app/v1'
const NFL = 'nfl'

export interface SleeperTrendingOptions {
  lookbackHours?: number
  limit?: number
}

export class SleeperApi {
  private nflStateCache?: Promise<SleeperNflState>
  private trendingPlayersCache = new Map<
    string,
    Promise<SleeperTrendingPlayer[]>
  >()

  fetchLeague(leagueId: string): Promise<SleeperLeague> {
    return sleeperFetch<SleeperLeague>(`/league/${leagueId}`)
  }

  fetchLeagueUsers(leagueId: string): Promise<SleeperUser[]> {
    return sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`)
  }

  fetchLeagueRosters(leagueId: string): Promise<SleeperRoster[]> {
    return sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`)
  }

  fetchLeagueDrafts(leagueId: string): Promise<SleeperDraft[]> {
    return sleeperFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`)
  }

  fetchDraft(draftId: string): Promise<SleeperDraft> {
    return sleeperFetch<SleeperDraft>(`/draft/${draftId}`)
  }

  fetchDraftPicks(draftId: string): Promise<SleeperPick[]> {
    return sleeperFetch<SleeperPick[]>(`/draft/${draftId}/picks`)
  }

  fetchNflState(): Promise<SleeperNflState> {
    this.nflStateCache ??= sleeperFetch<SleeperNflState>(`/state/${NFL}`)

    return this.nflStateCache
  }

  fetchLeagueMatchups(
    leagueId: string,
    week: number
  ): Promise<SleeperMatchup[]> {
    return sleeperFetch<SleeperMatchup[]>(
      `/league/${leagueId}/matchups/${week}`
    )
  }

  fetchTransactions(
    leagueId: string,
    week: number
  ): Promise<SleeperTransaction[]> {
    return sleeperFetch<SleeperTransaction[]>(
      `/league/${leagueId}/transactions/${week}`
    )
  }

  fetchTradedPicks(leagueId: string): Promise<SleeperTradedPick[]> {
    return sleeperFetch<SleeperTradedPick[]>(`/league/${leagueId}/traded_picks`)
  }

  fetchTrendingPlayers(
    type: 'add' | 'drop',
    options: SleeperTrendingOptions = {}
  ): Promise<SleeperTrendingPlayer[]> {
    const params = new URLSearchParams()

    if (options.lookbackHours) {
      params.set('lookback_hours', String(options.lookbackHours))
    }

    if (options.limit) {
      params.set('limit', String(options.limit))
    }

    const query = params.toString()
    const cacheKey = `${type}:${query}`
    const path = `/players/${NFL}/trending/${type}${query ? `?${query}` : ''}`
    const cachedPlayers = this.trendingPlayersCache.get(cacheKey)

    if (cachedPlayers) {
      return cachedPlayers
    }

    const playersRequest = sleeperFetch<SleeperTrendingPlayer[]>(path)
    this.trendingPlayersCache.set(cacheKey, playersRequest)

    return playersRequest
  }

  fetchPlayers(): Promise<Record<string, SleeperPlayer>> {
    return sleeperFetch<Record<string, SleeperPlayer>>(
      `/players/${NFL}?active=true`
    )
  }
}

async function sleeperFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${SLEEPER_API_BASE}${path}`)

  if (!response.ok) {
    throw new Error(
      `Sleeper API request failed: ${response.status} ${response.statusText}`
    )
  }

  const body = (await response.json()) as T | null

  if (!body) {
    throw new Error('Sleeper API returned no data')
  }

  return body
}
