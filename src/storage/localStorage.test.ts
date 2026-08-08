import { beforeEach, describe, expect, it, vi } from 'vitest'
import { loadJson, saveJson } from './localStorage'

describe('localStorage JSON helpers', () => {
  let store: Map<string, string>

  beforeEach(() => {
    store = new Map()
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: {
        clear: vi.fn(() => store.clear()),
        getItem: vi.fn((key: string) => store.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => {
          store.set(key, value)
        }),
      },
    })
  })

  it('saves and loads JSON values', () => {
    saveJson('settings', { draftRoom: false, teamTracker: true })

    expect(loadJson('settings', {})).toEqual({
      draftRoom: false,
      teamTracker: true,
    })
  })

  it('returns the fallback when the key is missing', () => {
    expect(loadJson('missing', 'fallback')).toBe('fallback')
  })

  it('returns the fallback when stored JSON is invalid', () => {
    window.localStorage.setItem('broken', '{')

    expect(loadJson('broken', { safe: true })).toEqual({ safe: true })
  })

  it('returns validated parsed values', () => {
    saveJson('count', 3)

    expect(
      loadJson('count', 0, (value) =>
        typeof value === 'number' ? value : undefined
      )
    ).toBe(3)
  })

  it('returns the fallback when parsed values fail validation', () => {
    saveJson('count', 'three')

    expect(
      loadJson('count', 0, (value) =>
        typeof value === 'number' ? value : undefined
      )
    ).toBe(0)
  })
})
