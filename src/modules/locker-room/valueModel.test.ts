import { describe, expect, it } from 'vitest'
import type { TrackedPlayer } from './model'
import {
  buildPositionValueGaps,
  buildTeamPickValueImpacts,
  buildTeamValueSnapshot,
  formatTeamValue,
  formatTeamValueDelta,
  isPositionWeakSpot,
} from './valueModel'
import type { Player, Position } from '../../domain/types'

function makePlayer(
  id: string,
  searchRank: number,
  position: Position = 'RB'
): Player {
  return {
    id,
    providerPlayerId: id,
    fullName: id,
    positions: [position],
    searchRank,
  }
}

function makeTrackedPlayer(player: Player): TrackedPlayer {
  return {
    id: player.id,
    isDraftAddition: false,
    player,
    primaryPosition: player.positions[0] ?? 'RB',
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
    expect(snapshot.reserveValue).toBe(0)
    expect(snapshot.averageValue).toBe(65)
    expect(snapshot.starterBenchDelta).toBe(24)
    expect(snapshot.latestPickValue).toBe(53)
    expect(snapshot.latestPickDelta).toBe(-12)
  })

  it('includes reserve players in total roster value without counting them as bench value', () => {
    const starter = makePlayer('starter', 1)
    const reserve = makePlayer('reserve', 7)

    const snapshot = buildTeamValueSnapshot({
      bench: [],
      draftedAdditions: [],
      lineupSlots: [
        {
          id: 'RB-1',
          player: makeTrackedPlayer(starter),
          slot: 'RB',
        },
      ],
      picks: [],
      players: [starter, reserve],
      reserve: [makeTrackedPlayer(reserve)],
    })

    expect(snapshot.benchValue).toBe(0)
    expect(snapshot.reserveValue).toBe(61)
    expect(snapshot.totalValue).toBe(138)
  })
})

describe('buildTeamPickValueImpacts', () => {
  it('calculates each pick impact against the team baseline value', () => {
    const highValuePick = makePlayer('high-value-pick', 1)
    const lowValuePick = makePlayer('low-value-pick', 15, 'WR')

    const impacts = buildTeamPickValueImpacts({
      baselineValue: 65,
      picks: [
        {
          pickNo: 1,
          playerId: highValuePick.id,
          rosterId: 'team-1',
          round: 1,
        },
        {
          pickNo: 2,
          playerId: lowValuePick.id,
          rosterId: 'team-1',
          round: 1,
        },
      ],
      players: [highValuePick, lowValuePick],
      weakPositions: new Set(['RB']),
    })

    expect(impacts.get(1)?.valueDelta).toBe(12)
    expect(impacts.get(1)?.cumulativeDraftValue).toBe(77)
    expect(impacts.get(1)?.improvesWeakArea).toBe(true)
    expect(impacts.get(2)?.valueDelta).toBe(-12)
    expect(impacts.get(2)?.cumulativeDraftValue).toBe(130)
    expect(impacts.get(2)?.improvesWeakArea).toBe(false)
  })

  it('skips picks without matching player metadata', () => {
    const impacts = buildTeamPickValueImpacts({
      baselineValue: 65,
      picks: [
        {
          pickNo: 1,
          playerId: 'missing-player',
          rosterId: 'team-1',
          round: 1,
        },
      ],
      players: [],
    })

    expect(impacts.size).toBe(0)
  })
})

describe('buildPositionValueGaps', () => {
  it('summarizes starter fill and position value against roster average', () => {
    const runningBack = makePlayer('running-back', 1, 'RB')
    const wideReceiver = makePlayer('wide-receiver', 15, 'WR')

    const gaps = buildPositionValueGaps({
      bench: [makeTrackedPlayer(wideReceiver)],
      lineupSlots: [
        {
          id: 'RB-1',
          player: makeTrackedPlayer(runningBack),
          slot: 'RB',
        },
        {
          id: 'WR-1',
          slot: 'WR',
        },
      ],
    })

    expect(gaps).toEqual([
      {
        averageValue: 77,
        filledStarters: 1,
        playerCount: 1,
        position: 'RB',
        requiredStarters: 1,
        valueDelta: 12,
      },
      {
        averageValue: 53,
        filledStarters: 0,
        playerCount: 1,
        position: 'WR',
        requiredStarters: 1,
        valueDelta: -12,
      },
    ])
  })
})

describe('isPositionWeakSpot', () => {
  it('flags missing starters and meaningful negative value gaps', () => {
    expect(
      isPositionWeakSpot({
        averageValue: 0,
        filledStarters: 0,
        playerCount: 0,
        position: 'QB',
        requiredStarters: 1,
        valueDelta: 0,
      })
    ).toBe(true)
    expect(
      isPositionWeakSpot({
        averageValue: 60,
        filledStarters: 1,
        playerCount: 1,
        position: 'TE',
        requiredStarters: 1,
        valueDelta: -0.4,
      })
    ).toBe(false)
    expect(
      isPositionWeakSpot({
        averageValue: 55,
        filledStarters: 2,
        playerCount: 2,
        position: 'RB',
        requiredStarters: 2,
        valueDelta: -5.2,
      })
    ).toBe(true)
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
