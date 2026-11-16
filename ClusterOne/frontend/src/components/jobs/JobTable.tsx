import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { Job } from '@/types/job'
import { StatusBadge } from '@/components/common/StatusBadge'
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
  const count = job.request.gpuCount || 1
  const model = job.actual?.gpuModel || job.request.gpuType || 'NVIDIA GPU'
  return `${count} × ${model}`
}

function nodeLabel(job: Job): string {
  return job.actual?.node || 'Pending allocation'
}

function partitionLabel(job: Job): string {
  if (job.description.includes('Partition: ')) {
    const part = job.description.split('Partition: ')[1]?.split(' ')[0]
    return part || 'gpu'
  }
  return job.request.gpuCount > 0 ? 'gpu' : 'teaching'
}

function runtimeLabel(job: Job): string {
  if (!job.startedAt) return '—'
  return formatDuration(elapsedSeconds(job.startedAt, job.completedAt))
}

export function JobTable({ jobs, onCancel, onRetry, onClone, pendingId, footer }: JobTableProps) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
      {/* Desktop View */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1080px] border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border/80 bg-bg-secondary/80 text-[11px] uppercase tracking-wider text-text-muted">
              <th className="px-3.5 py-3 font-semibold">Job ID</th>
              <th className="px-3.5 py-3 font-semibold">Name</th>
              <th className="px-3.5 py-3 font-semibold">User</th>
              <th className="px-3.5 py-3 font-semibold">Status</th>
              <th className="px-3.5 py-3 font-semibold">Partition</th>
              <th className="px-3.5 py-3 font-semibold">GPU</th>
              <th className="px-3.5 py-3 font-semibold">Node</th>
              <th className="px-3.5 py-3 font-semibold">CPU</th>
              <th className="px-3.5 py-3 font-semibold">RAM</th>
              <th className="px-3.5 py-3 font-semibold">Time</th>
              <th className="px-3.5 py-3 font-semibold">Submitted</th>
              <th className="px-3.5 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {jobs.map((job) => (
              <tr key={job.id} className="transition-colors hover:bg-surface-hover/80">
                {/* JOB ID */}
                <td className="px-3.5 py-3 font-mono font-medium text-accent">
                  <Link to={`/jobs/${job.id}`} className="hover:underline">
                    #{job.id.length > 8 ? job.id.slice(0, 8) : job.id}
                  </Link>
                </td>

                {/* NAME */}
                <td className="px-3.5 py-3">
                  <Link to={`/jobs/${job.id}`} className="font-semibold text-text-primary hover:text-accent transition-colors block max-w-xs truncate">
                    {job.name}
                  </Link>
                </td>

                {/* USER */}
                <td className="px-3.5 py-3 text-text-secondary font-medium">
                  {job.owner}
                </td>

                {/* STATUS */}
                <td className="px-3.5 py-3">
                  <StatusBadge status={job.status} />
                </td>

                {/* PARTITION */}
                <td className="px-3.5 py-3 font-mono text-[11px] text-text-muted">
                  <span className="rounded bg-surface-raised px-1.5 py-0.5 border border-border/50">
                    {partitionLabel(job)}
                  </span>
                </td>

                {/* GPU */}
                <td className="px-3.5 py-3 text-text-secondary font-medium">
                  {job.request.gpuCount > 0 ? (
                    <span className="text-accent">{gpuLabel(job)}</span>
                  ) : (
                    <span className="text-text-muted">CPU only</span>
                  )}
                </td>

                {/* NODE */}
                <td className="px-3.5 py-3 font-mono text-[11.5px]">
                  {job.actual?.node ? (
                    <span className="font-semibold text-text-primary">{job.actual.node}</span>
                  ) : (
                    <span className="text-text-muted">pending</span>
                  )}
                </td>

                {/* CPU */}
                <td className="px-3.5 py-3 text-text-secondary font-mono text-[11px]">
                  {job.request.cpuCores} cores
                </td>

                {/* RAM */}
                <td className="px-3.5 py-3 text-text-secondary font-mono text-[11px]">
                  {job.request.ramGb} GB
                </td>

                {/* TIME */}
                <td className="px-3.5 py-3 font-mono text-[11px] text-text-secondary">
                  {runtimeLabel(job)}
                </td>

                {/* SUBMITTED */}
                <td className="px-3.5 py-3 text-text-muted text-[11px]">
                  {formatRelativeTime(job.submittedAt)}
                </td>

                {/* ACTIONS */}
                <td className="px-3.5 py-3 text-right">
                  <JobActionMenu job={job} onCancel={onCancel} onRetry={onRetry} onClone={onClone} pending={pendingId === job.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile list view */}
      <ul className="divide-y divide-border lg:hidden">
        {jobs.map((job) => (
          <li key={job.id} className="p-4 space-y-2.5">
            <div className="flex items-start justify-between gap-3">
              <Link to={`/jobs/${job.id}`}>
                <div className="font-semibold text-text-primary text-[14px]">{job.name}</div>
                <div className="font-mono text-[11px] text-accent">#{job.id.length > 8 ? job.id.slice(0, 8) : job.id} · {job.owner}</div>
              </Link>
              <StatusBadge status={job.status} />
            </div>

            <div className="grid grid-cols-2 gap-y-1 text-[11.5px] text-text-secondary border-t border-border/40 pt-2">
              <div>
                <span className="text-text-muted">Node: </span>
                <span className="font-mono text-text-primary">{nodeLabel(job)}</span>
              </div>
              <div>
                <span className="text-text-muted">GPU: </span>
                <span className="text-accent">{gpuLabel(job)}</span>
              </div>
              <div>
                <span className="text-text-muted">Resources: </span>
                <span>{job.request.cpuCores}c · {job.request.ramGb}GB</span>
              </div>
              <div>
                <span className="text-text-muted">Runtime: </span>
                <span className="font-mono">{runtimeLabel(job)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <JobActionMenu job={job} onCancel={onCancel} onRetry={onRetry} onClone={onClone} pending={pendingId === job.id} />
            </div>
          </li>
        ))}
      </ul>

      {footer}
    </div>
  )
}
