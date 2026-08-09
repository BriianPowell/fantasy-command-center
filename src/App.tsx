import { useEffect, useRef, useState } from 'react'
import { type DashboardModuleId } from './components/dashboard/dashboardTypes'
import { EmptyState } from './components/dashboard/EmptyState'
import { LeagueDashboard } from './components/dashboard/LeagueDashboard'
import { TopBar } from './components/dashboard/TopBar'
import { fantasyConfig } from './config/fantasyConfig'
import { type DraftSyncStatus, mergeLeagueDraftState } from './domain/draftSync'
import type { NflState, NormalizedLeagueData, Player } from './domain/types'
import { loadNflTeamByeWeeks } from './providers/schedule/nflScheduleApi'
import { SleeperProvider } from './providers/sleeper/SleeperProvider'
import {
  loadActiveDashboardId,
  loadMinimizedModules,
  saveActiveDashboardId,
  saveMinimizedModules,
} from './storage/dashboardPreferences'

const sleeperProvider = new SleeperProvider()
const configuredLeagueIds = [...fantasyConfig.sleeperLeagueIds]
const DRAFT_SYNC_INTERVAL_MS = 15_000

export function App() {
  const [leagues, setLeagues] = useState<NormalizedLeagueData[]>([])
  const [activeDashboardId, setActiveDashboardId] = useState(() =>
    loadActiveDashboardId(configuredLeagueIds)
  )
  const [minimizedModules, setMinimizedModules] =
    useState<Record<DashboardModuleId, boolean>>(loadMinimizedModules)
  const [nflState, setNflState] = useState<NflState | undefined>()
  const [draftSyncStatuses, setDraftSyncStatuses] = useState<
    Record<string, DraftSyncStatus>
  >({})
  const [status, setStatus] = useState('Loading configured Sleeper leagues...')
  const [errors, setErrors] = useState<string[]>([])
  const hasAutoLoaded = useRef(false)
  const activeLeague =
    leagues.find((league) => league.league.id === activeDashboardId) ??
    leagues[0]
  const activeLeagueId = activeLeague?.league.id
  const activeDraftId = activeLeague?.draft?.id
  const activePollingDraftId =
    activeLeague?.draft?.status === 'drafting'
      ? activeLeague.draft.id
      : undefined
  const activeDraftSyncStatus = activeLeagueId
    ? draftSyncStatuses[activeLeagueId]
    : undefined

  useEffect(() => {
    saveActiveDashboardId(activeDashboardId)
    saveMinimizedModules(minimizedModules)
  }, [activeDashboardId, minimizedModules])

  useEffect(() => {
    if (hasAutoLoaded.current || !configuredLeagueIds.length) {
      return
    }

    hasAutoLoaded.current = true
    void loadLeagues()
  }, [])

  useEffect(() => {
    if (!activeLeagueId || !activePollingDraftId) {
      if (activeLeagueId) {
        setDraftSyncStatuses((current) =>
          removeDraftSyncStatus(current, activeLeagueId)
        )
      }

      return
    }

    let isCancelled = false

    async function refreshActiveDraft() {
      if (!activeLeagueId || !activePollingDraftId) {
        return
      }

      await refreshDraftStatus(
        activeLeagueId,
        activePollingDraftId,
        () => isCancelled
      )
    }

    void refreshActiveDraft()
    const intervalId = window.setInterval(
      refreshActiveDraft,
      DRAFT_SYNC_INTERVAL_MS
    )

    return () => {
      isCancelled = true
      window.clearInterval(intervalId)
    }
  }, [activeLeagueId, activePollingDraftId])

  async function refreshDraftStatus(
    leagueId: string,
    draftId: string,
    isCancelled: () => boolean = () => false
  ) {
    setDraftSyncStatuses((current) => ({
      ...current,
      [leagueId]: {
        message: 'Refreshing draft picks',
        state: 'syncing',
      },
    }))

    try {
      const draft = await sleeperProvider.refreshDraftState(draftId)

      if (isCancelled()) {
        return
      }

      setLeagues((current) => mergeLeagueDraftState(current, leagueId, draft))
      setDraftSyncStatuses((current) => ({
        ...current,
        [leagueId]: {
          lastUpdatedAt: Date.now(),
          state: 'synced',
        },
      }))
    } catch (caughtError) {
      if (isCancelled()) {
        return
      }

      setDraftSyncStatuses((current) => ({
        ...current,
        [leagueId]: {
          message: readError(caughtError),
          state: 'error',
        },
      }))
    }
  }

  async function loadLeagues() {
    setErrors([])
    setStatus(
      `Loading ${configuredLeagueIds.length} Sleeper league${configuredLeagueIds.length === 1 ? '' : 's'}...`
    )

    const [nflStateResult, ...results] = await Promise.allSettled([
      sleeperProvider.loadNflState(),
      ...configuredLeagueIds.map((leagueId) =>
        sleeperProvider.loadLeagueShellData(leagueId)
      ),
    ])

    if (nflStateResult.status === 'fulfilled') {
      setNflState(nflStateResult.value)
    }

    const loadedLeagues = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : []
    )
    const loadErrors = results.flatMap((result, index) =>
      result.status === 'rejected'
        ? [`${configuredLeagueIds[index]}: ${readError(result.reason)}`]
        : []
    )
    const nflStateErrors =
      nflStateResult.status === 'rejected'
        ? [`NFL state: ${readError(nflStateResult.reason)}`]
        : []

    setLeagues(loadedLeagues)
    setActiveDashboardId((current) =>
      current && loadedLeagues.some((league) => league.league.id === current)
        ? current
        : (loadedLeagues[0]?.league.id ?? '')
    )
    setErrors([...loadErrors, ...nflStateErrors])
    setStatus(
      loadedLeagues.length
        ? `Loaded ${loadedLeagues.length} dashboard${loadedLeagues.length === 1 ? '' : 's'}. Loading player pool...`
        : 'No leagues loaded.'
    )

    if (!loadedLeagues.length) {
      return
    }

    try {
      const players = await sleeperProvider.loadPlayers()
      const { players: playersWithByeWeeks, warning: byeWeekWarning } =
        await enrichPlayersWithScheduleByeWeeks(players)
      const loadedLeagueIds = new Set(
        loadedLeagues.map((league) => league.league.id)
      )

      if (byeWeekWarning) {
        setErrors((current) => [...current, byeWeekWarning])
      }

      setLeagues((current) =>
        current.map((league) =>
          loadedLeagueIds.has(league.league.id)
            ? { ...league, players: playersWithByeWeeks }
            : league
        )
      )
      setStatus(
        `Loaded ${loadedLeagues.length} league${loadedLeagues.length === 1 ? '' : 's'}. Player pool ready.`
      )
    } catch (caughtError) {
      setErrors((current) => [
        ...current,
        `Player pool: ${readError(caughtError)}`,
      ])
      setStatus(
        `Loaded ${loadedLeagues.length} dashboard${loadedLeagues.length === 1 ? '' : 's'} without player metadata.`
      )
    }
  }

  return (
    <main className="app-shell">
      <TopBar
        activeDashboardId={activeLeague?.league.id ?? ''}
        leagueIds={configuredLeagueIds}
        leagues={leagues}
        weekLabel={formatNflWeekLabel(nflState)}
        status={status}
        onActiveDashboardChange={setActiveDashboardId}
      />
      {errors.map((error) => (
        <p className="error" key={error}>
          {error}
        </p>
      ))}

      {activeLeague ? (
        <LeagueDashboard
          data={activeLeague}
          draftSyncStatus={activeDraftSyncStatus}
          minimizedModules={minimizedModules}
          onRefreshDraftStatus={
            activeLeagueId && activeDraftId
              ? () => void refreshDraftStatus(activeLeagueId, activeDraftId)
              : undefined
          }
          onToggleModule={(moduleId) =>
            setMinimizedModules((current) => ({
              ...current,
              [moduleId]: !current[moduleId],
            }))
          }
        />
      ) : (
        <EmptyState />
      )}
    </main>
  )
}

