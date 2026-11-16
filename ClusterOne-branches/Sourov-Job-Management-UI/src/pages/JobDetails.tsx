import type { ReactNode } from 'react'
import { Link, NavLink, useParams, useLocation } from 'react-router-dom'
import {
  Ban,
  RotateCcw,
  Copy,
  Download,
  FileText,
  Database,
  Boxes,
  GitBranch,
  Terminal,
} from 'lucide-react'
import { useJobDetail } from '@/hooks/useJobDetail'
import { useJobActions } from '@/hooks/useJobActions'
import { StatusBadge } from '@/components/common/StatusBadge'
import { JobTimeline } from '@/components/jobs/JobTimeline'
import { ResourceSummary } from '@/components/jobs/ResourceSummary'
import { DistributedView } from '@/components/jobs/DistributedView'
import { LogViewer } from '@/components/jobs/LogViewer'
import { MetricLineChart } from '@/components/jobs/charts/MetricLineChart'
import { ConfirmationModal } from '@/components/common/ConfirmationModal'
import { EmptyState, ErrorState, CardSkeleton, DemoDataBadge } from '@/components/common/States'
import { formatDateTime, formatDuration, elapsedSeconds, cn } from '@/lib/format'
import type { Job } from '@/types/job'

const TABS = [
  { label: 'Overview', suffix: '' },
  { label: 'Resources', suffix: '/resources' },
  { label: 'Metrics', suffix: '/metrics' },
  { label: 'Logs', suffix: '/logs' },
  { label: 'Output', suffix: '/results' },
]

export function JobDetails() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { job, loading, error, refetch } = useJobDetail(id)
  const actions = useJobActions(() => refetch({ silent: true }))

  if (loading && !job) {
    return (
      <div className="space-y-4">
        <CardSkeleton className="h-24" />
        <CardSkeleton className="h-16" />
        <CardSkeleton className="h-64" />
      </div>
    )
  }

  if (error && !job) return <ErrorState title="Job not found" message={error} onRetry={() => refetch()} />
  if (!job) return null

  const canCancel = ['RUNNING', 'QUEUED', 'SCHEDULED', 'SUBMITTED'].includes(job.status)
  const canRetry = job.status === 'FAILED' || job.status === 'TIMEOUT'
  const canClone = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(job.status)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[12px] text-text-muted">
        <Link to="/jobs" className="hover:text-text-primary">
          Jobs
        </Link>
        <span>/</span>
        <span className="tabular text-text-secondary">#{job.id}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[20px] font-bold text-text-primary">
              Job #{job.id} · {job.name}
            </h1>
            <StatusBadge status={job.status} />
          </div>
          {job.description && <p className="mt-1 max-w-2xl text-[13px] text-text-secondary">{job.description}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {canCancel && (
            <ActionButton icon={Ban} label="Cancel Job" tone="danger" onClick={() => actions.requestCancel(job)} />
          )}
          {canRetry && (
            <ActionButton icon={RotateCcw} label="Retry Job" loading={actions.pending === 'retry'} onClick={() => actions.retry(job)} />
          )}
          {canClone && (
            <ActionButton icon={Copy} label="Clone Job" loading={actions.pending === 'clone'} onClick={() => actions.clone(job)} />
          )}
        </div>
      </div>

      {actions.error && <p className="text-[12.5px] font-medium text-status-failed">{actions.error}</p>}
      {job.failureReason && (job.status === 'FAILED' || job.status === 'TIMEOUT') && (
        <div className="rounded-[var(--radius-card)] border border-status-failed/30 bg-status-failed-soft px-4 py-3 text-[13px] text-status-failed">
          {job.failureReason}
        </div>
      )}

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <JobTimeline timeline={job.timeline} />
      </div>

      <nav className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.suffix}
            to={`/jobs/${job.id}${tab.suffix}`}
            end
            className={({ isActive }) =>
              cn(
                'shrink-0 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors',
                isActive ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <TabContent job={job} tabPath={location.pathname.replace(`/jobs/${job.id}`, '') || ''} />

      <ConfirmationModal
        open={!!actions.cancelTarget}
        title={`Cancel Job #${job.id}?`}
        description="This will stop the running workload and release its allocated resources. This cannot be undone."
        confirmLabel="Cancel Job"
        cancelLabel="Keep Running"
        destructive
        loading={actions.pending === 'cancel'}
        onConfirm={actions.confirmCancel}
        onCancel={actions.dismissCancel}
      />
    </div>
  )
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
  loading,
}: {
  icon: typeof Ban
  label: string
  onClick: () => void
  tone?: 'default' | 'danger'
  loading?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-[13px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        tone === 'danger'
          ? 'border-status-failed/40 text-status-failed hover:bg-status-failed-soft'
          : 'border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      <Icon size={14} />
      {loading ? 'Working…' : label}
    </button>
  )
}

