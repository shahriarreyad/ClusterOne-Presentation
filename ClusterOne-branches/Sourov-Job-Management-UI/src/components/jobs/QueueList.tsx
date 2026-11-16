import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import type { Job } from '@/types/job'
import { formatDateTime } from '@/lib/format'

const PRIORITY_STYLE: Record<string, string> = {
  HIGH: 'text-status-failed bg-status-failed-soft',
  NORMAL: 'text-text-secondary bg-surface-hover',
  LOW: 'text-text-muted bg-surface-hover',
}

export function QueueList({ jobs }: { jobs: Job[] }) {
  return (
    <ol className="divide-y divide-border">
      {jobs.map((job) => (
        <li key={job.id} className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-status-queued-soft text-[12px] font-bold text-status-queued">
            {job.queuePosition ?? '—'}
          </span>
          <div className="min-w-0 flex-1">
            <Link to={`/jobs/${job.id}`} className="block truncate text-[13px] font-medium text-text-primary hover:text-accent">
              {job.name} <span className="tabular text-text-muted">#{job.id}</span>
            </Link>
            <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-text-secondary">
              <span>
                {job.request.gpuCount} × {job.request.gpuType}
              </span>
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${PRIORITY_STYLE[job.request.priority]}`}>
                {job.request.priority}
              </span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="flex items-center gap-1 text-[11.5px] text-text-muted">
              <Clock size={11} />
              Est. start
            </div>
            <div className="tabular text-[12px] font-medium text-text-secondary">{job.estimatedStart ? formatDateTime(job.estimatedStart) : '—'}</div>
          </div>
        </li>
      ))}
    </ol>
  )
}
