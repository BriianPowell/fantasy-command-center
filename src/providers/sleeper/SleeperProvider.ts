import type {
  DraftPick,
  DraftState,
  FantasyTeam,
  League,
  LeagueSettings,
  NormalizedLeagueData,
  Player,
  Position,
  Roster
} from "../../domain/types";
import type { FantasyProvider, LeagueSearchResult } from "../FantasyProvider";

const SLEEPER_API_BASE = "https://api.sleeper.app/v1";
const NFL = "nfl";
const SUPPORTED_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF", "DB", "DL", "LB", "IDP"]);

interface SleeperLeague {
  league_id: string;
  name: string;
  season: string;
  draft_id?: string;
  total_rosters: number;
  roster_positions?: string[];
  scoring_settings?: Record<string, number>;
  settings?: {
    playoff_week_start?: number;
  };
}

interface SleeperUser {
  user_id: string;
  display_name?: string;
  username?: string;
  avatar?: string;
  metadata?: {
    team_name?: string;
  };
}

interface SleeperRoster {
  roster_id: number;
  owner_id?: string;
  players?: string[];
  starters?: string[];
}

interface SleeperDraft {
  draft_id: string;
  type?: string;
  status?: string;
  settings?: {
    rounds?: number;
  };
  metadata?: {
    scoring_type?: string;
  };
}

interface SleeperPick {
  pick_no: number;
  round: number;
  roster_id?: number;
  player_id?: string;
  picked_by?: string;
  metadata?: {
    first_name?: string;
    last_name?: string;
    position?: string;
    team?: string;
  };
}

interface SleeperPlayer {
  player_id: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  team?: string;
  fantasy_positions?: string[];
  position?: string;
  age?: number;
  years_exp?: number;
  injury_status?: string;
  bye_week?: number;
  search_rank?: number;
  active?: boolean;
}

interface SleeperUserLookup {
  user_id: string;
}

export class SleeperProvider implements FantasyProvider {
  id = "sleeper";
  displayName = "Sleeper";
  private playersCache?: Promise<Player[]>;

  async searchLeagues(query: string, season: string): Promise<LeagueSearchResult[]> {
    const trimmedQuery = query.trim();

    if (!trimmedQuery) {
      return [];
    }

    if (/^\d+$/.test(trimmedQuery)) {
      const league = await this.loadLeague(trimmedQuery);
      return [
        {
          id: league.id,
          name: league.name,
          season: league.season,
          provider: this.displayName
        }
      ];
    }

    const user = await sleeperFetch<SleeperUserLookup>(`/user/${encodeURIComponent(trimmedQuery)}`);
    const leagues = await sleeperFetch<SleeperLeague[]>(`/user/${user.user_id}/leagues/${NFL}/${season}`);

    return leagues.map((league) => ({
      id: league.league_id,
      name: league.name,
      season: league.season,
      provider: this.displayName
    }));
  }

  async loadLeague(leagueId: string): Promise<League> {
    const league = await sleeperFetch<SleeperLeague>(`/league/${leagueId}`);

    return normalizeLeague(league);
  }

  async loadLeagueData(leagueId: string): Promise<NormalizedLeagueData> {
    const [shellData, players] = await Promise.all([this.loadLeagueShellData(leagueId), this.loadPlayers()]);

    return {
      ...shellData,
      players
    };
  }

  async loadLeagueShellData(leagueId: string): Promise<NormalizedLeagueData> {
    const [league, users, rosters, drafts] = await Promise.all([
      sleeperFetch<SleeperLeague>(`/league/${leagueId}`),
      sleeperFetch<SleeperUser[]>(`/league/${leagueId}/users`),
      sleeperFetch<SleeperRoster[]>(`/league/${leagueId}/rosters`),
      sleeperFetch<SleeperDraft[]>(`/league/${leagueId}/drafts`)
    ]);

    const draftId = league.draft_id ?? drafts[0]?.draft_id;
    const draft = draftId ? await this.loadDraft(draftId) : undefined;

    return {
      league: normalizeLeague({ ...league, draft_id: draftId }),
      teams: normalizeTeams(users, rosters),
      rosters: rosters.map(normalizeRoster),
      draft,
      players: []
    };
  }

  async loadDraft(draftId: string): Promise<DraftState> {
    const [draft, picks] = await Promise.all([
      sleeperFetch<SleeperDraft>(`/draft/${draftId}`),
      sleeperFetch<SleeperPick[]>(`/draft/${draftId}/picks`)
    ]);

    return {
      id: draft.draft_id,
      type: draft.type === "auction" ? "auction" : draft.type === "linear" ? "linear" : "snake",
      status: normalizeDraftStatus(draft.status),
      rounds: draft.settings?.rounds ?? Math.max(...picks.map((pick) => pick.round), 0),
      currentPick: picks.length + 1,
      picks: picks.map(normalizePick)
    };
  }

  async loadPlayers(): Promise<Player[]> {
    this.playersCache ??= this.fetchPlayers();

    return this.playersCache;
  }

  private async fetchPlayers(): Promise<Player[]> {
    const players = await sleeperFetch<Record<string, SleeperPlayer>>(`/players/${NFL}`);

    return Object.values(players)
      .filter((player) => player.active !== false)
      .map(normalizePlayer)
      .filter((player): player is Player => Boolean(player))
      .sort((a, b) => (a.searchRank ?? Number.MAX_SAFE_INTEGER) - (b.searchRank ?? Number.MAX_SAFE_INTEGER));
  }
}

