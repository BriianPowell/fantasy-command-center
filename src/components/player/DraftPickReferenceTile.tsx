import { getSleeperPlayerImageUrl } from './playerAssets'
import { PlayerReferenceTile } from './PlayerReferenceTile'
import { SlotBadge } from './SlotBadge'
import {
  formatDraftValueScore,
  scoreDraftPlayerValue,
} from '../../domain/playerValueUtils'
import {
  getPositionClass,
  getPrimaryPosition,
} from '../../domain/positionUtils'
import type { DraftPick, Player } from '../../domain/types'

export type DraftPickReferenceTileTone = 'pick' | 'roster'

export function DraftPickReferenceTile({
  cumulativeValue,
  density = 'default',
  impactValue,
  improvesWeakArea,
  pick,
  player,
  tone = 'pick',
}: {
  cumulativeValue?: number
  density?: 'default' | 'compact'
  impactValue?: number
  improvesWeakArea?: boolean
  pick: DraftPick
  player?: Player
  tone?: DraftPickReferenceTileTone
}) {
  const position =
    getPrimaryPosition(player?.positions ?? []) ?? pick.metadata?.position
  const valueScore = player
    ? formatDraftValueScore(scoreDraftPlayerValue(player))
    : undefined
  const classes = [
    'draft-pick-reference-tile',
    tone === 'roster'
      ? `${density === 'default' ? 'team-player-row ' : ''}roster-style`
      : '',
    density === 'compact' ? 'compact-pick' : '',
    position ? getPositionClass(position) : '',
  ]
    .filter(Boolean)
    .join(' ')
  const meta = [
    player?.team ?? pick.metadata?.team ?? 'Draft pick',
    ...(player?.byeWeek ? [`Bye ${player.byeWeek}`] : []),
    ...(valueScore ? [`Value ${valueScore}`] : []),
    ...(impactValue === undefined
      ? []
      : [`Impact ${formatDraftValueScore(impactValue)}`]),
    ...(cumulativeValue === undefined
      ? []
      : [`Draft total ${formatDraftValueScore(cumulativeValue)}`]),
    ...(improvesWeakArea ? ['Weak spot'] : []),
  ]

  return (
    <PlayerReferenceTile
      avatarUrl={
        pick.playerId ? getSleeperPlayerImageUrl(pick.playerId) : undefined
      }
      className={classes}
      leadingLabel={position ? <SlotBadge slotLabel={position} /> : pick.pickNo}
      meta={meta}
      playerName={formatPickName(pick, player)}
      trailingLabel={`#${pick.pickNo}`}
      variant={density === 'compact' ? 'compact' : 'default'}
    />
  )
}

function formatPickName(pick: DraftPick, player: Player | undefined): string {
  return (
    [pick.metadata?.firstName, pick.metadata?.lastName]
      .filter(Boolean)
      .join(' ') ||
    player?.fullName ||
    pick.playerId ||
    'Unknown player'
  )
}
