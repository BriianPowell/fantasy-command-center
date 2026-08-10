const INJURY_STATUS_LABELS: Record<string, string> = {
  doubtful: 'Doubtful',
  ir: 'IR',
  nfi: 'NFI',
  out: 'Out',
  probable: 'Probable',
  pup: 'PUP',
  questionable: 'Questionable',
}

export interface InjuryDetailInput {
  injuryBodyPart?: string
  injuryNotes?: string
  injuryStartDate?: string
  injuryStatus?: string
}

export interface InjuryInsightLines {
  injury: string
  sleeperNote?: string
}

export type InjuryRiskTone = 'danger' | 'warning' | 'watch'

export function formatInjuryStatus(
  injuryStatus: string | undefined
): string | undefined {
  if (!injuryStatus) {
    return undefined
  }

  const normalizedStatus = normalizeInjuryStatus(injuryStatus)

  return (
    INJURY_STATUS_LABELS[normalizedStatus] ??
    injuryStatus
      .split(/[_\s-]+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  )
}

export function scoreInjuryRisk(injuryStatus: string | undefined): number {
  const normalizedStatus = normalizeInjuryStatus(injuryStatus)

  if (!normalizedStatus || normalizedStatus === 'probable') {
    return 0
  }

  if (normalizedStatus === 'questionable') {
    return 3
  }

  if (normalizedStatus === 'doubtful') {
    return 8
  }

  if (['out', 'ir', 'pup', 'nfi'].includes(normalizedStatus)) {
    return 12
  }

  return 2
}

export function scorePlayerInjuryRisk(player: InjuryDetailInput): number {
  const statusRisk = scoreInjuryRisk(player.injuryStatus)

  if (statusRisk > 0) {
    return statusRisk
  }

  if (player.injuryNotes) {
    return 3
  }

  if (player.injuryBodyPart || player.injuryStartDate) {
    return 2
  }

  return 0
}

export function formatInjuryRiskNote(
  injuryStatus: string | undefined
): string | undefined {
  const formattedStatus = formatInjuryStatus(injuryStatus)

  return formattedStatus ? `Injury: ${formattedStatus}` : undefined
}

export function formatPlayerInjuryRiskNote(
  player: InjuryDetailInput
): string | undefined {
  const statusNote = formatInjuryRiskNote(player.injuryStatus)

  if (statusNote) {
    return statusNote
  }

  if (player.injuryBodyPart) {
    return `Injury: ${player.injuryBodyPart}`
  }

  if (player.injuryNotes) {
    return `Injury: ${truncateInjuryNotes(player.injuryNotes)}`
  }

  if (player.injuryStartDate) {
    return `Injury since ${player.injuryStartDate}`
  }

  return undefined
}

export function formatInjurySummary(
  player: InjuryDetailInput
): string | undefined {
  return (
    formatInjuryStatus(player.injuryStatus) ??
    formatPlayerInjuryRiskNote(player)
  )
}

export function getInjuryRiskTone(
  player: InjuryDetailInput
): InjuryRiskTone | undefined {
  const normalizedStatus = normalizeInjuryStatus(player.injuryStatus)

  if (['out', 'ir', 'pup', 'nfi'].includes(normalizedStatus)) {
    return 'danger'
  }

  if (normalizedStatus === 'doubtful') {
    return 'warning'
  }

  if (
    normalizedStatus === 'questionable' ||
    player.injuryBodyPart ||
    player.injuryNotes ||
    player.injuryStartDate
  ) {
    return 'watch'
  }

  if (normalizedStatus && normalizedStatus !== 'probable') {
    return 'warning'
  }

  return undefined
}

export function getInjuryRiskToneClass(player: InjuryDetailInput): string {
  const tone = getInjuryRiskTone(player)

  return tone ? `injury-tone-${tone}` : ''
}

export function buildInjuryDetailLabels(player: InjuryDetailInput): string[] {
  const labels: string[] = []

  if (player.injuryBodyPart) {
    labels.push(player.injuryBodyPart)
  }

  if (player.injuryStartDate) {
    labels.push(`Since ${player.injuryStartDate}`)
  }

  if (player.injuryNotes) {
    labels.push(truncateInjuryNotes(player.injuryNotes))
  }

  return labels
}

export function buildDraftAvailabilityInsight(
  player: InjuryDetailInput
): string | undefined {
  const injuryRisk = scorePlayerInjuryRisk(player)
  const injuryNote = formatPlayerInjuryRiskNote(player)

  if (!injuryRisk || !injuryNote) {
    return undefined
  }

  if (player.injuryNotes) {
    return `${injuryNote}. Sleeper note: ${truncateInjuryNotes(player.injuryNotes)}`
  }

  if (player.injuryStartDate) {
    return `${injuryNote} since ${player.injuryStartDate}; confirm the return timeline before treating him as season-ready.`
  }

  if (injuryRisk >= 8) {
    return `${injuryNote} affects season viability unless the return timeline is clear.`
  }

  return `${injuryNote} adds short-term availability risk.`
}

export function buildInjuryInsightLines(
  player: InjuryDetailInput
): InjuryInsightLines | undefined {
  const injuryLabel =
    player.injuryBodyPart ?? formatInjuryStatus(player.injuryStatus)
  const fallbackContext = player.injuryNotes
    ? undefined
    : getFallbackInjuryContext(player)
  const sleeperNoteParts = [
    formatInjuryStatus(player.injuryStatus),
    player.injuryNotes ?? fallbackContext,
  ].filter((note): note is string => Boolean(note))

  if (!injuryLabel && !sleeperNoteParts.length) {
    return undefined
  }

  return {
    injury: `Injury: ${injuryLabel ?? 'Availability concern'}`,
    ...(sleeperNoteParts.length
      ? { sleeperNote: `Sleeper note: ${sleeperNoteParts.join(', ')}` }
      : {}),
  }
}

function normalizeInjuryStatus(injuryStatus: string | undefined): string {
  return injuryStatus?.trim().toLowerCase().replace(/\s+/g, '_') ?? ''
}

function getFallbackInjuryContext(
  player: InjuryDetailInput
): string | undefined {
  const injuryRisk = scorePlayerInjuryRisk(player)

  if (!injuryRisk) {
    return undefined
  }

  if (injuryRisk >= 8) {
    return 'confirm return timeline'
  }

  if (player.injuryBodyPart || player.injuryStartDate) {
    return 'monitor availability'
  }

  return 'short-term availability risk'
}

function truncateInjuryNotes(injuryNotes: string): string {
  const normalizedNotes = injuryNotes.trim()

  return normalizedNotes.length > 90
    ? `${normalizedNotes.slice(0, 87)}...`
    : normalizedNotes
}
