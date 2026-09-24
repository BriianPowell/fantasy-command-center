import type { PlayerNote, Position, Projection, Ranking } from './types'

export type PlayerRankingModelSource =
  'fantasypros' | 'pff' | 'sleeper' | 'manual' | 'model'

export interface ModelSourceMetadata {
  importedAt?: string
  source: PlayerRankingModelSource
  sourceUrl?: string
  version?: string
}

export interface HistoricalPlayerSeason {
  carries?: number
  fantasyPoints: number
  fantasyPointsPerGame: number
  games: number
  passingTouchdowns?: number
  passingYards?: number
  playerId?: string
  playerName: string
  position: Position
  receivingTargets?: number
  receivingTouchdowns?: number
  receivingYards?: number
  receptions?: number
  rushingTouchdowns?: number
  rushingYards?: number
  season: string
  source: ModelSourceMetadata
  /**
   * Position-specific counting stats that don't warrant top-level fields:
   * kicking distance buckets, team-defense takeaways, and similar.
   */
  stats?: Record<string, number>
  /** Share of the team's targets, as a percentage. */
  targetShare?: number
  team?: string
}

export interface TeamOffensiveLineProfile {
  notes?: string[]
  normalizedScore: number
  passProtectionScore?: number
  rank: number
  runBlockingScore?: number
  season: string
  source: ModelSourceMetadata
  team: string
  tier?: string
}

export interface TeamDefensiveLineProfile {
  normalizedScore: number
  notes?: string[]
  passRushScore?: number
  rank: number
  runDefenseScore?: number
  season: string
  source: ModelSourceMetadata
  team: string
  tier?: string
}

export interface QuarterbackContext {
  playerId?: string
  playerName: string
  productionScore: number
  season: string
  stabilityScore: number
  team: string
}

export interface PositionModelWeights {
  defensiveLine: number
  historicalProduction: number
  offensiveLine: number
  quarterback: number
  usage: number
}

export interface PlayerModelComponentScores {
  defensiveLine?: number
  historicalProduction?: number
  offensiveLine?: number
  quarterback?: number
  usage?: number
}

export interface PlayerModelScore {
  components: PlayerModelComponentScores
  notes: string[]
  playerId: string
  position: Position
  score: number
  season: string
}

export interface PlayerMatchReportEntry {
  candidates?: string[]
  matchedPlayerId?: string
  playerName: string
  reason?: string
  sourceTeam?: string
  status: 'matched' | 'ambiguous' | 'unmatched'
}

export interface PlayerRankingModelArtifact {
  generatedAt: string
  notes: PlayerNote[]
  playerScores: PlayerModelScore[]
  projections: Projection[]
  rankings: Ranking[]
  season: string
  sources: ModelSourceMetadata[]
  weights: Partial<Record<Position, PositionModelWeights>>
}
