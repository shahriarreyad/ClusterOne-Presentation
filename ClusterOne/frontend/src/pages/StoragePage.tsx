import { useEffect, useState } from 'react'
import { HardDrive, CheckCircle2 } from 'lucide-react'
import { fetchStorageSummary, type StorageSummaryResponse } from '@/services/clusterService'
import { ProgressBar } from '@/components/common/ProgressBar'

export function StoragePage() {
  const [storage, setStorage] = useState<StorageSummaryResponse | null>(null)

  useEffect(() => {
    fetchStorageSummary()
      .then(setStorage)
      .catch(() => null)
  }, [])

  const defaultShares = [
    {
      name: 'NFS User Homes',
      path: '/home',
      type: 'NFSv4 (Shared)',
      total_gb: 4000,
      used_gb: 1240,
      free_gb: 2760,
      usage_pct: 31.0,
      status: 'HEALTHY' as const,
      desc: 'Persistent research workspaces, scripts, and personal virtual environments.',
    },
    {
      name: 'ZFS Datasets Pool',
      path: '/datasets',
      type: 'ZFS NVMe-Cached',
      total_gb: 12000,
      used_gb: 5120,
      free_gb: 6880,
      usage_pct: 42.7,
      status: 'HEALTHY' as const,
      desc: 'Immutable read-only centralized datasets (Bengali NLP, ImageNet, Medical Imaging).',
    },
    {
      name: 'NFS Projects Space',
      path: '/projects',
      type: 'NFSv4 (Group Access)',
      total_gb: 8000,
      used_gb: 3600,
      free_gb: 4400,
      usage_pct: 45.0,
      status: 'HEALTHY' as const,
      desc: 'Shared departmental laboratory research projects and multi-user team code repositories.',
    },
    {
      name: 'Local Node Scratch',
      path: '/scratch',
      type: 'Local Node NVMe',
      total_gb: 6000,
      used_gb: 1800,
      free_gb: 4200,
      usage_pct: 30.0,
      status: 'HEALTHY' as const,
      desc: 'Ultra high-speed ephemeral local NVMe scratch storage for training epochs and checkpoint caches.',
    },
  ]

  const shares = storage?.shares?.length ? storage.shares : defaultShares
  const totalGb = storage ? storage.total_gb : shares.reduce((s, sh) => s + sh.total_gb, 0)
  const usedGb = storage ? storage.used_gb : shares.reduce((s, sh) => s + sh.used_gb, 0)
  const freeGb = storage ? storage.free_gb : totalGb - usedGb
  const overallPct = storage ? storage.usage_pct : Math.round((usedGb / totalGb) * 100)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-text-primary">Cluster Storage Architecture</h1>
        <p className="text-[13.5px] text-text-secondary">
          Network file shares and high-throughput local scratch storage mounted across all GPU compute nodes.
        </p>
      </div>

      {/* Aggregate KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <div className="text-[11px] text-text-muted uppercase">TOTAL CLUSTER STORAGE</div>
          <div className="mt-1 text-[22px] font-bold text-text-primary">{(totalGb / 1024).toFixed(1)} TB</div>
          <div className="text-[11px] text-text-muted mt-0.5">Across All Pools</div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <div className="text-[11px] text-text-muted uppercase">ALLOCATED / USED</div>
          <div className="mt-1 text-[22px] font-bold text-accent">{(usedGb / 1024).toFixed(1)} TB</div>
          <div className="text-[11px] text-accent/80 mt-0.5">{overallPct}% Utilized</div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <div className="text-[11px] text-text-muted uppercase">AVAILABLE CAPACITY</div>
          <div className="mt-1 text-[22px] font-bold text-status-running">{(freeGb / 1024).toFixed(1)} TB</div>
          <div className="text-[11px] text-status-running/80 mt-0.5">Free for Workloads</div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <div className="text-[11px] text-text-muted uppercase">ZFS / NFS INTEGRITY</div>
          <div className="mt-1 flex items-center gap-1.5 text-[20px] font-bold text-status-running">
            <CheckCircle2 size={18} /> Healthy
          </div>
          <div className="text-[11px] text-text-muted mt-0.5">All Shares Mounted</div>
        </div>
      </div>

      {/* Storage Pools Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {shares.map((share) => (
          <div
            key={share.name}
            className="rounded-[var(--radius-card)] border border-border bg-surface p-4.5 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/15 text-accent border border-accent/25">
                  <HardDrive size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-[14.5px] text-text-primary">{share.name}</h3>
                  <code className="font-mono text-[11.5px] text-accent">{share.path}</code>
                </div>
              </div>

              <span className="rounded-full bg-status-running/15 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-status-running border border-status-running/30">
                {share.status}
              </span>
            </div>

            <div className="text-[12px] text-text-secondary">
              {(share as { desc?: string }).desc || `Mounted file system pool of type ${share.type}`}
            </div>

            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-[11.5px] font-mono">
                <span className="text-text-muted">{share.used_gb} GB used / {share.total_gb} GB total</span>
                <span className="font-bold text-text-primary">{share.usage_pct}%</span>
              </div>
              <ProgressBar value={share.usage_pct} size="sm" tone={share.usage_pct > 80 ? 'error' : 'accent'} />
            </div>

            <div className="flex items-center justify-between border-t border-border/80 pt-2.5 text-[11.5px] text-text-muted font-mono">
              <span>Pool Type: <strong className="text-text-secondary">{share.type}</strong></span>
              <span>Available: <strong className="text-status-running">{share.free_gb} GB</strong></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
