import type { ReactNode } from 'react'
import { Link, NavLink, useParams, useLocation } from 'react-router-dom'
import { Ban, RotateCcw, Boxes, Terminal, Server, Activity, AlertTriangle, FolderOpen, Info, Clock } from 'lucide-react'
import { useJobDetail } from '@/hooks/useJobDetail'
import { useJobActions } from '@/hooks/useJobActions'
import { StatusBadge } from '@/components/common/StatusBadge'
import { JobTimeline } from '@/components/jobs/JobTimeline'
import { ResourceSummary } from '@/components/jobs/ResourceSummary'
import { DistributedView } from '@/components/jobs/DistributedView'
import { LogViewer } from '@/components/jobs/LogViewer'
import { MetricLineChart } from '@/components/jobs/charts/MetricLineChart'
import { ConfirmationModal } from '@/components/common/ConfirmationModal'
import { ErrorState, CardSkeleton } from '@/components/common/States'
import { formatDateTime, formatDuration, elapsedSeconds, cn } from '@/lib/format'
import type { Job } from '@/types/job'

const TABS = [
  { label: 'Overview', suffix: '' },
  { label: 'Live Metrics', suffix: '/metrics' },
  { label: 'Logs', suffix: '/logs' },
  { label: 'Resources', suffix: '/resources' },
  { label: 'Environment', suffix: '/environment' },
  { label: 'Output', suffix: '/files' },
  { label: 'Events', suffix: '/events' },
]

/** "#1842" when Slurm numbered the job, otherwise the first 8 characters of ClusterOne's id. */
function displayId(job: Job): string {
  return job.slurmJobId ? `#${job.slurmJobId}` : `#${job.id.slice(0, 8)}`
}

function executingOn(job: Job): string | null {
  const host = job.nodeHostname || job.actual?.node || null
  if (!host) return null
  return job.nodeIp ? `${host} · ${job.nodeIp}` : host
}

function gpuSummary(job: Job): string {
  const n = job.request.gpuCount
  if (n === 0) return 'CPU only'
  const model = job.actual?.gpuModel
  return model ? `${n} × ${model}` : `${n} × NVIDIA GPU`
}

const fmt = (v: number | null | undefined, unit = '', digits = 0) => (v == null ? '—' : `${v.toFixed(digits)}${unit}`)

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
  const canRunAgain = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(job.status)
  const where = executingOn(job)
  const waiting = ['QUEUED', 'SCHEDULED', 'SUBMITTED'].includes(job.status)
  const problem = job.status === 'FAILED' || job.status === 'TIMEOUT'

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[12px] text-text-muted">
        <Link to="/jobs" className="hover:text-text-primary transition-colors">
          Jobs
        </Link>
        <span>/</span>
        <span className="tabular text-text-secondary">{displayId(job)}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[22px] font-bold text-text-primary">
              Job {displayId(job)} · {job.name}
            </h1>
            <StatusBadge status={job.status} />
            {where && (
              <span className="flex items-center gap-1.5 rounded-md border border-cyan-500/30 bg-cyan-950/30 px-2.5 py-1 text-[11px] font-semibold text-cyan-400">
                <Server size={12} />
                {where}
              </span>
            )}
          </div>
          {job.description && <p className="mt-1 max-w-2xl text-[13px] text-text-secondary">{job.description}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canCancel && (
            <ActionButton icon={Ban} label="Cancel Job" tone="danger" onClick={() => actions.requestCancel(job)} />
          )}
          {canRunAgain && (
            <ActionButton
              icon={RotateCcw}
              label="Run Again"
              loading={actions.pending === 'retry'}
              onClick={() => actions.retry(job)}
            />
          )}
        </div>
      </div>

      {actions.error && (
        <div className="rounded-md border border-status-failed/40 bg-status-failed-soft p-3 text-[12.5px] font-medium text-status-failed">
          {actions.error}
        </div>
      )}

      {/* Plain-language state, straight from the Core Engine (why it waits / why it failed). */}
      {job.statusMessage && (problem || waiting) && (
        <div
          className={cn(
            'flex items-start gap-2 rounded-[var(--radius-card)] border p-4 text-[13px]',
            problem
              ? 'border-status-failed/40 bg-status-failed-soft/50 text-status-failed'
              : 'border-amber-500/30 bg-amber-950/20 text-amber-300',
          )}
        >
          {problem ? <AlertTriangle size={16} className="mt-0.5 shrink-0" /> : <Clock size={16} className="mt-0.5 shrink-0" />}
          <div>
            <div className="font-semibold">{problem ? 'This job did not finish' : 'Waiting to start'}</div>
            <div>{job.statusMessage}</div>
          </div>
        </div>
      )}

      <ExecutionPanel job={job} where={where} />

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
                'shrink-0 border-b-2 px-4 py-2.5 text-[13px] font-medium transition-colors',
                isActive
                  ? 'border-accent text-accent font-semibold'
                  : 'border-transparent text-text-secondary hover:text-text-primary',
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
        title={`Cancel Job ${displayId(job)}?`}
        description="This stops the process on the compute node and releases its GPU, CPU and RAM. This cannot be undone."
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

