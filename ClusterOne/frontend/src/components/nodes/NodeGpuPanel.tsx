import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Cpu, MemoryStick, Play, Square, Zap, CheckCircle2, XCircle, MinusCircle } from 'lucide-react'
import type { NodeDetailResponse } from '@/services/clusterService'
import { cancelJob } from '@/services/jobService'
import { useActiveNode } from '@/context/ActiveNodeContext'
import { cn } from '@/lib/format'

const AVAILABILITY_STYLE: Record<string, string> = {
  AVAILABLE: 'border-status-running/40 bg-status-running/10 text-status-running',
  BUSY: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
  OFFLINE: 'border-border bg-surface text-text-muted',
  ERROR: 'border-status-failed/40 bg-status-failed-soft text-status-failed',
}

const AVAILABILITY_HINT: Record<string, string> = {
  AVAILABLE: 'A GPU is free: jobs can start here now.',
  BUSY: 'Every GPU is in use or reserved; new jobs wait for it.',
  OFFLINE: 'No heartbeat. Check the PC is on, its node agent is running, and the network.',
  ERROR: 'Online but reports no NVIDIA GPU (driver missing or nvidia-smi failing).',
}

function Check({ ok, label, detail }: { ok: boolean | null; label: string; detail?: string }) {
  const Icon = ok === null ? MinusCircle : ok ? CheckCircle2 : XCircle
  return (
    <div className="flex items-start gap-2 text-[12.5px]">
      <Icon size={15} className={cn('mt-0.5 shrink-0', ok === null ? 'text-text-muted' : ok ? 'text-status-running' : 'text-status-failed')} />
      <div>
        <span className="text-text-primary">{label}</span>
        {detail && <span className="ml-1.5 font-mono text-[11.5px] text-text-muted">{detail}</span>}
      </div>
    </div>
  )
}

