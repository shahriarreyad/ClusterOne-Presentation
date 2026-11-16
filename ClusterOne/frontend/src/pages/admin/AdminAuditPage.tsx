import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'
import { fetchClusterActivity, type ActivityEventResponse } from '@/services/clusterService'
import { formatDateTime } from '@/lib/format'

export function AdminAuditPage() {
  const [logs, setLogs] = useState<ActivityEventResponse[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchClusterActivity(100).then(setLogs).catch(() => null)
  }, [])

  const filtered = logs.filter(
    (l) => l.message.toLowerCase().includes(query.toLowerCase()) || l.event_type.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">System Audit Logs</h1>
          <p className="text-[13.5px] text-text-secondary">
            Immutable chronological audit trail of all cluster administrative and scheduling actions.
          </p>
        </div>

        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search audit trail..."
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-9 pr-3 text-[12.5px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
        <table className="w-full border-collapse text-left text-[12.5px]">
          <thead>
            <tr className="border-b border-border bg-bg-secondary text-[11px] uppercase tracking-wider text-text-muted font-medium">
              <th className="px-4 py-3">Timestamp</th>
              <th className="px-4 py-3">Event Type</th>
              <th className="px-4 py-3">Target ID</th>
              <th className="px-4 py-3">Audit Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono">
            {filtered.map((l) => (
              <tr key={l.id} className="hover:bg-surface-hover/50">
                <td className="px-4 py-3 text-text-muted text-[11.5px] whitespace-nowrap">
                  {formatDateTime(l.timestamp)}
                </td>
                <td className="px-4 py-3 text-accent font-bold uppercase">{l.event_type}</td>
                <td className="px-4 py-3 text-text-secondary">{l.target_id || '—'}</td>
                <td className="px-4 py-3 font-sans text-text-primary">{l.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
