import { useEffect, useRef } from 'react'
import { sortDraftPicks } from '../../domain/draftPickUtils'
import type { DraftPick, Player } from '../../domain/types'
import {
  DraftPickReferenceTile,
  type DraftPickReferenceTileTone,
} from '../player/DraftPickReferenceTile'

export function PickList({
  autoScrollToEnd = false,
  picks,
  players = [],
  tileDensity = 'default',
  title,
  tone = 'pick',
}: {
  autoScrollToEnd?: boolean
  picks: DraftPick[]
  players?: Player[]
  tileDensity?: 'default' | 'compact'
  title: string
  tone?: DraftPickReferenceTileTone
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const sortedPicks = sortDraftPicks(picks)
  const playersById = new Map(players.map((player) => [player.id, player]))

  useEffect(() => {
    if (!autoScrollToEnd || !listRef.current) {
      return
    }

    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [autoScrollToEnd, sortedPicks.length])

  return (
    <div>
      <h3>{title}</h3>
      <div
        className={
          autoScrollToEnd ? 'pick-list compact scrollable' : 'pick-list compact'
        }
        ref={listRef}
      >
        {sortedPicks.length ? (
          sortedPicks.map((pick) => (
            <DraftPickReferenceTile
              density={tileDensity}
              key={`${title}-${pick.pickNo}`}
              pick={pick}
              player={
                pick.playerId ? playersById.get(pick.playerId) : undefined
              }
              tone={tone}
            />
          ))
        ) : (
          <p>No picks yet.</p>
        )}
      </div>
    </div>
  )
}
