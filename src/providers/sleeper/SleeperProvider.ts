import { SleeperApi, type SleeperTrendingOptions } from './sleeperApi'
import {
  normalizeDraft,
  normalizeLeague,
  normalizeMatchup,
  normalizeNflState,
  normalizePlayer,
  normalizeRoster,
  normalizeTeams,
  normalizeTradedPick,
  normalizeTransaction,
  normalizeTrendingPlayer,
} from './sleeperNormalizers'
import type {
  DraftState,
  LeagueMatchup,
  LeagueTransaction,
  NflState,
  NormalizedLeagueData,
  Player,
  TradedDraftPick,
  TrendingPlayer,
} from '../../domain/types'

export class SleeperProvider {
  id = 'sleeper'
  displayName = 'Sleeper'
  private readonly api = new SleeperApi()
  private playersCache?: Promise<Player[]>

  async loadLeagueShellData(leagueId: string): Promise<NormalizedLeagueData> {
    const [league, users, rosters, drafts] = await Promise.all([
      this.api.fetchLeague(leagueId),
      this.api.fetchLeagueUsers(leagueId),
      this.api.fetchLeagueRosters(leagueId),
      this.api.fetchLeagueDrafts(leagueId),
    ])
    const draftId = league.draft_id ?? drafts[0]?.draft_id
    const draft = draftId ? await this.loadDraft(draftId) : undefined

    return {
      league: normalizeLeague({ ...league, draft_id: draftId }),
      teams: normalizeTeams(users, rosters),
      rosters: rosters.map(normalizeRoster),
      draft,
      players: [],
    }
  }

  async loadDraft(draftId: string): Promise<DraftState> {
    const [draft, picks] = await Promise.all([
      this.api.fetchDraft(draftId),
      this.api.fetchDraftPicks(draftId),
    ])

    return normalizeDraft(draft, picks)
  }

  async loadNflState(): Promise<NflState> {
    const state = await this.api.fetchNflState()

    return normalizeNflState(state)
  }

  async loadLeagueMatchups(
    leagueId: string,
    week: number
  ): Promise<LeagueMatchup[]> {
    const matchups = await this.api.fetchLeagueMatchups(leagueId, week)

    return matchups.map(normalizeMatchup)
  }

  async loadTransactions(
    leagueId: string,
    week: number
  ): Promise<LeagueTransaction[]> {
    const transactions = await this.api.fetchTransactions(leagueId, week)

    return transactions.map(normalizeTransaction)
  }

  async loadTradedPicks(leagueId: string): Promise<TradedDraftPick[]> {
    const tradedPicks = await this.api.fetchTradedPicks(leagueId)

    return tradedPicks.map(normalizeTradedPick)
  }

  async loadTrendingPlayers(
    type: TrendingPlayer['type'],
    options: SleeperTrendingOptions = {}
  ): Promise<TrendingPlayer[]> {
    const trendingPlayers = await this.api.fetchTrendingPlayers(type, options)

    return trendingPlayers.map((player) =>
      normalizeTrendingPlayer(player, type)
    )
  }

  async loadPlayers(): Promise<Player[]> {
    this.playersCache ??= this.fetchPlayers()

    return this.playersCache
  }

  private async fetchPlayers(): Promise<Player[]> {
    const players = await this.api.fetchPlayers()

    return Object.values(players)
      .filter((player) => player.active !== false)
      .map(normalizePlayer)
      .filter((player): player is Player => Boolean(player))
      .sort(
        (a, b) =>
          (a.searchRank ?? Number.MAX_SAFE_INTEGER) -
          (b.searchRank ?? Number.MAX_SAFE_INTEGER)
      )
  }
}
