import { formatComponentScore } from './formatting'
import { getPrimaryPosition } from './positionUtils'
import { InjuryInsightCallout } from '../../components/player/InjuryInsightCallout'
import {
  buildInjuryDetailLabels,
  buildInjuryInsightLines,
  getInjuryRiskToneClass,
} from '../../domain/injuryStatus'
import type { DraftRecommendation, Position } from '../../domain/types'

export function RecommendationDetails({
  recommendation,
}: {
  recommendation: DraftRecommendation
}) {
  const positionContext = getPositionScoringContext(
    getPrimaryPosition(recommendation.player.positions)
  )
  const injuryInsightLines = buildInjuryInsightLines(recommendation.player)
  const injuryToneClass = getInjuryRiskToneClass(recommendation.player)
  const injuryDetailNotes = new Set(
    buildInjuryDetailLabels(recommendation.player)
  )
  const nonInjuryNotes = recommendation.notes.filter(
    (note) => !note.startsWith('Injury') && !injuryDetailNotes.has(note)
  )

  return (
    <article className="why-popover">
      <div className="why-popover-header">
        <div>
          <p className="eyebrow">Recommendation Detail</p>
          <h3>{recommendation.player.fullName}</h3>
        </div>
      </div>
      <div className="recommendation-breakdown">
        {recommendation.valueTier ? (
          <span>Tier {recommendation.valueTier}</span>
        ) : null}
        {recommendation.positionRank ? (
          <span>Position rank #{recommendation.positionRank}</span>
        ) : null}
        {recommendation.tierPlayersRemaining ? (
          <span>Tier left {recommendation.tierPlayersRemaining}</span>
        ) : null}
        {recommendation.picksUntilNextPick !== undefined ? (
          <span>Next turn {recommendation.picksUntilNextPick} picks</span>
        ) : null}
        {recommendation.dropOffAfter !== undefined &&
        recommendation.dropOffAfter >= 4 ? (
          <span>
            Next drop-off {formatComponentScore(recommendation.dropOffAfter)}
          </span>
        ) : null}
        <span>Value {formatComponentScore(recommendation.valueScore)}</span>
        <span>Need {formatComponentScore(recommendation.needScore)}</span>
        <span>
          Scarcity {formatComponentScore(recommendation.scarcityScore)}
        </span>
        <span>
          Strategy {formatComponentScore(recommendation.strategyScore)}
        </span>
        <span>Bye risk {formatComponentScore(recommendation.byeRisk)}</span>
        {recommendation.injuryRisk > 0 ? (
          <span className={`injury-breakdown-chip ${injuryToneClass}`}>
            Injury penalty {formatComponentScore(-recommendation.injuryRisk)}
          </span>
        ) : null}
      </div>
      <div className="note-list">
        <span className="recommendation-insight-note">
          {recommendation.suggestion}: {recommendation.insight}
        </span>
        {injuryInsightLines ? (
          <InjuryInsightCallout
            className="recommendation-injury-note"
            lines={injuryInsightLines}
            toneClass={injuryToneClass}
          />
        ) : null}
        {positionContext ? (
          <span className="position-context-note">{positionContext}</span>
        ) : null}
        {nonInjuryNotes.length ? (
          nonInjuryNotes.map((note) => <span key={note}>{note}</span>)
        ) : !injuryInsightLines ? (
          <span>
            Baseline score from value, roster need, positional scarcity, and
            strategy context.
          </span>
        ) : null}
      </div>
    </article>
  )
}

function getPositionScoringContext(
  position: Position | undefined
): string | undefined {
  if (position === 'TE') {
    return 'TE recommendations get extra pressure from positional scarcity and weekly matchup leverage.'
  }

  if (position === 'K') {
    return 'Kicker scores are mostly tie-breaker guidance, so they should usually matter later in the draft.'
  }

  if (position === 'DEF') {
    return 'Defense scores emphasize roster need and availability, with matchup context to be added as the season gets closer.'
  }

  return undefined
}
