import type {
  DraftPick,
  DraftState,
  FantasyTeam,
  League,
  LeagueMatchup,
  LeagueSettings,
  LeagueTransaction,
  NflState,
  Player,
  Position,
  Roster,
  TradedDraftPick,
  TrendingPlayer
} from "../../domain/types";
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
  SleeperUser
} from "./sleeperTypes";

const SUPPORTED_POSITIONS = new Set(["QB", "RB", "WR", "TE", "K", "DEF", "DB", "DL", "LB", "IDP"]);

export function normalizeLeague(league: SleeperLeague): League {
  return {
    id: league.league_id,
    provider: "sleeper",
    name: league.name,
    season: league.season,
    draftId: league.draft_id,
    settings: normalizeSettings(league)
  };
}

export function normalizeTeams(users: SleeperUser[], rosters: SleeperRoster[]): FantasyTeam[] {
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

export function normalizeRoster(roster: SleeperRoster): Roster {
  return {
    teamId: String(roster.roster_id),
    playerIds: roster.players ?? [],
    starters: roster.starters ?? []
  };
}

export function normalizeDraft(draft: SleeperDraft, picks: SleeperPick[]): DraftState {
  return {
    id: draft.draft_id,
    type: draft.type === "auction" ? "auction" : draft.type === "linear" ? "linear" : "snake",
    status: normalizeDraftStatus(draft.status),
    rounds: draft.settings?.rounds ?? Math.max(...picks.map((pick) => pick.round), 0),
    currentPick: picks.length + 1,
    picks: picks.map(normalizePick)
  };
}

export function normalizeNflState(state: SleeperNflState): NflState {
  return {
    week: state.week,
    displayWeek: state.display_week,
    season: state.season,
    seasonType: state.season_type,
    leagueSeason: state.league_season,
    previousSeason: state.previous_season,
    leg: state.leg
  };
}

export function normalizeMatchup(matchup: SleeperMatchup): LeagueMatchup {
  return {
    teamId: String(matchup.roster_id),
    matchupId: matchup.matchup_id,
    points: matchup.points ?? 0,
    playerIds: matchup.players ?? [],
    starters: matchup.starters ?? [],
    playerPoints: matchup.players_points ?? {},
    starterPoints: matchup.starters_points ?? []
  };
}

export function normalizeTransaction(transaction: SleeperTransaction): LeagueTransaction {
  return {
    id: transaction.transaction_id,
    type: transaction.type ?? "unknown",
    status: transaction.status ?? "unknown",
    rosterIds: (transaction.roster_ids ?? []).map(String),
    adds: stringifyRosterMap(transaction.adds),
    drops: stringifyRosterMap(transaction.drops),
    waiverBudget:
      transaction.waiver_budget?.map((budget) => ({
        sender: String(budget.sender),
        receiver: String(budget.receiver),
        amount: budget.amount
      })) ?? [],
    draftPicks: transaction.draft_picks?.map(normalizeTradedPick) ?? []
  };
}

export function normalizeTradedPick(pick: SleeperTradedPick): TradedDraftPick {
  return {
    season: pick.season,
    round: pick.round,
    rosterId: String(pick.roster_id),
    ownerId: pick.owner_id ? String(pick.owner_id) : undefined,
    previousOwnerId: pick.previous_owner_id ? String(pick.previous_owner_id) : undefined
  };
}

export function normalizeTrendingPlayer(player: SleeperTrendingPlayer, type: TrendingPlayer["type"]): TrendingPlayer {
  return {
    playerId: player.player_id,
    type,
    count: player.count
  };
}

export function normalizePlayer(player: SleeperPlayer): Player | undefined {
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

function stringifyRosterMap(rosterMap: Record<string, number> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(rosterMap ?? {}).map(([playerId, rosterId]) => [playerId, String(rosterId)]));
}

function isRosterSlot(slot: string): slot is keyof LeagueSettings["rosterSlots"] {
  return ["QB", "RB", "WR", "TE", "K", "DEF", "DB", "DL", "LB", "IDP", "FLEX", "SUPER_FLEX", "BN"].includes(slot);
}