async function sleeperFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${SLEEPER_API_BASE}${path}`);

  if (!response.ok) {
    throw new Error(`Sleeper API request failed: ${response.status} ${response.statusText}`);
  }

  const body = (await response.json()) as T | null;

  if (!body) {
    throw new Error("Sleeper API returned no data");
  }

  return body;
}

function normalizeLeague(league: SleeperLeague): League {
  return {
    id: league.league_id,
    provider: "sleeper",
    name: league.name,
    season: league.season,
    draftId: league.draft_id,
    settings: normalizeSettings(league)
  };
}

function normalizeSettings(league: SleeperLeague): LeagueSettings {
  const rosterSlots = (league.roster_positions ?? []).reduce<LeagueSettings["rosterSlots"]>(
    (slots, slot) => {
      const normalizedSlot = slot === "SUPER_FLEX" ? "SUPER_FLEX" : slot === "FLEX" ? "FLEX" : slot === "BN" ? "BN" : slot;

      if (isRosterSlot(normalizedSlot)) {
        slots[normalizedSlot] = (slots[normalizedSlot] ?? 0) + 1;
      }

      return slots;
    },
    {
      QB: 0,
      RB: 0,
      WR: 0,
      TE: 0,
      K: 0,
      DEF: 0,
      DB: 0,
      DL: 0,
      LB: 0,
      IDP: 0,
      FLEX: 0,
      SUPER_FLEX: 0,
      BN: 0
    }
  );

  return {
    teams: league.total_rosters,
    scoringType: inferScoringType(league.scoring_settings),
    rosterSlots,
    playoffWeekStart: league.settings?.playoff_week_start
  };
}

function normalizeTeams(users: SleeperUser[], rosters: SleeperRoster[]): FantasyTeam[] {
  const usersById = new Map(users.map((user) => [user.user_id, user]));

  return rosters.map((roster) => {
    const user = roster.owner_id ? usersById.get(roster.owner_id) : undefined;

    return {
      id: String(roster.roster_id),
      name: user?.metadata?.team_name ?? user?.display_name ?? `Team ${roster.roster_id}`,
      ownerName: user?.display_name ?? user?.username ?? "Unknown owner",
      ownerUsername: user?.username,
      ownerId: user?.user_id,
      avatarUrl: user?.avatar ? `https://sleepercdn.com/avatars/${user.avatar}` : undefined
    };
  });
}

function normalizeRoster(roster: SleeperRoster): Roster {
  return {
    teamId: String(roster.roster_id),
    playerIds: roster.players ?? [],
    starters: roster.starters ?? []
  };
}

function normalizePick(pick: SleeperPick): DraftPick {
  return {
    pickNo: pick.pick_no,
    round: pick.round,
    rosterId: pick.roster_id ? String(pick.roster_id) : undefined,
    playerId: pick.player_id,
    pickedBy: pick.picked_by,
    metadata: pick.metadata
      ? {
          firstName: pick.metadata.first_name,
          lastName: pick.metadata.last_name,
          position: normalizePosition(pick.metadata.position),
          team: pick.metadata.team
        }
      : undefined
  };
}

function normalizePlayer(player: SleeperPlayer): Player | undefined {
  const positions = (player.fantasy_positions?.length ? player.fantasy_positions : [player.position])
    .map(normalizePosition)
    .filter((position): position is Position => Boolean(position));

  if (!positions.length || !positions.some((position) => SUPPORTED_POSITIONS.has(position))) {
    return undefined;
  }

  const fullName = player.full_name ?? [player.first_name, player.last_name].filter(Boolean).join(" ");

  if (!fullName) {
    return undefined;
  }

  return {
    id: player.player_id,
    providerPlayerId: player.player_id,
    fullName,
    firstName: player.first_name,
    lastName: player.last_name,
    team: player.team,
    positions,
    age: player.age,
    yearsExperience: player.years_exp,
    injuryStatus: player.injury_status,
    byeWeek: player.bye_week,
    searchRank: player.search_rank
  };
}

function normalizePosition(position?: string): Position | undefined {
  if (!position) {
    return undefined;
  }

  const normalized = position === "DST" ? "DEF" : position;

  return SUPPORTED_POSITIONS.has(normalized) ? (normalized as Position) : undefined;
}

function normalizeDraftStatus(status?: string): DraftState["status"] {
  if (status === "pre_draft" || status === "drafting" || status === "complete") {
    return status;
  }

  return "unknown";
}

function inferScoringType(scoringSettings: Record<string, number> | undefined): LeagueSettings["scoringType"] {
  const receptionPoints = scoringSettings?.rec ?? 0;

  if (receptionPoints === 1) {
    return "ppr";
  }

  if (receptionPoints === 0.5) {
    return "half_ppr";
  }

  if (receptionPoints === 0) {
    return "standard";
  }

  return "custom";
}

function isRosterSlot(slot: string): slot is keyof LeagueSettings["rosterSlots"] {
  return ["QB", "RB", "WR", "TE", "K", "DEF", "DB", "DL", "LB", "IDP", "FLEX", "SUPER_FLEX", "BN"].includes(slot);
}
