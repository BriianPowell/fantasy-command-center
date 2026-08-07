import type { Position } from './types'

export function getPrimaryPosition(
  positions: Position[]
): Position | undefined {
  return positions[0]
}

export function getPositionClass(position: Position): string {
  return `position-${position.toLowerCase()}`
}
