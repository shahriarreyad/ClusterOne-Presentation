import { useCallback, useEffect, useState } from 'react'
import {
  Server,
  Cpu,
  Thermometer,
  Layers,
  LayoutGrid,
  Network,
  Table as TableIcon,
  X,
  CheckCircle2,
} from 'lucide-react'
import { fetchNodesInfo, type NodeInfo } from '@/services/nodeService'
import { fetchClusterTopology, type MasterInfo } from '@/services/clusterService'
import { usePolling } from '@/hooks/usePolling'
import { ProgressBar } from '@/components/common/ProgressBar'
import { ClusterTopologyView } from '@/components/topology/ClusterTopologyView'
import { NodeGpuPanel } from '@/components/nodes/NodeGpuPanel'
import { cn } from '@/lib/format'

type ViewMode = 'cards' | 'topology' | 'table'

export function NodesPage() {
  const [nodes, setNodes] = useState<NodeInfo[]>([])
  const [master, setMaster] = useState<MasterInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('cards')
  const [selectedNode, setSelectedNode] = useState<NodeInfo | null>(null)

  const load = useCallback(async () => {
    try {
      const [nodesData, topoData] = await Promise.all([
        fetchNodesInfo(),
        fetchClusterTopology().catch(() => null),
      ])
      setNodes(nodesData)
      if (topoData) setMaster(topoData.master)
      setError(null)
      if (selectedNode) {
        const updated = nodesData.find((n) => n.id === selectedNode.id)
        if (updated) setSelectedNode(updated)
      }
    } catch {
      setError('Unable to load cluster nodes. Please ensure backend is reachable.')
    }
  }, [selectedNode])

  useEffect(() => {
    void load()
  }, [load])
  usePolling(() => void load(), 3000)

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Cluster Compute Nodes</h1>
          <p className="text-[13.5px] text-text-secondary">
            Physical GPU compute PCs connected via 10.20.0.0/24 private subnet. Workloads execute on their hardware.
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center rounded-lg border border-border bg-surface p-1 self-start sm:self-auto">
          <button
            onClick={() => setViewMode('cards')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors',
              viewMode === 'cards'
                ? 'bg-accent/15 text-accent font-semibold border border-accent/20'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <LayoutGrid size={14} /> Cards
          </button>
          <button
            onClick={() => setViewMode('topology')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors',
              viewMode === 'topology'
                ? 'bg-accent/15 text-accent font-semibold border border-accent/20'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <Network size={14} /> Topology
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors',
              viewMode === 'table'
                ? 'bg-accent/15 text-accent font-semibold border border-accent/20'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            <TableIcon size={14} /> Table
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-status-failed/40 bg-status-failed-soft p-3 text-[13px] text-status-failed">
          {error}
        </div>
      )}

      {/* VIEW: TOPOLOGY */}
      {viewMode === 'topology' && (
        <div className="space-y-4">
          <ClusterTopologyView master={master} nodes={nodes} onSelectNode={setSelectedNode} />
        </div>
      )}

      {/* VIEW: CARDS */}
      {viewMode === 'cards' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {nodes.map((n) => {
            const isOnline = n.status === 'ONLINE' || n.status === 'BUSY'
            const vramPct = n.gpuMemoryTotalMb > 0 ? Math.round((n.gpuMemoryUsedMb / n.gpuMemoryTotalMb) * 100) : 0
            const ramPct = n.ramTotalMb > 0 ? Math.round((n.ramUsedMb / n.ramTotalMb) * 100) : 0

            return (
              <div
                key={n.id}
                className={cn(
                  'group flex flex-col justify-between rounded-[var(--radius-card)] border bg-surface p-4.5 transition-all hover:border-accent/40',
                  isOnline ? 'border-border' : 'border-status-failed/30 opacity-75',
                )}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Server size={16} className="text-accent" />
                        <span className="font-mono text-[15px] font-bold text-text-primary uppercase">
                          {n.hostname}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-text-muted mt-0.5">{n.ipAddress}</div>
                    </div>

                    <span
                      className={cn(
                        'flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase',
                        isOnline
                          ? 'bg-status-running/15 text-status-running border border-status-running/30'
                          : 'bg-status-failed/15 text-status-failed border border-status-failed/30',
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', isOnline ? 'bg-status-running animate-pulse-dot' : 'bg-status-failed')} />
                      {n.status}
                    </span>
                  </div>

                  {/* GPU Architecture */}
                  <div className="mt-3 rounded-md bg-bg-secondary p-2.5">
                    <div className="text-[12px] font-semibold text-text-primary flex items-center justify-between">
                      <span>{n.gpuModel}</span>
                      <span className="font-mono text-[11px] text-accent font-bold">{n.gpuCount} GPUs</span>
                    </div>
                  </div>

                  {/* Resource Gauges */}
                  <div className="mt-3.5 space-y-2.5">
                    <div>
                      <div className="flex items-center justify-between text-[11.5px] mb-1">
                        <span className="text-text-secondary font-medium">GPU Utilization</span>
                        <span className="font-mono font-semibold text-text-primary">{n.gpuUtilization}%</span>
                      </div>
                      <ProgressBar value={n.gpuUtilization} size="sm" tone="accent" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11.5px] mb-1">
                        <span className="text-text-secondary font-medium">VRAM Allocation</span>
                        <span className="font-mono font-semibold text-text-primary">{vramPct}%</span>
                      </div>
                      <ProgressBar value={vramPct} size="sm" tone="accent" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11.5px] mb-1">
                        <span className="text-text-secondary font-medium">CPU Utilization</span>
                        <span className="font-mono font-semibold text-text-primary">{n.cpuUtilization}%</span>
                      </div>
                      <ProgressBar value={n.cpuUtilization} size="sm" tone="warning" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[11.5px] mb-1">
                        <span className="text-text-secondary font-medium">Host RAM</span>
                        <span className="font-mono font-semibold text-text-primary">{ramPct}%</span>
                      </div>
                      <ProgressBar value={ramPct} size="sm" />
                    </div>
                  </div>

                  {/* Temperature & Running Jobs footer */}
                  <div className="mt-4 flex items-center justify-between border-t border-border/80 pt-3 text-[12px]">
                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <Thermometer size={14} className={n.temperatureC > 75 ? 'text-status-failed' : 'text-accent'} />
                      <span className="font-mono">{n.temperatureC}°C</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-text-secondary">
                      <Layers size={14} className="text-indigo-400" />
                      <span>{n.runningJobsCount} Jobs Running</span>
                    </div>
                  </div>
                </div>

                {/* View Node Button */}
                <div className="mt-4 pt-2">
                  <button
                    onClick={() => setSelectedNode(n)}
                    className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-[12.5px] font-semibold text-text-primary transition-colors hover:border-accent hover:bg-accent/10 hover:text-accent"
                  >
                    View Node Details
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* VIEW: TABLE */}
      {viewMode === 'table' && (
        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-border bg-bg-secondary text-[11px] uppercase tracking-wider text-text-muted">
                <th className="px-4 py-3 font-medium">Node</th>
                <th className="px-4 py-3 font-medium">IP Address</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">GPU Architecture</th>
                <th className="px-4 py-3 font-medium">GPU Util</th>
                <th className="px-4 py-3 font-medium">VRAM</th>
                <th className="px-4 py-3 font-medium">CPU Util</th>
                <th className="px-4 py-3 font-medium">RAM</th>
                <th className="px-4 py-3 font-medium">Temp</th>
                <th className="px-4 py-3 font-medium">Active Jobs</th>
                <th className="px-4 py-3 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border font-mono">
              {nodes.map((n) => {
                const isOnline = n.status === 'ONLINE' || n.status === 'BUSY'
                const vramPct = n.gpuMemoryTotalMb > 0 ? Math.round((n.gpuMemoryUsedMb / n.gpuMemoryTotalMb) * 100) : 0
                const ramPct = n.ramTotalMb > 0 ? Math.round((n.ramUsedMb / n.ramTotalMb) * 100) : 0

                return (
                  <tr key={n.id} className="hover:bg-surface-hover/50">
                    <td className="px-4 py-3 font-bold text-text-primary uppercase">{n.hostname}</td>
                    <td className="px-4 py-3 text-text-muted">{n.ipAddress}</td>
                    <td className="px-4 py-3 font-sans">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase',
                          isOnline ? 'bg-status-running/15 text-status-running' : 'bg-status-failed/15 text-status-failed',
                        )}
                      >
                        {n.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-sans text-text-primary">{n.gpuModel}</td>
                    <td className="px-4 py-3 text-accent font-bold">{n.gpuUtilization}%</td>
                    <td className="px-4 py-3 text-text-secondary">{vramPct}%</td>
                    <td className="px-4 py-3 text-text-secondary">{n.cpuUtilization}%</td>
                    <td className="px-4 py-3 text-text-secondary">{ramPct}%</td>
                    <td className="px-4 py-3 text-text-primary">{n.temperatureC}°C</td>
                    <td className="px-4 py-3 text-indigo-400 font-bold">{n.runningJobsCount}</td>
                    <td className="px-4 py-3 text-right font-sans">
                      <button
                        onClick={() => setSelectedNode(n)}
                        className="rounded border border-border px-2.5 py-1 text-[11.5px] font-medium text-text-secondary hover:border-accent hover:text-accent"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* NODE DETAIL MODAL / DRAWER */}
      {selectedNode && (
        <NodeDetailDrawer node={selectedNode} onClose={() => setSelectedNode(null)} />
      )}
    </div>
  )
}

// -----------------------------------------------------------------------
// NODE DETAIL DRAWER / MODAL
// -----------------------------------------------------------------------
function NodeDetailDrawer({ node, onClose }: { node: NodeInfo; onClose: () => void }) {
  const [tab, setTab] = useState<'overview' | 'gpus' | 'jobs' | 'health'>('overview')
  const gpus = node.raw.gpus || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col rounded-[var(--radius-card)] border border-accent/30 bg-[#0B0F19] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/20 border border-accent/40 text-accent">
              <Server size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-mono text-[17px] font-bold text-text-primary uppercase">{node.hostname}</h2>
                <span className="rounded bg-status-running/20 px-2 py-0.5 text-[10.5px] font-semibold text-status-running font-mono">
                  {node.ipAddress}
                </span>
              </div>
              <p className="text-[12px] text-text-muted">
                {node.raw.os_info ?? 'OS not reported'} · agent {node.raw.agent_version ?? 'old version (no version reported)'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-text-muted hover:bg-surface-hover hover:text-text-primary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Drawer Tabs */}
        <div className="flex border-b border-border/80 px-6 text-[13px] font-medium">
          <button
            onClick={() => setTab('overview')}
            className={cn('border-b-2 py-2.5 px-3 transition-colors', tab === 'overview' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary')}
          >
            Overview
          </button>
          <button
            onClick={() => setTab('gpus')}
            className={cn('border-b-2 py-2.5 px-3 transition-colors', tab === 'gpus' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary')}
          >
            Per-GPU Cards ({gpus.length || node.gpuCount})
          </button>
          <button
            onClick={() => setTab('jobs')}
            className={cn('border-b-2 py-2.5 px-3 transition-colors', tab === 'jobs' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary')}
          >
            Running Workloads ({node.runningJobsCount})
          </button>
          <button
            onClick={() => setTab('health')}
            className={cn('border-b-2 py-2.5 px-3 transition-colors', tab === 'health' ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary')}
          >
            Node Health & Telemetry
          </button>
        </div>

        {/* Content Body */}
        <div className="scrollbar-thin flex-1 overflow-y-auto p-6 space-y-4">
          {tab === 'overview' && (
            <div className="space-y-4">
              <NodeGpuPanel node={node.raw} />
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono">
                <div className="rounded-md border border-border bg-surface p-3">
                  <span className="text-[11px] text-text-muted uppercase block">Physical GPUs</span>
                  <strong className="text-[16px] text-accent">{node.gpuCount}</strong>
                </div>
                <div className="rounded-md border border-border bg-surface p-3">
                  <span className="text-[11px] text-text-muted uppercase block">CPU Threads</span>
                  <strong className="text-[16px] text-text-primary">{node.raw.cpu_cores}</strong>
                </div>
                <div className="rounded-md border border-border bg-surface p-3">
                  <span className="text-[11px] text-text-muted uppercase block">Host RAM</span>
                  <strong className="text-[16px] text-text-primary">{Math.round(node.ramTotalMb / 1024)} GB</strong>
                </div>
                <div className="rounded-md border border-border bg-surface p-3">
                  <span className="text-[11px] text-text-muted uppercase block">Node Status</span>
                  <strong className="text-[16px] text-status-running uppercase">{node.status}</strong>
                </div>
              </div>

              <div className="rounded-md border border-border bg-surface p-4 text-[13px] space-y-2">
                <div className="flex justify-between border-b border-border/80 py-1.5">
                  <span className="text-text-muted">OS / Kernel:</span>
                  <span className="font-mono text-text-primary">{node.raw.os_info || 'Ubuntu 24.04 LTS (Kernel 6.8.0-31-generic)'}</span>
                </div>
                <div className="flex justify-between border-b border-border/80 py-1.5">
                  <span className="text-text-muted">Node Agent Version:</span>
                  <span className="font-mono text-text-primary">{node.raw.agent_version || 'ClusterOne-Agent v1.0.0'}</span>
                </div>
                <div className="flex justify-between border-b border-border/80 py-1.5">
                  <span className="text-text-muted">Slurm State:</span>
                  <span className="font-mono text-accent">{node.raw.slurm_state || 'ALLOCATED / IDLE'}</span>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-text-muted">Registered At:</span>
                  <span className="font-mono text-text-secondary">{new Date(node.raw.registered_at).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {tab === 'gpus' && (
            <div className="space-y-4">
              {gpus.length === 0 && (
                <p className="rounded-lg border border-dashed border-border p-4 text-[12.5px] text-text-muted">
                  This node reports no NVIDIA GPU (no driver or <code>nvidia-smi</code>).
                </p>
              )}
              {gpus.map((gpu, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-surface p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Cpu size={16} className="text-accent" />
                      <span className="font-mono text-[14px] font-bold text-text-primary">
                        GPU {idx} · {gpu.name}
                      </span>
                    </div>
                    <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
                      CUDA ID: {idx}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-[12px]">
                    <div className="rounded bg-bg-secondary p-2">
                      <span className="text-text-muted block text-[10.5px]">UTILIZATION</span>
                      <strong className="text-accent text-[14px]">{gpu.utilization_pct}%</strong>
                    </div>
                    <div className="rounded bg-bg-secondary p-2">
                      <span className="text-text-muted block text-[10.5px]">VRAM USAGE</span>
                      <strong className="text-text-primary text-[14px]">
                        {(gpu.vram_used_mb / 1024).toFixed(1)} / {(gpu.vram_total_mb / 1024).toFixed(1)} GB
                      </strong>
                    </div>
                    <div className="rounded bg-bg-secondary p-2">
                      <span className="text-text-muted block text-[10.5px]">TEMPERATURE</span>
                      <strong className="text-text-primary text-[14px]">{gpu.temperature_c == null ? '—' : `${gpu.temperature_c}°C`}</strong>
                    </div>
                    <div className="rounded bg-bg-secondary p-2">
                      <span className="text-text-muted block text-[10.5px]">POWER DRAW</span>
                      <strong className="text-text-primary text-[14px]">{gpu.power_w == null ? '—' : `${gpu.power_w} W`}</strong>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'jobs' && (
            <div>
              {node.currentJobs.length === 0 ? (
                <div className="py-8 text-center text-text-muted text-[13px]">
                  No active workloads currently allocated to this node. Node is ready for scheduling.
                </div>
              ) : (
                <ul className="divide-y divide-border rounded-md border border-border bg-surface">
                  {node.currentJobs.map((j) => (
                    <li key={j.id} className="flex items-center justify-between p-3.5 text-[13px]">
                      <div>
                        <div className="font-semibold text-text-primary">
                          {j.name} <span className="font-mono text-text-muted">#{j.id}</span>
                        </div>
                        <div className="text-[11.5px] text-text-muted">
                          User: <strong className="text-text-secondary">{j.submitted_by}</strong> · Allocation: {j.gpu_count} GPU
                        </div>
                      </div>
                      <span className="rounded-full bg-status-running/15 px-2.5 py-0.5 text-[11px] font-semibold text-status-running">
                        Running
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'health' && (
            <div className="space-y-3 text-[13px]">
              <div className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
                <span className="flex items-center gap-2 text-text-secondary">
                  <CheckCircle2 size={16} className="text-status-running" /> Node Heartbeat
                </span>
                <span className="font-mono text-text-primary">
                  {node.heartbeatAgeSeconds ? `${Math.round(node.heartbeatAgeSeconds)}s ago` : 'Active'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
                <span className="flex items-center gap-2 text-text-secondary">
                  <CheckCircle2 size={16} className="text-status-running" /> NVIDIA Driver & NVML
                </span>
                <span className="font-mono text-status-running">Healthy</span>
              </div>
              <div className="flex items-center justify-between rounded-md border border-border bg-surface p-3">
                <span className="flex items-center gap-2 text-text-secondary">
                  <CheckCircle2 size={16} className="text-status-running" /> Slurm slurmd daemon
                </span>
                <span className="font-mono text-status-running">Active & Responsive</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
