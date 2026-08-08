import type {
  TeamTrackerLineupSlot,
  TeamTrackerPlayer,
} from './teamTrackerModel'
import {
  formatDraftValueScore,
  scoreDraftPlayerValue,
} from '../../domain/playerValueUtils'
import type { DraftPick, Player } from '../../domain/types'

export interface TeamValueSnapshot {
  averageValue: number
  benchValue: number
  draftedAdditionsValue: number
  latestPickDelta?: number
  latestPickValue?: number
  starterValue: number
  totalValue: number
}

export function buildTeamValueSnapshot({
  bench,
  draftedAdditions,
  lineupSlots,
  picks,
  players,
}: {
  bench: TeamTrackerPlayer[]
  draftedAdditions: TeamTrackerPlayer[]
  lineupSlots: TeamTrackerLineupSlot[]
  picks: DraftPick[]
  players: Player[]
}): TeamValueSnapshot {
  const starters = lineupSlots.flatMap((slot) =>
    slot.player ? [slot.player] : []
  )
  const rosterPlayers = [...starters, ...bench]
  const totalValue = sumPlayerValues(rosterPlayers)
  const averageValue = rosterPlayers.length
    ? totalValue / rosterPlayers.length
    : 0
  const latestPick = picks.at(-1)
  const latestPickPlayer = latestPick?.playerId
    ? players.find((player) => player.id === latestPick.playerId)
    : undefined
  const latestPickValue = latestPickPlayer
    ? scoreDraftPlayerValue(latestPickPlayer)
    : undefined

  return {
    averageValue,
    benchValue: sumPlayerValues(bench),
    draftedAdditionsValue: sumPlayerValues(draftedAdditions),
    latestPickDelta:
      latestPickValue === undefined
        ? undefined
        : latestPickValue - averageValue,
    latestPickValue,
    starterValue: sumPlayerValues(starters),
    totalValue,
  }
}

export function formatTeamValue(value: number): string {
  return String(Math.round(value))
}

export function formatTeamValueDelta(value: number | undefined): string {
  return value === undefined ? '-' : formatDraftValueScore(value)
}

function sumPlayerValues(players: TeamTrackerPlayer[]): number {
  return players.reduce(
    (total, player) => total + scoreDraftPlayerValue(player.player),
    0
  )
}
