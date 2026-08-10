import { describe, expect, it } from 'vitest'
import { buildLockerRoomViewModel } from './lockerRoomModel'
import type { LeagueSettings, Player, Position } from '../../domain/types'

const leagueSettings: LeagueSettings = {
  rosterSlots: {
    QB: 1,
    RB: 1,
    WR: 0,
    TE: 0,
    K: 0,
    DEF: 0,
    DB: 0,
    DL: 0,
    LB: 0,
    IDP: 0,
    FLEX: 1,
    SUPER_FLEX: 0,
    BN: 4,
  },
  scoringType: 'ppr',
  teams: 12,
}

function makePlayer(id: string, position: Position): Player {
  return {
    id,
    providerPlayerId: id,
    fullName: id,
    positions: [position],
  }
}

describe('buildLockerRoomViewModel', () => {
  it('assigns roster starters to exact and flex slots before benching the rest', () => {
    const quarterback = makePlayer('quarterback', 'QB')
    const runningBack = makePlayer('running-back', 'RB')
    const wideReceiver = makePlayer('wide-receiver', 'WR')

    const viewModel = buildLockerRoomViewModel({
      draftPicks: [],
      leagueSettings,
      players: [quarterback, runningBack, wideReceiver],
      roster: {
        playerIds: [quarterback.id, runningBack.id, wideReceiver.id],
        starters: [runningBack.id, wideReceiver.id],
        teamId: 'team-1',
      },
      selectedTeamId: 'team-1',
    })

    expect(
      viewModel.lineupSlots.find((slot) => slot.slot === 'RB')?.player?.id
    ).toBe(runningBack.id)
    expect(
      viewModel.lineupSlots.find((slot) => slot.slot === 'FLEX')?.player?.id
    ).toBe(wideReceiver.id)
    expect(viewModel.bench.map((player) => player.id)).toEqual([quarterback.id])
    expect(viewModel.totalPlayers).toBe(3)
  })

  it('tracks selected-team draft picks as draft additions without adding other teams picks', () => {
    const rosteredRunningBack = makePlayer('rostered-rb', 'RB')
    const draftedWideReceiver = makePlayer('drafted-wr', 'WR')
    const otherTeamQuarterback = makePlayer('other-team-qb', 'QB')

    const viewModel = buildLockerRoomViewModel({
      draftPicks: [
        {
          pickNo: 1,
          playerId: draftedWideReceiver.id,
          rosterId: 'team-1',
          round: 1,
        },
        {
          pickNo: 2,
          playerId: otherTeamQuarterback.id,
          rosterId: 'team-2',
          round: 1,
        },
      ],
      leagueSettings,
      players: [rosteredRunningBack, draftedWideReceiver, otherTeamQuarterback],
      roster: {
        playerIds: [rosteredRunningBack.id],
        starters: [rosteredRunningBack.id],
        teamId: 'team-1',
      },
      selectedTeamId: 'team-1',
    })

    expect(viewModel.draftedAdditions).toEqual([
      expect.objectContaining({
        id: draftedWideReceiver.id,
        isDraftAddition: true,
      }),
    ])
    expect(viewModel.bench.map((player) => player.id)).toEqual([
      draftedWideReceiver.id,
    ])
    expect(viewModel.totalPlayers).toBe(2)
  })

  it('separates taxi squad players from bench players', () => {
    const starter = makePlayer('starter-rb', 'RB')
    const benchPlayer = makePlayer('bench-qb', 'QB')
    const taxiPlayer = makePlayer('taxi-wr', 'WR')

    const viewModel = buildLockerRoomViewModel({
      draftPicks: [],
      leagueSettings,
      players: [starter, benchPlayer, taxiPlayer],
      roster: {
        playerIds: [starter.id, benchPlayer.id],
        starters: [starter.id],
        taxiPlayerIds: [taxiPlayer.id],
        teamId: 'team-1',
      },
      selectedTeamId: 'team-1',
    })

    expect(viewModel.bench.map((player) => player.id)).toEqual([benchPlayer.id])
    expect(viewModel.taxi.map((player) => player.id)).toEqual([taxiPlayer.id])
    expect(viewModel.totalPlayers).toBe(3)
  })
})
