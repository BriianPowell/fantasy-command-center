const ESPN_SCOREBOARD_URL = "https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard";
const REGULAR_SEASON_TYPE = "2";
const REGULAR_SEASON_WEEKS = Array.from({ length: 18 }, (_, index) => index + 1);
const byeWeekCache = new Map<string, Promise<Record<string, number>>>();
const NFL_TEAMS = [
  "ARI",
  "ATL",
  "BAL",
  "BUF",
  "CAR",
  "CHI",
  "CIN",
  "CLE",
  "DAL",
  "DEN",
  "DET",
  "GB",
  "HOU",
  "IND",
  "JAX",
  "KC",
  "LV",
  "LAC",
  "LAR",
  "MIA",
  "MIN",
  "NE",
  "NO",
  "NYG",
  "NYJ",
  "PHI",
  "PIT",
  "SEA",
  "SF",
  "TB",
  "TEN",
  "WAS"
] as const;

type NflTeam = (typeof NFL_TEAMS)[number];

interface EspnScoreboard {
  events?: {
    competitions?: {
      competitors?: {
        team?: {
          abbreviation?: string;
        };
      }[];
    }[];
  }[];
}

export async function loadNflTeamByeWeeks(season: string): Promise<Record<string, number>> {
  const cachedByeWeeks = byeWeekCache.get(season);

  if (cachedByeWeeks) {
    return cachedByeWeeks;
  }

  const byeWeeksPromise = fetchNflTeamByeWeeks(season).catch((caughtError) => {
    byeWeekCache.delete(season);
    throw caughtError;
  });
  byeWeekCache.set(season, byeWeeksPromise);

  return byeWeeksPromise;
}

async function fetchNflTeamByeWeeks(season: string): Promise<Record<string, number>> {
  const weeklyTeams = await Promise.all(REGULAR_SEASON_WEEKS.map((week) => fetchWeekTeams(season, week)));
  const byeWeeks: Partial<Record<NflTeam, number>> = {};

  weeklyTeams.forEach((playingTeams, index) => {
    const week = REGULAR_SEASON_WEEKS[index];

    if (!playingTeams.size) {
      return;
    }

    for (const team of NFL_TEAMS) {
      if (!playingTeams.has(team) && !byeWeeks[team]) {
        byeWeeks[team] = week;
      }
    }
  });

  validateByeWeeks(byeWeeks);

  return Object.fromEntries(
    Object.entries(byeWeeks).flatMap(([team, week]) => [
      [team, week],
      ...getSleeperTeamAliases(team).map((alias) => [alias, week])
    ])
  );
}

function validateByeWeeks(byeWeeks: Partial<Record<NflTeam, number>>) {
  const missingTeams = NFL_TEAMS.filter((team) => !byeWeeks[team]);

  if (missingTeams.length) {
    throw new Error(`Incomplete NFL bye-week schedule. Missing teams: ${missingTeams.join(", ")}`);
  }
}

async function fetchWeekTeams(season: string, week: number): Promise<Set<NflTeam>> {
  const params = new URLSearchParams({
    dates: season,
    seasontype: REGULAR_SEASON_TYPE,
    week: String(week)
  });
  const response = await fetch(`${ESPN_SCOREBOARD_URL}?${params.toString()}`);

  if (!response.ok) {
    throw new Error(`NFL schedule request failed: ${response.status} ${response.statusText}`);
  }

  const scoreboard = (await response.json()) as EspnScoreboard;
  const teams = new Set<NflTeam>();

  for (const event of scoreboard.events ?? []) {
    for (const competition of event.competitions ?? []) {
      for (const competitor of competition.competitors ?? []) {
        const team = normalizeEspnTeam(competitor.team?.abbreviation);

        if (team) {
          teams.add(team);
        }
      }
    }
  }

  return teams;
}

function normalizeEspnTeam(team: string | undefined): NflTeam | undefined {
  if (!team) {
    return undefined;
  }

  const normalized = team === "WSH" ? "WAS" : team;

  return isNflTeam(normalized) ? normalized : undefined;
}

function isNflTeam(team: string): team is NflTeam {
  return NFL_TEAMS.includes(team as NflTeam);
}

function getSleeperTeamAliases(team: string): string[] {
  if (team === "WAS") {
    return ["WSH"];
  }

  if (team === "JAX") {
    return ["JAC"];
  }

  return [];
}
