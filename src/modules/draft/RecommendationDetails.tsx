import type { DraftRecommendation, Position } from "../../domain/types";
import { formatComponentScore } from "./draftFormatting";
import { getPrimaryPosition } from "./draftPositionUtils";

export function RecommendationDetails({ recommendation }: { recommendation: DraftRecommendation }) {
  const positionContext = getPositionScoringContext(getPrimaryPosition(recommendation.player.positions));

  return (
    <article className="why-popover">
      <div className="why-popover-header">
        <div>
          <p className="eyebrow">Recommendation Detail</p>
          <h3>{recommendation.player.fullName}</h3>
        </div>
      </div>
      <div className="recommendation-breakdown">
        <span>Value {formatComponentScore(recommendation.valueScore)}</span>
        <span>Need {formatComponentScore(recommendation.needScore)}</span>
        <span>Scarcity {formatComponentScore(recommendation.scarcityScore)}</span>
        <span>Strategy {formatComponentScore(recommendation.strategyScore)}</span>
        <span>Bye risk {formatComponentScore(recommendation.byeRisk)}</span>
      </div>
      <div className="note-list">
        {positionContext ? <span className="position-context-note">{positionContext}</span> : null}
        {recommendation.notes.length ? (
          recommendation.notes.map((note) => <span key={note}>{note}</span>)
        ) : (
          <span>Baseline score from value, roster need, positional scarcity, and strategy context.</span>
        )}
      </div>
    </article>
  );
}

function getPositionScoringContext(position: Position | undefined): string | undefined {
  if (position === "TE") {
    return "TE recommendations get extra pressure from positional scarcity and weekly matchup leverage.";
  }

  if (position === "K") {
    return "Kicker scores are mostly tie-breaker guidance, so they should usually matter later in the draft.";
  }

  if (position === "DEF") {
    return "Defense scores emphasize roster need and availability, with matchup context to be added as the season gets closer.";
  }

  return undefined;
}
