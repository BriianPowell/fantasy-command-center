export type DashboardModuleId = 'lockerRoom' | 'draftRoom'

export const dashboardModuleLabels: Record<DashboardModuleId, string> = {
  draftRoom: 'Draft Room',
  lockerRoom: 'Locker Room',
}

export const defaultMinimizedModules: Record<DashboardModuleId, boolean> = {
  draftRoom: false,
  lockerRoom: false,
}
