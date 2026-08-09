import { getPositionClass, getPrimaryPosition } from './draftPositionUtils'
import { getSleeperPlayerImageUrl } from '../../components/player/playerAssets'
import { PlayerReferenceTile } from '../../components/player/PlayerReferenceTile'
import type { DraftRecommendation } from '../../domain/types'

export function BestAvailableStrip({
  recommendations,
}: {
  recommendations: DraftRecommendation[]
}) {
  if (!recommendations.length) {
    return null
  }

  return (
    <section
      className="best-available-strip"
      aria-label="Best available players"
    >
      <div>
        <p className="eyebrow">Best Available</p>
        <strong>Top overall targets</strong>
      </div>
      <div className="best-available-list">
        {recommendations.map((recommendation, index) => {
          const primaryPosition = getPrimaryPosition(
            recommendation.player.positions
          )

          return (
            <PlayerReferenceTile
              avatarUrl={getSleeperPlayerImageUrl(recommendation.player)}
              className={`best-available-pill ${primaryPosition ? getPositionClass(primaryPosition) : ''}`}
              key={recommendation.player.id}
              leadingLabel={index + 1}
              meta={[
                primaryPosition ?? 'Any',
                ...(recommendation.valueTier
                  ? [`Tier ${recommendation.valueTier}`]
                  : []),
                recommendation.suggestion,
              ]}
              playerName={recommendation.player.fullName}
              trailingLabel={recommendation.score}
              variant="compact"
            />
          )
        })}
      </div>
    </section>
  )
}
