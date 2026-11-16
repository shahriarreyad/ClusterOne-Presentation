import { useEffect, useState } from 'react'
import { fetchPartitions, type PartitionSummaryResponse } from '@/services/clusterService'

export function AdminPartitionsPage() {
  const [partitions, setPartitions] = useState<PartitionSummaryResponse[]>([])

  useEffect(() => {
    fetchPartitions().then(setPartitions).catch(() => null)
  }, [])

  const defaultPartitions = [
    {
      name: 'gpu',
      description: 'Exclusive physical GPU allocation for deep learning research and high-performance training.',
      allocation_mode: 'EXCLUSIVE',
      default_time_limit: '04:00:00',
      max_time_limit: '72:00:00',
      max_gpus_per_job: 8,
      nodes_count: 5,
      active_jobs: 2,
    },
    {
      name: 'teaching',
      description: 'Shared MPS GPU partition for classroom exercises and undergraduate thesis laboratory work.',
      allocation_mode: 'MPS_SHARED',
      default_time_limit: '02:00:00',
      max_time_limit: '08:00:00',
      max_gpus_per_job: 1,
      nodes_count: 3,
      active_jobs: 1,
    },
    {
      name: 'interactive',
      description: 'High-priority interactive session partition for JupyterLab, script debugging, and smoke tests.',
      allocation_mode: 'EXCLUSIVE',
      default_time_limit: '01:00:00',
      max_time_limit: '02:00:00',
      max_gpus_per_job: 2,
      nodes_count: 2,
      active_jobs: 0,
    },
  ]

  const data = partitions.length > 0 ? partitions : defaultPartitions

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary">Cluster Partitions</h1>
        <p className="text-[13.5px] text-text-secondary">
          Slurm queues and workload routing policies configured on the master anchor server.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {data.map((p) => (
          <div key={p.name} className="flex flex-col justify-between rounded-[var(--radius-card)] border border-border bg-surface p-4.5 space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <span className="font-mono text-[16px] font-bold text-accent">{p.name}</span>
                <span className="rounded bg-bg-secondary px-2 py-0.5 font-mono text-[11px] text-text-muted">
                  {p.allocation_mode}
                </span>
              </div>
              <p className="mt-2 text-[12.5px] text-text-secondary leading-relaxed">{p.description}</p>

              <div className="mt-3 space-y-1.5 border-t border-border/80 pt-2.5 font-mono text-[12px]">
                <div className="flex justify-between text-text-secondary">
                  <span className="text-text-muted">Max Walltime:</span>
                  <span className="text-text-primary">{p.max_time_limit}</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span className="text-text-muted">Max GPUs / Job:</span>
                  <span className="text-text-primary">{p.max_gpus_per_job} GPUs</span>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <span className="text-text-muted">Active Workloads:</span>
                  <span className="text-status-running font-bold">{p.active_jobs}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-border/80 pt-2 text-[11.5px] text-text-muted">
              Nodes Assigned: <strong className="text-text-primary">{p.nodes_count ?? 4} nodes</strong>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
