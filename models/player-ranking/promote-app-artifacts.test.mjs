import { describe, expect, it } from 'vitest'

import { indexSleeperPlayers } from './sleeper-players.mjs'
import {
  buildAppArtifacts,
  dedupeRankingRowsByPlayerId,
} from './promote-app-artifacts.mjs'

describe('buildAppArtifacts', () => {
  const sleeperIndex = indexSleeperPlayers({
    p1: {
      player_id: '99',
      full_name: 'Alpha Back',
      position: 'RB',
      team: 'AAA',
      active: true,
      search_rank: 1,
    },
    p2: {
      player_id: '88',
      full_name: 'Beta Back',
      position: 'RB',
      team: 'BBB',
      active: true,
      search_rank: 2,
    },
  })

  it('emits rankings sorted by projected points and projections for skill positions', () => {
    const { rankings, projections, matchReport } = buildAppArtifacts({
      scoresArtifact: {
        scores: [
          {
            season: '2025',
            playerName: 'Alpha Back',
            position: 'RB',
            team: 'AAA',
            qualified: true,
            positionRank: 1,
            productionScore: 95,
            fantasyPointsPerGame: 18,
          },
          {
            season: '2025',
            playerName: 'Beta Back',
            position: 'RB',
            team: 'BBB',
            qualified: true,
            positionRank: 2,
            productionScore: 90,
            fantasyPointsPerGame: 16,
          },
        ],
      },
      projectionsArtifact: {
        positions: {
          RB: {
            projections: [
              {
                playerName: 'Alpha Back',
                projectedPoints: 300,
                projectedFloor: 250,
                projectedCeiling: 340,
              },
              {
                playerName: 'Beta Back',
                projectedPoints: 250,
                projectedFloor: 200,
                projectedCeiling: 290,
              },
            ],
          },
        },
      },
      season: '2025',
      sleeperIndex,
    })

    expect(matchReport.every((row) => row.status === 'matched')).toBe(true)
    expect(rankings).toHaveLength(2)
    expect(rankings[0].playerId).toBe('99')
    expect(rankings[0].rank).toBe(1)
    expect(rankings[1].rank).toBe(2)
    expect(rankings[0].tier).toBe(1)

    expect(projections).toHaveLength(2)
    expect(projections[0].projectedPoints).toBe(300)
    expect(projections[0].floor).toBe(250)
  })

  it('dedupes duplicate Sleeper ids, keeping the stronger vendor row', () => {
    const flexIndex = indexSleeperPlayers({
      flex: {
        player_id: '8223',
        full_name: 'Velus Jones Jr.',
        position: 'WR',
        fantasy_positions: ['RB', 'WR'],
        team: 'SEA',
        active: true,
        search_rank: 400,
      },
    })

    const { rankings, projections, dedupedRankingRows, dedupedProjectionRows } =
      buildAppArtifacts({
        scoresArtifact: {
          scores: [
            {
              season: '2025',
              playerName: 'Velus Jones Jr.',
              position: 'RB',
              team: 'SEA',
              qualified: true,
              positionRank: 80,
              productionScore: 40,
              fantasyPointsPerGame: 3,
            },
            {
              season: '2025',
              playerName: 'Velus Jones Jr.',
              position: 'WR',
              team: 'SEA',
              qualified: true,
              positionRank: 50,
              productionScore: 55,
              fantasyPointsPerGame: 6,
            },
          ],
        },
        projectionsArtifact: {
          positions: {
            RB: {
              projections: [
                {
                  playerName: 'Velus Jones Jr.',
                  projectedPoints: 0,
                  projectedFloor: 0,
                  projectedCeiling: 20,
                },
              ],
            },
            WR: {
              projections: [
                {
                  playerName: 'Velus Jones Jr.',
                  projectedPoints: 50,
                  projectedFloor: 30,
                  projectedCeiling: 70,
                },
              ],
            },
          },
        },
        season: '2025',
        sleeperIndex: flexIndex,
      })

    expect(dedupedRankingRows).toBe(1)
    expect(dedupedProjectionRows).toBe(1)
    expect(rankings).toHaveLength(1)
    expect(projections).toHaveLength(1)
    expect(rankings[0].playerId).toBe('8223')
    expect(rankings[0].positionRank).toBe(50)
    expect(projections[0].projectedPoints).toBe(50)
  })
})

describe('dedupeRankingRowsByPlayerId', () => {
  it('keeps the row with higher sortPoints', () => {
    const rows = dedupeRankingRowsByPlayerId([
      { playerId: '1', sortPoints: 10, productionScore: 50, positionRank: 2 },
      { playerId: '1', sortPoints: 20, productionScore: 60, positionRank: 1 },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].sortPoints).toBe(20)
  })
})
