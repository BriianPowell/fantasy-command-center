import type { NormalizedLeagueData } from '../../domain/types'

export interface TopBarProps {
  activeDashboardId: string
  leagueIds: string[]
  leagues: NormalizedLeagueData[]
  onActiveDashboardChange: (leagueId: string) => void
  status: string
  weekLabel: string
}

export function TopBar({
  activeDashboardId,
  leagueIds,
  leagues,
  onActiveDashboardChange,
  status,
  weekLabel,
}: TopBarProps) {
  return (
    <header className="top-bar">
      <p className="status-line top-status">
        <span className="status-dot" />
        {status}
      </p>
      <div className="brand-block">
        <h1>Fantasy Command Center</h1>
      </div>

      <nav className="league-tabs" aria-label="League dashboards">
        {leagues.length ? (
          leagues.map((league) => (
            <button
              className={
                league.league.id === activeDashboardId
                  ? 'league-tab active'
                  : 'league-tab'
              }
              key={league.league.id}
              onClick={() => onActiveDashboardChange(league.league.id)}
              type="button"
            >
              {league.league.name}
            </button>
          ))
        ) : (
          <span className="league-tabs-loading">
            Loading {leagueIds.length} leagues...
          </span>
        )}
      </nav>

      <div className="week-pill">{weekLabel}</div>
    </header>
  )
}
