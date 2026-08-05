import { useEffect, useMemo, useRef, useState } from "react";
import { buildDraftRecommendations } from "./analysis/draftRecommendations";
import { buildWeeklyRosterSummary } from "./analysis/weeklyAnalysis";
import { fantasyConfig } from "./config/fantasyConfig";
import { personalStrategy, teamOpportunityProfiles } from "./config/personalStrategy";
import { defaultPlayerNotes, defaultProjections, defaultRankings } from "./data/defaultInputs";
import { Metric } from "./components/dashboard/Metric";
import type { NormalizedLeagueData, Roster } from "./domain/types";
import { DraftPickHelperModule } from "./modules/draft/DraftPickHelperModule";
import { FreeAgentPickupModule } from "./modules/free-agents/FreeAgentPickupModule";
import { WeeklyTeamAnalysisModule } from "./modules/weekly/WeeklyTeamAnalysisModule";
import { SleeperProvider } from "./providers/sleeper/SleeperProvider";
import { loadJson, saveJson } from "./storage/localStorage";
import { buildStrategyContext } from "./strategy/teamOpportunity";
import { getCurrentNflWeek } from "./utils/nflWeek";

const sleeperProvider = new SleeperProvider();
const configuredLeagueIds = [...fantasyConfig.sleeperLeagueIds];

