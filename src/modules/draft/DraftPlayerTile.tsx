import { useEffect, useRef, useState } from 'react'
import { formatComponentScore } from './draftFormatting'
import { RecommendationDetails } from './RecommendationDetails'
import { getSleeperPlayerImageUrl } from '../../components/player/playerAssets'
import { PlayerReferenceTile } from '../../components/player/PlayerReferenceTile'
import type { DraftRecommendation } from '../../domain/types'

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
  const [isWhyOpen, setIsWhyOpen] = useState(false)
  const hoverOpenTimer = useRef<number | undefined>(undefined)
  const ignoreScrollUntil = useRef(0)
  const tileRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isWhyOpen) {
      return
    }

    const scrollContainer = tileRef.current?.closest('.draft-position-column')
    const closeOnScroll = () => {
      if (Date.now() < ignoreScrollUntil.current) {
        return
      }

      onScrollCooldown()
      closeRecommendationDetails()
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
    if (!isWhyOpen) {
      return
    }

    ignoreScrollUntil.current = Date.now() + 200
    requestAnimationFrame(() => {
      tileRef.current?.scrollIntoView({ block: 'nearest' })
    })
  }, [isWhyOpen])

  function openRecommendationDetails() {
    window.clearTimeout(hoverOpenTimer.current)

    if (isTileUnderColumnHeader(tileRef.current)) {
      setIsWhyOpen(false)
      return
    }

    const cooldownRemaining = hoverCooldownRef.current - Date.now()

    if (cooldownRemaining > 0) {
      hoverOpenTimer.current = window.setTimeout(() => {
        if (
          !isTileUnderColumnHeader(tileRef.current) &&
          (tileRef.current?.matches(':hover') ||
            document.activeElement === tileRef.current)
        ) {
          setIsWhyOpen(true)
        }
      }, cooldownRemaining)
      return
    }

    setIsWhyOpen(true)
  }

  function closeRecommendationDetails() {
    window.clearTimeout(hoverOpenTimer.current)
    setIsWhyOpen(false)
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
          setIsWhyOpen(false)
        }
      }}
      onFocus={openRecommendationDetails}
      onMouseEnter={openRecommendationDetails}
      onMouseLeave={closeRecommendationDetails}
      onMouseMove={openRecommendationDetails}
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
