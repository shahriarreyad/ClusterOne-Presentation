import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Job } from '@/types/job'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ProgressBar } from '@/components/common/ProgressBar'
import { JobActionMenu } from './JobActionMenu'
import { formatDuration, formatRelativeTime, elapsedSeconds } from '@/lib/format'

interface JobTableProps {
  jobs: Job[]
  onCancel: (job: Job) => void
  onRetry: (job: Job) => void
  onClone: (job: Job) => void
  pendingId?: string | null
  footer?: ReactNode
}

function gpuLabel(job: Job): string {
  if (job.executionMode === 'DISTRIBUTED') return `${job.request.gpuCount} GPUs`
  return job.actual?.gpuModel ?? job.request.gpuType
}

function nodeLabel(job: Job): string {
  return job.actual?.node ?? '—'
}

function runtimeLabel(job: Job): string {
  if (!job.startedAt) return '—'
  return formatDuration(elapsedSeconds(job.startedAt, job.completedAt))
}

export function JobTable({ jobs, onCancel, onRetry, onClone, pendingId, footer }: JobTableProps) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
      {/* Desktop */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[920px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg-secondary text-[11px] uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Job</th>
              <th className="px-4 py-3 font-medium">Mode</th>
              <th className="px-4 py-3 font-medium">GPU</th>
              <th className="px-4 py-3 font-medium">Node</th>
              <th className="px-4 py-3 font-medium">Submitted</th>
              <th className="px-4 py-3 font-medium">Runtime</th>
              <th className="px-4 py-3 font-medium">Progress</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {jobs.map((job) => (
              <tr key={job.id} className="transition-colors hover:bg-surface-hover">
                <td className="px-4 py-3">
                  <Link to={`/jobs/${job.id}`} className="block">
                    <div className="font-medium text-text-primary hover:text-accent">{job.name}</div>
                    <div className="tabular text-[11.5px] text-text-muted">#{job.id}</div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {job.executionMode === 'DISTRIBUTED' ? (
                    <span className="text-distributed">Distributed</span>
                  ) : (
                    'Single GPU'
                  )}
                </td>
                <td className="px-4 py-3 text-text-secondary">{gpuLabel(job)}</td>
                <td className="tabular px-4 py-3 text-text-secondary">{nodeLabel(job)}</td>
                <td className="px-4 py-3 text-text-secondary">{formatRelativeTime(job.submittedAt)}</td>
                <td className="tabular px-4 py-3 text-text-secondary">{runtimeLabel(job)}</td>
                <td className="px-4 py-3">
                  <ProgressBar
                    value={job.progress}
                    size="sm"
                    tone={job.status === 'FAILED' ? 'error' : job.status === 'RUNNING' ? 'accent' : 'success'}
                    showLabel
                    className="w-28"
                  />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={job.status} />
                </td>
                <td className="px-4 py-3">
                  <JobActionMenu job={job} onCancel={onCancel} onRetry={onRetry} onClone={onClone} pending={pendingId === job.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ul className="divide-y divide-border lg:hidden">
        {jobs.map((job) => (
          <li key={job.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <Link to={`/jobs/${job.id}`}>
                <div className="font-medium text-text-primary">{job.name}</div>
                <div className="tabular text-[11.5px] text-text-muted">#{job.id}</div>
              </Link>
              <StatusBadge status={job.status} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-y-1.5 text-[12px] text-text-secondary">
              <div>
                <span className="text-text-muted">Mode: </span>
                {job.executionMode === 'DISTRIBUTED' ? 'Distributed' : 'Single GPU'}
              </div>
              <div>
                <span className="text-text-muted">GPU: </span>
                {gpuLabel(job)}
              </div>
              <div>
                <span className="text-text-muted">Submitted: </span>
                {formatRelativeTime(job.submittedAt)}
              </div>
              <div>
                <span className="text-text-muted">Runtime: </span>
                <span className="tabular">{runtimeLabel(job)}</span>
              </div>
            </div>
            <ProgressBar value={job.progress} size="sm" showLabel className="mt-3" />
            <div className="mt-3 flex justify-end">
              <JobActionMenu job={job} onCancel={onCancel} onRetry={onRetry} onClone={onClone} pending={pendingId === job.id} />
            </div>
          </li>
        ))}
      </ul>
      {footer}
    </div>
  )
}
