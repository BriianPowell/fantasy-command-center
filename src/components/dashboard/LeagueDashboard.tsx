import { useMemo } from 'react'
import type { DashboardModuleId } from './dashboardTypes'
import { buildDraftRecommendations } from '../../analysis/draftRecommendations'
import { fantasyConfig } from '../../config/fantasyConfig'
import {
  defaultPlayerNotes,
  defaultProjections,
  defaultRankings,
} from '../../data/defaultInputs'
import {
  type LeagueDraftModeConfig,
  resolveDraftBoardContext,
} from '../../domain/draftBoardMode'
import type { NormalizedLeagueData, Roster } from '../../domain/types'
import { DraftPickHelperModule } from '../../modules/draft'
import { TeamTrackerModule } from '../../modules/team-tracker/TeamTrackerModule'
import { buildStrategyContext } from '../../strategy/teamOpportunity'

export interface LeagueDashboardProps {
  data: NormalizedLeagueData
  minimizedModules: Record<DashboardModuleId, boolean>
  onToggleModule: (moduleId: DashboardModuleId) => void
}

export function LeagueDashboard({
  data,
  minimizedModules,
  onToggleModule,
}: LeagueDashboardProps) {
  const selectedTeamId = resolveSelectedTeamId(data)
  const baseRoster = useMemo(
    () => data.rosters.find((roster) => roster.teamId === selectedTeamId),
    [data.rosters, selectedTeamId]
  )
  const selectedRoster = useMemo(() => {
    return buildDraftAwareRoster(baseRoster, data, selectedTeamId)
  }, [baseRoster, data, selectedTeamId])

  const unavailablePlayerIds = useMemo(() => {
    const draftedFromSleeper =
      data.draft?.picks.flatMap((pick) =>
        pick.playerId ? [pick.playerId] : []
      ) ?? []
    const rosteredPlayers = data.rosters.flatMap((roster) => roster.playerIds)

    return new Set([...draftedFromSleeper, ...rosteredPlayers])
  }, [data.draft?.picks, data.rosters])

  const strategyContext = useMemo(() => {
    return buildStrategyContext({
      players: data.players,
    })
  }, [data.players])
  const draftBoardContext = useMemo(() => {
    const leagueDraftModeConfig = fantasyConfig.leagueDraftModes[
      data.league.id
    ] as LeagueDraftModeConfig | undefined

    return resolveDraftBoardContext(data.draft?.status, leagueDraftModeConfig)
  }, [data.draft?.status, data.league.id])

  const recommendations = useMemo(() => {
    return buildDraftRecommendations({
      boardMode: draftBoardContext.boardMode,
      players: data.players,
      unavailablePlayerIds,
      roster: selectedRoster,
      leagueSettings: data.league.settings,
      rankings: defaultRankings,
      projections: defaultProjections,
      notes: defaultPlayerNotes,
      strategyContext,
    })
  }, [
    draftBoardContext.boardMode,
    data.league.settings,
    data.players,
    selectedRoster,
    strategyContext,
    unavailablePlayerIds,
  ])

  return (
    <article className="league-dashboard">
      <TeamTrackerModule
        data={data}
        isMinimized={minimizedModules.teamTracker}
        onToggleMinimized={() => onToggleModule('teamTracker')}
        roster={baseRoster}
        selectedTeamId={selectedTeamId}
      />
      <DraftPickHelperModule
        boardMode={draftBoardContext.boardMode}
        data={data}
        draftMode={draftBoardContext.draftMode}
        isMinimized={minimizedModules.draftRoom}
        onToggleMinimized={() => onToggleModule('draftRoom')}
        recommendations={recommendations}
        selectedTeamId={selectedTeamId}
      />
    </article>
  )
}

function buildDraftAwareRoster(
  roster: Roster | undefined,
  data: NormalizedLeagueData,
  teamId: string
): Roster | undefined {
  if (!roster) {
    return undefined
  }

  const draftedForTeam =
    data.draft?.picks.flatMap((pick) =>
      pick.rosterId === teamId && pick.playerId ? [pick.playerId] : []
    ) ?? []

  return {
    ...roster,
    playerIds: Array.from(new Set([...roster.playerIds, ...draftedForTeam])),
  }
}

function resolveSelectedTeamId(data: NormalizedLeagueData): string {
  const configuredTeams = data.teams.filter(isConfiguredOwner)

  return configuredTeams[0]?.id ?? data.teams[0]?.id ?? ''
}

function isConfiguredOwner(
  team: NormalizedLeagueData['teams'][number]
): boolean {
  const configuredOwners =
    fantasyConfig.sleeperUsernames.map(normalizeIdentifier)

  return [team.ownerUsername, team.ownerName, team.ownerId].some(
    (ownerValue) =>
      ownerValue && configuredOwners.includes(normalizeIdentifier(ownerValue))
  )
}

function normalizeIdentifier(value: string): string {
  return value.trim().toLowerCase()
}
