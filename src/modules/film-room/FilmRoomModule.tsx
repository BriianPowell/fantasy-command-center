import './filmRoom.css'
import { dashboardModuleLabels } from '../../components/dashboard/dashboardTypes'
import { ModuleTrimToggle } from '../../components/dashboard/ModuleTrimToggle'
import { PlayerReferenceTile } from '../../components/player/PlayerReferenceTile'
import { SlotBadge } from '../../components/player/SlotBadge'
import {
  formatDraftValueScore,
  scoreDraftPlayerValue,
} from '../../domain/playerValueUtils'
import {
  getPositionClass,
  getPrimaryPosition,
} from '../../domain/positionUtils'
import type {
  LeagueMatchup,
  NormalizedLeagueData,
  Player,
  TrendingPlayer,
} from '../../domain/types'

interface FilmRoomModuleProps {
  data: NormalizedLeagueData
  isMinimized: boolean
  onToggleMinimized: () => void
  selectedTeamId: string
}

interface FreeAgentTarget {
  player: Player
  trend: TrendingPlayer
}

interface StartSitSignal {
  label: string
  player: Player
  value: number
}

export function FilmRoomModule({
  data,
  isMinimized,
  onToggleMinimized,
  selectedTeamId,
}: FilmRoomModuleProps) {
  const weekly = data.weekly
  const playersById = new Map(data.players.map((player) => [player.id, player]))
  const rosteredPlayerIds = new Set(
    data.rosters.flatMap((roster) => roster.playerIds)
  )
  const selectedMatchup = weekly?.matchups.find(
    (matchup) => matchup.teamId === selectedTeamId
  )
  const opponentMatchup =
    selectedMatchup?.matchupId === undefined
      ? undefined
      : weekly?.matchups.find(
          (matchup) =>
            matchup.matchupId === selectedMatchup.matchupId &&
            matchup.teamId !== selectedTeamId
        )
  const opponentTeam = data.teams.find(
    (team) => team.id === opponentMatchup?.teamId
  )
  const startSitSignals = buildStartSitSignals(selectedMatchup, playersById)
  const freeAgentTargets = buildFreeAgentTargets({
    playersById,
    rosteredPlayerIds,
    trends: weekly?.trendingAdds ?? [],
  })

  return (
    <section
      className={
        isMinimized
          ? 'panel film-room-panel module-is-minimized'
          : 'panel film-room-panel'
      }
    >
      <ModuleTrimToggle
        isMinimized={isMinimized}
        moduleName={dashboardModuleLabels.filmRoom}
        onToggle={onToggleMinimized}
      />
      <header className="film-room-header">
        <div>
          <p className="eyebrow">Weekly Insights</p>
          <h2>{dashboardModuleLabels.filmRoom}</h2>
        </div>
        <span className="film-room-week">
          {weekly ? `Week ${weekly.week}` : 'Week TBD'}
        </span>
      </header>

      {!isMinimized ? (
        <div className="film-room-grid">
          <FilmRoomSection
            emptyText="Matchup data has not loaded yet."
            title="Matchup Snapshot"
          >
            {selectedMatchup ? (
              <div className="film-room-matchup-card">
                <span>
                  Your points{' '}
                  <strong>{selectedMatchup.points.toFixed(1)}</strong>
                </span>
                <span>
                  Opponent{' '}
                  <strong>{opponentTeam?.name ?? 'Matchup pending'}</strong>
                </span>
                {opponentMatchup ? (
                  <span>
                    Opponent points{' '}
                    <strong>{opponentMatchup.points.toFixed(1)}</strong>
                  </span>
                ) : null}
              </div>
            ) : null}
          </FilmRoomSection>

          <FilmRoomSection
            emptyText="Start/sit signals will appear once weekly matchup starters are available."
            title="Start/Sit Signals"
          >
            {startSitSignals.map((signal) => (
              <FilmRoomPlayerTile
                key={signal.player.id}
                player={signal.player}
                trailingLabel={signal.label}
                value={signal.value}
              />
            ))}
          </FilmRoomSection>

          <FilmRoomSection
            emptyText="Trending free-agent targets will appear once weekly data loads."
            title="Free-Agent Targets"
          >
            {freeAgentTargets.map(({ player, trend }) => (
              <FilmRoomPlayerTile
                key={player.id}
                player={player}
                trailingLabel={`${trend.count.toLocaleString()} adds`}
                value={scoreDraftPlayerValue(player)}
              />
            ))}
          </FilmRoomSection>
        </div>
      ) : null}
    </section>
  )
}

function FilmRoomSection({
  children,
  emptyText,
  title,
}: {
  children: React.ReactNode
  emptyText: string
  title: string
}) {
  const hasContent = Boolean(children) && childrenHasItems(children)

  return (
    <section className="film-room-section">
      <header>
        <h3>{title}</h3>
      </header>
      <div className="film-room-section-body">
        {hasContent ? children : <p>{emptyText}</p>}
      </div>
    </section>
  )
}

function FilmRoomPlayerTile({
  player,
  trailingLabel,
  value,
}: {
  player: Player
  trailingLabel: string
  value: number
}) {
  const primaryPosition = getPrimaryPosition(player.positions)

  return (
    <PlayerReferenceTile
      className={
        primaryPosition ? getPositionClass(primaryPosition) : undefined
      }
      leadingLabel={
        primaryPosition ? <SlotBadge slotLabel={primaryPosition} /> : null
      }
      meta={[
        player.team ?? 'FA',
        ...(player.byeWeek ? [`Bye ${player.byeWeek}`] : []),
        `Value ${formatDraftValueScore(value)}`,
      ]}
      playerName={player.fullName}
      trailingLabel={trailingLabel}
      variant="compact"
    />
  )
}

function buildStartSitSignals(
  matchup: LeagueMatchup | undefined,
  playersById: Map<string, Player>
): StartSitSignal[] {
  if (!matchup) {
    return []
  }

  return matchup.starters
    .flatMap((playerId) => {
      const player = playersById.get(playerId)

      if (!player) {
        return []
      }

      const value = scoreDraftPlayerValue(player)

      return [
        {
          label: value >= 50 ? 'Strong start' : 'Monitor',
          player,
          value,
        },
      ]
    })
    .sort((a, b) => b.value - a.value)
    .slice(0, 4)
}

function buildFreeAgentTargets({
  playersById,
  rosteredPlayerIds,
  trends,
}: {
  playersById: Map<string, Player>
  rosteredPlayerIds: Set<string>
  trends: TrendingPlayer[]
}): FreeAgentTarget[] {
  return trends
    .flatMap((trend) => {
      const player = playersById.get(trend.playerId)

      if (!player || rosteredPlayerIds.has(player.id)) {
        return []
      }

      return [{ player, trend }]
    })
    .sort((a, b) => b.trend.count - a.trend.count)
    .slice(0, 5)
}

function childrenHasItems(children: React.ReactNode): boolean {
  return Array.isArray(children) ? children.length > 0 : Boolean(children)
}
