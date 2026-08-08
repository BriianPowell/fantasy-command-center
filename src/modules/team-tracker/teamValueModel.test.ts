import { describe, expect, it } from 'vitest'
import type { TeamTrackerPlayer } from './teamTrackerModel'
import {
  buildTeamValueSnapshot,
  formatTeamValue,
  formatTeamValueDelta,
} from './teamValueModel'
import type { Player } from '../../domain/types'

function makePlayer(id: string, searchRank: number): Player {
  return {
    id,
    providerPlayerId: id,
    fullName: id,
    positions: ['RB'],
    searchRank,
  }
}

function makeTrackedPlayer(player: Player): TeamTrackerPlayer {
  return {
    id: player.id,
    isDraftAddition: false,
    player,
    primaryPosition: 'RB',
  }
}

describe('buildTeamValueSnapshot', () => {
  it('calculates starter, bench, draft addition, and latest pick values', () => {
    const starter = makePlayer('starter', 1)
    const bench = makePlayer('bench', 15)
    const draftAddition = makePlayer('draft-addition', 3)

    const snapshot = buildTeamValueSnapshot({
      bench: [makeTrackedPlayer(bench)],
      draftedAdditions: [makeTrackedPlayer(draftAddition)],
      lineupSlots: [
        {
          id: 'RB-1',
          player: makeTrackedPlayer(starter),
          slot: 'RB',
        },
      ],
      picks: [
        {
          pickNo: 1,
          playerId: bench.id,
          rosterId: 'team-1',
          round: 1,
        },
      ],
      players: [starter, bench, draftAddition],
    })

    expect(snapshot.starterValue).toBe(77)
    expect(snapshot.benchValue).toBe(53)
    expect(snapshot.totalValue).toBe(130)
    expect(snapshot.draftedAdditionsValue).toBe(69)
    expect(snapshot.averageValue).toBe(65)
    expect(snapshot.latestPickValue).toBe(53)
    expect(snapshot.latestPickDelta).toBe(-12)
  })
})

describe('team value formatting', () => {
  it('rounds total values and signs value deltas', () => {
    expect(formatTeamValue(64.6)).toBe('65')
    expect(formatTeamValueDelta(7.2)).toBe('+7')
    expect(formatTeamValueDelta(-3.8)).toBe('-4')
    expect(formatTeamValueDelta(undefined)).toBe('-')
  })
})
