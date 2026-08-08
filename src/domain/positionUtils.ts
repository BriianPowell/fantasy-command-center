import type { LeagueSettings, Position } from './types'

const FLEX_POSITIONS = new Set<Position>(['RB', 'WR', 'TE'])
const SUPER_FLEX_POSITIONS = new Set<Position>(['QB', 'RB', 'WR', 'TE'])

export function canFillFlexPosition(position: Position): boolean {
  return FLEX_POSITIONS.has(position)
}

export function canFillSuperFlexPosition(position: Position): boolean {
  return SUPER_FLEX_POSITIONS.has(position)
}

export function isPositionConfiguredForLeague(
  position: Position,
  leagueSettings: LeagueSettings
): boolean {
  if ((leagueSettings.rosterSlots[position] ?? 0) > 0) {
    return true
  }

  if (
    (leagueSettings.rosterSlots.FLEX ?? 0) > 0 &&
    canFillFlexPosition(position)
  ) {
    return true
  }

  return (
    (leagueSettings.rosterSlots.SUPER_FLEX ?? 0) > 0 &&
    canFillSuperFlexPosition(position)
  )
}

export function getPrimaryPosition(
  positions: Position[]
): Position | undefined {
  return positions[0]
}

export function getPositionClass(position: Position): string {
  return `position-${position.toLowerCase()}`
}
