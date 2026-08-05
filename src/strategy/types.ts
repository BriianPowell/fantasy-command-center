import type { Player, Position } from "../domain/types";

export interface DepthChartEntry {
  playerName: string;
  playerId?: string;
  rank: number;
  role?: string;
}

export interface PlayerContributionProfile {
  playerName?: string;
  playerId?: string;
  opportunityShare?: number;
  fantasyPointShare?: number;
  redZoneShare?: number;
  trend?: "rising" | "stable" | "falling";
}

export interface TeamPositionProfile {
  fantasyPointShare?: number;
  opportunityGrade?: number;
  depthChart?: DepthChartEntry[];
  playerContributions?: PlayerContributionProfile[];
}

export interface TeamOpportunityProfile {
  team: string;
  label?: string;
  positions: Partial<Record<Position, TeamPositionProfile>>;
}

export interface PersonalStrategy {
  preferTeamPointEngines: boolean;
  preferDepthChartUpside: boolean;
  boostRisingUsage: boolean;
  penalizeBuriedDepthChartPlayers: boolean;
  highValuePositionShare: number;
  weights: {
    teamPositionValue: number;
    depthChart: number;
    playerContribution: number;
    trend: number;
  };
}

export interface StrategyContext {
  strategy: PersonalStrategy;
  teamProfiles: Record<string, TeamOpportunityProfile>;
  inferredDepthCharts: Map<string, Map<Position, Player[]>>;
}

export interface StrategyEvaluation {
  score: number;
  notes: string[];
  depthChartRank?: number;
  teamPositionShare?: number;
  playerContributionShare?: number;
}
