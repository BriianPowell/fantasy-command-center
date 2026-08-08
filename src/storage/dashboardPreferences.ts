import { loadJson, saveJson } from './localStorage'
import {
  type DashboardModuleId,
  defaultMinimizedModules,
} from '../components/dashboard/dashboardTypes'

const ACTIVE_DASHBOARD_ID_KEY = 'fcc:v1:active-dashboard-id'
const MINIMIZED_MODULES_KEY = 'fcc:v1:minimized-modules'
const dashboardModuleIds = Object.keys(
  defaultMinimizedModules
) as DashboardModuleId[]

export function loadActiveDashboardId(configuredLeagueIds: string[]): string {
  return loadJson(ACTIVE_DASHBOARD_ID_KEY, '', (value) =>
    parseActiveDashboardId(value, configuredLeagueIds)
  )
}

export function saveActiveDashboardId(activeDashboardId: string): void {
  saveJson(ACTIVE_DASHBOARD_ID_KEY, activeDashboardId)
}

export function loadMinimizedModules(): Record<DashboardModuleId, boolean> {
  return loadJson(
    MINIMIZED_MODULES_KEY,
    defaultMinimizedModules,
    parseMinimizedModules
  )
}

export function saveMinimizedModules(
  minimizedModules: Record<DashboardModuleId, boolean>
): void {
  saveJson(MINIMIZED_MODULES_KEY, minimizedModules)
}

function parseActiveDashboardId(
  value: unknown,
  configuredLeagueIds: string[]
): string | undefined {
  if (value === '') {
    return ''
  }

  if (typeof value !== 'string') {
    return undefined
  }

  return configuredLeagueIds.includes(value) ? value : undefined
}

function parseMinimizedModules(
  value: unknown
): Record<DashboardModuleId, boolean> | undefined {
  if (!isRecord(value)) {
    return undefined
  }

  const minimizedModules = { ...defaultMinimizedModules }

  for (const moduleId of dashboardModuleIds) {
    const persistedValue = value[moduleId]

    if (persistedValue === undefined) {
      continue
    }

    if (typeof persistedValue !== 'boolean') {
      return undefined
    }

    minimizedModules[moduleId] = persistedValue
  }

  return minimizedModules
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}
