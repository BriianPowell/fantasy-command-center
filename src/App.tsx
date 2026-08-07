import { useEffect, useMemo, useRef, useState } from "react";
import { buildDraftRecommendations } from "./analysis/draftRecommendations";
import { fantasyConfig } from "./config/fantasyConfig";
import { defaultPlayerNotes, defaultProjections, defaultRankings } from "./data/defaultInputs";
import type { NormalizedLeagueData, Player, Roster } from "./domain/types";
import { DraftPickHelperModule } from "./modules/draft/DraftPickHelperModule";
import { TeamTrackerModule } from "./modules/team-tracker/TeamTrackerModule";
import { loadNflTeamByeWeeks } from "./providers/schedule/nflScheduleApi";
import { SleeperProvider } from "./providers/sleeper/SleeperProvider";
import { loadJson, saveJson } from "./storage/localStorage";
import { buildStrategyContext } from "./strategy/teamOpportunity";
import { getCurrentNflWeek } from "./utils/nflWeek";

const sleeperProvider = new SleeperProvider();
const configuredLeagueIds = [...fantasyConfig.sleeperLeagueIds];
type DashboardModuleId = "teamTracker" | "draftRoom";
const defaultMinimizedModules: Record<DashboardModuleId, boolean> = {
  draftRoom: false,
  teamTracker: false
};

export function App() {
  const selectedWeek = getCurrentNflWeek();
  const [leagues, setLeagues] = useState<NormalizedLeagueData[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState(() => loadJson("fcc:active-dashboard-id", ""));
  const [minimizedModules, setMinimizedModules] = useState<Record<DashboardModuleId, boolean>>(() =>
    ({ ...defaultMinimizedModules, ...loadJson("fcc:minimized-modules", defaultMinimizedModules) })
  );
  const [status, setStatus] = useState("Loading configured Sleeper leagues...");
  const [errors, setErrors] = useState<string[]>([]);
  const hasAutoLoaded = useRef(false);

  useEffect(() => {
    saveJson("fcc:active-dashboard-id", activeDashboardId);
    saveJson("fcc:minimized-modules", minimizedModules);
  }, [activeDashboardId, minimizedModules]);

  useEffect(() => {
    if (hasAutoLoaded.current || !configuredLeagueIds.length) {
      return;
    }

    hasAutoLoaded.current = true;
    void loadLeagues();
  }, []);

  async function loadLeagues() {
    setErrors([]);
    setStatus(`Loading ${configuredLeagueIds.length} Sleeper league${configuredLeagueIds.length === 1 ? "" : "s"}...`);

    const results = await Promise.allSettled(configuredLeagueIds.map((leagueId) => sleeperProvider.loadLeagueShellData(leagueId)));
    const loadedLeagues = results.flatMap((result) => (result.status === "fulfilled" ? [result.value] : []));
    const loadErrors = results.flatMap((result, index) =>
      result.status === "rejected" ? [`${configuredLeagueIds[index]}: ${readError(result.reason)}`] : []
    );

    setLeagues(loadedLeagues);
    setActiveDashboardId((current) =>
      current && loadedLeagues.some((league) => league.league.id === current) ? current : loadedLeagues[0]?.league.id ?? ""
    );
    setErrors(loadErrors);
    setStatus(
      loadedLeagues.length
        ? `Loaded ${loadedLeagues.length} dashboard${loadedLeagues.length === 1 ? "" : "s"}. Loading player pool...`
        : "No leagues loaded."
    );

    if (!loadedLeagues.length) {
      return;
    }

    try {
      const players = await sleeperProvider.loadPlayers();
      const { players: playersWithByeWeeks, warning: byeWeekWarning } = await hydratePlayerByeWeeks(players);
      const loadedLeagueIds = new Set(loadedLeagues.map((league) => league.league.id));

      if (byeWeekWarning) {
        setErrors((current) => [...current, byeWeekWarning]);
      }

      setLeagues((current) =>
        current.map((league) => (loadedLeagueIds.has(league.league.id) ? { ...league, players: playersWithByeWeeks } : league))
      );
      setStatus(
        `Loaded ${loadedLeagues.length} league${loadedLeagues.length === 1 ? "" : "s"}. Player pool ready.`
      );
    } catch (caughtError) {
      setErrors((current) => [...current, `Player pool: ${readError(caughtError)}`]);
      setStatus(`Loaded ${loadedLeagues.length} dashboard${loadedLeagues.length === 1 ? "" : "s"} without player metadata.`);
    }
  }

  const activeLeague = leagues.find((league) => league.league.id === activeDashboardId) ?? leagues[0];

  return (
    <main className="app-shell">
      <TopBar
        activeDashboardId={activeLeague?.league.id ?? ""}
        leagueIds={configuredLeagueIds}
        leagues={leagues}
        selectedWeek={selectedWeek}
        status={status}
        onActiveDashboardChange={setActiveDashboardId}
      />
      {errors.map((error) => (
        <p className="error" key={error}>
          {error}
        </p>
      ))}

      {activeLeague ? (
        <LeagueDashboard
          data={activeLeague}
          minimizedModules={minimizedModules}
          selectedTeamId={resolveSelectedTeamId(activeLeague)}
          onToggleModule={(moduleId) =>
            setMinimizedModules((current) => ({
              ...current,
              [moduleId]: !current[moduleId]
            }))
          }
        />
      ) : (
        <EmptyState />
      )}
    </main>
  );
}

function TopBar({
  activeDashboardId,
  leagueIds,
  leagues,
  selectedWeek,
  status,
  onActiveDashboardChange
}: {
  activeDashboardId: string;
  leagueIds: string[];
  leagues: NormalizedLeagueData[];
  selectedWeek: number;
  status: string;
  onActiveDashboardChange: (leagueId: string) => void;
}) {
  return (
    <header className="top-bar">
      <p className="status-line top-status">
        <span className="status-dot" />
        {status}
      </p>
      <div className="brand-block">
        <h1>Fantasy Command Center</h1>
      </div>

      <nav className="league-tabs" aria-label="League dashboards">
        {leagues.length ? (
          leagues.map((league) => (
            <button
              className={league.league.id === activeDashboardId ? "league-tab active" : "league-tab"}
              key={league.league.id}
              onClick={() => onActiveDashboardChange(league.league.id)}
              type="button"
            >
              {league.league.name}
            </button>
          ))
        ) : (
          <span className="league-tabs-loading">Loading {leagueIds.length} leagues...</span>
        )}
      </nav>

      <div className="week-pill">Week {selectedWeek}</div>
    </header>
  );
}

async function hydratePlayerByeWeeks(players: Player[]): Promise<{ players: Player[]; warning?: string }> {
  try {
    const teamByeWeeks = await loadNflTeamByeWeeks(fantasyConfig.season);

    return {
      players: players.map((player) => {
        const byeWeek = player.byeWeek ?? (player.team ? teamByeWeeks[player.team] : undefined);

        return byeWeek ? { ...player, byeWeek } : player;
      })
    };
  } catch (caughtError) {
    return {
      players,
      warning: `Bye-week schedule: ${readError(caughtError)}`
    };
  }
}

function LeagueDashboard({
  data,
  minimizedModules,
  onToggleModule,
  selectedTeamId
}: {
  data: NormalizedLeagueData;
  minimizedModules: Record<DashboardModuleId, boolean>;
  onToggleModule: (moduleId: DashboardModuleId) => void;
  selectedTeamId: string;
}) {
  const baseRoster = useMemo(() => data.rosters.find((roster) => roster.teamId === selectedTeamId), [data.rosters, selectedTeamId]);
  const selectedRoster = useMemo(() => {
    return buildDraftAwareRoster(baseRoster, data, selectedTeamId);
  }, [baseRoster, data, selectedTeamId]);

  const draftedPlayerIds = useMemo(() => {
    const draftedFromSleeper = data.draft?.picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : [])) ?? [];

    return new Set(draftedFromSleeper);
  }, [data.draft?.picks]);

  const strategyContext = useMemo(() => {
    return buildStrategyContext({
      players: data.players
    });
  }, [data.players]);

  const recommendations = useMemo(() => {
    return buildDraftRecommendations({
      players: data.players,
      draftedPlayerIds,
      roster: selectedRoster,
      leagueSettings: data.league.settings,
      rankings: defaultRankings,
      projections: defaultProjections,
      notes: defaultPlayerNotes,
      strategyContext
    });
  }, [data.league.settings, data.players, draftedPlayerIds, selectedRoster, strategyContext]);

  return (
    <article className="league-dashboard">
      <TeamTrackerModule
        data={data}
        isMinimized={minimizedModules.teamTracker}
        onToggleMinimized={() => onToggleModule("teamTracker")}
        roster={baseRoster}
        selectedTeamId={selectedTeamId}
      />
      <DraftPickHelperModule
        data={data}
        isMinimized={minimizedModules.draftRoom}
        onToggleMinimized={() => onToggleModule("draftRoom")}
        recommendations={recommendations}
        selectedTeamId={selectedTeamId}
      />
    </article>
  );
}

