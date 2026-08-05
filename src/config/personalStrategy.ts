import type { PersonalStrategy, TeamOpportunityProfile } from "../strategy/types";

export const personalStrategy: PersonalStrategy = {
  preferTeamPointEngines: true,
  preferDepthChartUpside: true,
  boostRisingUsage: true,
  penalizeBuriedDepthChartPlayers: true,
  highValuePositionShare: 0.28,
  weights: {
    teamPositionValue: 18,
    depthChart: 8,
    playerContribution: 14,
    trend: 5
  }
};

export const teamOpportunityProfiles: Record<string, TeamOpportunityProfile> = {
  // Example shape:
  // DET: {
  //   team: "DET",
  //   label: "Run game creates RB value",
  //   positions: {
  //     RB: {
  //       fantasyPointShare: 0.34,
  //       opportunityGrade: 0.9,
  //       depthChart: [
  //         { playerName: "Jahmyr Gibbs", rank: 1, role: "explosive starter" },
  //         { playerName: "David Montgomery", rank: 2, role: "goal-line / early-down" }
  //       ],
  //       playerContributions: [{ playerName: "Jahmyr Gibbs", fantasyPointShare: 0.22, trend: "rising" }]
  //     }
  //   }
  // }
};
