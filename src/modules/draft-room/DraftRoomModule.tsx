import { useCallback, useRef } from 'react'
import { BestAvailableStrip } from './BestAvailableStrip'
import { formatDraftStatus } from './formatting'
import { PickList } from './PickList'
import { PositionColumn } from './PositionColumn'
import {
  getVisiblePositions,
  groupRecommendationsByPosition,
} from './positionUtils'
import './draftRoom.css'
import { StatusChip } from './StatusChip'
import { dashboardModuleLabels } from '../../components/dashboard/dashboardTypes'
import { ModuleTrimToggle } from '../../components/dashboard/ModuleTrimToggle'
import {
  formatDraftBoardMode,
  formatLeagueDraftMode,
} from '../../domain/draftBoardMode'
import type {
  DraftBoardMode,
  LeagueDraftMode,
} from '../../domain/draftBoardMode'
import { getDraftPicksForRoster } from '../../domain/draftPickUtils'
import type { DraftSyncStatus } from '../../domain/draftSync'
import type {
  DraftRecommendation,
  NormalizedLeagueData,
} from '../../domain/types'

const HOVER_DETAIL_SCROLL_COOLDOWN_MS = 250

export interface DraftRoomModuleProps {
  boardMode: DraftBoardMode
  data: NormalizedLeagueData
  draftMode: LeagueDraftMode
  draftSyncStatus?: DraftSyncStatus
  isMinimized: boolean
  onRefreshDraftStatus?: () => void
  onToggleMinimized: () => void
  recommendations: DraftRecommendation[]
  selectedTeamId: string
}

export function DraftRoomModule({
  boardMode,
  data,
  draftMode,
  draftSyncStatus,
  isMinimized,
  onRefreshDraftStatus,
  onToggleMinimized,
  recommendations,
  selectedTeamId,
}: DraftRoomModuleProps) {
  const hoverDetailsSuppressedUntil = useRef(0)
  const recommendationsByPosition =
    groupRecommendationsByPosition(recommendations)
  const visiblePositions = getVisiblePositions(
    recommendationsByPosition,
    data.league.settings
  )
  const picks = data.draft?.picks ?? []
  const myPicks = getDraftPicksForRoster(picks, selectedTeamId)
  const availablePlayerCount = recommendations.length
  const canRefreshDraftStatus =
    data.draft?.status !== 'complete' && Boolean(onRefreshDraftStatus)
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
        moduleName={dashboardModuleLabels.draftRoom}
        onToggle={onToggleMinimized}
      />
      <div className="panel-header">
        <div className="draft-room-intro">
          <div className="draft-room-heading">
            <h2>{dashboardModuleLabels.draftRoom}</h2>
            <div className="draft-room-status">
              <StatusChip
                label="Phase"
                disabled={draftSyncStatus?.state === 'syncing'}
                onClick={
                  canRefreshDraftStatus ? onRefreshDraftStatus : undefined
                }
                title={
                  canRefreshDraftStatus
                    ? 'Check Sleeper draft status'
                    : undefined
                }
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
            <p className="draft-room-subtitle">
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
              headerAccessory={
                draftSyncStatus ? (
                  <StatusChip
                    label="Sync"
                    value={formatDraftSyncStatus(draftSyncStatus)}
                  />
                ) : null
              }
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
                <PositionColumn
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

function formatDraftSyncStatus(status: DraftSyncStatus): string {
  if (status.state === 'syncing') {
    return 'Refreshing'
  }

  if (status.state === 'error') {
    return 'Sync failed'
  }

  if (status.lastUpdatedAt) {
    return `Updated ${new Date(status.lastUpdatedAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })}`
  }

  return 'Live'
}
