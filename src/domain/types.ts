export type Position = "QB" | "RB" | "WR" | "TE" | "K" | "DEF" | "DB" | "DL" | "LB" | "IDP";

export type DraftType = "snake" | "auction" | "linear";

export type TeamNeed = "critical" | "thin" | "stable" | "surplus";

export interface LeagueSettings {
  teams: number;
  scoringType: "ppr" | "half_ppr" | "standard" | "custom";
  rosterSlots: Record<Position | "FLEX" | "SUPER_FLEX" | "BN", number>;
  playoffWeekStart?: number;
}

export interface League {
  id: string;
  provider: "sleeper";
  name: string;
  season: string;
  settings: LeagueSettings;
  draftId?: string;
}

export interface FantasyTeam {
  id: string;
  name: string;
  ownerName: string;
  ownerUsername?: string;
  ownerId?: string;
  avatarUrl?: string;
}

export interface Player {
  id: string;
  providerPlayerId: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  team?: string;
  positions: Position[];
  age?: number;
  yearsExperience?: number;
  injuryStatus?: string;
  byeWeek?: number;
  searchRank?: number;
}

export interface Roster {
  teamId: string;
  playerIds: string[];
  starters: string[];
}

export interface NflState {
  week: number;
  displayWeek?: number;
  season: string;
  seasonType: "pre" | "regular" | "post" | string;
  leagueSeason?: string;
  previousSeason?: string;
  leg?: number;
}

export interface LeagueMatchup {
  teamId: string;
  matchupId?: number;
  points: number;
  playerIds: string[];
  starters: string[];
  playerPoints: Record<string, number>;
  starterPoints: number[];
}

export interface LeagueTransaction {
  id: string;
  type: string;
  status: string;
  rosterIds: string[];
  adds: Record<string, string>;
  drops: Record<string, string>;
  waiverBudget: {
    sender: string;
    receiver: string;
    amount: number;
  }[];
  draftPicks: TradedDraftPick[];
}

export interface TradedDraftPick {
  season: string;
  round: number;
  rosterId: string;
  ownerId?: string;
  previousOwnerId?: string;
}

export interface TrendingPlayer {
  playerId: string;
  type: "add" | "drop";
  count: number;
}

export interface DraftPick {
  pickNo: number;
  round: number;
  rosterId?: string;
  playerId?: string;
  pickedBy?: string;
  metadata?: {
    firstName?: string;
    lastName?: string;
    position?: Position;
    team?: string;
  };
}

export interface DraftState {
  id: string;
  type: DraftType;
  status: "pre_draft" | "drafting" | "complete" | "unknown";
  rounds: number;
  currentPick?: number;
  picks: DraftPick[];
}

export interface Projection {
  playerId: string;
  week?: number;
  projectedPoints: number;
  floor?: number;
  ceiling?: number;
  source: string;
}

export interface Ranking {
  playerId: string;
  rank: number;
  tier?: number;
  positionRank?: number;
  source: string;
}

export interface PlayerNote {
  playerId: string;
  tag: "target" | "avoid" | "watch";
  note?: string;
}

export interface DraftRecommendation {
  player: Player;
  score: number;
  valueScore: number;
  needScore: number;
  scarcityScore: number;
  strategyScore: number;
  byeRisk: number;
  notes: string[];
}

export interface NormalizedLeagueData {
  league: League;
  teams: FantasyTeam[];
  rosters: Roster[];
  draft?: DraftState;
  players: Player[];
}
