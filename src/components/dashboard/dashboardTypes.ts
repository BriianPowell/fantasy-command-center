export type DashboardModuleId = 'lockerRoom' | 'filmRoom' | 'draftRoom'

export const dashboardModuleLabels: Record<DashboardModuleId, string> = {
  draftRoom: 'Draft Room',
  filmRoom: 'Film Room',
  lockerRoom: 'Locker Room',
}

export const defaultMinimizedModules: Record<DashboardModuleId, boolean> = {
  draftRoom: false,
  filmRoom: false,
  lockerRoom: false,
}
