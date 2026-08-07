import type { Player } from '../../domain/types'

export function getSleeperPlayerImageUrl(playerOrId: Player | string): string {
  const playerId =
    typeof playerOrId === 'string' ? playerOrId : playerOrId.providerPlayerId

  return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`
}
