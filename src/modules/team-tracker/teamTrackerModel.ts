import type { DraftPick, LeagueSettings, Player, Position, Roster } from "../../domain/types";

const LINEUP_SLOT_ORDER: LineupSlotType[] = ["QB", "RB", "WR", "TE", "FLEX", "SUPER_FLEX", "K", "DEF"];
const FLEX_POSITIONS = new Set<Position>(["RB", "WR", "TE"]);
const SUPER_FLEX_POSITIONS = new Set<Position>(["QB", "RB", "WR", "TE"]);

export type LineupSlotType = Position | "FLEX" | "SUPER_FLEX";

export interface TeamTrackerPlayer {
  id: string;
  isDraftAddition: boolean;
  isStarter: boolean;
  player: Player;
  primaryPosition: Position;
}

export interface TeamTrackerLineupSlot {
  id: string;
  player?: TeamTrackerPlayer;
  slot: LineupSlotType;
}

export interface TeamTrackerViewModel {
  bench: TeamTrackerPlayer[];
  draftedAdditions: TeamTrackerPlayer[];
  lineupSlots: TeamTrackerLineupSlot[];
  missingPlayerIds: string[];
  starters: TeamTrackerPlayer[];
  totalPlayers: number;
}

export function buildTeamTrackerViewModel({
  draftPicks,
  leagueSettings,
  players,
  roster,
  selectedTeamId
}: {
  draftPicks: DraftPick[];
  leagueSettings: LeagueSettings;
  players: Player[];
  roster: Roster | undefined;
  selectedTeamId: string;
}): TeamTrackerViewModel {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const rosterPlayerIds = roster?.playerIds ?? [];
  const starterIds = new Set(roster?.starters ?? []);
  const draftAdditionIds = draftPicks.flatMap((pick) => (pick.rosterId === selectedTeamId && pick.playerId ? [pick.playerId] : []));
  const draftAdditionIdSet = new Set(draftAdditionIds);
  const trackedPlayerIds = Array.from(new Set([...rosterPlayerIds, ...draftAdditionIds]));
  const missingPlayerIds: string[] = [];

  const trackedPlayers = trackedPlayerIds.flatMap<TeamTrackerPlayer>((playerId) => {
    const player = playersById.get(playerId);
    const primaryPosition = player?.positions[0];

    if (!player || !primaryPosition) {
      missingPlayerIds.push(playerId);
      return [];
    }

    return [
      {
        id: player.id,
        isDraftAddition: draftAdditionIdSet.has(player.id) && !rosterPlayerIds.includes(player.id),
        isStarter: starterIds.has(player.id),
        player,
        primaryPosition
      }
    ];
  });

  const lineupSlots = assignLineupSlots(buildLineupSlots(leagueSettings), roster?.starters ?? [], trackedPlayers);
  const assignedStarterIds = new Set(lineupSlots.flatMap((slot) => (slot.player ? [slot.player.id] : [])));
  const starters = lineupSlots.flatMap((slot) => (slot.player ? [slot.player] : []));
  const bench = trackedPlayers.filter((player) => !assignedStarterIds.has(player.id));
  const draftedAdditions = trackedPlayers.filter((player) => player.isDraftAddition);

  return {
    bench,
    draftedAdditions,
    lineupSlots,
    missingPlayerIds,
    starters,
    totalPlayers: trackedPlayers.length
  };
}

function buildLineupSlots(settings: LeagueSettings): TeamTrackerLineupSlot[] {
  return LINEUP_SLOT_ORDER.flatMap((slot) => {
    const slotCount = settings.rosterSlots[slot] ?? 0;

    return Array.from({ length: slotCount }, (_, index) => ({
      id: `${slot}-${index + 1}`,
      slot
    }));
  });
}

function assignLineupSlots(
  slots: TeamTrackerLineupSlot[],
  starterPlayerIds: string[],
  trackedPlayers: TeamTrackerPlayer[]
): TeamTrackerLineupSlot[] {
  const playersById = new Map(trackedPlayers.map((player) => [player.id, player]));
  const assignedSlots = slots.map((slot) => ({ ...slot }));

  for (const playerId of starterPlayerIds) {
    const player = playersById.get(playerId);

    if (!player) {
      continue;
    }

    const slot = findOpenSlot(assignedSlots, player);

    if (slot) {
      slot.player = player;
    }
  }

  return assignedSlots;
}

function findOpenSlot(slots: TeamTrackerLineupSlot[], player: TeamTrackerPlayer): TeamTrackerLineupSlot | undefined {
  return (
    slots.find((slot) => !slot.player && slot.slot === player.primaryPosition) ??
    slots.find((slot) => !slot.player && slot.slot === "FLEX" && FLEX_POSITIONS.has(player.primaryPosition)) ??
    slots.find((slot) => !slot.player && slot.slot === "SUPER_FLEX" && SUPER_FLEX_POSITIONS.has(player.primaryPosition))
  );
}
