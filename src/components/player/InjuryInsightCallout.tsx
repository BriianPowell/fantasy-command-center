import type { InjuryInsightLines } from '../../domain/injuryStatus'
import './injuryInsight.css'

export function InjuryInsightCallout({
  className,
  lines,
  toneClass,
}: {
  className?: string
  lines: InjuryInsightLines
  toneClass?: string
}) {
  return (
    <div
      className={['injury-insight-callout', toneClass, className]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="injury-insight-row">
        <strong>Injury</strong>
        <em>{stripLinePrefix(lines.injury, 'Injury')}</em>
      </div>
      {lines.sleeperNote ? (
        <div className="injury-insight-row">
          <strong>Sleeper</strong>
          <em>{stripLinePrefix(lines.sleeperNote, 'Sleeper note')}</em>
        </div>
      ) : null}
    </div>
  )
}

function stripLinePrefix(line: string, prefix: string): string {
  return line.replace(new RegExp(`^${prefix}:\\s*`), '')
}
