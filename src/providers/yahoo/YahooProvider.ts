import type { DraftState, League, NormalizedLeagueData, Player } from "../../domain/types";
import type { FantasyProvider, LeagueSearchResult } from "../FantasyProvider";

export interface YahooProviderConfig {
  backendBaseUrl: string;
}

export class YahooProvider implements FantasyProvider {
  id = "yahoo";
  displayName = "Yahoo Sports";

  constructor(private readonly config: YahooProviderConfig) {}

  async searchLeagues(query: string, season: string): Promise<LeagueSearchResult[]> {
    return this.backendFetch<LeagueSearchResult[]>(`/api/yahoo/leagues?query=${encodeURIComponent(query)}&season=${season}`);
  }

  async loadLeague(leagueId: string): Promise<League> {
    return this.backendFetch<League>(`/api/yahoo/leagues/${leagueId}`);
  }

  async loadLeagueData(leagueId: string): Promise<NormalizedLeagueData> {
    return this.backendFetch<NormalizedLeagueData>(`/api/yahoo/leagues/${leagueId}/normalized`);
  }

  async loadDraft(draftId: string): Promise<DraftState> {
    return this.backendFetch<DraftState>(`/api/yahoo/drafts/${draftId}`);
  }

  async loadPlayers(): Promise<Player[]> {
    return this.backendFetch<Player[]>("/api/yahoo/players");
  }

  private async backendFetch<T>(path: string): Promise<T> {
    const response = await fetch(`${this.config.backendBaseUrl}${path}`, {
      credentials: "include"
    });

    if (response.status === 401) {
      throw new Error("Yahoo authentication is required. Connect your Yahoo account from the backend sign-in flow.");
    }

    if (!response.ok) {
      throw new Error(`Yahoo backend request failed: ${response.status} ${response.statusText}`);
    }

    return (await response.json()) as T;
  }
}
