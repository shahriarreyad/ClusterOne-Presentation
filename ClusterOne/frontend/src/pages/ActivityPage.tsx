import { useCallback, useEffect, useState } from 'react'
import { fetchClusterActivity, type ActivityEventResponse } from '@/services/clusterService'
import { usePolling } from '@/hooks/usePolling'
import { formatDateTime, cn } from '@/lib/format'

export function ActivityPage() {
  const [events, setEvents] = useState<ActivityEventResponse[]>([])
  const [filter, setFilter] = useState<'all' | 'jobs' | 'nodes'>('all')

  const load = useCallback(async () => {
    try {
      const data = await fetchClusterActivity(60)
      setEvents(data)
    } catch {
      // Keep existing events
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  usePolling(() => void load(), 4000)

  const filtered = events.filter((e) => {
    if (filter === 'jobs') return e.target_type === 'job' || e.event_type.toLowerCase().includes('job')
    if (filter === 'nodes') return e.target_type === 'node' || e.event_type.toLowerCase().includes('node')
    return true
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Cluster Activity & Event Stream</h1>
          <p className="text-[13.5px] text-text-secondary">
            Real-time audit log of job lifecycle changes, node heartbeats, and cluster scheduling events.
          </p>
        </div>

        {/* Filter buttons */}
        <div className="flex items-center rounded-lg border border-border bg-surface p-1">
          <button
            onClick={() => setFilter('all')}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
              filter === 'all' ? 'bg-accent/15 text-accent font-semibold' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            All Events
          </button>
          <button
            onClick={() => setFilter('jobs')}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
              filter === 'jobs' ? 'bg-accent/15 text-accent font-semibold' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            Jobs Only
          </button>
          <button
            onClick={() => setFilter('nodes')}
            className={cn(
              'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
              filter === 'nodes' ? 'bg-accent/15 text-accent font-semibold' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            Nodes Only
          </button>
        </div>
      </div>

      {/* Events Timeline */}
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-text-muted text-[13px]">
            No activity events recorded yet. New submissions and telemetry updates will stream here.
          </div>
        ) : (
          <ol className="relative border-l border-border/80 ml-4 space-y-4">
            {filtered.map((e) => {
              const isSuccess = e.tone === 'success'
              const isWarning = e.tone === 'warning'
              const isError = e.tone === 'error'

              return (
                <li key={e.id} className="ml-5">
                  <div
                    className={cn(
                      'absolute -left-2 mt-1.5 h-4 w-4 rounded-full border-2 bg-[#0B0F19] flex items-center justify-center',
                      isSuccess && 'border-status-running text-status-running',
                      isWarning && 'border-amber-400 text-amber-400',
                      isError && 'border-status-failed text-status-failed',
                      !isSuccess && !isWarning && !isError && 'border-accent text-accent',
                    )}
                  />
                  <div className="rounded-lg border border-border/60 bg-bg-secondary p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold uppercase tracking-wider text-accent">
                          {e.event_type}
                        </span>
                        {e.target_id && (
                          <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-[11px] text-text-muted">
                            {e.target_type === 'job' ? `#${e.target_id}` : e.target_id}
                          </span>
                        )}
                      </div>
                      <span className="font-mono text-[11.5px] text-text-muted">
                        {formatDateTime(e.timestamp)}
                      </span>
                    </div>
                    <p className="mt-1 text-[13px] text-text-primary font-medium">{e.message}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </div>
    </div>
  )
}
