import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Server, Cpu, MemoryStick, Play } from 'lucide-react'
import { request } from '@/services/api'
import { usePolling } from '@/hooks/usePolling'
import { ProgressBar } from '@/components/common/ProgressBar'
import { cn } from '@/lib/format'

interface ApiNode {
  id: string
  hostname: string
  ip_address: string | null
  cpu_cores: number
  ram_total_mb: number
  ram_used_mb: number
  cpu_util_pct: number
  status: string
  gpus: { name: string; vram_total_mb: number; vram_used_mb: number; utilization_pct: number }[]
}

const gb = (mb: number) => (mb / 1024).toFixed(1)

export function NodesPage() {
  const [nodes, setNodes] = useState<ApiNode[] | null>(null)
  const [error, setError] = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      setNodes(await request<ApiNode[]>('/v1/nodes'))
      setError(false)
    } catch {
      setError(true)
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  usePolling(() => void load(), 2000)

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold text-text-primary">Nodes</h1>
      <p className="text-[13.5px] text-text-secondary">
        Machines connected to ClusterOne. Pick one to run work on its CPU, RAM and GPU.
      </p>
      {error && (
        <p className="rounded-md bg-status-failed-soft px-3 py-2 text-[13px] text-status-failed">
          Cannot reach the ClusterOne backend (port 8000).
        </p>
      )}
      {nodes?.length === 0 && <p className="text-[13px] text-text-secondary">No nodes connected yet. Start the node agent on a PC.</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {nodes?.map((n) => {
          const online = n.status === 'ONLINE' || n.status === 'BUSY'
          return (
            <div key={n.id} className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-[14px] font-semibold text-text-primary">
                  <Server size={15} className="text-text-muted" />
                  {n.hostname}
                </span>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase',
                    online ? 'bg-status-running-soft text-status-running' : 'bg-status-failed-soft text-status-failed',
                  )}
                >
                  {online ? 'Online' : 'Offline'}
                </span>
              </div>
              <div className="text-[11.5px] text-text-muted">{n.ip_address ?? 'unknown IP'}</div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[12px] text-text-secondary">
                  <Cpu size={13} /> CPU · {n.cpu_cores} cores
                </div>
                <ProgressBar value={Math.round(n.cpu_util_pct)} size="sm" showLabel />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-[12px] text-text-secondary">
                  <MemoryStick size={13} /> RAM · {gb(n.ram_used_mb)} / {gb(n.ram_total_mb)} GB
                </div>
                <ProgressBar value={Math.round((n.ram_used_mb / Math.max(1, n.ram_total_mb)) * 100)} size="sm" showLabel />
              </div>

              {n.gpus.length === 0 && <div className="text-[12px] text-text-muted">No GPU detected</div>}
              {n.gpus.map((g, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="text-[12px] text-text-secondary">
                    GPU · {g.name} · VRAM {gb(g.vram_used_mb)} / {gb(g.vram_total_mb)} GB
                  </div>
                  <ProgressBar value={Math.round(g.utilization_pct)} size="sm" showLabel />
                </div>
              ))}

              <button
                disabled={!online}
                onClick={() => navigate(`/run?node=${n.id}`)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-40"
              >
                <Play size={14} /> Use this node
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