function formatNflWeekLabel(nflState: NflState | undefined): string {
  if (!nflState) {
    return 'Week TBD'
  }

  const week = nflState.displayWeek ?? nflState.week

  if (nflState.seasonType === 'pre') {
    return `Preseason Week ${week}`
  }

  if (nflState.seasonType === 'post') {
    return `Postseason Week ${week}`
  }

  return `Week ${week}`
}

function removeDraftSyncStatus(
  statuses: Record<string, DraftSyncStatus>,
  leagueId: string
): Record<string, DraftSyncStatus> {
  if (!statuses[leagueId]) {
    return statuses
  }

  const nextStatuses = { ...statuses }
  delete nextStatuses[leagueId]

  return nextStatuses
}

async function enrichPlayersWithScheduleByeWeeks(
  players: Player[]
): Promise<{ players: Player[]; warning?: string }> {
  try {
    const teamByeWeeks = await loadNflTeamByeWeeks(fantasyConfig.season)

    return {
      players: players.map((player) => {
        const byeWeek =
          player.byeWeek ??
          (player.team ? teamByeWeeks[player.team] : undefined)

        return byeWeek ? { ...player, byeWeek } : player
      }),
    }
  } catch (caughtError) {
    return {
      players,
      warning: `Bye-week schedule: ${readError(caughtError)}`,
    }
  }
}

function readError(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error'
}
