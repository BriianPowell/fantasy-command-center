import { ModuleTrimToggle } from "../../components/dashboard/ModuleTrimToggle";
import { getRecentDraftPicks } from "../../domain/draftPickUtils";
import type { NormalizedLeagueData, Roster } from "../../domain/types";
import { LineupSection, RecentTeamPicksSection, RosterSection, TrackerMetric } from "./TeamTrackerSections";
import { buildTeamTrackerViewModel } from "./teamTrackerModel";
import "./teamTracker.css";

export interface TeamTrackerModuleProps {
  data: NormalizedLeagueData;
  isMinimized: boolean;
  onToggleMinimized: () => void;
  roster: Roster | undefined;
  selectedTeamId: string;
}

export function TeamTrackerModule({ data, isMinimized, onToggleMinimized, roster, selectedTeamId }: TeamTrackerModuleProps) {
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId);
  const teamPicks = getRecentDraftPicks(data.draft?.picks ?? [], { limit: 6, rosterId: selectedTeamId });
  const scoringLabel = formatScoringType(data.league.settings.scoringType);
  const rosterSpotCount = countRosterSpots(data.league.settings.rosterSlots);
  const tracker = buildTeamTrackerViewModel({
    draftPicks: data.draft?.picks ?? [],
    leagueSettings: data.league.settings,
    players: data.players,
    roster,
    selectedTeamId
  });

  return (
    <section className={isMinimized ? "panel team-tracker-panel module-is-minimized" : "panel team-tracker-panel"}>
      <ModuleTrimToggle isMinimized={isMinimized} moduleName="Team Tracker" onToggle={onToggleMinimized} />
      <div className="team-tracker-header">
        <div>
          <h2>{selectedTeam?.name ?? "Configured team"}</h2>
          <p>
            {data.league.name} · {data.league.settings.teams} teams · {data.league.season} season
          </p>
        </div>
        <div className="team-tracker-summary">
          <TrackerMetric label="Roster spots" value={String(rosterSpotCount)} />
          <TrackerMetric label="Scoring" value={scoringLabel} />
          <TrackerMetric label="Players" value={String(tracker.totalPlayers)} />
          <TrackerMetric label="Draft adds" value={String(tracker.draftedAdditions.length)} />
        </div>
      </div>

      {!isMinimized ? (
        <div className="team-roster-grid">
          <LineupSection slots={tracker.lineupSlots} title="Starters" />
          <RosterSection emptyText="No bench players mapped yet." players={tracker.bench} title="Bench" />
          <RecentTeamPicksSection picks={teamPicks} players={data.players} />
        </div>
      ) : null}
    </section>
  );
}

function countRosterSpots(rosterSlots: NormalizedLeagueData["league"]["settings"]["rosterSlots"]): number {
  return Object.values(rosterSlots).reduce((total, count) => total + count, 0);
}

function formatScoringType(scoringType: NormalizedLeagueData["league"]["settings"]["scoringType"]): string {
  return scoringType
    .split("_")
    .map((part) => part.toUpperCase())
    .join(" ");
}