export function App() {
  const selectedWeek = getCurrentNflWeek();
  const [selectedTeamByLeague, setSelectedTeamByLeague] = useState<Record<string, string>>(() =>
    loadJson("fft:selected-teams", {})
  );
  const [manualDraftedByLeague, setManualDraftedByLeague] = useState<Record<string, string[]>>(() =>
    loadJson("fft:manual-drafted-by-league", {})
  );
  const [leagues, setLeagues] = useState<NormalizedLeagueData[]>([]);
  const [activeDashboardId, setActiveDashboardId] = useState(() => loadJson("fft:active-dashboard-id", ""));
  const [status, setStatus] = useState("Loading configured Sleeper leagues...");
  const [errors, setErrors] = useState<string[]>([]);
  const hasAutoLoaded = useRef(false);

  useEffect(() => {
    saveJson("fft:selected-teams", selectedTeamByLeague);
    saveJson("fft:manual-drafted-by-league", manualDraftedByLeague);
    saveJson("fft:active-dashboard-id", activeDashboardId);
  }, [activeDashboardId, manualDraftedByLeague, selectedTeamByLeague]);

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
    setSelectedTeamByLeague((current) => {
      const configuredTeamSelections = Object.fromEntries(
        loadedLeagues.map((league) => [league.league.id, findConfiguredTeam(league)?.id ?? league.teams[0]?.id ?? ""])
      );

      return {
        ...current,
        ...configuredTeamSelections
      };
    });
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
      const loadedLeagueIds = new Set(loadedLeagues.map((league) => league.league.id));

      setLeagues((current) =>
        current.map((league) => (loadedLeagueIds.has(league.league.id) ? { ...league, players } : league))
      );
      setStatus(
        `Loaded ${loadedLeagues.length} dashboard${loadedLeagues.length === 1 ? "" : "s"} with ${players.length.toLocaleString()} players.`
      );
    } catch (caughtError) {
      setErrors((current) => [...current, `Player pool: ${readError(caughtError)}`]);
      setStatus(`Loaded ${loadedLeagues.length} dashboard${loadedLeagues.length === 1 ? "" : "s"} without player metadata.`);
    }
  }

  function selectTeam(leagueId: string, teamId: string) {
    setSelectedTeamByLeague((current) => ({
      ...current,
      [leagueId]: teamId
    }));
  }

  function markDrafted(leagueId: string, playerId: string) {
    setManualDraftedByLeague((current) => ({
      ...current,
      [leagueId]: Array.from(new Set([...(current[leagueId] ?? []), playerId]))
    }));
  }

  function clearManualDrafted(leagueId: string) {
    setManualDraftedByLeague((current) => ({
      ...current,
      [leagueId]: []
    }));
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
          selectedTeamId={resolveSelectedTeamId(activeLeague, selectedTeamByLeague[activeLeague.league.id])}
          selectedWeek={selectedWeek}
          manualDraftedIds={new Set(manualDraftedByLeague[activeLeague.league.id] ?? [])}
          onSelectTeam={(teamId) => selectTeam(activeLeague.league.id, teamId)}
          onMarkDrafted={(playerId) => markDrafted(activeLeague.league.id, playerId)}
          onClearManualDrafted={() => clearManualDrafted(activeLeague.league.id)}
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
      <div className="brand-block">
        <p className="eyebrow">Fantasy Football Tooling</p>
        <h1>Fantasy Football</h1>
        <p>{status}</p>
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

function LeagueDashboard({
  data,
  selectedTeamId,
  selectedWeek,
  manualDraftedIds,
  onSelectTeam,
  onMarkDrafted,
  onClearManualDrafted
}: {
  data: NormalizedLeagueData;
  selectedTeamId: string;
  selectedWeek: number;
  manualDraftedIds: Set<string>;
  onSelectTeam: (teamId: string) => void;
  onMarkDrafted: (playerId: string) => void;
  onClearManualDrafted: () => void;
}) {
  const selectedRoster = useMemo(() => {
    return buildDraftAwareRoster(data.rosters.find((roster) => roster.teamId === selectedTeamId), data, selectedTeamId);
  }, [data, selectedTeamId]);

  const draftedPlayerIds = useMemo(() => {
    const draftedFromSleeper = data.draft?.picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : [])) ?? [];

    return new Set([...draftedFromSleeper, ...manualDraftedIds]);
  }, [data.draft?.picks, manualDraftedIds]);

  const unavailablePlayerIds = useMemo(() => {
    return new Set(data.rosters.flatMap((roster) => roster.playerIds));
  }, [data.rosters]);

  const strategyContext = useMemo(() => {
    return buildStrategyContext({
      players: data.players,
      strategy: personalStrategy,
      teamProfiles: teamOpportunityProfiles
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

  const weeklySummary = useMemo(() => {
    if (!selectedRoster) {
      return undefined;
    }

    return buildWeeklyRosterSummary({
      roster: selectedRoster,
      players: data.players,
      projections: defaultProjections,
      week: selectedWeek,
      unavailablePlayerIds,
      strategyContext
    });
  }, [data.players, selectedRoster, selectedWeek, unavailablePlayerIds, strategyContext]);

  return (
    <article className="league-dashboard">
      <LeagueSummary data={data} selectedTeamId={selectedTeamId} onSelectTeam={onSelectTeam} selectedWeek={selectedWeek} />
      <DraftPickHelperModule
        data={data}
        recommendations={recommendations}
        draftedPlayerIds={draftedPlayerIds}
        selectedTeamId={selectedTeamId}
        onMarkDrafted={onMarkDrafted}
        onClearManualDrafted={onClearManualDrafted}
      />
      <WeeklyTeamAnalysisModule selectedRoster={selectedRoster} summary={weeklySummary} selectedWeek={selectedWeek} />
      <FreeAgentPickupModule summary={weeklySummary} selectedWeek={selectedWeek} />
    </article>
  );
}

function LeagueSummary({
  data,
  selectedTeamId,
  selectedWeek,
  onSelectTeam
}: {
  data: NormalizedLeagueData;
  selectedTeamId: string;
  selectedWeek: number;
  onSelectTeam: (teamId: string) => void;
}) {
  const configuredTeams = data.teams.filter(isConfiguredOwner);
  const teamOptions = configuredTeams.length ? configuredTeams : data.teams;

  return (
    <section className="panel grid-panel league-summary">
      <div>
        <p className="eyebrow">League Dashboard</p>
        <h2>{data.league.name}</h2>
        <p>
          {data.league.settings.teams} teams · {data.league.settings.scoringType.replace("_", " ")} · week {selectedWeek}
        </p>
      </div>
      <label>
        {configuredTeams.length ? "Your configured team" : "Fallback team"}
        <select value={selectedTeamId} onChange={(event) => onSelectTeam(event.target.value)}>
          {teamOptions.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name} ({team.ownerUsername ?? team.ownerName})
            </option>
          ))}
        </select>
      </label>
      <Metric label="Drafted" value={String(data.draft?.picks.length ?? 0)} />
      <Metric label="Free Agents" value={estimateFreeAgents(data).toLocaleString()} />
    </section>
  );
}

function EmptyState() {
  return (
    <section className="panel empty-state">
      <h2>Ready for your leagues</h2>
      <p>
        Your configured Sleeper leagues and usernames load automatically. Once loaded, choose a dashboard from the top bar to
        use the draft helper, weekly team analysis, and free agent pickup modules.
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

function estimateFreeAgents(data: NormalizedLeagueData): number {
  const rosteredPlayerIds = new Set(data.rosters.flatMap((roster) => roster.playerIds));

  return data.players.filter((player) => !rosteredPlayerIds.has(player.id)).length;
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function findConfiguredTeam(data: NormalizedLeagueData) {
  return data.teams.find(isConfiguredOwner);
}

function resolveSelectedTeamId(data: NormalizedLeagueData, storedTeamId: string | undefined): string {
  const configuredTeams = data.teams.filter(isConfiguredOwner);

  if (storedTeamId && configuredTeams.some((team) => team.id === storedTeamId)) {
    return storedTeamId;
  }

  return configuredTeams[0]?.id ?? storedTeamId ?? data.teams[0]?.id ?? "";
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
