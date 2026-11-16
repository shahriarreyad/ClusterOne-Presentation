import { Cpu } from 'lucide-react'
import { useNodes } from '@/hooks/useNodes'
import { DemoDataBadge } from '@/components/common/States'
import { cn } from '@/lib/format'

export function GpusPage() {
  const { nodes, live, gpuSummary } = useNodes()
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-[22px] font-bold text-text-primary">GPUs</h1>
        {!live && <DemoDataBadge />}
      </div>
      <p className="text-[13.5px] text-text-secondary">GPU availability across the cluster, by model.</p>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {gpuSummary.map((g) => (
          <div key={g.model} className="rounded-[var(--radius-card)] border border-border bg-surface p-4 text-center">
            <span className="mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Cpu size={17} />
            </span>
            <div className="text-[13.5px] font-semibold text-text-primary">{g.model}</div>
            <div className={cn('tabular mt-1 text-[13px] font-medium', g.available > 0 ? 'text-status-running' : 'text-status-failed')}>
              {g.available} / {g.total} available
            </div>
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg-secondary text-[11px] uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">GPU</th>
              <th className="px-4 py-3 font-medium">Model</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Current Job</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {nodes.map((n) => (
              <tr key={n.id}>
                <td className="px-4 py-3 text-text-primary">{n.id}</td>
                <td className="px-4 py-3 text-text-secondary">{n.gpuModel}</td>
                <td className="px-4 py-3 text-text-secondary">{n.status}</td>
                <td className="px-4 py-3 text-text-secondary">{n.jobId && n.status === 'BUSY' ? `#${n.jobId}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
