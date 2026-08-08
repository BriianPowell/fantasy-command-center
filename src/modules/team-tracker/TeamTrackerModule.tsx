import { buildTeamTrackerViewModel } from './teamTrackerModel'
import {
  LineupSection,
  PositionValueGapsSection,
  RecentTeamPicksSection,
  RosterSection,
  TrackerMetric,
} from './TeamTrackerSections'
import {
  buildPositionValueGaps,
  buildTeamPickValueImpacts,
  buildTeamValueSnapshot,
  formatTeamValue,
  formatTeamValueDelta,
} from './teamValueModel'
import './teamTracker.css'
import { ModuleTrimToggle } from '../../components/dashboard/ModuleTrimToggle'
import { getRecentDraftPicks } from '../../domain/draftPickUtils'
import type { NormalizedLeagueData, Roster } from '../../domain/types'

export interface TeamTrackerModuleProps {
  data: NormalizedLeagueData
  isMinimized: boolean
  onToggleMinimized: () => void
  roster: Roster | undefined
  selectedTeamId: string
}

export function TeamTrackerModule({
  data,
  isMinimized,
  onToggleMinimized,
  roster,
  selectedTeamId,
}: TeamTrackerModuleProps) {
  const selectedTeam = data.teams.find((team) => team.id === selectedTeamId)
  const teamPicks = getRecentDraftPicks(data.draft?.picks ?? [], {
    limit: 6,
    rosterId: selectedTeamId,
  })
  const scoringLabel = formatScoringType(data.league.settings.scoringType)
  const tracker = buildTeamTrackerViewModel({
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
  })
  const positionValueGaps = buildPositionValueGaps({
    bench: tracker.bench,
    lineupSlots: tracker.lineupSlots,
  })
  const weakPositions = new Set(
    positionValueGaps.flatMap((gap) =>
      gap.filledStarters < gap.requiredStarters || gap.valueDelta < 0
        ? [gap.position]
        : []
    )
  )
  const pickValueImpacts = buildTeamPickValueImpacts({
    baselineValue: teamValue.averageValue,
    picks: teamPicks,
    players: data.players,
    weakPositions,
  })

  return (
    <section
      className={
        isMinimized
          ? 'panel team-tracker-panel module-is-minimized'
          : 'panel team-tracker-panel'
      }
    >
      <ModuleTrimToggle
        isMinimized={isMinimized}
        moduleName="Team Tracker"
        onToggle={onToggleMinimized}
      />
      <div className="team-tracker-header">
        <div>
          <h2>{selectedTeam?.name ?? 'Configured team'}</h2>
          <p>
            {data.league.name} · {data.league.settings.teams} teams ·{' '}
            {data.league.season} season
          </p>
        </div>
        <div className="team-tracker-summary">
          <TrackerMetric label="Scoring" value={scoringLabel} />
          <TrackerMetric
            label="Team value"
            value={formatTeamValue(teamValue.totalValue)}
          />
          <TrackerMetric
            label="Starter value"
            value={formatTeamValue(teamValue.starterValue)}
          />
          <TrackerMetric
            label="Bench value"
            value={formatTeamValue(teamValue.benchValue)}
          />
          <TrackerMetric
            label="Starter edge"
            value={formatTeamValueDelta(teamValue.starterBenchDelta)}
          />
          <TrackerMetric
            label="Draft value"
            value={formatTeamValue(teamValue.draftedAdditionsValue)}
          />
          <TrackerMetric
            label="Last pick"
            value={formatTeamValueDelta(teamValue.latestPickDelta)}
          />
        </div>
      </div>

      {!isMinimized ? (
        <div className="team-roster-grid">
          <LineupSection slots={tracker.lineupSlots} title="Starters" />
          <RosterSection
            emptyText="No bench players mapped yet."
            players={tracker.bench}
            title="Bench"
          />
          <PositionValueGapsSection gaps={positionValueGaps} />
          <RecentTeamPicksSection
            pickValueImpacts={pickValueImpacts}
            picks={teamPicks}
            players={data.players}
          />
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
