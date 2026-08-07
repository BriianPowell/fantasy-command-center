export interface NflWeekConfig {
  weekOneStartDate: string
  maxWeek: number
}

export const nflWeekConfig: NflWeekConfig = {
  weekOneStartDate: '2026-09-10T00:00:00-04:00',
  maxWeek: 18,
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export function getCurrentNflWeek(
  date = new Date(),
  config = nflWeekConfig
): number {
  const weekOneStart = new Date(config.weekOneStartDate)

  if (date < weekOneStart) {
    return 0
  }

  const week =
    Math.floor((date.getTime() - weekOneStart.getTime()) / WEEK_MS) + 1

  return Math.min(week, config.maxWeek)
}
