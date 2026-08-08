export type DashboardModuleId = 'teamTracker' | 'draftRoom'

export const defaultMinimizedModules: Record<DashboardModuleId, boolean> = {
  draftRoom: false,
  teamTracker: false,
}