/** Where the job runs and what it is using right now. Every number comes from the node's last heartbeat. */
function ExecutionPanel({ job, where }: { job: Job; where: string | null }) {
  const a = job.actual
  const running = job.status === 'RUNNING'
  const elapsed = job.startedAt ? formatDuration(elapsedSeconds(job.startedAt, job.completedAt)) : '—'

  return (
    <div className="rounded-[var(--radius-card)] border border-accent/30 bg-gradient-to-r from-accent/15 via-[#0D1527] to-[#121B32] p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-accent/40 bg-accent/20 text-accent">
          <Server size={22} />
        </div>
        <div className="min-w-0">
          <div className="text-[10.5px] font-extrabold uppercase tracking-widest text-accent">Executing on</div>
          <div className="text-[16px] font-bold text-text-primary">
            {where ? <span className="font-mono">{where}</span> : <span className="text-text-secondary">Not started yet</span>}
          </div>
          <div className="mt-0.5 text-[12px] text-text-secondary">
            {where
              ? 'This job runs on that compute node. Your browser only controls and monitors it.'
              : 'It will run on a compute node chosen by the scheduler, not on this PC.'}
          </div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <Tile label="Allocated" value={gpuSummary(job)} small />
        <Tile label="CPU / RAM" value={`${job.actual?.cpuCores ?? job.request.cpuCores} cores · ${job.actual?.ramGb ?? job.request.ramGb} GB`} small />
        <Tile label="GPU utilization" value={running ? fmt(a?.gpuUtilization, '%') : '—'} highlight={running} />
        <Tile
          label="GPU memory"
          value={running && a ? `${a.gpuVramUsedGb.toFixed(1)} / ${a.gpuVramGb.toFixed(1)} GB` : '—'}
        />
        <Tile label="CPU" value={running ? fmt(a?.cpuUtilization, '%') : '—'} />
        <Tile label="RAM" value={running && a ? `${a.ramUsedGb.toFixed(1)} / ${(a.ramGb || 0).toFixed(0)} GB` : '—'} />
        <Tile label="Elapsed" value={elapsed} />
      </div>
      {running && a && (
        <p className="mt-2 text-[11px] text-text-muted">
          GPU, CPU and RAM figures are for the whole node (other jobs on it are included).
        </p>
      )}
    </div>
  )
}

function Tile({ label, value, highlight, small }: { label: string; value: string; highlight?: boolean; small?: boolean }) {
  return (
    <div className={cn('rounded-lg border border-border bg-surface/80 px-3 py-2', highlight && 'border-accent/40 bg-accent/5')}>
      <div className={cn('tabular font-bold', small ? 'text-[12.5px]' : 'text-[17px]', highlight ? 'text-accent' : 'text-text-primary')}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-text-muted">{label}</div>
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
        'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60',
        tone === 'danger'
          ? 'border-status-failed/40 text-status-failed hover:bg-status-failed-soft'
          : 'border-border text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      <Icon size={13} />
      {loading ? 'Working…' : label}
    </button>
  )
}

function TabContent({ job, tabPath }: { job: Job; tabPath: string }) {
  if (tabPath === '/resources') return <ResourcesTab job={job} />
  if (tabPath === '/metrics') return <LiveMetricsTab job={job} />
  if (tabPath === '/logs') return <LogViewer logs={job.logs} jobId={job.id} live={job.status === 'RUNNING'} />
  if (tabPath === '/environment') return <EnvironmentTab job={job} />
  if (tabPath === '/files') return <OutputTab job={job} />
  if (tabPath === '/events') return <EventsTab job={job} />
  return <OverviewTab job={job} />
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/80 py-2.5 text-[13px] last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className={cn('max-w-[65%] break-all text-right font-medium text-text-primary', mono && 'font-mono text-[12px]')}>
        {value}
      </span>
    </div>
  )
}

