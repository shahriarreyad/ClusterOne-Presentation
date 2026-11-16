import { Check, X as XIcon } from 'lucide-react'
import type { TimelineEvent } from '@/types/job'
import { STATUS_LABEL, formatDateTime, cn } from '@/lib/format'

const TERMINAL_FAILURE = new Set(['FAILED', 'CANCELLED', 'TIMEOUT'])

interface JobTimelineProps {
  timeline: TimelineEvent[]
}

export function JobTimeline({ timeline }: JobTimelineProps) {
  const lastReachedIndex = [...timeline].reverse().findIndex((e) => e.timestamp !== null)
  const currentIndex = lastReachedIndex === -1 ? -1 : timeline.length - 1 - lastReachedIndex
  const isFinalFailure = TERMINAL_FAILURE.has(timeline.at(-1)?.stage ?? '')

  return (
    <div className="flex items-start overflow-x-auto pb-1">
      {timeline.map((event, i) => {
        const reached = event.timestamp !== null
        const isCurrent = i === currentIndex
        const isFailedStep = isCurrent && isFinalFailure
        const done = reached && !isCurrent

        return (
          <div key={event.stage} className="flex min-w-[92px] flex-1 items-center last:min-w-0 last:flex-none">
            <div className="flex shrink-0 flex-col items-center gap-1.5 px-1 text-center">
              <span
                className={cn(
                  'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold',
                  isFailedStep && 'border-status-failed bg-status-failed-soft text-status-failed',
                  !isFailedStep && done && 'border-status-running bg-status-running-soft text-status-running',
                  !isFailedStep && isCurrent && 'border-accent bg-accent-soft text-accent',
                  !isFailedStep && !done && !isCurrent && 'border-border bg-transparent text-text-muted',
                )}
              >
                {isFailedStep ? <XIcon size={13} /> : done ? <Check size={13} /> : isCurrent ? <span className="h-2 w-2 rounded-full bg-current animate-pulse-dot" /> : null}
              </span>
              <div className={cn('whitespace-nowrap text-[11.5px] font-semibold', isFailedStep ? 'text-status-failed' : reached ? 'text-text-primary' : 'text-text-muted')}>
                {STATUS_LABEL[event.stage]}
              </div>
              <div className="tabular whitespace-nowrap text-[10.5px] text-text-muted">{event.timestamp ? formatDateTime(event.timestamp) : '—'}</div>
            </div>
            {i < timeline.length - 1 && (
              <span className={cn('-mt-6 h-0.5 flex-1', reached && timeline[i + 1].timestamp !== null ? 'bg-status-running/50' : reached ? 'bg-border-strong' : 'bg-border')} />
            )}
          </div>
        )
      })}
    </div>
  )
}
