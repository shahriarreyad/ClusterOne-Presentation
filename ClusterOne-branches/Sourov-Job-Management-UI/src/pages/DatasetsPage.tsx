import { Database } from 'lucide-react'
import { DATASETS } from '@/data/mockData'
import { DemoDataBadge } from '@/components/common/States'
import { formatDateTime } from '@/lib/format'

export function DatasetsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <h1 className="text-[22px] font-bold text-text-primary">Datasets</h1>
        <DemoDataBadge />
      </div>
      <p className="text-[13.5px] text-text-secondary">Centrally managed datasets available to jobs on the cluster.</p>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg-secondary text-[11px] uppercase tracking-wide text-text-muted">
              <th className="px-4 py-3 font-medium">Dataset</th>
              <th className="px-4 py-3 font-medium">Size</th>
              <th className="px-4 py-3 font-medium">Samples</th>
              <th className="px-4 py-3 font-medium">Format</th>
              <th className="px-4 py-3 font-medium">Owner</th>
              <th className="px-4 py-3 font-medium">Access</th>
              <th className="px-4 py-3 font-medium">Last Updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {DATASETS.map((d) => (
              <tr key={d.id}>
                <td className="px-4 py-3 font-medium text-text-primary">
                  <span className="flex items-center gap-2">
                    <Database size={13} className="text-text-muted" />
                    {d.name}
                  </span>
                </td>
                <td className="px-4 py-3 text-text-secondary">{d.sizeGb} GB</td>
                <td className="px-4 py-3 text-text-secondary">{d.samples.toLocaleString()}</td>
                <td className="px-4 py-3 text-text-secondary">{d.format}</td>
                <td className="px-4 py-3 text-text-secondary">{d.owner}</td>
                <td className="px-4 py-3 text-text-secondary">{d.access === 'READ_ONLY' ? 'Read Only' : 'Read/Write'}</td>
                <td className="px-4 py-3 text-text-secondary">{formatDateTime(d.lastUpdated)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
