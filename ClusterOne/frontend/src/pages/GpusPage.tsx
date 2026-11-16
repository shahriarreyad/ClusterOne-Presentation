import { useCallback, useEffect, useState } from 'react'
import { Cpu, Server, Thermometer, Zap } from 'lucide-react'
import { fetchNodesInfo, type NodeInfo } from '@/services/nodeService'
import { usePolling } from '@/hooks/usePolling'
import { ProgressBar } from '@/components/common/ProgressBar'
import { cn } from '@/lib/format'

interface FlatGpu {
  gpuIndex: number
  name: string
  nodeId: string
  nodeHostname: string
  nodeIp: string
  utilizationPct: number
  vramUsedMb: number
  vramTotalMb: number
  temperatureC: number | null
  powerW: number | null
  status: 'ALLOCATED' | 'IDLE' | 'OFFLINE'
  currentJobName?: string
}

export function GpusPage() {
  const [nodes, setNodes] = useState<NodeInfo[]>([])

  const load = useCallback(async () => {
    try {
      const data = await fetchNodesInfo()
      setNodes(data)
    } catch {
      // Keep existing data
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  usePolling(() => void load(), 3000)

  // Flatten all GPUs from all physical nodes
  const allGpus: FlatGpu[] = []
  nodes.forEach((n) => {
    const isOnline = n.status === 'ONLINE' || n.status === 'BUSY'
    const rawGpus = n.raw.gpus || []

    if (rawGpus.length === 0) {
      return // no NVIDIA GPU reported by this node: nothing to draw
    } else {
      rawGpus.forEach((g, idx) => {
        const isAllocated = g.utilization_pct > 10 || n.runningJobsCount > 0
        allGpus.push({
          gpuIndex: idx,
          name: g.name,
          nodeId: n.id,
          nodeHostname: n.hostname,
          nodeIp: n.ipAddress,
          utilizationPct: isOnline ? g.utilization_pct : 0,
          vramUsedMb: isOnline ? g.vram_used_mb : 0,
          vramTotalMb: g.vram_total_mb,
          temperatureC: isOnline ? (g.temperature_c ?? null) : null,
          powerW: isOnline ? (g.power_w ?? null) : null,
          status: !isOnline ? 'OFFLINE' : isAllocated ? 'ALLOCATED' : 'IDLE',
          currentJobName: n.currentJobs[idx]?.name,
        })
      })
    }
  })

  const total = allGpus.length
  const allocated = allGpus.filter((g) => g.status === 'ALLOCATED').length
  const idle = allGpus.filter((g) => g.status === 'IDLE').length
  const offline = allGpus.filter((g) => g.status === 'OFFLINE').length

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary">GPU Accelerators</h1>
        <p className="text-[13.5px] text-text-secondary">
          Physical GPU inventory and real-time execution states across the DIU CSE compute cluster.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono">
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <div className="text-[11px] text-text-muted uppercase">TOTAL GPUS</div>
          <div className="mt-1 text-[22px] font-bold text-text-primary">{total}</div>
          <div className="text-[11px] text-text-muted mt-0.5">Physical Cards</div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <div className="text-[11px] text-text-muted uppercase">ALLOCATED / BUSY</div>
          <div className="mt-1 text-[22px] font-bold text-accent">{allocated}</div>
          <div className="text-[11px] text-accent/80 mt-0.5">Running Research</div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <div className="text-[11px] text-text-muted uppercase">AVAILABLE / IDLE</div>
          <div className="mt-1 text-[22px] font-bold text-status-running">{idle}</div>
          <div className="text-[11px] text-status-running/80 mt-0.5">Ready for Jobs</div>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
          <div className="text-[11px] text-text-muted uppercase">OFFLINE / DOWN</div>
          <div className="mt-1 text-[22px] font-bold text-status-failed">{offline}</div>
          <div className="text-[11px] text-text-muted mt-0.5">Unreachable</div>
        </div>
      </div>

      {/* GPU Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {allGpus.map((gpu, idx) => {
          const vramPct = gpu.vramTotalMb > 0 ? Math.round((gpu.vramUsedMb / gpu.vramTotalMb) * 100) : 0

          return (
            <div
              key={`${gpu.nodeId}-${gpu.gpuIndex}-${idx}`}
              className={cn(
                'rounded-[var(--radius-card)] border bg-surface p-4.5 space-y-3 transition-all hover:border-accent/40',
                gpu.status === 'ALLOCATED'
                  ? 'border-accent/30 bg-accent/[0.02]'
                  : gpu.status === 'IDLE'
                  ? 'border-border'
                  : 'border-status-failed/30 opacity-60',
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent/15 text-accent border border-accent/25">
                    <Cpu size={16} />
                  </div>
                  <div>
                    <div className="font-semibold text-[13.5px] text-text-primary">{gpu.name}</div>
                    <div className="font-mono text-[11px] text-text-muted">
                      {gpu.nodeHostname} (GPU {gpu.gpuIndex})
                    </div>
                  </div>
                </div>

                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase font-mono',
                    gpu.status === 'ALLOCATED'
                      ? 'bg-accent/20 text-accent border border-accent/30'
                      : gpu.status === 'IDLE'
                      ? 'bg-status-running/15 text-status-running border border-status-running/30'
                      : 'bg-status-failed/15 text-status-failed border border-status-failed/30',
                  )}
                >
                  {gpu.status}
                </span>
              </div>

              {/* Gauges */}
              <div className="space-y-2 pt-1">
                <div>
                  <div className="flex justify-between text-[11.5px] mb-1">
                    <span className="text-text-secondary">Core Utilization</span>
                    <span className="font-mono font-bold text-accent">{gpu.utilizationPct}%</span>
                  </div>
                  <ProgressBar value={gpu.utilizationPct} size="sm" tone="accent" />
                </div>

                <div>
                  <div className="flex justify-between text-[11.5px] mb-1">
                    <span className="text-text-secondary">VRAM: {(gpu.vramUsedMb / 1024).toFixed(1)} / {(gpu.vramTotalMb / 1024).toFixed(1)} GB</span>
                    <span className="font-mono font-semibold text-text-primary">{vramPct}%</span>
                  </div>
                  <ProgressBar value={vramPct} size="sm" tone="accent" />
                </div>
              </div>

              {/* Bottom stats */}
              <div className="flex items-center justify-between border-t border-border/80 pt-2.5 text-[11.5px] font-mono text-text-secondary">
                <div className="flex items-center gap-1">
                  <Thermometer size={13} className={(gpu.temperatureC ?? 0) > 75 ? 'text-status-failed' : 'text-accent'} />
                  <span>{gpu.temperatureC == null ? '—' : `${gpu.temperatureC}°C`}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Zap size={13} className="text-amber-400" />
                  <span>{gpu.powerW == null ? '—' : `${gpu.powerW} W`}</span>
                </div>
                <div className="flex items-center gap-1 text-text-muted">
                  <Server size={13} />
                  <span>{gpu.nodeIp}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
