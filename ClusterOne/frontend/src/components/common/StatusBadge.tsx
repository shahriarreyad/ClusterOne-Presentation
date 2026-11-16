import type { JobStatus } from '@/types/job'
import { STATUS_LABEL } from '@/lib/format'

const STATUS_STYLE: Record<JobStatus, string> = {
  RUNNING: 'text-status-running bg-status-running-soft',
  QUEUED: 'text-status-queued bg-status-queued-soft',
  SCHEDULED: 'text-status-scheduled bg-status-scheduled-soft',
  SUBMITTED: 'text-status-scheduled bg-status-scheduled-soft',
  COMPLETED: 'text-status-completed bg-status-completed-soft',
  FAILED: 'text-status-failed bg-status-failed-soft',
  CANCELLED: 'text-status-cancelled bg-status-cancelled-soft',
  TIMEOUT: 'text-status-timeout bg-status-timeout-soft',
}

const PULSE: Set<JobStatus> = new Set(['RUNNING'])

interface StatusBadgeProps {
  status: JobStatus
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLE[status]} ${className}`}
    >
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full bg-current ${PULSE.has(status) ? 'animate-pulse-dot' : ''}`}
        aria-hidden
      />
      {STATUS_LABEL[status]}
    </span>
  )
}
