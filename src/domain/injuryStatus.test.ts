import { describe, expect, it } from 'vitest'
import {
  buildDraftAvailabilityInsight,
  buildInjuryDetailLabels,
  buildInjuryInsightLines,
  formatInjuryRiskNote,
  formatInjuryStatus,
  formatInjurySummary,
  getInjuryRiskTone,
  scoreInjuryRisk,
  scorePlayerInjuryRisk,
} from './injuryStatus'

describe('injuryStatus', () => {
  it('formats known Sleeper injury statuses', () => {
    expect(formatInjuryStatus('questionable')).toBe('Questionable')
    expect(formatInjuryStatus('ir')).toBe('IR')
    expect(formatInjuryRiskNote('out')).toBe('Injury: Out')
  })

  it('scores availability risk conservatively', () => {
    expect(scoreInjuryRisk(undefined)).toBe(0)
    expect(scoreInjuryRisk('probable')).toBe(0)
    expect(scoreInjuryRisk('questionable')).toBe(3)
    expect(scoreInjuryRisk('doubtful')).toBe(8)
    expect(scoreInjuryRisk('out')).toBe(12)
    expect(scoreInjuryRisk('pup')).toBe(12)
    expect(scorePlayerInjuryRisk({ injuryBodyPart: 'Knee' })).toBe(2)
  })

  it('maps injury statuses to display tones', () => {
    expect(getInjuryRiskTone({ injuryStatus: 'Questionable' })).toBe('watch')
    expect(getInjuryRiskTone({ injuryStatus: 'Doubtful' })).toBe('warning')
    expect(getInjuryRiskTone({ injuryStatus: 'PUP' })).toBe('danger')
    expect(getInjuryRiskTone({ injuryStatus: 'Out' })).toBe('danger')
  })

  it('builds injury detail labels from Sleeper injury metadata', () => {
    expect(
      buildInjuryDetailLabels({
        injuryBodyPart: 'Knee',
        injuryNotes: 'Expected to miss multiple weeks',
        injuryStartDate: '2026-09-12',
      })
    ).toEqual(['Knee', 'Since 2026-09-12', 'Expected to miss multiple weeks'])
  })

  it('builds draft availability insight from injury notes when available', () => {
    expect(
      buildDraftAvailabilityInsight({
        injuryNotes: 'Expected to miss multiple weeks',
        injuryStatus: 'Out',
      })
    ).toBe('Injury: Out. Sleeper note: Expected to miss multiple weeks')
  })

  it('summarizes injury details when Sleeper does not provide a status', () => {
    expect(formatInjurySummary({ injuryBodyPart: 'Knee' })).toBe('Injury: Knee')
    expect(buildDraftAvailabilityInsight({ injuryBodyPart: 'Knee' })).toBe(
      'Injury: Knee adds short-term availability risk.'
    )
  })

  it('builds roster injury insight lines with body part and Sleeper note', () => {
    expect(
      buildInjuryInsightLines({
        injuryBodyPart: 'Knee - ACL',
        injuryNotes: 'Surgery',
        injuryStatus: 'Questionable',
      })
    ).toEqual({
      injury: 'Injury: Knee - ACL',
      sleeperNote: 'Sleeper note: Questionable, Surgery',
    })
  })

  it('falls back to availability insight when Sleeper has no injury note', () => {
    expect(
      buildInjuryInsightLines({
        injuryBodyPart: 'Hamstring',
        injuryStatus: 'Questionable',
      })
    ).toEqual({
      injury: 'Injury: Hamstring',
      sleeperNote: 'Sleeper note: Questionable, monitor availability',
    })
  })
})