/** The one-glance answer to "is this node's GPU usable for me, and what is it doing?" Real readings only. */
export function NodeGpuPanel({ node }: { node: NodeDetailResponse }) {
  const { activeNode, setActiveNode } = useActiveNode()
  const navigate = useNavigate()
  const [stopping, setStopping] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const gpu = node.gpus[0]
  const caps = node.capabilities ?? {}
  const state = node.availability ?? (node.status === 'ONLINE' || node.status === 'BUSY' ? 'AVAILABLE' : 'OFFLINE')
  const reportOnly = caps.accepts_jobs === false
  const online = state !== 'OFFLINE' && !reportOnly
  const isMine = activeNode?.id === node.id
  const freeRamGb = Math.max(0, node.ram_total_mb - node.ram_used_mb) / 1024
  const hasCaps = Object.keys(caps).length > 0
  const torchOk = hasCaps ? Boolean(caps.torch && caps.torch_cuda_available) : null

  async function stopJobs() {
    if (!window.confirm(`Stop ${node.current_jobs.length} running job(s) on ${node.hostname}?`)) return
    setStopping(true)
    setMessage(null)
    try {
      for (const j of node.current_jobs) await cancelJob(j.id)
      setMessage('Stop requested. The node frees its GPU within a few seconds.')
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not stop the job.')
    } finally {
      setStopping(false)
    }
  }

  return (
    <div className="space-y-4 rounded-[var(--radius-card)] border border-accent/30 bg-surface/60 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cn('rounded-full border px-3 py-1 font-mono text-[12px] font-bold', AVAILABILITY_STYLE[state] ?? AVAILABILITY_STYLE.OFFLINE)}>
            {state}
          </span>
          <span className="text-[12px] text-text-muted">{AVAILABILITY_HINT[state]}</span>
        </div>
        {node.reserved_by && (
          <span className="rounded border border-accent/40 bg-accent/10 px-2 py-0.5 text-[11px] font-semibold text-accent">
            Reserved by {node.reserved_by}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-border bg-bg-secondary p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <Zap size={12} className="text-accent" /> GPU
          </div>
          {gpu ? (
            <div className="space-y-0.5 font-mono text-[12.5px] text-text-primary">
              <div className="text-[14px] font-bold">{gpu.name}</div>
              <div>VRAM {(gpu.vram_used_mb / 1024).toFixed(1)} / {(gpu.vram_total_mb / 1024).toFixed(1)} GB</div>
              <div>Utilization {gpu.utilization_pct.toFixed(0)}%</div>
              <div>Temperature {gpu.temperature_c == null ? 'not reported' : `${gpu.temperature_c.toFixed(0)} °C`}</div>
              <div className="text-text-muted">
                Driver {gpu.driver_version ?? 'unknown'} · CUDA {gpu.cuda_version ?? 'unknown'}
              </div>
            </div>
          ) : (
            <div className="text-[12.5px] text-text-muted">No NVIDIA GPU reported by this node.</div>
          )}
        </div>

        <div className="rounded-md border border-border bg-bg-secondary p-3">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-text-muted">
            <Cpu size={12} className="text-accent" /> Worker system
          </div>
          <div className="space-y-0.5 font-mono text-[12.5px] text-text-primary">
            <div>CPU {node.cpu_util_pct.toFixed(0)}% of {node.cpu_cores} cores</div>
            <div className="flex items-center gap-1">
              <MemoryStick size={12} className="text-text-muted" />
              RAM {(node.ram_used_mb / 1024).toFixed(1)} / {(node.ram_total_mb / 1024).toFixed(1)} GB ({freeRamGb.toFixed(1)} free)
            </div>
            <div>Active jobs {node.current_jobs.length}{node.current_jobs.length > 0 ? `: ${node.current_jobs.map((j) => j.name).join(', ')}` : ''}</div>
            <div className="text-text-muted">{node.os_info ?? 'OS unknown'}</div>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-bg-secondary p-3">
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-text-muted">What this node can run (measured by its agent)</div>
        {hasCaps ? (
          <div className="grid gap-1.5 sm:grid-cols-2">
            <Check ok={torchOk} label="PyTorch with CUDA" detail={caps.torch ? `${caps.torch}${caps.torch_cuda_available ? '' : ' (no CUDA)'}` : 'not installed'} />
            <Check ok={Boolean(caps.ffmpeg_nvenc)} label="FFmpeg GPU encoding (NVENC)" detail={caps.ffmpeg ? undefined : 'ffmpeg not installed'} />
            <Check ok={Boolean(caps.docker)} label="Docker" detail={caps.docker_gpu_image ? `jobs run in ${caps.docker_gpu_image}` : undefined} />
            <Check ok={Boolean(caps.nvidia_smi)} label="NVIDIA driver (nvidia-smi)" />
            <Check ok={caps.accepts_jobs !== false} label="Accepts jobs" detail={caps.accepts_jobs === false ? 'report-only (--no-jobs)' : undefined} />
          </div>
        ) : (
          <div className="text-[12.5px] text-text-muted">
            Not reported yet. Restart this node's agent with the newest <code className="text-accent">node_agent.py</code> to see what it can run.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={!online}
          onClick={() => setActiveNode({ id: node.id, hostname: node.hostname })}
          className={cn(
            'flex items-center gap-1.5 rounded-md border px-3.5 py-2 text-[12.5px] font-bold disabled:cursor-not-allowed disabled:opacity-40',
            isMine ? 'border-accent bg-accent text-bg' : 'border-accent/50 bg-accent/10 text-accent hover:bg-accent/20',
          )}
        >
          <Zap size={14} /> {isMine ? 'USING THIS GPU' : 'USE GPU'}
        </button>
        <button
          disabled={!online}
          onClick={() => {
            setActiveNode({ id: node.id, hostname: node.hostname })
            navigate('/jobs/new')
          }}
          className="flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-[12.5px] font-bold text-text-primary hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Play size={14} /> RUN JOB
        </button>
        <button
          disabled={node.current_jobs.length === 0 || stopping}
          onClick={() => void stopJobs()}
          className="flex items-center gap-1.5 rounded-md border border-status-failed/40 px-3.5 py-2 text-[12.5px] font-bold text-status-failed hover:bg-status-failed-soft disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Square size={14} /> {stopping ? 'STOPPING…' : 'STOP JOB'}
        </button>
      </div>
      {message && <p className="text-[12px] text-text-secondary">{message}</p>}
    </div>
  )
}
