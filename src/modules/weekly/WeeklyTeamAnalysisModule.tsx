import type { buildWeeklyRosterSummary } from "../../analysis/weeklyAnalysis";
import { Metric } from "../../components/dashboard/Metric";
import { RecommendationBlock } from "../../components/dashboard/RecommendationBlock";
import type { Roster } from "../../domain/types";

export function WeeklyTeamAnalysisModule({
  selectedRoster,
  summary,
  selectedWeek
}: {
  selectedRoster: Roster | undefined;
  summary: ReturnType<typeof buildWeeklyRosterSummary> | undefined;
  selectedWeek: number;
}) {
  return (
    <section className="panel module-panel">
      <p className="eyebrow">Module 2</p>
      <h2>Week {selectedWeek} Player Analysis On My Team</h2>
      {selectedRoster && summary ? (
        <div className="weekly-grid">
          <Metric label="Rostered" value={String(selectedRoster.playerIds.length)} />
          <Metric label="Starter Projection" value={summary.projectedStarterPoints.toFixed(1)} />
          <RecommendationBlock title="Current Weak Spots" items={summary.weakSpots} />
          <RecommendationBlock
            title="Best Bench Options"
            items={summary.benchOptions.slice(0, 5).map((recommendation) => `${recommendation.player.fullName}: ${recommendation.reason}`)}
          />
          <RecommendationBlock
            title="Starter Notes"
            items={summary.starters.slice(0, 5).map((recommendation) => `${recommendation.player.fullName}: ${recommendation.reason}`)}
          />
        </div>
      ) : (
        <p>Select a team after loading a league to see weekly analysis.</p>
      )}
    </section>
  );
}
