export function StatusChip({
  disabled = false,
  label,
  onClick,
  title,
  value,
  accent = false,
}: {
  disabled?: boolean
  label: string
  onClick?: () => void
  title?: string
  value: string
  accent?: boolean
}) {
  const className = accent ? 'status-chip accent' : 'status-chip'
  const content = (
    <>
      <span className="status-chip-label">{label}</span>
      <strong className="status-chip-value">{value}</strong>
    </>
  )

  if (onClick) {
    return (
      <button
        className={className}
        disabled={disabled}
        onClick={onClick}
        title={title}
        type="button"
      >
        {content}
      </button>
    )
  }

  return (
    <span className={className} title={title}>
      {content}
    </span>
  )
}
