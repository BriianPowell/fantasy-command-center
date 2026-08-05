import type { Player, Projection, Roster, WeeklyRecommendation } from "../domain/types";
import { evaluatePlayerStrategy } from "../strategy/teamOpportunity";
import type { StrategyContext } from "../strategy/types";

export interface WeeklyAnalysisInput {
  roster: Roster;
  players: Player[];
  projections: Projection[];
  week: number;
  unavailablePlayerIds?: Set<string>;
  strategyContext?: StrategyContext;
}

export interface WeeklyRosterSummary {
  starters: WeeklyRecommendation[];
  benchOptions: WeeklyRecommendation[];
  waiverTargets: WeeklyRecommendation[];
  weakSpots: string[];
  projectedStarterPoints: number;
}

export function buildWeeklyRosterSummary(input: WeeklyAnalysisInput): WeeklyRosterSummary {
  const playersById = new Map(input.players.map((player) => [player.id, player]));
  const projectionByPlayer = new Map(
    input.projections.filter((projection) => projection.week === input.week).map((projection) => [projection.playerId, projection])
  );

  const recommendations = input.roster.playerIds
    .flatMap<WeeklyRecommendation>((playerId) => {
      const player = playersById.get(playerId);

      if (!player) {
        return [];
      }

      const projection = projectionByPlayer.get(playerId);

      return [{
        player,
        ...(projection ? { projection } : {}),
        confidence: projection ? Math.min(100, Math.round((projection.projectedPoints / 20) * 100)) : 25,
        reason: projection
          ? `${projection.projectedPoints.toFixed(1)} projected points from ${projection.source}`
          : "No projection feed connected yet"
      }];
    })
    .sort((a, b) => (b.projection?.projectedPoints ?? 0) - (a.projection?.projectedPoints ?? 0));

  const starters = recommendations.filter((recommendation) => input.roster.starters.includes(recommendation.player.id));
  const benchOptions = recommendations.filter((recommendation) => !input.roster.starters.includes(recommendation.player.id));
  const waiverTargets = buildWaiverTargets(input, projectionByPlayer);
  const projectedStarterPoints = starters.reduce((total, recommendation) => total + (recommendation.projection?.projectedPoints ?? 0), 0);

  return {
    starters,
    benchOptions,
    waiverTargets,
    projectedStarterPoints,
    weakSpots: findWeakSpots(starters)
  };
}

function buildWaiverTargets(
  input: WeeklyAnalysisInput,
  projectionByPlayer: Map<string, Projection>
): WeeklyRecommendation[] {
  const unavailablePlayerIds = input.unavailablePlayerIds ?? new Set(input.roster.playerIds);

  return input.players
    .filter((player) => !unavailablePlayerIds.has(player.id))
    .flatMap<WeeklyRecommendation>((player) => {
      const projection = projectionByPlayer.get(player.id);
      const strategyEvaluation = evaluatePlayerStrategy(player, input.strategyContext);
      const fallbackScore = scoreProjectionFallback(player);

      if (!projection && strategyEvaluation.score <= 0 && fallbackScore <= 0) {
        return [];
      }

      return [{
        player,
        ...(projection ? { projection } : {}),
        confidence: projection ? Math.min(100, Math.round((projection.projectedPoints / 20) * 100)) : Math.min(75, fallbackScore * 8),
        strategyScore: Math.round(strategyEvaluation.score),
        reason: buildWaiverReason(player, projection, input.strategyContext)
      }];
    })
    .sort(
      (a, b) =>
        (b.projection?.projectedPoints ?? 0) +
        scoreProjectionFallback(b.player) +
        (b.strategyScore ?? 0) -
        ((a.projection?.projectedPoints ?? 0) + scoreProjectionFallback(a.player) + (a.strategyScore ?? 0))
    )
    .slice(0, 12);
}

function buildWaiverReason(
  player: Player,
  projection: Projection | undefined,
  strategyContext: StrategyContext | undefined
): string {
  const strategyEvaluation = evaluatePlayerStrategy(player, strategyContext);
  const strategyNote = strategyEvaluation.notes[0];

  if (!projection && strategyNote) {
    return strategyNote;
  }

  if (!projection) {
    return `${player.team ?? "FA"} ${player.positions[0]} with favorable Sleeper availability signal`;
  }

  if (strategyNote) {
    return `${projection.projectedPoints.toFixed(1)} projected points; ${strategyNote}`;
  }

  return `${projection.projectedPoints.toFixed(1)} projected points available at ${player.positions[0]}`;
}

function scoreProjectionFallback(player: Player): number {
  if (!player.searchRank) {
    return 0;
  }

  return Math.max(0, 12 - player.searchRank / 35);
}

function findWeakSpots(starters: WeeklyRecommendation[]): string[] {
  const weakSpots: string[] = [];
  const starterByPosition = new Map<string, WeeklyRecommendation[]>();

  for (const starter of starters) {
    const position = starter.player.positions[0] ?? "UNKNOWN";
    starterByPosition.set(position, [...(starterByPosition.get(position) ?? []), starter]);
  }

  for (const [position, positionStarters] of starterByPosition) {
    const lowProjectionCount = positionStarters.filter((starter) => (starter.projection?.projectedPoints ?? 0) < 8).length;

    if (lowProjectionCount > 0) {
      weakSpots.push(`${position}: ${lowProjectionCount} starter below 8 projected points`);
    }
  }

  if (weakSpots.length === 0 && starters.length > 0) {
    weakSpots.push("No obvious weak starter spots with current projections");
  }

  if (starters.length === 0) {
    weakSpots.push("Select a team roster to evaluate weekly starters");
  }

  return weakSpots;
}
