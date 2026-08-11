import type { LineupSlot, TrackedPlayer } from './model'
import { PlayerRow } from './PlayerInsight'
import {
  isPositionWeakSpot,
  type PositionValueGap,
  type TeamPickValueImpact,
} from './valueModel'
import { DraftPickReferenceTile } from '../../components/player/DraftPickReferenceTile'
import { PlayerReferenceTile } from '../../components/player/PlayerReferenceTile'
import { SlotBadge } from '../../components/player/SlotBadge'
import { formatDraftValueScore } from '../../domain/playerValueUtils'
import type { DraftPick, Player } from '../../domain/types'

export function SummaryMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <span className="locker-room-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  )
}

export function LineupSection({
  baselineValue,
  onClosePlayerInsight,
  onPlayerSelect,
  selectedPlayerId,
  slots,
  title,
  weakPositions,
}: {
  baselineValue: number
  onClosePlayerInsight?: () => void
  onPlayerSelect?: (playerId: string) => void
  selectedPlayerId?: string
  slots: LineupSlot[]
  title: string
  weakPositions: Set<TrackedPlayer['primaryPosition']>
}) {
  const filledSlots = slots.filter((slot) => slot.player).length

  return (
    <section className="team-roster-section">
      <header>
        <h3>{title}</h3>
        <span>
          {filledSlots}/{slots.length}
        </span>
      </header>
      <div className="team-player-list team-lineup-list">
        {slots.map((slot) =>
          slot.player ? (
            <div className="team-lineup-slot filled" key={slot.id}>
              <PlayerRow
                isSelected={selectedPlayerId === slot.player.id}
                baselineValue={baselineValue}
                isWeakSpot={weakPositions.has(slot.player.primaryPosition)}
                onCloseInsight={onClosePlayerInsight}
                onSelect={onPlayerSelect}
                player={slot.player}
                roleLabel={`Starter ${slot.slot}`}
                slotLabel={slot.slot}
              />
            </div>
          ) : (
            <div className="team-lineup-slot empty" key={slot.id}>
              <EmptyLineupSlot slotLabel={slot.slot} />
            </div>
          )
        )}
      </div>
    </section>
  )
}

export function RosterSection({
  baselineValue,
  emptyText,
  insightSide = 'right',
  onClosePlayerInsight,
  onPlayerSelect,
  players,
  roleLabel = 'Bench',
  selectedPlayerId,
  title,
  weakPositions,
}: {
  baselineValue: number
  emptyText: string
  insightSide?: 'left' | 'right'
  onClosePlayerInsight?: () => void
  onPlayerSelect?: (playerId: string) => void
  players: TrackedPlayer[]
  roleLabel?: string
  selectedPlayerId?: string
  title: string
  weakPositions: Set<TrackedPlayer['primaryPosition']>
}) {
  return (
    <section className="team-roster-section">
      <header>
        <h3>{title}</h3>
        <span>{players.length}</span>
      </header>
      <div className="team-player-list">
        {players.length ? (
          players.map((player) => (
            <PlayerRow
              baselineValue={baselineValue}
              insightSide={insightSide}
              isWeakSpot={weakPositions.has(player.primaryPosition)}
              isSelected={selectedPlayerId === player.id}
              key={player.id}
              onCloseInsight={onClosePlayerInsight}
              onSelect={onPlayerSelect}
              player={player}
              roleLabel={player.isDraftAddition ? 'Draft addition' : roleLabel}
            />
          ))
        ) : (
          <p>{emptyText}</p>
        )}
      </div>
    </section>
  )
}

export function PositionNeedsSummary({ gaps }: { gaps: PositionValueGap[] }) {
  const weakSpots = gaps.filter(isPositionWeakSpot)

  return (
    <div className="team-needs-summary" aria-label="Position weak spots">
      <span className="team-needs-label">Weak spots</span>
      <span
        aria-label="Weak spot gap help"
        className="team-needs-help"
        data-tooltip="Gap compares a position's average player value against your roster average. Negative means that position trails your roster baseline; positive means it is ahead."
        tabIndex={0}
      >
        ?
      </span>
      {weakSpots.length ? (
        weakSpots.map((gap) => (
          <span
            className="position-need-chip"
            data-tooltip={formatPositionGapTooltip(gap)}
            key={gap.position}
            tabIndex={0}
          >
            <strong>{gap.position}</strong>
            <span>
              {gap.filledStarters}/{gap.requiredStarters}
            </span>
            <span>Gap {formatDraftValueScore(gap.valueDelta)}</span>
          </span>
        ))
      ) : (
        <span className="team-needs-empty">No clear gaps</span>
      )}
    </div>
  )
}

function formatPositionGapTooltip(gap: PositionValueGap): string {
  const rosterAverage = gap.averageValue - gap.valueDelta
  const starterFill =
    gap.filledStarters < gap.requiredStarters
      ? ` Starter fill is ${gap.filledStarters}/${gap.requiredStarters}.`
      : ''

  return `${gap.position} average value is ${Math.round(gap.averageValue)} versus a roster average of ${Math.round(rosterAverage)}. Gap ${formatDraftValueScore(gap.valueDelta)} means this position is ${gap.valueDelta < 0 ? 'behind' : 'ahead of'} your roster baseline.${starterFill}`
}

export function RecentTeamPicksSection({
  pickValueImpacts,
  picks,
  players,
}: {
  pickValueImpacts?: Map<number, TeamPickValueImpact>
  picks: DraftPick[]
  players: Player[]
}) {
  const playersById = new Map(players.map((player) => [player.id, player]))

  return (
    <section className="team-roster-section">
      <header>
        <h3>Team Picks</h3>
        <span>{picks.length}</span>
      </header>
      <div className="team-pick-list">
        {picks.length ? (
          picks.map((pick) => (
            <DraftPickReferenceTile
              cumulativeValue={
                pickValueImpacts?.get(pick.pickNo)?.cumulativeDraftValue
              }
              impactValue={pickValueImpacts?.get(pick.pickNo)?.valueDelta}
              improvesWeakArea={
                pickValueImpacts?.get(pick.pickNo)?.improvesWeakArea
              }
              key={pick.pickNo}
              pick={pick}
              player={
                pick.playerId ? playersById.get(pick.playerId) : undefined
              }
              tone="roster"
            />
          ))
        ) : (
          <p>No team picks yet.</p>
        )}
      </div>
    </section>
  )
}

function EmptyLineupSlot({ slotLabel }: { slotLabel: string }) {
  return (
    <PlayerReferenceTile
      className="team-player-row empty-slot"
      leadingLabel={<SlotBadge slotLabel={slotLabel} />}
      meta={[]}
      playerName={<span className="empty-slot-placeholder" />}
    />
  )
}