// -----------------------------------------------------------------------
// Route-driven tab content. Reads the trailing path segment ('', '/resources',
// '/metrics', '/logs', '/results') so each tab is addressable at
// /jobs/:id, /jobs/:id/resources, /jobs/:id/metrics, /jobs/:id/logs, /jobs/:id/results.
// -----------------------------------------------------------------------
function TabContent({ job, tabPath }: { job: Job; tabPath: string }) {
  if (tabPath === '/resources') {
    return (
      <div className="space-y-5">
        <ResourceSummary job={job} />
        <DistributedView job={job} />
      </div>
    )
  }

  if (tabPath === '/metrics') return <MetricsTab job={job} />
  if (tabPath === '/logs') return <LogViewer logs={job.logs} jobId={job.id} live={job.status === 'RUNNING'} />
  if (tabPath === '/results') return <ResultsTab job={job} />
  return <OverviewTab job={job} />
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 text-[13px] last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-text-primary">{value}</span>
    </div>
  )
}

function OverviewTab({ job }: { job: Job }) {
  const elapsed = job.startedAt ? formatDuration(elapsedSeconds(job.startedAt, job.completedAt)) : '—'
  let eta = '—'
  if (job.status === 'RUNNING' && job.startedAt && job.progress > 0) {
    const elapsedS = elapsedSeconds(job.startedAt, null)
    const totalEstS = elapsedS / (job.progress / 100)
    eta = formatDateTime(new Date(Date.now() + (totalEstS - elapsedS) * 1000).toISOString())
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Job Information</h3>
        <InfoRow label="Job ID" value={`#${job.id}`} />
        <InfoRow label="Owner" value={job.owner} />
        <InfoRow label="Execution Mode" value={job.executionMode === 'DISTRIBUTED' ? 'Distributed Multi-GPU' : 'Single GPU'} />
        <InfoRow label="Created" value={formatDateTime(job.submittedAt)} />
        <InfoRow label="Started" value={job.startedAt ? formatDateTime(job.startedAt) : '—'} />
        <InfoRow label="Elapsed Time" value={elapsed} />
        <InfoRow label="Estimated Completion" value={eta} />
        <InfoRow label="Node" value={job.actual?.node ?? '—'} />
        <InfoRow label="GPU" value={job.actual?.gpuModel ?? job.request.gpuType} />
      </div>

      <div className="space-y-5">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <Database size={12} />
            Dataset
          </h3>
          <InfoRow label="Name" value={job.dataset.name} />
          <InfoRow label="Size" value={`${job.dataset.sizeGb} GB · ${job.dataset.samples.toLocaleString()} samples`} />
          <InfoRow label="Access" value={job.dataset.access === 'READ_ONLY' ? 'Read Only' : 'Read/Write'} />
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <Boxes size={12} />
            Environment
          </h3>
          <InfoRow label="Name" value={job.environment.name} />
          <InfoRow label="Python" value={job.environment.pythonVersion} />
          <InfoRow label="CUDA" value={job.environment.cudaVersion} />
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <h3 className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-muted">
            <GitBranch size={12} />
            Code
          </h3>
          {job.code.repository && <InfoRow label="Repository" value={`${job.code.repository} @ ${job.code.branch}`} />}
          <InfoRow label="Entry Point" value={job.code.entryPoint} />
          {job.code.arguments && <InfoRow label="Arguments" value={job.code.arguments} />}
        </div>
      </div>
    </div>
  )
}

