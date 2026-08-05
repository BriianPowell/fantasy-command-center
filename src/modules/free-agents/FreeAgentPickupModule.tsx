import type { buildWeeklyRosterSummary } from "../../analysis/weeklyAnalysis";

export function FreeAgentPickupModule({
  summary,
  selectedWeek
}: {
  summary: ReturnType<typeof buildWeeklyRosterSummary> | undefined;
  selectedWeek: number;
}) {
  return (
    <section className="panel module-panel">
      <p className="eyebrow">Module 3</p>
      <h2>Week {selectedWeek} Free Agent Pickup Recommendations</h2>
      {summary ? (
        <div className="recommendation-list">
          {summary.waiverTargets.slice(0, 10).map((recommendation) => (
            <article className="player-card" key={recommendation.player.id}>
              <div>
                <div className="player-title">
                  <strong>{recommendation.player.fullName}</strong>
                  <span>{recommendation.player.positions.join("/")}</span>
                </div>
                <p>
                  {recommendation.player.team ?? "FA"} · Confidence {recommendation.confidence}
                </p>
                <div className="note-list">
                  <span>{recommendation.reason}</span>
                  {recommendation.strategyScore ? <span>Strategy {recommendation.strategyScore}</span> : null}
                </div>
              </div>
            </article>
          ))}
          {!summary.waiverTargets.length ? <p>No pickup recommendations yet. Player metadata may still be loading.</p> : null}
        </div>
      ) : (
        <p>Select a team after loading a league to see free agent recommendations.</p>
      )}
    </section>
  );
}
