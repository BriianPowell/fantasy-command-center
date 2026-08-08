import type {
  TeamTrackerLineupSlot,
  TeamTrackerPlayer,
} from './teamTrackerModel'
import {
  formatDraftValueScore,
  scoreDraftPlayerValue,
} from '../../domain/playerValueUtils'
import { getPrimaryPosition } from '../../domain/positionUtils'
import type { DraftPick, Player, Position } from '../../domain/types'

export interface TeamValueSnapshot {
  averageValue: number
  benchValue: number
  draftedAdditionsValue: number
  latestPickDelta?: number
  latestPickValue?: number
  starterBenchDelta: number
  starterValue: number
  totalValue: number
}

export interface TeamPickValueImpact {
  cumulativeDraftValue: number
  improvesWeakArea: boolean
  pickNo: number
  valueDelta: number
}

export interface PositionValueGap {
  averageValue: number
  filledStarters: number
  playerCount: number
  position: Position
  requiredStarters: number
  valueDelta: number
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
  const starterValue = sumPlayerValues(starters)
  const benchValue = sumPlayerValues(bench)
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
    benchValue,
    draftedAdditionsValue: sumPlayerValues(draftedAdditions),
    latestPickDelta:
      latestPickValue === undefined
        ? undefined
        : latestPickValue - averageValue,
    latestPickValue,
    starterBenchDelta: starterValue - benchValue,
    starterValue,
    totalValue,
  }
}

export function formatTeamValue(value: number): string {
  return String(Math.round(value))
}

export function formatTeamValueDelta(value: number | undefined): string {
  return value === undefined ? '-' : formatDraftValueScore(value)
}

export function buildTeamPickValueImpacts({
  baselineValue,
  picks,
  players,
  weakPositions = new Set(),
}: {
  baselineValue: number
  picks: DraftPick[]
  players: Player[]
  weakPositions?: Set<Position>
}): Map<number, TeamPickValueImpact> {
  const playersById = new Map(players.map((player) => [player.id, player]))
  let cumulativeDraftValue = 0

  return new Map(
    [...picks]
      .sort((a, b) => a.pickNo - b.pickNo)
      .flatMap((pick) => {
        const player = pick.playerId
          ? playersById.get(pick.playerId)
          : undefined

        if (!player) {
          return []
        }
        const playerValue = scoreDraftPlayerValue(player)
        const primaryPosition = getPrimaryPosition(player.positions)
        cumulativeDraftValue += playerValue

        return [
          [
            pick.pickNo,
            {
              cumulativeDraftValue,
              improvesWeakArea: primaryPosition
                ? weakPositions.has(primaryPosition)
                : false,
              pickNo: pick.pickNo,
              valueDelta: playerValue - baselineValue,
            },
          ],
        ]
      })
  )
}

export function buildPositionValueGaps({
  bench,
  lineupSlots,
}: {
  bench: TeamTrackerPlayer[]
  lineupSlots: TeamTrackerLineupSlot[]
}): PositionValueGap[] {
  const starters = lineupSlots.flatMap((slot) =>
    slot.player ? [slot.player] : []
  )
  const rosterPlayers = [...starters, ...bench]
  const rosterAverage = rosterPlayers.length
    ? sumPlayerValues(rosterPlayers) / rosterPlayers.length
    : 0
  const positions = getRequiredStarterPositions(lineupSlots)

  return positions.map((position) => {
    const positionPlayers = rosterPlayers.filter(
      (player) => player.primaryPosition === position
    )
    const totalValue = sumPlayerValues(positionPlayers)
    const averageValue = positionPlayers.length
      ? totalValue / positionPlayers.length
      : 0
    const requiredStarters = lineupSlots.filter(
      (slot) => slot.slot === position
    ).length
    const filledStarters = lineupSlots.filter(
      (slot) => slot.slot === position && slot.player
    ).length

    return {
      averageValue,
      filledStarters,
      playerCount: positionPlayers.length,
      position,
      requiredStarters,
      valueDelta: averageValue - rosterAverage,
    }
  })
}

function sumPlayerValues(players: TeamTrackerPlayer[]): number {
  return players.reduce(
    (total, player) => total + scoreDraftPlayerValue(player.player),
    0
  )
}

function getRequiredStarterPositions(
  lineupSlots: TeamTrackerLineupSlot[]
): Position[] {
  return Array.from(
    new Set(
      lineupSlots.flatMap((slot) =>
        slot.slot === 'FLEX' || slot.slot === 'SUPER_FLEX' ? [] : [slot.slot]
      )
    )
  )
}
