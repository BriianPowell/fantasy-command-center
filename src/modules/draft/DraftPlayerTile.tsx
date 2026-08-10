import { useEffect, useRef, useState } from 'react'
import { formatComponentScore } from './draftFormatting'
import { RecommendationDetails } from './RecommendationDetails'
import { getSleeperPlayerImageUrl } from '../../components/player/playerAssets'
import { PlayerReferenceTile } from '../../components/player/PlayerReferenceTile'
import {
  formatInjurySummary,
  getInjuryRiskToneClass,
} from '../../domain/injuryStatus'
import type { DraftRecommendation } from '../../domain/types'

const HOVER_OPEN_DELAY_MS = 160
const HOVER_CLOSE_DELAY_MS = 100

interface DraftPlayerTileProps {
  hoverCooldownRef: { current: number }
  onScrollCooldown: () => void
  rank: number
  recommendation: DraftRecommendation
}

export function DraftPlayerTile({
  hoverCooldownRef,
  onScrollCooldown,
  rank,
  recommendation,
}: DraftPlayerTileProps) {
  const { player } = recommendation
  const injurySummaryLabel = formatInjurySummary(player)
  const injuryToneClass = getInjuryRiskToneClass(player)
  const [isWhyOpen, setIsWhyOpen] = useState(false)
  const hoverCloseTimer = useRef<number | undefined>(undefined)
  const hoverOpenTimer = useRef<number | undefined>(undefined)
  const tileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isWhyOpen) {
      return
    }

    const scrollContainer = tileRef.current?.closest('.draft-position-column')
    const closeOnScroll = () => {
      onScrollCooldown()
      closeRecommendationDetails({ immediate: true })
    }

    scrollContainer?.addEventListener('scroll', closeOnScroll, {
      passive: true,
    })
    window.addEventListener('scroll', closeOnScroll, { passive: true })

    return () => {
      scrollContainer?.removeEventListener('scroll', closeOnScroll)
      window.removeEventListener('scroll', closeOnScroll)
    }
  }, [isWhyOpen, onScrollCooldown])

  useEffect(() => {
    return () => {
      window.clearTimeout(hoverCloseTimer.current)
      window.clearTimeout(hoverOpenTimer.current)
    }
  }, [])

  function openRecommendationDetails({ immediate = false } = {}) {
    window.clearTimeout(hoverCloseTimer.current)
    window.clearTimeout(hoverOpenTimer.current)

    if (isTileUnderColumnHeader(tileRef.current)) {
      setIsWhyOpen(false)
      return
    }

    const cooldownRemaining = hoverCooldownRef.current - Date.now()
    const openDelay = immediate
      ? Math.max(cooldownRemaining, 0)
      : Math.max(cooldownRemaining, HOVER_OPEN_DELAY_MS)

    if (openDelay > 0) {
      hoverOpenTimer.current = window.setTimeout(() => {
        if (
          !isTileUnderColumnHeader(tileRef.current) &&
          (tileRef.current?.matches(':hover') ||
            document.activeElement === tileRef.current)
        ) {
          setIsWhyOpen(true)
        }
      }, openDelay)
      return
    }

    setIsWhyOpen(true)
  }

  function closeRecommendationDetails({ immediate = false } = {}) {
    window.clearTimeout(hoverOpenTimer.current)

    if (immediate) {
      window.clearTimeout(hoverCloseTimer.current)
      setIsWhyOpen(false)
      return
    }

    hoverCloseTimer.current = window.setTimeout(() => {
      setIsWhyOpen(false)
    }, HOVER_CLOSE_DELAY_MS)
  }

  return (
    <PlayerReferenceTile
      avatarUrl={getSleeperPlayerImageUrl(player)}
      className={
        isWhyOpen ? 'draft-player-tile is-popover-open' : 'draft-player-tile'
      }
      leadingLabel={rank}
      meta={[
        player.team ?? 'FA',
        ...(player.byeWeek ? [`Bye ${player.byeWeek}`] : []),
        ...(injurySummaryLabel
          ? [
              <span className={`player-injury-chip ${injuryToneClass}`}>
                {injurySummaryLabel}
              </span>,
            ]
          : []),
        ...(recommendation.valueTier
          ? [`Tier ${recommendation.valueTier}`]
          : []),
        recommendation.suggestion,
        `Value ${formatComponentScore(recommendation.valueScore)}`,
      ]}
      onBlur={(event) => {
        if (
          !(event.relatedTarget instanceof Node) ||
          !event.currentTarget.contains(event.relatedTarget)
        ) {
          closeRecommendationDetails({ immediate: true })
        }
      }}
      onFocus={() => openRecommendationDetails({ immediate: true })}
      onMouseEnter={() => openRecommendationDetails()}
      onMouseLeave={() => closeRecommendationDetails()}
      ref={tileRef}
      tabIndex={0}
      playerName={player.fullName}
      trailingLabel={recommendation.score}
    >
      {isWhyOpen ? (
        <RecommendationDetails recommendation={recommendation} />
      ) : null}
    </PlayerReferenceTile>
  )
}

function isTileUnderColumnHeader(tile: HTMLDivElement | null): boolean {
  if (!tile) {
    return false
  }

  const column = tile.closest('.draft-position-column')
  const header = column?.querySelector('.draft-position-header')

  if (!header) {
    return false
  }

  return (
    tile.getBoundingClientRect().top < header.getBoundingClientRect().bottom
  )
}
