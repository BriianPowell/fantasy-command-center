export function formatComponentScore(score: number): string {
  const roundedScore = Math.round(score)

  return roundedScore > 0 ? `+${roundedScore}` : String(roundedScore)
}

export function formatByeWeek(byeWeek: number | undefined): string {
  return byeWeek ? String(byeWeek) : 'TBD'
}

export function formatDraftStatus(status: string | undefined): string {
  if (!status) {
    return 'No draft'
  }

  return status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}
