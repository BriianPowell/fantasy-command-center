import { useState } from 'react'
import { buildViewModel } from './model'
import {
  LineupSection,
  PositionNeedsSummary,
  RecentTeamPicksSection,
  RosterSection,
  SummaryMetric,
} from './Sections'
import {
  buildPositionValueGaps,
  buildTeamPickValueImpacts,
  buildTeamValueSnapshot,
  formatTeamValue,
  formatTeamValueDelta,
  isPositionWeakSpot,
} from './valueModel'
import './lockerRoom.css'
import { dashboardModuleLabels } from '../../components/dashboard/dashboardTypes'
import { ModuleTrimToggle } from '../../components/dashboard/ModuleTrimToggle'
import {
  getDraftPicksForRoster,
  sortDraftPicks,
} from '../../domain/draftPickUtils'
import type { NormalizedLeagueData, Roster } from '../../domain/types'

export interface LockerRoomModuleProps {
  data: NormalizedLeagueData
  isMinimized: boolean
  onToggleMinimized: () => void
  roster: Roster | undefined
  selectedTeamId: string
}

export function LockerRoomModule({
  data,
  isMinimized,
  onToggleMinimized,
  roster,
  selectedTeamId,
}: LockerRoomModuleProps) {
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | undefined>()
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId)
  const teamPicks = sortDraftPicks(
    getDraftPicksForRoster(data.draft?.picks ?? [], selectedTeamId),
    'oldest_first'
  )
  const scoringLabel = formatScoringType(data.league.settings.scoringType)
  const tracker = buildViewModel({
    draftPicks: data.draft?.picks ?? [],
    leagueSettings: data.league.settings,
    players: data.players,
    roster,
    selectedTeamId,
  })
  const teamValue = buildTeamValueSnapshot({
    bench: tracker.bench,
    draftedAdditions: tracker.draftedAdditions,
    lineupSlots: tracker.lineupSlots,
    picks: teamPicks,
    players: data.players,
    reserve: tracker.reserve,
    taxi: tracker.taxi,
  })
  const positionValueGaps = buildPositionValueGaps({
    bench: tracker.bench,
    lineupSlots: tracker.lineupSlots,
  })
  const weakPositions = new Set(
    positionValueGaps.flatMap((gap) =>
      isPositionWeakSpot(gap) ? [gap.position] : []
    )
  )
  const pickValueImpacts = buildTeamPickValueImpacts({
    baselineValue: teamValue.averageValue,
    picks: teamPicks,
    players: data.players,
    weakPositions,
  })
  function toggleSelectedPlayer(playerId: string) {
    setSelectedPlayerId((current) =>
      current === playerId ? undefined : playerId
    )
  }

  return (
    <section
      className={
        isMinimized
          ? 'panel locker-room-panel module-is-minimized'
          : selectedPlayerId
            ? 'panel locker-room-panel has-player-insight'
            : 'panel locker-room-panel'
      }
    >
      <ModuleTrimToggle
        isMinimized={isMinimized}
        moduleName={dashboardModuleLabels.lockerRoom}
        onToggle={onToggleMinimized}
      />
      <div className="locker-room-header">
        <div>
          <h2>{selectedTeam?.name ?? 'Configured team'}</h2>
          <p>
            {data.league.name} · {data.league.settings.teams} teams ·{' '}
            {data.league.season} season
          </p>
        </div>
        <div className="locker-room-summary-stack">
          <div className="locker-room-summary">
            <SummaryMetric label="Scoring" value={scoringLabel} />
            <SummaryMetric
              label="Team value"
              value={formatTeamValue(teamValue.totalValue)}
            />
            <SummaryMetric
              label="Starter value"
              value={formatTeamValue(teamValue.starterValue)}
            />
            <SummaryMetric
              label="Bench value"
              value={formatTeamValue(teamValue.benchValue)}
            />
            <SummaryMetric
              label="Starter edge"
              value={formatTeamValueDelta(teamValue.starterBenchDelta)}
            />
            <SummaryMetric
              label="Draft value"
              value={formatTeamValue(teamValue.draftedAdditionsValue)}
            />
            <SummaryMetric
              label="Last pick"
              value={formatTeamValueDelta(teamValue.latestPickDelta)}
            />
          </div>
          <PositionNeedsSummary gaps={positionValueGaps} />
        </div>
      </div>

      {!isMinimized ? (
        <div className="team-roster-grid">
          <LineupSection
            baselineValue={teamValue.averageValue}
            onClosePlayerInsight={() => setSelectedPlayerId(undefined)}
            onPlayerSelect={toggleSelectedPlayer}
            selectedPlayerId={selectedPlayerId}
            slots={tracker.lineupSlots}
            title="Starters"
            weakPositions={weakPositions}
          />
          <RosterSection
            baselineValue={teamValue.averageValue}
            emptyText="No bench players mapped yet."
            onClosePlayerInsight={() => setSelectedPlayerId(undefined)}
            onPlayerSelect={toggleSelectedPlayer}
            players={tracker.bench}
            selectedPlayerId={selectedPlayerId}
            title="Bench"
            weakPositions={weakPositions}
          />
          <div className="team-roster-side-stack">
            {tracker.reserve.length ? (
              <RosterSection
                baselineValue={teamValue.averageValue}
                emptyText="No IR players mapped yet."
                insightSide="left"
                onClosePlayerInsight={() => setSelectedPlayerId(undefined)}
                onPlayerSelect={toggleSelectedPlayer}
                players={tracker.reserve}
                roleLabel="IR"
                selectedPlayerId={selectedPlayerId}
                title="IR"
                weakPositions={weakPositions}
              />
            ) : null}
            {tracker.taxi.length ? (
              <RosterSection
                baselineValue={teamValue.averageValue}
                emptyText="No taxi squad players mapped yet."
                insightSide="left"
                onClosePlayerInsight={() => setSelectedPlayerId(undefined)}
                onPlayerSelect={toggleSelectedPlayer}
                players={tracker.taxi}
                roleLabel="Taxi Squad"
                selectedPlayerId={selectedPlayerId}
                title="Taxi Squad"
                weakPositions={weakPositions}
              />
            ) : null}
            <RecentTeamPicksSection
              pickValueImpacts={pickValueImpacts}
              picks={teamPicks}
              players={data.players}
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}

function formatScoringType(
  scoringType: NormalizedLeagueData['league']['settings']['scoringType']
): string {
  return scoringType
    .split('_')
    .map((part) => part.toUpperCase())
    .join(' ')
}
