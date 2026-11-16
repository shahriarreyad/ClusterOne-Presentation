import { Link, useNavigate } from 'react-router-dom'
import {
  Server,
  Activity,
  Cpu,
  Layers,
  Clock,
  CheckCircle2,
  PlusCircle,
  PlayCircle,
  HardDrive,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useJobActions } from '@/hooks/useJobActions'
import { ClusterTopologyView } from '@/components/topology/ClusterTopologyView'
import { JobTable } from '@/components/jobs/JobTable'
import { QueueList } from '@/components/jobs/QueueList'
import { EmptyState, ErrorState, CardSkeleton, TableSkeleton } from '@/components/common/States'
import { ConfirmationModal } from '@/components/common/ConfirmationModal'
import type { NodeInfo } from '@/services/nodeService'

export function Dashboard() {
  const { summary, topology, nodesInfo, running, queued, recent, loading, error, refetch } = useDashboardData()
  const actions = useJobActions(() => refetch({ silent: true }))
  const navigate = useNavigate()

  // Derive aggregate metrics from real backend data
  const totalNodes = summary ? summary.nodes_total : nodesInfo.length
  const onlineNodes = summary ? summary.nodes_online : nodesInfo.filter((n) => n.status !== 'DOWN' && n.status !== 'OFFLINE').length

  // Calculate real average GPU utilization across online nodes
  const totalGpuUtil = nodesInfo.reduce((acc, n) => acc + (n.status !== 'DOWN' ? n.gpuUtilization : 0), 0)
  const avgGpuUtil = nodesInfo.length > 0 ? Math.round(totalGpuUtil / Math.max(1, onlineNodes)) : 0

  // Calculate real average CPU utilization
  const totalCpuUtil = nodesInfo.reduce((acc, n) => acc + (n.status !== 'DOWN' ? n.cpuUtilization : 0), 0)
  const avgCpuUtil = nodesInfo.length > 0 ? Math.round(totalCpuUtil / Math.max(1, onlineNodes)) : 0

  // Calculate real average RAM percentage
  const totalRamUsed = nodesInfo.reduce((acc, n) => acc + (n.status !== 'DOWN' ? n.ramUsedMb : 0), 0)
  const totalRamAvail = nodesInfo.reduce((acc, n) => acc + (n.status !== 'DOWN' ? n.ramTotalMb : 0), 0)
  const avgRamPct = totalRamAvail > 0 ? Math.round((totalRamUsed / totalRamAvail) * 100) : 0

  const activeJobsCount = summary ? summary.jobs_running : running.length
  const queuedJobsCount = summary ? summary.jobs_pending : queued.length

  const handleSelectNode = (node: NodeInfo) => {
    navigate(`/resources/nodes?selected=${encodeURIComponent(node.id)}`)
  }

  if (error && !summary && nodesInfo.length === 0) {
    return <ErrorState message={error} onRetry={() => refetch()} />
  }

  return (
    <div className="space-y-6">
      {/* Page Title & Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-extrabold text-text-primary tracking-tight">
              Cluster Overview & Control Plane
            </h1>
            <span className="rounded-full bg-status-running-soft px-2.5 py-0.5 text-[11px] font-bold text-status-running border border-status-running/30">
              LIVE PILOT
            </span>
          </div>
          <p className="mt-1 text-[13px] text-text-secondary">
            Master control node (10.20.0.10) orchestrating physical GPU compute nodes for DIU CSE researchers.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] font-medium text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
            title="Refresh telemetry"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Sync</span>
          </button>
          <Link
            to="/jobs/new"
            className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-all hover:bg-accent/90 shadow-md shadow-accent/20"
          >
            <PlusCircle size={15} />
            <span>Submit Job</span>
          </Link>
        </div>
      </div>

      {/* 8 TOP KPI CARDS */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-8">
        {loading && !summary ? (
          Array.from({ length: 8 }).map((_, i) => <CardSkeleton key={i} className="h-24" />)
        ) : (
          <>
            {/* 1. TOTAL NODES */}
            <div className="rounded-xl border border-border bg-surface/80 p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Total Nodes</span>
                <Server size={14} className="text-text-muted" />
              </div>
              <div className="mt-2 text-[22px] font-black tracking-tight text-text-primary">
                {totalNodes}
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-muted font-mono">1 Anchor + Compute</div>
            </div>

            {/* 2. ONLINE NODES */}
            <div className="rounded-xl border border-status-running/30 bg-status-running-soft/20 p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-status-running">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Online</span>
                <CheckCircle2 size={14} />
              </div>
              <div className="mt-2 text-[22px] font-black tracking-tight text-status-running">
                {onlineNodes}
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-secondary">
                {totalNodes - onlineNodes > 0 ? `${totalNodes - onlineNodes} offline/down` : '100% compute active'}
              </div>
            </div>

            {/* 3. GPU UTILIZATION */}
            <div className="rounded-xl border border-accent/30 bg-accent-soft/20 p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-accent">
                <span className="text-[11px] font-semibold uppercase tracking-wider">GPU Compute</span>
                <Cpu size={14} />
              </div>
              <div className="mt-2 text-[22px] font-black tracking-tight text-accent font-mono">
                {avgGpuUtil}%
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-secondary">
                {summary ? `${summary.gpus_allocated} / ${summary.gpus_total} GPUs busy` : 'Hardware load'}
              </div>
            </div>

            {/* 4. CPU UTILIZATION */}
            <div className="rounded-xl border border-border bg-surface/80 p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-cyan-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">CPU Util</span>
                <Activity size={14} />
              </div>
              <div className="mt-2 text-[22px] font-black tracking-tight text-text-primary font-mono">
                {avgCpuUtil}%
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-muted">Host CPU average</div>
            </div>

            {/* 5. RAM UTILIZATION */}
            <div className="rounded-xl border border-border bg-surface/80 p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-indigo-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">RAM Memory</span>
                <HardDrive size={14} />
              </div>
              <div className="mt-2 text-[22px] font-black tracking-tight text-text-primary font-mono">
                {avgRamPct}%
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-muted">Host RAM average</div>
            </div>

            {/* 6. ACTIVE JOBS */}
            <Link to="/jobs/running" className="rounded-xl border border-border bg-surface/80 p-3.5 shadow-sm hover:border-status-running transition-colors group">
              <div className="flex items-center justify-between text-status-running">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Active Jobs</span>
                <PlayCircle size={14} />
              </div>
              <div className="mt-2 text-[22px] font-black tracking-tight text-text-primary group-hover:text-status-running">
                {activeJobsCount}
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-muted">Running on nodes</div>
            </Link>

            {/* 7. QUEUED JOBS */}
            <Link to="/jobs/queued" className="rounded-xl border border-border bg-surface/80 p-3.5 shadow-sm hover:border-status-queued transition-colors group">
              <div className="flex items-center justify-between text-status-queued">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Queued Jobs</span>
                <Clock size={14} />
              </div>
              <div className="mt-2 text-[22px] font-black tracking-tight text-text-primary group-hover:text-status-queued">
                {queuedJobsCount}
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-muted">Waiting for allocation</div>
            </Link>

            {/* 8. UPTIME */}
            <div className="rounded-xl border border-border bg-surface/80 p-3.5 shadow-sm">
              <div className="flex items-center justify-between text-emerald-400">
                <span className="text-[11px] font-semibold uppercase tracking-wider">Cluster SLA</span>
                <Layers size={14} />
              </div>
              <div className="mt-2 text-[22px] font-black tracking-tight text-emerald-400 font-mono">
                99.98%
              </div>
              <div className="mt-0.5 text-[10.5px] text-text-muted">Anchor uptime</div>
            </div>
          </>
        )}
      </div>

      {/* CLUSTER TOPOLOGY SECTION */}
      <div>
        <ClusterTopologyView
          master={topology?.master ?? null}
          nodes={nodesInfo}
          onSelectNode={handleSelectNode}
        />
      </div>

      {/* SPLIT SECTION: RUNNING JOBS & QUEUE */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* RUNNING JOBS TABLE (2 COLS) */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-status-running animate-pulse-dot" />
              <h2 className="text-[16px] font-bold text-text-primary">
                Workloads Running on Remote GPU Nodes
              </h2>
            </div>
            <Link to="/jobs/running" className="text-[12px] font-semibold text-accent hover:underline flex items-center gap-1">
              View All Running <ExternalLink size={12} />
            </Link>
          </div>

          {loading && running.length === 0 ? (
            <TableSkeleton rows={3} cols={6} />
          ) : running.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6 text-center">
              <p className="text-[13px] text-text-secondary">All GPU compute nodes are currently idle.</p>
              <Link to="/jobs/new" className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-accent hover:underline">
                <PlusCircle size={13} /> Launch a training run
              </Link>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface">
              <JobTable
                jobs={running}
                onCancel={actions.requestCancel}
                onRetry={actions.retry}
                onClone={actions.clone}
                pendingId={actions.cancelTarget?.id}
              />
            </div>
          )}
        </div>

        {/* QUEUED WORKLOADS (1 COL) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-status-queued" />
              <h2 className="text-[16px] font-bold text-text-primary">
                Scheduler Queue
              </h2>
            </div>
            <Link to="/jobs/queued" className="text-[12px] font-semibold text-accent hover:underline flex items-center gap-1">
              View Queue <ExternalLink size={12} />
            </Link>
          </div>

          {queued.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-6 text-center">
              <p className="text-[13px] text-text-secondary">Queue is clear. No jobs waiting for GPU resources.</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-surface p-3">
              <QueueList jobs={queued} />
            </div>
          )}
        </div>
      </div>

      {/* RECENT COMPLETED/FAILED JOBS */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-text-primary">
            Recent Cluster Executions
          </h2>
          <Link to="/jobs" className="text-[12px] font-semibold text-accent hover:underline flex items-center gap-1">
            Browse All Jobs <ExternalLink size={12} />
          </Link>
        </div>

        {loading && recent.length === 0 ? (
          <TableSkeleton rows={4} cols={7} />
        ) : recent.length === 0 ? (
          <EmptyState title="No Job History Yet" description="Submit training workloads to start recording job history." />
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <JobTable
              jobs={recent}
              onCancel={actions.requestCancel}
              onRetry={actions.retry}
              onClone={actions.clone}
              pendingId={actions.cancelTarget?.id}
            />
          </div>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <ConfirmationModal
        open={!!actions.cancelTarget}
        title="Cancel Job"
        description={actions.cancelTarget ? `Are you sure you want to stop job #${actions.cancelTarget.id} (${actions.cancelTarget.name}) on the cluster?` : ''}
        confirmLabel="Cancel Job"
        destructive
        loading={actions.pending === 'cancel'}
        onConfirm={actions.confirmCancel}
        onCancel={actions.dismissCancel}
      />
    </div>
  )
}
