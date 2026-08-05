import { PickList } from "../../components/dashboard/PickList";
import type { DraftRecommendation, NormalizedLeagueData, Position } from "../../domain/types";

export function DraftPickHelperModule({
  data,
  recommendations,
  draftedPlayerIds,
  selectedTeamId,
  onMarkDrafted,
  onClearManualDrafted
}: {
  data: NormalizedLeagueData;
  recommendations: DraftRecommendation[];
  draftedPlayerIds: Set<string>;
  selectedTeamId: string;
  onMarkDrafted: (playerId: string) => void;
  onClearManualDrafted: () => void;
}) {
  const recommendationsByPosition = groupRecommendationsByPosition(recommendations);
  const visiblePositions = getVisiblePositions(recommendationsByPosition);
  const picks = data.draft?.picks ?? [];
  const myPicks = picks.filter((pick) => pick.rosterId === selectedTeamId);

  return (
    <section className="panel module-panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Module 1</p>
          <h2>Draft Pick Helper By Position</h2>
          <p>
            {data.draft?.status ?? "No draft"} · {picks.length} picks made · {myPicks.length} picks for your team
          </p>
        </div>
        <button className="secondary" onClick={onClearManualDrafted}>
          Clear Manual Drafted
        </button>
      </div>
      <div className="draft-module-grid">
        <div className="position-helper-grid">
          {visiblePositions.map((position, index) => {
            const positionRecommendations = recommendationsByPosition.get(position) ?? [];
            const topRecommendation = positionRecommendations[0];

            return (
              <details className="position-card position-dropdown" key={position} defaultOpen={index < 4}>
                <summary className="position-card-header">
                  <div>
                    <h3>{position}</h3>
                    <small>
                      {topRecommendation
                        ? `Top: ${topRecommendation.player.fullName}`
                        : "No recommendations available"}
                    </small>
                  </div>
                  <span className="position-meta">
                    {positionRecommendations.length} options · best {topRecommendation?.score ?? 0}
                  </span>
                </summary>
                <div className="recommendation-list compact">
                  {positionRecommendations.slice(0, 6).map((recommendation) => (
                    <CompactDraftRecommendationCard
                      key={`${data.league.id}-${position}-${recommendation.player.id}`}
                      recommendation={recommendation}
                      isDrafted={draftedPlayerIds.has(recommendation.player.id)}
                      onMarkDrafted={onMarkDrafted}
                    />
                  ))}
                </div>
              </details>
            );
          })}
        </div>
        <div className="draft-pick-sidebar">
          <PickList title="Your Picks" picks={myPicks.slice(-6).reverse()} />
          <PickList title="Latest Picks" picks={picks.slice(-6).reverse()} />
        </div>
      </div>
    </section>
  );
}

function CompactDraftRecommendationCard({
  recommendation,
  isDrafted,
  onMarkDrafted
}: {
  recommendation: DraftRecommendation;
  isDrafted: boolean;
  onMarkDrafted: (playerId: string) => void;
}) {
  const { player } = recommendation;

  return (
    <article className="compact-player-card">
      <div className="compact-player-main">
        <div>
          <div className="player-title">
            <strong>{player.fullName}</strong>
            <span>{player.positions.join("/")}</span>
          </div>
          <p>
            {player.team ?? "FA"} · Bye {player.byeWeek ?? "?"}
          </p>
        </div>
        <strong className="compact-score">{recommendation.score}</strong>
      </div>

      <div className="compact-player-actions">
        <details className="recommendation-details">
          <summary>Why this pick</summary>
          <div className="recommendation-breakdown">
            <span>Value {formatComponentScore(recommendation.valueScore)}</span>
            <span>Need {formatComponentScore(recommendation.needScore)}</span>
            <span>Scarcity {formatComponentScore(recommendation.scarcityScore)}</span>
            <span>Strategy {formatComponentScore(recommendation.strategyScore)}</span>
            <span>Bye risk {formatComponentScore(recommendation.byeRisk)}</span>
          </div>
          <div className="note-list">
            {recommendation.notes.slice(0, 3).map((note) => (
              <span key={note}>{note}</span>
            ))}
          </div>
        </details>
        <button onClick={() => onMarkDrafted(player.id)} disabled={isDrafted}>
          {isDrafted ? "Drafted" : "Draft"}
        </button>
      </div>
    </article>
  );
}

function formatComponentScore(score: number): string {
  return score > 0 ? `+${score}` : String(score);
}

function groupRecommendationsByPosition(recommendations: DraftRecommendation[]): Map<Position, DraftRecommendation[]> {
  const grouped = new Map<Position, DraftRecommendation[]>();

  for (const recommendation of recommendations) {
    const position = recommendation.player.positions[0];
    grouped.set(position, [...(grouped.get(position) ?? []), recommendation]);
  }

  return grouped;
}

function getVisiblePositions(groupedRecommendations: Map<Position, DraftRecommendation[]>): Position[] {
  const preferredOrder: Position[] = ["QB", "RB", "WR", "TE", "K", "DEF", "DB", "DL", "LB", "IDP"];
  const remainingPositions = Array.from(groupedRecommendations.keys()).filter((position) => !preferredOrder.includes(position));

  return [...preferredOrder, ...remainingPositions].filter((position) => (groupedRecommendations.get(position)?.length ?? 0) > 0);
}
