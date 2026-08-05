import type { DraftState, League, NormalizedLeagueData, Player } from "../domain/types";

export interface LeagueSearchResult {
  id: string;
  name: string;
  season: string;
  provider: string;
}

export interface FantasyProvider {
  id: string;
  displayName: string;
  searchLeagues(query: string, season: string): Promise<LeagueSearchResult[]>;
  loadLeague(leagueId: string): Promise<League>;
  loadLeagueData(leagueId: string): Promise<NormalizedLeagueData>;
  loadDraft(draftId: string): Promise<DraftState>;
  loadPlayers(): Promise<Player[]>;
}