function MetricsTab({ job }: { job: Job }) {
  if (job.metrics.length === 0) {
    return <EmptyState icon={Terminal} title="No Metrics Yet" description="Training metrics appear once the job starts running." />
  }
  const latest = job.metrics.at(-1)!

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricStat label="Epoch" value={`${latest.epoch}`} />
        <MetricStat label="Iteration" value={latest.iteration.toLocaleString()} />
        <MetricStat label="Loss" value={latest.loss.toFixed(3)} />
        <MetricStat label="Accuracy" value={`${latest.accuracy.toFixed(1)}%`} />
      </div>
      <div className="flex items-center gap-2">
        <DemoDataBadge />
        <span className="text-[11.5px] text-text-muted">Simulated training telemetry for demonstration.</span>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="Loss over Time">
          <MetricLineChart data={job.metrics} series={[{ dataKey: 'loss', name: 'Loss', color: '#F87171' }]} />
        </ChartCard>
        <ChartCard title="Accuracy over Time">
          <MetricLineChart data={job.metrics} series={[{ dataKey: 'accuracy', name: 'Accuracy %', color: '#34D399' }]} yDomain={[0, 100]} />
        </ChartCard>
        <ChartCard title="Learning Rate">
          <MetricLineChart data={job.metrics} series={[{ dataKey: 'learningRate', name: 'LR', color: '#22D3EE' }]} />
        </ChartCard>
        {job.utilization.length > 0 && (
          <ChartCard title="GPU / CPU Utilization">
            <MetricLineChart
              data={job.utilization}
              series={[
                { dataKey: 'gpuUtilization', name: 'GPU %', color: '#22D3EE' },
                { dataKey: 'cpuUtilization', name: 'CPU %', color: '#A78BFA' },
              ]}
              yDomain={[0, 100]}
            />
          </ChartCard>
        )}
      </div>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h3 className="mb-2 text-[12.5px] font-semibold text-text-primary">{title}</h3>
      {children}
    </div>
  )
}

function MetricStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-3.5">
      <div className="tabular text-[19px] font-bold text-text-primary">{value}</div>
      <div className="mt-0.5 text-[11.5px] text-text-muted">{label}</div>
    </div>
  )
}

function ResultsTab({ job }: { job: Job }) {
  if (job.status !== 'COMPLETED' || !job.results) {
    return (
      <EmptyState
        icon={FileText}
        title="Results Not Available Yet"
        description={
          job.status === 'FAILED' || job.status === 'TIMEOUT'
            ? 'This job did not complete successfully, so no results were produced.'
            : 'Results and artifacts appear here once the job completes.'
        }
      />
    )
  }

  const r = job.results
  return (
    <div className="space-y-5">
      <div className="rounded-[var(--radius-card)] border border-status-running/30 bg-status-running-soft/40 p-4">
        <h3 className="mb-3 text-[13px] font-semibold text-status-running">Job Completed</h3>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {r.accuracy !== undefined && <MetricStat label="Accuracy" value={`${r.accuracy}%`} />}
          {r.precision !== undefined && <MetricStat label="Precision" value={`${r.precision}%`} />}
          {r.recall !== undefined && <MetricStat label="Recall" value={`${r.recall}%`} />}
          {r.f1 !== undefined && <MetricStat label="F1" value={`${r.f1}%`} />}
          <MetricStat label="Training Time" value={r.trainingTime} />
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Artifacts</h3>
          <button className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-semibold text-bg hover:bg-accent/90">
            <Download size={13} />
            Download All
          </button>
        </div>
        <ul className="divide-y divide-border">
          {r.artifacts.map((a) => (
            <li key={a.name} className="flex items-center justify-between py-2.5 text-[13px]">
              <span className="flex items-center gap-2 text-text-primary">
                <FileText size={14} className="text-text-muted" />
                {a.name}
                <span className="text-[11.5px] text-text-muted">({a.sizeMb} MB)</span>
              </span>
              <button className="flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-[11.5px] font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary">
                <Download size={12} />
                Download
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
