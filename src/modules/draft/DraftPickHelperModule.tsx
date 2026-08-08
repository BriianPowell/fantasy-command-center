import { useCallback, useRef } from 'react'
import { BestAvailableStrip } from './BestAvailableStrip'
import { formatDraftStatus } from './draftFormatting'
import { DraftPositionColumn } from './DraftPositionColumn'
import {
  getVisiblePositions,
  groupRecommendationsByPosition,
} from './draftPositionUtils'
import './draftRoom.css'
import { StatusChip } from './StatusChip'
import { ModuleTrimToggle } from '../../components/dashboard/ModuleTrimToggle'
import { PickList } from '../../components/dashboard/PickList'
import {
  formatDraftBoardMode,
  formatLeagueDraftMode,
} from '../../domain/draftBoardMode'
import type {
  DraftBoardMode,
  LeagueDraftMode,
} from '../../domain/draftBoardMode'
import type {
  DraftRecommendation,
  NormalizedLeagueData,
} from '../../domain/types'

const HOVER_DETAIL_SCROLL_COOLDOWN_MS = 250

export interface DraftPickHelperModuleProps {
  boardMode: DraftBoardMode
  data: NormalizedLeagueData
  draftMode: LeagueDraftMode
  isMinimized: boolean
  onToggleMinimized: () => void
  recommendations: DraftRecommendation[]
  selectedTeamId: string
}

export function DraftPickHelperModule({
  boardMode,
  data,
  draftMode,
  isMinimized,
  onToggleMinimized,
  recommendations,
  selectedTeamId,
}: DraftPickHelperModuleProps) {
  const hoverDetailsSuppressedUntil = useRef(0)
  const recommendationsByPosition =
    groupRecommendationsByPosition(recommendations)
  const visiblePositions = getVisiblePositions(recommendationsByPosition)
  const picks = data.draft?.picks ?? []
  const myPicks = picks.filter((pick) => pick.rosterId === selectedTeamId)
  const availablePlayerCount = recommendations.length
  const bestAvailable = [...recommendations]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
  const suppressHoverDetailsAfterScroll = useCallback(() => {
    hoverDetailsSuppressedUntil.current =
      Date.now() + HOVER_DETAIL_SCROLL_COOLDOWN_MS
  }, [])

  return (
    <section
      className={
        isMinimized
          ? 'panel module-panel module-is-minimized'
          : 'panel module-panel'
      }
    >
      <ModuleTrimToggle
        isMinimized={isMinimized}
        moduleName="Draft Room"
        onToggle={onToggleMinimized}
      />
      <div className="panel-header">
        <div className="draft-room-intro">
          <div className="draft-room-heading">
            <h2>Draft Room</h2>
            <div className="draft-room-status">
              <StatusChip
                label="Phase"
                value={formatDraftStatus(data.draft?.status)}
              />
              <StatusChip
                label="Mode"
                value={formatLeagueDraftMode(draftMode)}
              />
              <StatusChip
                label="Board"
                value={formatDraftBoardMode(boardMode)}
              />
              <StatusChip label="Picks" value={String(picks.length)} />
              <StatusChip label="Your picks" value={String(myPicks.length)} />
              <StatusChip
                label="Board pool"
                value={availablePlayerCount.toLocaleString()}
              />
            </div>
            <p className="draft-room-helper">
              Hover a player tile for full recommendation details.
            </p>
          </div>

          {!isMinimized ? (
            <BestAvailableStrip recommendations={bestAvailable} />
          ) : null}
        </div>

        {!isMinimized ? (
          <aside className="draft-latest-picks">
            <PickList
              autoScrollToEnd
              title="Latest Picks"
              picks={picks}
              players={data.players}
              tileDensity="compact"
              tone="roster"
            />
          </aside>
        ) : null}
      </div>

      {!isMinimized ? (
        <div className="draft-room-layout">
          <div
            className="draft-board-scroll"
            aria-label="Draft recommendations by position"
          >
            <div className="draft-board-grid">
              {visiblePositions.map((position) => (
                <DraftPositionColumn
                  hoverCooldownRef={hoverDetailsSuppressedUntil}
                  key={position}
                  onScrollCooldown={suppressHoverDetailsAfterScroll}
                  position={position}
                  recommendations={
                    recommendationsByPosition.get(position) ?? []
                  }
                />
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
