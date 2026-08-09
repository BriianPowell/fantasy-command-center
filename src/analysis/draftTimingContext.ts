import type { DraftState, LeagueSettings } from '../domain/types'

export interface DraftTimingContext {
  picksUntilNextPick?: number
}

export type TierUrgency = 'take_now' | 'safe_to_wait'

export interface TierUrgencyInput extends DraftTimingContext {
  dropOffAfter?: number
  tierPlayersRemaining: number
}

export function getDraftTimingContext({
  draft,
  leagueSettings,
  selectedTeamId,
}: {
  draft?: DraftState
  leagueSettings: LeagueSettings
  selectedTeamId?: string
}): DraftTimingContext {
  if (!draft || !selectedTeamId) {
    return {}
  }

  const picksUntilNextPick = getPicksUntilNextSelection({
    draft,
    selectedTeamId,
    teams: leagueSettings.teams,
  })

  return picksUntilNextPick !== undefined ? { picksUntilNextPick } : {}
}

export function getTierUrgency(
  context: TierUrgencyInput
): TierUrgency | undefined {
  if (context.picksUntilNextPick === undefined) {
    return undefined
  }

  const tierCanRunOut =
    context.tierPlayersRemaining <= context.picksUntilNextPick + 1

  if (
    tierCanRunOut &&
    context.dropOffAfter !== undefined &&
    context.dropOffAfter >= 8
  ) {
    return 'take_now'
  }

  if (context.tierPlayersRemaining >= context.picksUntilNextPick + 3) {
    return 'safe_to_wait'
  }

  return undefined
}

function getPicksUntilNextSelection({
  draft,
  selectedTeamId,
  teams,
}: {
  draft: DraftState
  selectedTeamId: string
  teams: number
}): number | undefined {
  const selectedTeamPick = draft.picks.find(
    (pick) => pick.rosterId === selectedTeamId
  )

  if (!selectedTeamPick || teams <= 0) {
    return undefined
  }

  const selectedDraftSlot = getDraftSlotForPick({
    pickNo: selectedTeamPick.pickNo,
    round: selectedTeamPick.round,
    teams,
    type: draft.type,
  })
  const currentPick = draft.currentPick ?? draft.picks.length + 1
  const finalPick = draft.rounds * teams

  for (let pickNo = currentPick; pickNo <= finalPick; pickNo += 1) {
    const round = Math.ceil(pickNo / teams)
    const draftSlot = getDraftSlotForPick({
      pickNo,
      round,
      teams,
      type: draft.type,
    })

    if (draftSlot === selectedDraftSlot && pickNo !== currentPick) {
      return pickNo - currentPick
    }
  }

  return undefined
}

function getDraftSlotForPick({
  pickNo,
  round,
  teams,
  type,
}: {
  pickNo: number
  round: number
  teams: number
  type: DraftState['type']
}): number {
  const pickInRound = ((pickNo - 1) % teams) + 1

  return type === 'snake' && round % 2 === 0
    ? teams - pickInRound + 1
    : pickInRound
}
