import { forwardRef, type HTMLAttributes, type ReactNode } from 'react'
import './playerReference.css'

export interface PlayerReferenceTileProps extends HTMLAttributes<HTMLDivElement> {
  avatarUrl?: string
  leadingLabel: ReactNode
  meta: ReactNode[]
  playerName: ReactNode
  trailingLabel?: ReactNode
  variant?: 'default' | 'compact' | 'embedded'
}

export const PlayerReferenceTile = forwardRef<
  HTMLDivElement,
  PlayerReferenceTileProps
>(function PlayerReferenceTile(
  {
    avatarUrl,
    children,
    className,
    leadingLabel,
    meta,
    playerName,
    trailingLabel,
    variant = 'default',
    ...props
  },
  ref
) {
  const classes = [
    'player-reference-tile',
    variant !== 'default' ? variant : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className={classes} ref={ref} {...props}>
      <div className="player-reference-main">
        <span className="player-reference-leading">{leadingLabel}</span>
        {avatarUrl ? (
          <img
            alt=""
            className="player-reference-avatar"
            loading="lazy"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
            }}
            src={avatarUrl}
          />
        ) : null}
        <div className="player-reference-body">
          <strong>{playerName}</strong>
          <div className="player-reference-meta">
            {meta.map((item, index) => (
              <span key={index}>{item}</span>
            ))}
          </div>
        </div>
        {trailingLabel ? (
          <strong className="player-reference-trailing">{trailingLabel}</strong>
        ) : null}
      </div>
      {children}
    </div>
  )
})