function Card({ title, icon, children }: { title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  )
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-dashed border-border p-4 text-[12.5px] text-text-muted">
      <Info size={14} className="mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

function OverviewTab({ job }: { job: Job }) {
  const elapsed = job.startedAt ? formatDuration(elapsedSeconds(job.startedAt, job.completedAt)) : '—'
  const limit = job.timeLimitMinutes ? formatDuration(job.timeLimitMinutes * 60) : '—'

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Job Execution Overview" icon={<Activity size={13} />}>
        <InfoRow label="Job ID" value={job.id} mono />
        {job.slurmJobId && <InfoRow label="Slurm job" value={`#${job.slurmJobId}`} mono />}
        <InfoRow label="Submitted by" value={job.owner} />
        <InfoRow label="Partition" value={job.partition ?? '—'} />
        <InfoRow label="Executing on" value={executingOn(job) ?? 'not started'} mono />
        <InfoRow label="GPU" value={gpuSummary(job)} />
        <InfoRow label="CPU cores" value={`${job.request.cpuCores}`} />
        <InfoRow label="RAM" value={`${job.request.ramGb} GB`} />
        <InfoRow label="Time limit" value={limit} />
        <InfoRow label="Submitted" value={formatDateTime(job.submittedAt)} />
        <InfoRow label="Started" value={job.startedAt ? formatDateTime(job.startedAt) : '—'} />
        <InfoRow label="Finished" value={job.completedAt ? formatDateTime(job.completedAt) : '—'} />
        <InfoRow label="Elapsed" value={elapsed} />
        {job.exitCode != null && <InfoRow label="Exit code" value={String(job.exitCode)} mono />}
      </Card>

      <div className="space-y-5">
        <Card title="Execution Command" icon={<Terminal size={13} />}>
          <div className="overflow-x-auto whitespace-pre-wrap rounded-md bg-[#070A11] p-3 font-mono text-[12px] leading-relaxed text-accent">
            {job.code.entryPoint || '—'}
          </div>
        </Card>
        <Card title="Container & Storage Paths" icon={<Boxes size={13} />}>
          <InfoRow label="Container image" value={job.image ?? 'none'} mono />
          <InfoRow label="Working directory" value={job.workingDir ?? '—'} mono />
          <InfoRow label="Dataset" value={job.datasetPath ?? '—'} mono />
          <InfoRow label="Output directory" value={job.outputDir ?? '—'} mono />
        </Card>
      </div>
    </div>
  )
}

function LiveMetricsTab({ job }: { job: Job }) {
  const a = job.actual
  const running = job.status === 'RUNNING'
  const latestMetric = job.metrics.at(-1)
  const haveSeries = job.utilization.length >= 2

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <MetricStat label="GPU Utilization" value={running ? fmt(a?.gpuUtilization, '%') : '—'} highlight />
        <MetricStat label="GPU Memory" value={running && a ? `${a.gpuVramUsedGb.toFixed(1)} / ${a.gpuVramGb.toFixed(1)} GB` : '—'} />
        <MetricStat label="GPU Temp" value={running ? fmt(a?.temperatureC, ' °C') : '—'} />
        <MetricStat label="GPU Power" value={running ? fmt(a?.powerWatts, ' W') : '—'} />
        <MetricStat label="CPU" value={running ? fmt(a?.cpuUtilization, '%') : '—'} />
        <MetricStat label="Loss (from logs)" value={latestMetric ? latestMetric.loss.toFixed(3) : '—'} />
      </div>
      {!running && <Empty>Live readings appear while the job is RUNNING. Finished jobs keep their logs; per-job history needs Prometheus.</Empty>}

      <div className="grid gap-5 lg:grid-cols-2">
        <ChartCard title="GPU & CPU utilization (%) — node readings since you opened this page">
          {haveSeries ? (
            <MetricLineChart
              data={job.utilization}
              series={[
                { dataKey: 'gpuUtilization', name: 'GPU %', color: '#22D3EE' },
                { dataKey: 'cpuUtilization', name: 'CPU %', color: '#A78BFA' },
              ]}
              yDomain={[0, 100]}
            />
          ) : (
            <Empty>Collecting samples… one point is added every few seconds while the job runs.</Empty>
          )}
        </ChartCard>

        <ChartCard title="Training loss — parsed from the job's log lines">
          {job.metrics.length > 0 ? (
            <MetricLineChart data={job.metrics} series={[{ dataKey: 'loss', name: 'Loss', color: '#F87171' }]} />
          ) : (
            <Empty>
              No loss values found. Print lines such as <code className="text-accent">epoch 3 loss 0.412 acc 87.1</code> in your
              script and they are plotted here.
            </Empty>
          )}
        </ChartCard>

        {job.metrics.some((m) => m.accuracy > 0) && (
          <ChartCard title="Accuracy (%) — parsed from the job's log lines">
            <MetricLineChart
              data={job.metrics}
              series={[{ dataKey: 'accuracy', name: 'Accuracy %', color: '#34D399' }]}
              yDomain={[0, 100]}
            />
          </ChartCard>
        )}
      </div>
    </div>
  )
}

function MetricStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={cn('rounded-[var(--radius-card)] border border-border bg-surface p-3.5', highlight && 'border-accent/40 bg-accent/5')}>
      <div className={cn('tabular text-[18px] font-bold', highlight ? 'text-accent' : 'text-text-primary')}>{value}</div>
      <div className="mt-0.5 text-[11px] uppercase tracking-wider text-text-muted">{label}</div>
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

function ResourcesTab({ job }: { job: Job }) {
  return (
    <div className="space-y-5">
      <ResourceSummary job={job} />
      {job.nodeCount > 1 && <DistributedView job={job} />}
    </div>
  )
}

function EnvironmentTab({ job }: { job: Job }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Container" icon={<Boxes size={13} />}>
          <InfoRow label="Runtime" value={job.image ? 'Apptainer' : 'direct on the node'} />
          <InfoRow label="Image" value={job.image ?? 'none'} mono />
          <p className="pt-2 text-[11.5px] text-text-muted">
            Python, CUDA and framework versions are inside the image. To see them, run{' '}
            <code className="text-accent">python -c "import torch; print(torch.__version__, torch.version.cuda)"</code> as a job.
          </p>
        </Card>
        <Card title="Paths" icon={<FolderOpen size={13} />}>
          <InfoRow label="Working directory" value={job.workingDir ?? '—'} mono />
          <InfoRow label="Dataset" value={job.datasetPath ?? '—'} mono />
          <InfoRow label="Output directory" value={job.outputDir ?? '—'} mono />
        </Card>
      </div>

      <Card title="Environment variables (names only; values stay on the server)">
        {job.envKeys && job.envKeys.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {job.envKeys.map((k) => (
              <span key={k} className="rounded border border-border bg-bg-secondary px-2 py-1 font-mono text-[12px] text-accent">
                {k}
              </span>
            ))}
          </div>
        ) : (
          <Empty>No custom environment variables were set for this job.</Empty>
        )}
      </Card>
    </div>
  )
}

function OutputTab({ job }: { job: Job }) {
  return (
    <Card title="Output location" icon={<FolderOpen size={13} />}>
      <InfoRow label="Output directory" value={job.outputDir ?? 'job default (your home directory)'} mono />
      <p className="pt-3 text-[12px] text-text-muted">
        Files your job writes there live on the shared storage and are visible from every node. ClusterOne does not list or
        download them; open the path from a login node or VS Code Remote-SSH. The job's console output is on the Logs tab.
      </p>
    </Card>
  )
}

function EventsTab({ job }: { job: Job }) {
  const where = executingOn(job)
  const events: { time: string; name: string; desc: string }[] = [
    { time: job.submittedAt, name: 'Submitted', desc: `by ${job.owner} through the ClusterOne portal` },
  ]
  if (job.startedAt) {
    events.push({ time: job.startedAt, name: 'Started', desc: where ? `running on ${where}` : 'running on a compute node' })
  }
  if (job.completedAt) {
    events.push({
      time: job.completedAt,
      name: job.status.charAt(0) + job.status.slice(1).toLowerCase(),
      desc: [job.exitCode != null ? `exit code ${job.exitCode}` : '', job.statusMessage ?? ''].filter(Boolean).join(' · ') || 'finished',
    })
  }

  return (
    <Card title="Job history (recorded timestamps)">
      <ol className="relative ml-3 space-y-4 border-l border-border/80">
        {events.map((e) => (
          <li key={e.name} className="ml-4">
            <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-accent bg-[#0B0F19]" />
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text-primary">{e.name}</span>
              <span className="font-mono text-[11px] text-text-muted">{formatDateTime(e.time)}</span>
            </div>
            <p className="mt-0.5 text-[12.5px] text-text-secondary">{e.desc}</p>
          </li>
        ))}
      </ol>
    </Card>
  )
}
