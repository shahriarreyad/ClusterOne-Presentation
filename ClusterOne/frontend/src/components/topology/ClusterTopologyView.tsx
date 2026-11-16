import { useState } from 'react'
import { Server, Cpu, ShieldCheck, Thermometer, Layers, ExternalLink, Zap, Network, CheckCircle2 } from 'lucide-react'
import type { NodeInfo } from '@/services/nodeService'
import type { MasterInfo } from '@/services/clusterService'
import { cn } from '@/lib/format'

interface ClusterTopologyViewProps {
  master: MasterInfo | null
  nodes: NodeInfo[]
  onSelectNode?: (node: NodeInfo) => void
}

export function ClusterTopologyView({ master, nodes, onSelectNode }: ClusterTopologyViewProps) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

  const masterIp = master?.ip_address || '10.20.0.10'
  const masterHost = master?.hostname || 'c1-anchor'
  const schedulerMode = master?.scheduler === 'slurm' ? 'Slurm Engine' : 'Dev Best-Fit'

  return (
    <div className="relative overflow-hidden rounded-[var(--radius-card)] border border-border bg-gradient-to-b from-[#0F172A]/90 to-[#0B0F19]/95 p-5 shadow-2xl backdrop-blur-md">
      {/* Background architectural grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'radial-gradient(#38BDF8 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* Header bar */}
      <div className="relative z-10 mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-soft text-accent">
              <Network size={14} />
            </span>
            <h2 className="text-[14.5px] font-bold tracking-tight text-text-primary">
              Campus Research Cluster Topology
            </h2>
            <span className="rounded bg-accent-soft px-2 py-0.5 text-[10.5px] font-semibold text-accent">
              VLAN 10.20.0.0/24
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-text-secondary">
            Master node dispatches jobs to isolated physical GPU compute nodes. User browser is control plane only.
          </p>
        </div>

        <div className="flex items-center gap-2 text-[11.5px] text-text-secondary">
          <span className="flex items-center gap-1.5 rounded-full border border-status-running/30 bg-status-running-soft px-2.5 py-1 text-status-running font-medium">
            <span className="h-1.5 w-1.5 rounded-full bg-status-running animate-pulse-dot" />
            Control Plane Live
          </span>
          <span className="rounded-md border border-border bg-surface px-2 py-1 font-mono text-[11px] text-text-muted">
            {schedulerMode}
          </span>
        </div>
      </div>

      {/* TOPOLOGY GRAPH VISUALIZATION */}
      <div className="relative z-10 flex flex-col items-center">
        {/* 1. MASTER / ANCHOR NODE (TOP) */}
        <div className="group relative w-full max-w-md rounded-xl border border-accent/40 bg-surface/90 p-4 shadow-lg shadow-accent/5 transition-all hover:border-accent">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-gradient-to-br from-accent/20 to-accent-soft text-accent border border-accent/30 shadow-inner">
                <Server size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[14px] font-bold text-text-primary uppercase tracking-wide">
                    Cluster Master
                  </span>
                  <span className="rounded-full bg-status-running-soft px-2 py-0.5 text-[10px] font-bold text-status-running">
                    ANCHOR
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 font-mono text-[11.5px] text-text-muted">
                  <span className="text-accent font-semibold">{masterIp}</span>
                  <span>·</span>
                  <span>{masterHost}</span>
                </div>
              </div>
            </div>

            <div className="text-right">
              {master?.slurm_reachable === false ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-failed">
                  <ShieldCheck size={13} />
                  SLURM UNREACHABLE
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-status-running">
                  <ShieldCheck size={13} />
                  {master?.slurm_reachable ? 'SLURM CONNECTED' : 'API ONLINE'}
                </span>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/50 pt-2.5 text-center text-[11px]">
            <div className="rounded bg-bg/50 px-2 py-1">
              <span className="text-text-muted block text-[10px]">Active Nodes</span>
              <span className="font-semibold text-text-primary">{nodes.filter((n) => n.status !== 'DOWN' && n.status !== 'OFFLINE').length} / {nodes.length}</span>
            </div>
            <div className="rounded bg-bg/50 px-2 py-1">
              <span className="text-text-muted block text-[10px]">Total GPUs</span>
              <span className="font-semibold text-accent">{nodes.reduce((acc, n) => acc + n.gpuCount, 0)}</span>
            </div>
            <div className="rounded bg-bg/50 px-2 py-1">
              <span className="text-text-muted block text-[10px]">Scheduler</span>
              <span className="font-semibold text-text-primary">{schedulerMode.split(' ')[0]}</span>
            </div>
          </div>
        </div>

        {/* 2. DYNAMIC NETWORK BUS CONNECTOR (SVG) */}
        <div className="relative h-12 w-full max-w-4xl">
          <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 800 50">
            {/* Center stem down from master */}
            <line x1="400" y1="0" x2="400" y2="25" stroke="#38BDF8" strokeWidth="2" strokeOpacity="0.6" />
            <circle cx="400" cy="25" r="3.5" fill="#38BDF8" />

            {/* Horizontal distribution spine */}
            <line x1="60" y1="25" x2="740" y2="25" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="4 3" />

            {/* Drop lines down to compute nodes */}
            {nodes.length > 0 &&
              nodes.map((_, idx) => {
                const total = nodes.length
                const step = total > 1 ? (740 - 60) / (total - 1) : 0
                const x = total === 1 ? 400 : 60 + idx * step
                return (
                  <g key={idx}>
                    <line x1={x} y1="25" x2={x} y2="50" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity="0.5" />
                    <circle cx={x} cy="50" r="2.5" fill="#38BDF8" />
                  </g>
                )
              })}
          </svg>
        </div>

        {/* 3. GPU COMPUTE NODES GRID */}
        {nodes.length === 0 ? (
          <div className="my-6 rounded-lg border border-dashed border-border p-8 text-center">
            <Server size={28} className="mx-auto text-text-muted mb-2" />
            <p className="text-[13.5px] font-medium text-text-primary">No Compute Nodes Connected</p>
            <p className="mt-1 text-[12px] text-text-secondary max-w-md mx-auto">
              Run <code className="bg-surface px-1.5 py-0.5 rounded text-accent">python node_agent.py --server http://10.20.0.10:8000</code> on any compute node to join the cluster.
            </p>
          </div>
        ) : (
          <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {nodes.map((node) => {
              const isDown = node.status === 'DOWN' || node.status === 'OFFLINE'
              const isBusy = node.status === 'BUSY'
              const isHovered = hoveredNodeId === node.id

              return (
                <div
                  key={node.id}
                  onMouseEnter={() => setHoveredNodeId(node.id)}
                  onMouseLeave={() => setHoveredNodeId(null)}
                  onClick={() => onSelectNode?.(node)}
                  className={cn(
                    'group relative cursor-pointer rounded-xl border p-3.5 transition-all duration-200',
                    isDown
                      ? 'border-status-failed/40 bg-surface/40 opacity-75'
                      : isHovered
                      ? 'border-accent bg-surface-hover shadow-lg shadow-accent/10 -translate-y-0.5'
                      : 'border-border/80 bg-surface/80 hover:border-border-strong hover:bg-surface-hover',
                  )}
                >
                  {/* Top: Name, IP, Status */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[13.5px] text-text-primary tracking-tight">
                          {node.hostname}
                        </span>
                        <ExternalLink size={12} className="text-text-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="font-mono text-[11px] text-accent font-medium">
                        {node.ipAddress}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          'h-2 w-2 rounded-full',
                          isDown
                            ? 'bg-status-failed'
                            : isBusy
                            ? 'bg-status-queued animate-pulse-dot'
                            : 'bg-status-running animate-pulse-dot',
                        )}
                      />
                      <span
                        className={cn(
                          'text-[10px] font-bold uppercase tracking-wider',
                          isDown
                            ? 'text-status-failed'
                            : isBusy
                            ? 'text-status-queued'
                            : 'text-status-running',
                        )}
                      >
                        {node.status}
                      </span>
                    </div>
                  </div>

                  {/* GPU Identity */}
                  <div className="mt-2.5 flex items-center justify-between rounded-md bg-bg/60 px-2.5 py-1.5 border border-border/40 text-[11.5px]">
                    <span className="flex items-center gap-1.5 font-medium text-text-primary">
                      <Cpu size={13} className="text-accent" />
                      {node.gpuModel}
                    </span>
                    <span className="rounded bg-accent/10 px-1.5 py-0.5 font-mono text-[10.5px] font-bold text-accent">
                      {node.gpuCount} {node.gpuCount === 1 ? 'GPU' : 'GPUs'}
                    </span>
                  </div>

                  {/* Telemetry Meters */}
                  <div className="mt-3 space-y-1.5 text-[11px]">
                    {/* GPU Utilization */}
                    <div>
                      <div className="flex justify-between text-text-secondary">
                        <span className="flex items-center gap-1">GPU Compute</span>
                        <span className="font-mono font-medium text-text-primary">{node.gpuUtilization}%</span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all duration-500',
                            node.gpuUtilization > 85
                              ? 'bg-status-timeout'
                              : node.gpuUtilization > 50
                              ? 'bg-accent'
                              : 'bg-status-running',
                          )}
                          style={{ width: `${node.gpuUtilization}%` }}
                        />
                      </div>
                    </div>

                    {/* GPU VRAM */}
                    <div>
                      <div className="flex justify-between text-text-secondary">
                        <span className="flex items-center gap-1">VRAM</span>
                        <span className="font-mono text-[10.5px] text-text-muted">
                          {(node.gpuMemoryUsedMb / 1024).toFixed(1)} / {(node.gpuMemoryTotalMb / 1024).toFixed(1)} GB
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-border/50">
                        <div
                          className="h-full rounded-full bg-distributed transition-all duration-500"
                          style={{
                            width: `${
                              node.gpuMemoryTotalMb > 0
                                ? Math.min(100, Math.round((node.gpuMemoryUsedMb / node.gpuMemoryTotalMb) * 100))
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* CPU & RAM mini bars */}
                    <div className="grid grid-cols-2 gap-2 pt-0.5">
                      <div>
                        <div className="flex justify-between text-[10px] text-text-muted">
                          <span>CPU</span>
                          <span className="font-mono text-text-secondary">{node.cpuUtilization}%</span>
                        </div>
                        <div className="mt-0.5 h-1 w-full rounded-full bg-border/50">
                          <div className="h-full rounded-full bg-cyan-400" style={{ width: `${node.cpuUtilization}%` }} />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] text-text-muted">
                          <span>RAM</span>
                          <span className="font-mono text-text-secondary">
                            {Math.round((node.ramUsedMb / Math.max(1, node.ramTotalMb)) * 100)}%
                          </span>
                        </div>
                        <div className="mt-0.5 h-1 w-full rounded-full bg-border/50">
                          <div
                            className="h-full rounded-full bg-indigo-400"
                            style={{ width: `${Math.round((node.ramUsedMb / Math.max(1, node.ramTotalMb)) * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Node Footer: Temp, Power, Active Jobs */}
                  <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-2 text-[11px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <Thermometer size={12} className={node.temperatureC > 75 ? 'text-status-failed' : 'text-text-muted'} />
                      <span className={cn(node.temperatureC > 75 && 'text-status-failed font-medium')}>
                        {node.temperatureC > 0 ? `${node.temperatureC}°C` : 'Normal'}
                      </span>
                    </span>

                    <span className="flex items-center gap-1 text-[11px]">
                      <Layers size={12} className="text-text-muted" />
                      <span className="font-medium text-text-secondary">
                        {node.runningJobsCount} {node.runningJobsCount === 1 ? 'job' : 'jobs'}
                      </span>
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 4. EXECUTION ISOLATION BANNER */}
      <div className="relative z-10 mt-5 rounded-lg border border-accent/20 bg-accent-soft/30 p-3 text-[12px] text-text-secondary flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} className="text-accent shrink-0" />
          <span>
            <strong className="text-text-primary">Campus GPU Execution Guarantee:</strong> When training starts,
            workloads execute entirely inside Apptainer containers on physical NVIDIA GPU nodes. Your laptop acts only as a web terminal.
          </span>
        </div>
        <div className="font-mono text-[11px] text-accent font-semibold flex items-center gap-1.5">
          <Zap size={13} /> Remote Acceleration Active
        </div>
      </div>
    </div>
  )
}
