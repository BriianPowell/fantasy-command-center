import { describe, expect, it } from 'vitest'
import {
  formatDraftBoardMode,
  formatLeagueDraftMode,
  resolveDraftBoardContext,
  resolveDraftBoardMode,
  resolveLeagueDraftMode,
  shouldIncludePlayerInDraftBoard,
} from './draftBoardMode'
import type { Player } from './types'

const rookie: Player = {
  fullName: 'Rookie Player',
  id: 'rookie',
  positions: ['RB'],
  providerPlayerId: 'rookie',
  yearsExperience: 0,
}

const veteran: Player = {
  ...rookie,
  fullName: 'Veteran Player',
  id: 'veteran',
  providerPlayerId: 'veteran',
  yearsExperience: 3,
}

describe('resolveDraftBoardMode', () => {
  it('uses active draft mode only while a draft is upcoming or active', () => {
    const config = {
      activeDraft: 'rookieDraft' as const,
      season: 'dynasty' as const,
    }

    expect(resolveDraftBoardMode('pre_draft', config)).toBe('rookies_only')
    expect(resolveDraftBoardMode('drafting', config)).toBe('rookies_only')
    expect(resolveDraftBoardMode('complete', config)).toBe('full_pool')
    expect(resolveDraftBoardMode(undefined, config)).toBe('full_pool')
  })

  it('defaults to the full pool without league-specific config', () => {
    expect(resolveDraftBoardMode('drafting', undefined)).toBe('full_pool')
  })
})

describe('resolveLeagueDraftMode', () => {
  it('resolves explicit redraft, dynasty, and rookie draft modes by draft window', () => {
    const config = {
      activeDraft: 'rookieDraft' as const,
      season: 'dynasty' as const,
    }

    expect(resolveLeagueDraftMode('drafting', config)).toBe('rookieDraft')
    expect(resolveLeagueDraftMode('complete', config)).toBe('dynasty')
    expect(resolveLeagueDraftMode(undefined, { season: 'redraft' })).toBe(
      'redraft'
    )
  })
})

describe('resolveDraftBoardContext', () => {
  it('derives board filters from explicit league draft modes', () => {
    expect(
      resolveDraftBoardContext('drafting', {
        activeDraft: 'rookieDraft',
        season: 'dynasty',
      })
    ).toEqual({
      boardMode: 'rookies_only',
      draftMode: 'rookieDraft',
    })
    expect(
      resolveDraftBoardContext('complete', {
        activeDraft: 'rookieDraft',
        season: 'dynasty',
      })
    ).toEqual({
      boardMode: 'full_pool',
      draftMode: 'dynasty',
    })
  })
})

describe('shouldIncludePlayerInDraftBoard', () => {
  it('includes every player in full-pool mode', () => {
    expect(shouldIncludePlayerInDraftBoard(rookie, 'full_pool')).toBe(true)
    expect(shouldIncludePlayerInDraftBoard(veteran, 'full_pool')).toBe(true)
  })

  it('limits rookie-only mode to players with zero years of experience', () => {
    expect(shouldIncludePlayerInDraftBoard(rookie, 'rookies_only')).toBe(true)
    expect(shouldIncludePlayerInDraftBoard(veteran, 'rookies_only')).toBe(false)
  })
})

describe('formatDraftBoardMode', () => {
  it('formats board mode labels for Draft Room status chips', () => {
    expect(formatDraftBoardMode('full_pool')).toBe('Full pool')
    expect(formatDraftBoardMode('rookies_only')).toBe('Rookies')
  })
})

describe('formatLeagueDraftMode', () => {
  it('formats league draft mode labels for Draft Room status chips', () => {
    expect(formatLeagueDraftMode('redraft')).toBe('Redraft')
    expect(formatLeagueDraftMode('dynasty')).toBe('Dynasty')
    expect(formatLeagueDraftMode('rookieDraft')).toBe('Rookie draft')
  })
})
