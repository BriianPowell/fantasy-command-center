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
import {
  buildDraftAwareRoster,
  getDraftedPlayerIds,
} from '../../domain/draftPickUtils'
import type { DraftSyncStatus } from '../../domain/draftSync'
import type { NormalizedLeagueData } from '../../domain/types'
import { DraftPickHelperModule } from '../../modules/draft'
import { TeamTrackerModule } from '../../modules/team-tracker/TeamTrackerModule'
import { buildStrategyContext } from '../../strategy/teamOpportunity'

export interface LeagueDashboardProps {
  data: NormalizedLeagueData
  draftSyncStatus?: DraftSyncStatus
  minimizedModules: Record<DashboardModuleId, boolean>
  onRefreshDraftStatus?: () => void
  onToggleModule: (moduleId: DashboardModuleId) => void
}

export function LeagueDashboard({
  data,
  draftSyncStatus,
  minimizedModules,
  onRefreshDraftStatus,
  onToggleModule,
}: LeagueDashboardProps) {
  const selectedTeamId = resolveSelectedTeamId(data)
  const baseRoster = useMemo(
    () => data.rosters.find((roster) => roster.teamId === selectedTeamId),
    [data.rosters, selectedTeamId]
  )
  const picks = data.draft?.picks ?? []
  const selectedRoster = useMemo(() => {
    return buildDraftAwareRoster(baseRoster, picks, selectedTeamId)
  }, [baseRoster, picks, selectedTeamId])

  const unavailablePlayerIds = useMemo(() => {
    const draftedFromSleeper = getDraftedPlayerIds(picks)
    const rosteredPlayers = data.rosters.flatMap((roster) => roster.playerIds)

    return new Set([...draftedFromSleeper, ...rosteredPlayers])
  }, [data.rosters, picks])

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
      draft: data.draft,
      players: data.players,
      selectedTeamId,
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
    data.draft,
    data.players,
    selectedTeamId,
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
        draftSyncStatus={draftSyncStatus}
        isMinimized={minimizedModules.draftRoom}
        onRefreshDraftStatus={onRefreshDraftStatus}
        onToggleMinimized={() => onToggleModule('draftRoom')}
        recommendations={recommendations}
        selectedTeamId={selectedTeamId}
      />
    </article>
  )
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
