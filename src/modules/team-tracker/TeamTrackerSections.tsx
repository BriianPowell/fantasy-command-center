import type {
  TeamTrackerLineupSlot,
  TeamTrackerPlayer,
} from './teamTrackerModel'
import { DraftPickReferenceTile } from '../../components/player/DraftPickReferenceTile'
import { getSleeperPlayerImageUrl } from '../../components/player/playerAssets'
import { PlayerReferenceTile } from '../../components/player/PlayerReferenceTile'
import { SlotBadge } from '../../components/player/SlotBadge'
import {
  formatDraftValueScore,
  scoreDraftPlayerValue,
} from '../../domain/playerValueUtils'
import type { DraftPick, Player } from '../../domain/types'

export function TrackerMetric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <span className="team-tracker-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  )
}

export function LineupSection({
  slots,
  title,
}: {
  slots: TeamTrackerLineupSlot[]
  title: string
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
              <TeamPlayerRow player={slot.player} slotLabel={slot.slot} />
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
  emptyText,
  players,
  title,
}: {
  emptyText: string
  players: TeamTrackerPlayer[]
  title: string
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
            <TeamPlayerRow key={player.id} player={player} />
          ))
        ) : (
          <p>{emptyText}</p>
        )}
      </div>
    </section>
  )
}

export function RecentTeamPicksSection({
  picks,
  players,
}: {
  picks: DraftPick[]
  players: Player[]
}) {
  const playersById = new Map(players.map((player) => [player.id, player]))

  return (
    <section className="team-roster-section">
      <header>
        <h3>Recent Team Picks</h3>
        <span>{picks.length}</span>
      </header>
      <div className="team-pick-list">
        {picks.length ? (
          picks.map((pick) => (
            <DraftPickReferenceTile
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

function TeamPlayerRow({
  player,
  slotLabel,
}: {
  player: TeamTrackerPlayer
  slotLabel?: string
}) {
  const valueScore = formatDraftValueScore(scoreDraftPlayerValue(player.player))

  return (
    <PlayerReferenceTile
      avatarUrl={getSleeperPlayerImageUrl(player.player)}
      className={
        player.isDraftAddition
          ? 'team-player-row draft-addition'
          : 'team-player-row'
      }
      leadingLabel={
        <SlotBadge slotLabel={slotLabel ?? player.primaryPosition} />
      }
      meta={[
        player.player.team ?? 'FA',
        `Bye ${player.player.byeWeek ?? 'TBD'}`,
        `Value ${valueScore}`,
        ...(player.isDraftAddition ? ['Draft addition'] : []),
      ]}
      playerName={player.player.fullName}
    />
  )
}
