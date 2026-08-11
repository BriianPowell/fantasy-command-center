import { getDraftedPlayerIdsForRoster } from '../../domain/draftPickUtils'
import {
  canFillFlexPosition,
  canFillSuperFlexPosition,
  getPrimaryPosition,
} from '../../domain/positionUtils'
import type {
  DraftPick,
  LeagueSettings,
  Player,
  Position,
  Roster,
} from '../../domain/types'

const LINEUP_SLOT_ORDER: LineupSlotType[] = [
  'QB',
  'RB',
  'WR',
  'TE',
  'FLEX',
  'SUPER_FLEX',
  'K',
  'DEF',
]

const BENCH_POSITION_ORDER: Position[] = [
  'QB',
  'RB',
  'WR',
  'TE',
  'K',
  'DEF',
  'DB',
  'DL',
  'LB',
  'IDP',
]

export type LineupSlotType = Position | 'FLEX' | 'SUPER_FLEX'

export interface TrackedPlayer {
  id: string
  isDraftAddition: boolean
  player: Player
  primaryPosition: Position
}

export interface LineupSlot {
  id: string
  player?: TrackedPlayer
  slot: LineupSlotType
}

export interface ViewModel {
  bench: TrackedPlayer[]
  draftedAdditions: TrackedPlayer[]
  lineupSlots: LineupSlot[]
  reserve: TrackedPlayer[]
  taxi: TrackedPlayer[]
  totalPlayers: number
}

export function buildViewModel({
  draftPicks,
  leagueSettings,
  players,
  roster,
  selectedTeamId,
}: {
  draftPicks: DraftPick[]
  leagueSettings: LeagueSettings
  players: Player[]
  roster: Roster | undefined
  selectedTeamId: string
}): ViewModel {
  const playersById = new Map(players.map((player) => [player.id, player]))
  const rosterPlayerIds = roster?.playerIds ?? []
  const reservePlayerIds = roster?.reservePlayerIds ?? []
  const reservePlayerIdSet = new Set(reservePlayerIds)
  const taxiPlayerIds = roster?.taxiPlayerIds ?? []
  const taxiPlayerIdSet = new Set(taxiPlayerIds)
  const draftAdditionIds = getDraftedPlayerIdsForRoster(
    draftPicks,
    selectedTeamId
  )
  const draftAdditionIdSet = new Set(draftAdditionIds)
  const trackedPlayerIds = Array.from(
    new Set([
      ...rosterPlayerIds,
      ...reservePlayerIds,
      ...taxiPlayerIds,
      ...draftAdditionIds,
    ])
  )

  const trackedPlayers = trackedPlayerIds.flatMap<TrackedPlayer>((playerId) => {
    const player = playersById.get(playerId)
    const primaryPosition = player
      ? getPrimaryPosition(player.positions)
      : undefined

    if (!player || !primaryPosition) {
      return []
    }

    return [
      {
        id: player.id,
        isDraftAddition:
          draftAdditionIdSet.has(player.id) &&
          !rosterPlayerIds.includes(player.id),
        player,
        primaryPosition,
      },
    ]
  })

  const lineupSlots = assignLineupSlots(
    buildLineupSlots(leagueSettings),
    roster?.starters ?? [],
    trackedPlayers
  )
  const assignedStarterIds = new Set(
    lineupSlots.flatMap((slot) => (slot.player ? [slot.player.id] : []))
  )
  const reserve = sortBenchPlayers(
    trackedPlayers.filter((player) => reservePlayerIdSet.has(player.id))
  )
  const taxi = trackedPlayers.filter((player) => taxiPlayerIdSet.has(player.id))
  const bench = sortBenchPlayers(
    trackedPlayers.filter(
      (player) =>
        !assignedStarterIds.has(player.id) &&
        !reservePlayerIdSet.has(player.id) &&
        !taxiPlayerIdSet.has(player.id)
    )
  )
  const draftedAdditions = trackedPlayers.filter(
    (player) => player.isDraftAddition
  )

  return {
    bench,
    draftedAdditions,
    lineupSlots,
    reserve,
    taxi,
    totalPlayers: trackedPlayers.length,
  }
}

function buildLineupSlots(settings: LeagueSettings): LineupSlot[] {
  return LINEUP_SLOT_ORDER.flatMap((slot) => {
    const slotCount = settings.rosterSlots[slot] ?? 0

    return Array.from({ length: slotCount }, (_, index) => ({
      id: `${slot}-${index + 1}`,
      slot,
    }))
  })
}

function assignLineupSlots(
  slots: LineupSlot[],
  starterPlayerIds: string[],
  trackedPlayers: TrackedPlayer[]
): LineupSlot[] {
  const playersById = new Map(
    trackedPlayers.map((player) => [player.id, player])
  )
  const assignedSlots = slots.map((slot) => ({ ...slot }))

  for (const playerId of starterPlayerIds) {
    const player = playersById.get(playerId)

    if (!player) {
      continue
    }

    const slot = findOpenSlot(assignedSlots, player)

    if (slot) {
      slot.player = player
    }
  }

  return assignedSlots
}

function findOpenSlot(
  slots: LineupSlot[],
  player: TrackedPlayer
): LineupSlot | undefined {
  return (
    slots.find(
      (slot) => !slot.player && slot.slot === player.primaryPosition
    ) ??
    slots.find(
      (slot) =>
        !slot.player &&
        slot.slot === 'FLEX' &&
        canFillFlexPosition(player.primaryPosition)
    ) ??
    slots.find(
      (slot) =>
        !slot.player &&
        slot.slot === 'SUPER_FLEX' &&
        canFillSuperFlexPosition(player.primaryPosition)
    )
  )
}

function sortBenchPlayers(players: TrackedPlayer[]): TrackedPlayer[] {
  const positionOrder = new Map(
    BENCH_POSITION_ORDER.map((position, index) => [position, index])
  )

  return [...players].sort(
    (a, b) =>
      (positionOrder.get(a.primaryPosition) ?? Number.MAX_SAFE_INTEGER) -
      (positionOrder.get(b.primaryPosition) ?? Number.MAX_SAFE_INTEGER)
  )
}
