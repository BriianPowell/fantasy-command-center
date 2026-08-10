import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  loadActiveDashboardId,
  loadMinimizedModules,
  saveActiveDashboardId,
  saveMinimizedModules,
} from './dashboardPreferences'
import { defaultMinimizedModules } from '../components/dashboard/dashboardTypes'

describe('dashboard preferences', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store.set(key, value)
        }),
      },
    })
  })

  it('loads valid active dashboard and minimized module state', () => {
    saveActiveDashboardId('league-1')
    saveMinimizedModules({
      draftRoom: true,
      lockerRoom: false,
    })

    expect(loadActiveDashboardId(['league-1', 'league-2'])).toBe('league-1')
    expect(loadMinimizedModules()).toEqual({
      draftRoom: true,
      lockerRoom: false,
    })
  })

  it('falls back when the persisted active dashboard ID is stale', () => {
    saveActiveDashboardId('removed-league')

    expect(loadActiveDashboardId(['league-1'])).toBe('')
  })

  it('falls back when minimized module state has an invalid shape', () => {
    window.localStorage.setItem(
      'fcc:v1:minimized-modules',
      JSON.stringify({ draftRoom: 'yes', lockerRoom: false })
    )

    expect(loadMinimizedModules()).toEqual(defaultMinimizedModules)
  })

  it('merges missing minimized module keys with defaults', () => {
    window.localStorage.setItem(
      'fcc:v1:minimized-modules',
      JSON.stringify({ draftRoom: true })
    )

    expect(loadMinimizedModules()).toEqual({
      ...defaultMinimizedModules,
      draftRoom: true,
    })
  })
})
