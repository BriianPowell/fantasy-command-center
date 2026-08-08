import type { DraftState, Player } from './types'

export type DraftBoardMode = 'full_pool' | 'rookies_only'
export type LeagueDraftMode = 'dynasty' | 'redraft' | 'rookieDraft'

export interface DraftBoardContext {
  boardMode: DraftBoardMode
  draftMode: LeagueDraftMode
}

export interface LeagueDraftModeConfig {
  activeDraft?: LeagueDraftMode
  season?: LeagueDraftMode
}

export const defaultDraftBoardMode: DraftBoardMode = 'full_pool'
export const defaultLeagueDraftMode: LeagueDraftMode = 'redraft'

export function resolveDraftBoardContext(
  draftStatus: DraftState['status'] | undefined,
  config: LeagueDraftModeConfig | undefined
): DraftBoardContext {
  const draftMode = resolveLeagueDraftMode(draftStatus, config)

  return {
    boardMode: getBoardModeForDraftMode(draftMode),
    draftMode,
  }
}

export function resolveDraftBoardMode(
  draftStatus: DraftState['status'] | undefined,
  config: LeagueDraftModeConfig | undefined
): DraftBoardMode {
  return resolveDraftBoardContext(draftStatus, config).boardMode
}

export function resolveLeagueDraftMode(
  draftStatus: DraftState['status'] | undefined,
  config: LeagueDraftModeConfig | undefined
): LeagueDraftMode {
  const isDraftWindow =
    draftStatus === 'pre_draft' || draftStatus === 'drafting'

  return isDraftWindow
    ? (config?.activeDraft ?? defaultLeagueDraftMode)
    : (config?.season ?? defaultLeagueDraftMode)
}

export function shouldIncludePlayerInDraftBoard(
  player: Player,
  boardMode: DraftBoardMode
): boolean {
  return boardMode === 'full_pool' || player.yearsExperience === 0
}

export function formatDraftBoardMode(boardMode: DraftBoardMode): string {
  return boardMode === 'rookies_only' ? 'Rookies' : 'Full pool'
}

export function formatLeagueDraftMode(draftMode: LeagueDraftMode): string {
  return draftMode === 'rookieDraft'
    ? 'Rookie draft'
    : draftMode === 'dynasty'
      ? 'Dynasty'
      : 'Redraft'
}

function getBoardModeForDraftMode(draftMode: LeagueDraftMode): DraftBoardMode {
  return draftMode === 'rookieDraft' ? 'rookies_only' : defaultDraftBoardMode
}
