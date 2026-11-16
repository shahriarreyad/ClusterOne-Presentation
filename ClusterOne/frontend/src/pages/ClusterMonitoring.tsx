import { Link } from 'react-router-dom'
import { ActivitySquare, Server, Cpu } from 'lucide-react'
import { MOCK_JOBS } from '@/data/mockData'
import { useNodes } from '@/hooks/useNodes'
import { StatCard } from '@/components/common/StatCard'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ProgressBar } from '@/components/common/ProgressBar'
import { DemoDataBadge } from '@/components/common/States'

export function ClusterMonitoring() {
  const { nodes: NODES, live } = useNodes()
  const CLUSTER_HEALTH = NODES.some((n) => n.status === 'OFFLINE') ? 'DEGRADED' : 'HEALTHY'
  const busy = NODES.filter((n) => n.status === 'BUSY')
  const idle = NODES.filter((n) => n.status === 'IDLE')
  const offline = NODES.filter((n) => n.status === 'OFFLINE')
  const avgUtil = busy.length ? Math.round(busy.reduce((s, n) => s + n.utilization, 0) / busy.length) : 0
  const runningJobs = MOCK_JOBS.filter((j) => j.status === 'RUNNING')

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-[22px] font-bold text-text-primary">Cluster Monitoring</h1>
        {!live && <DemoDataBadge />}
      </div>
      <p className="text-[13.5px] text-text-secondary">A live view of node health and GPU utilization across the cluster.</p>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Cluster Status" value={CLUSTER_HEALTH === 'HEALTHY' ? 'Healthy' : 'Degraded'} icon={ActivitySquare} tone={CLUSTER_HEALTH === 'HEALTHY' ? 'success' : 'error'} />
        <StatCard label="Nodes Busy" value={busy.length} icon={Server} tone="warning" />
        <StatCard label="Nodes Idle" value={idle.length} icon={Server} tone="default" />
        <StatCard label="Avg GPU Utilization" value={`${avgUtil}%`} icon={Cpu} tone="info" />
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Node Utilization</h3>
        <div className="space-y-3">
          {NODES.map((n) => (
            <div key={n.id} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-[12.5px] font-medium text-text-primary">{n.id}</span>
              <span className="w-24 shrink-0 text-[11.5px] text-text-muted">{n.gpuModel}</span>
              {n.status === 'OFFLINE' ? (
                <span className="text-[11.5px] text-status-failed">Offline</span>
              ) : (
                <ProgressBar value={n.utilization} size="sm" showLabel className="flex-1" />
              )}
            </div>
          ))}
          {offline.length > 0 && <p className="pt-1 text-[11.5px] text-text-muted">{offline.length} node(s) currently offline.</p>}
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[14.5px] font-semibold text-text-primary">Active Workloads</h3>
        {runningJobs.length === 0 ? (
          <p className="text-[13px] text-text-secondary">No jobs are currently running.</p>
        ) : (
          <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
            {runningJobs.map((j) => (
              <li key={j.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <Link to={`/jobs/${j.id}`} className="text-[13px] font-medium text-text-primary hover:text-accent">
                  {j.name} <span className="tabular text-text-muted">#{j.id}</span>
                </Link>
                <div className="flex items-center gap-3">
                  <ProgressBar value={j.progress} size="sm" showLabel className="w-28" />
                  <StatusBadge status={j.status} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