function EmptyState() {
  return (
    <section className="panel empty-state">
      <h2>Ready for your leagues</h2>
      <p>
        Your configured Sleeper leagues and usernames load automatically. Once loaded, choose a dashboard from the top bar to
        use the draft helper module.
      </p>
    </section>
  );
}

function buildDraftAwareRoster(roster: Roster | undefined, data: NormalizedLeagueData, teamId: string): Roster | undefined {
  if (!roster) {
    return undefined;
  }

  const draftedForTeam = data.draft?.picks.flatMap((pick) => (pick.rosterId === teamId && pick.playerId ? [pick.playerId] : [])) ?? [];

  return {
    ...roster,
    playerIds: Array.from(new Set([...roster.playerIds, ...draftedForTeam]))
  };
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function resolveSelectedTeamId(data: NormalizedLeagueData): string {
  const configuredTeams = data.teams.filter(isConfiguredOwner);

  return configuredTeams[0]?.id ?? data.teams[0]?.id ?? "";
}

function isConfiguredOwner(team: NormalizedLeagueData["teams"][number]): boolean {
  const configuredOwners = fantasyConfig.sleeperUsernames.map(normalizeIdentifier);

  return [team.ownerUsername, team.ownerName, team.ownerId].some(
    (ownerValue) => ownerValue && configuredOwners.includes(normalizeIdentifier(ownerValue))
  );
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase();
}
