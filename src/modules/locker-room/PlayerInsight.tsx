import type { TrackedPlayer } from './model'
import { InjuryInsightCallout } from '../../components/player/InjuryInsightCallout'
import { getSleeperPlayerImageUrl } from '../../components/player/playerAssets'
import { PlayerReferenceTile } from '../../components/player/PlayerReferenceTile'
import { SlotBadge } from '../../components/player/SlotBadge'
import {
  buildInjuryInsightLines,
  formatInjurySummary,
  getInjuryRiskToneClass,
} from '../../domain/injuryStatus'
import {
  formatDraftValueScore,
  scoreDraftPlayerValue,
} from '../../domain/playerValueUtils'

export function PlayerInsightPanel({
  baselineValue,
  isWeakSpot,
  onClose,
  player,
  roleLabel,
}: {
  baselineValue: number
  isWeakSpot: boolean
  onClose: () => void
  player: TrackedPlayer
  roleLabel: string
}) {
  const playerValue = scoreDraftPlayerValue(player.player)
  const valueDelta = playerValue - baselineValue
  const valueDeltaLabel = formatDraftValueScore(valueDelta)
  const injuryInsightLines = buildInjuryInsightLines(player.player)
  const injuryToneClass = getInjuryRiskToneClass(player.player)
  const primarySignal = buildPlayerInsightSignal({
    isWeakSpot,
    player,
    valueDelta,
  })

  return (
    <aside className="team-player-insight-panel" aria-live="polite">
      <div>
        <p className="eyebrow">Roster Insight</p>
        <h3>{player.player.fullName}</h3>
      </div>
      <button
        onClick={(event) => {
          event.stopPropagation()
          onClose()
        }}
        type="button"
      >
        Close
      </button>
      <div className="team-player-insight-grid">
        <span>
          Role <strong>{roleLabel}</strong>
        </span>
        <span>
          Position <strong>{player.primaryPosition}</strong>
        </span>
        <span>
          Value <strong>{formatDraftValueScore(playerValue)}</strong>
        </span>
        <span>
          Vs team avg <strong>{valueDeltaLabel}</strong>
        </span>
      </div>
      {injuryInsightLines ? (
        <InjuryInsightCallout
          lines={injuryInsightLines}
          toneClass={injuryToneClass}
        />
      ) : (
        <p className="team-player-primary-signal">{primarySignal}</p>
      )}
      <div className="team-player-insight-notes">
        <span>{player.player.team ?? 'FA'}</span>
        {player.player.byeWeek ? (
          <span>Bye {player.player.byeWeek}</span>
        ) : null}
        {player.isDraftAddition ? <span>Draft addition</span> : null}
        {isWeakSpot ? <span>Weak spot position</span> : null}
      </div>
    </aside>
  )
}

export function PlayerRow({
  baselineValue,
  insightSide = 'right',
  isWeakSpot = false,
  isSelected = false,
  onCloseInsight,
  onSelect,
  player,
  roleLabel,
  slotLabel,
}: {
  baselineValue?: number
  insightSide?: 'left' | 'right'
  isWeakSpot?: boolean
  isSelected?: boolean
  onCloseInsight?: () => void
  onSelect?: (playerId: string) => void
  player: TrackedPlayer
  roleLabel?: string
  slotLabel?: string
}) {
  const valueScore = formatDraftValueScore(scoreDraftPlayerValue(player.player))
  const isInteractive = Boolean(onSelect)
  const injurySummaryLabel = formatInjurySummary(player.player)
  const injuryToneClass = getInjuryRiskToneClass(player.player)

  return (
    <PlayerReferenceTile
      avatarUrl={getSleeperPlayerImageUrl(player.player)}
      className={[
        'team-player-row',
        player.isDraftAddition ? 'draft-addition' : '',
        isInteractive ? 'is-clickable' : '',
        isSelected ? 'is-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      leadingLabel={
        <SlotBadge slotLabel={slotLabel ?? player.primaryPosition} />
      }
      meta={[
        player.player.team ?? 'FA',
        ...(player.player.byeWeek ? [`Bye ${player.player.byeWeek}`] : []),
        ...(injurySummaryLabel
          ? [
              <span className={`player-injury-chip ${injuryToneClass}`}>
                {injurySummaryLabel}
              </span>,
            ]
          : []),
        `Value ${valueScore}`,
        ...(player.isDraftAddition ? ['Draft addition'] : []),
      ]}
      onClick={() => onSelect?.(player.id)}
      onKeyDown={(event) => {
        if (!isInteractive) {
          return
        }

        if (event.target !== event.currentTarget) {
          return
        }

        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onSelect?.(player.id)
        }
      }}
      playerName={player.player.fullName}
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
    >
      {isSelected && baselineValue !== undefined && roleLabel ? (
        <div
          className={
            insightSide === 'left'
              ? 'team-player-insight-popover opens-left'
              : 'team-player-insight-popover'
          }
          onClick={(event) => event.stopPropagation()}
        >
          <PlayerInsightPanel
            baselineValue={baselineValue}
            isWeakSpot={isWeakSpot}
            onClose={onCloseInsight ?? (() => undefined)}
            player={player}
            roleLabel={roleLabel}
          />
        </div>
      ) : null}
    </PlayerReferenceTile>
  )
}

function buildPlayerInsightSignal({
  isWeakSpot,
  player,
  valueDelta,
}: {
  isWeakSpot: boolean
  player: TrackedPlayer
  valueDelta: number
}): string {
  if (isWeakSpot && valueDelta >= 0) {
    return `${player.primaryPosition} is a roster weak spot, and this player is helping lift that position.`
  }

  if (isWeakSpot) {
    return `${player.primaryPosition} is a roster weak spot, but this player is still below your team value baseline.`
  }

  if (valueDelta >= 0) {
    return 'This player is helping lift your roster value baseline.'
  }

  return 'This player is below your roster value baseline.'
}
