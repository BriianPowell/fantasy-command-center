import { DraftPlayerTile } from './DraftPlayerTile'
import { getPositionClass } from './draftPositionUtils'
import type { DraftRecommendation, Position } from '../../domain/types'

interface DraftPositionColumnProps {
  hoverCooldownRef: { current: number }
  onScrollCooldown: () => void
  position: Position
  recommendations: DraftRecommendation[]
}

export function DraftPositionColumn({
  hoverCooldownRef,
  onScrollCooldown,
  position,
  recommendations,
}: DraftPositionColumnProps) {
  const topRecommendation = recommendations[0]

  return (
    <section
      className={`draft-position-column ${getPositionClass(position)}`}
      onScroll={onScrollCooldown}
    >
      <header className="draft-position-header">
        <div>
          <h3>{position}</h3>
          <small>{recommendations.length} ranked players</small>
        </div>
        <span className="draft-position-top-score">
          <span>Top</span>
          <strong>{topRecommendation?.score ?? '-'}</strong>
        </span>
      </header>
      <div className="draft-player-stack">
        {recommendations.map((recommendation, index) => (
          <DraftPlayerTile
            hoverCooldownRef={hoverCooldownRef}
            key={`${position}-${recommendation.player.id}`}
            onScrollCooldown={onScrollCooldown}
            rank={index + 1}
            recommendation={recommendation}
          />
        ))}
      </div>
    </section>
  )
}
