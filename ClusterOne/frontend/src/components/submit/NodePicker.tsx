import { useCallback, useEffect, useState } from 'react'
import { Server, Laptop, Cpu, MemoryStick, Loader2 } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import { fetchNodes } from '@/services/nodeService'
import type { NodeDetailResponse } from '@/services/clusterService'
import { usePolling } from '@/hooks/usePolling'
import { useActiveNode } from '@/context/ActiveNodeContext'
import { currentUsername } from '@/services/api'
import { cn } from '@/lib/format'

interface Props {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
}

const isUp = (n: NodeDetailResponse) => n.status === 'ONLINE' || n.status === 'BUSY'
// A report-only agent (started with --no-jobs) shows telemetry but never starts jobs.
const takesJobs = (n: NodeDetailResponse) => n.capabilities?.accepts_jobs !== false

/**
 * Lets the user choose which compute node runs the job. The job then uses THAT machine's GPU, CPU
 * and RAM; the PC the browser runs on is not involved. Everything shown comes from the node's own
 * last heartbeat.
 */
export function NodePicker({ value, update }: Props) {
  const [nodes, setNodes] = useState<NodeDetailResponse[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setNodes(await fetchNodes())
      setError(null)
    } catch {
      setError('Could not reach the Core Engine, so the list of nodes is unavailable.')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])
  usePolling(load, 3000, true)

  // Start from the node chosen in the header ("My GPU") the first time this form is shown.
  const { activeNode, setActiveNode } = useActiveNode()
  useEffect(() => {
    if (value.targetNodeId === undefined && activeNode) {
      update({ targetNodeId: activeNode.id, targetNodeName: activeNode.hostname })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const me = currentUsername()
  const chosen = nodes?.find((n) => n.id === value.targetNodeId)
  // A chosen node that has since gone offline: say so instead of silently queueing for it.
  const chosenDown = chosen && !isUp(chosen)

  // One choice everywhere: picking here also becomes "My GPU" in the header.
  const choose = (n: NodeDetailResponse | null) => {
    update({ targetNodeId: n ? n.id : null, targetNodeName: n ? n.hostname : null })
    setActiveNode(n ? { id: n.id, hostname: n.hostname } : null)
  }

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-[13.5px] font-semibold text-text-primary">Run on which machine?</h3>
        <p className="mt-0.5 flex items-start gap-1.5 text-[12px] text-text-muted">
          <Laptop size={13} className="mt-0.5 shrink-0" />
          The job runs on the node you pick, using its GPU, CPU and RAM. Your own PC only controls and monitors it, so you can
          keep using it normally.
        </p>
      </div>

      <button
        type="button"
        onClick={() => choose(null)}
        className={cn(
          'w-full rounded-[var(--radius-card)] border p-3 text-left transition-colors',
          !value.targetNodeId ? 'border-accent bg-accent/10' : 'border-border bg-surface hover:bg-surface-hover',
        )}
      >
        <div className="text-[13px] font-semibold text-text-primary">Any available node</div>
        <div className="text-[12px] text-text-muted">The scheduler picks an online node with enough free GPU, CPU and RAM.</div>
      </button>

      {nodes === null && !error && (
        <div className="flex items-center gap-2 text-[12.5px] text-text-muted">
          <Loader2 size={14} className="animate-spin" /> Loading nodes…
        </div>
      )}
      {error && <div className="rounded-md border border-status-failed/40 bg-status-failed-soft p-3 text-[12.5px] text-status-failed">{error}</div>}
      {nodes?.length === 0 && (
        <div className="rounded-md border border-dashed border-border p-4 text-[12.5px] text-text-muted">
          No compute node is connected. Start <code className="text-accent">node_agent.py</code> on the machine you want to use.
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {nodes?.map((n) => {
          const up = isUp(n)
          const lockedByOther = !!n.reserved_by && n.reserved_by !== me
          const reportOnly = up && !takesJobs(n)
          const selected = value.targetNodeId === n.id
          const freeRamGb = Math.max(0, n.ram_total_mb - n.ram_used_mb) / 1024
          const gpu = n.gpus[0]
          return (
            <button
              key={n.id}
              type="button"
              disabled={!up || lockedByOther || reportOnly}
              onClick={() => choose(n)}
              className={cn(
                'rounded-[var(--radius-card)] border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                selected ? 'border-accent bg-accent/10' : 'border-border bg-surface enabled:hover:bg-surface-hover',
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-mono text-[13px] font-bold text-text-primary">
                  <Server size={13} className="text-accent" />
                  {n.hostname}
                </span>
                <span className={cn('flex items-center gap-1 text-[10.5px] font-semibold', up ? 'text-status-running' : 'text-status-failed')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', up ? 'bg-status-running' : 'bg-status-failed')} />
                  {up ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
              <div className="mt-0.5 font-mono text-[11px] text-text-muted">{n.ip_address ?? 'IP unknown'}</div>
              <div className="mt-2 text-[12px] text-text-secondary">
                {gpu ? `${n.gpu_count} × ${gpu.name}` : 'No GPU reported'}
                {gpu ? ` · ${(gpu.vram_total_mb / 1024).toFixed(0)} GB VRAM` : ''}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-text-muted">
                <span>{up ? `${n.gpus_free} of ${n.gpu_count} GPU free` : 'unavailable'}</span>
                <span className="flex items-center gap-1">
                  <Cpu size={11} />
                  {n.cpu_cores} cores
                </span>
                <span className="flex items-center gap-1">
                  <MemoryStick size={11} />
                  {freeRamGb.toFixed(1)} / {(n.ram_total_mb / 1024).toFixed(0)} GB free
                </span>
              </div>
              {reportOnly && (
                <div className="mt-1 text-[11px] font-semibold text-status-failed">Report-only agent: it cannot run jobs</div>
              )}
              {n.reserved_by && (
                <div className={cn('mt-1 text-[11px] font-semibold', lockedByOther ? 'text-status-failed' : 'text-accent')}>
                  {lockedByOther ? `Reserved by ${n.reserved_by}` : 'Reserved for you (whole node)'}
                </div>
              )}
              {n.current_jobs.length > 0 && (
                <div className="mt-1 text-[11px] text-amber-300">
                  Running: {n.current_jobs.map((j) => j.name).join(', ')}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {chosen && chosen.reserved_by === me && !chosenDown && (
        <button
          type="button"
          onClick={() =>
            update({
              gpuCount: chosen.gpu_count,
              cpuCores: chosen.cpu_cores,
              ramGb: Math.max(1, Math.floor(Math.max(0, chosen.ram_total_mb - chosen.ram_used_mb) / 1024)),
            })
          }
          className="w-full rounded-md border border-accent/50 bg-accent/10 px-3 py-2 text-left text-[12.5px] font-semibold text-accent"
        >
          Use the whole node: {chosen.gpu_count} GPU, {chosen.cpu_cores} CPU cores, {Math.max(1, Math.floor(Math.max(0, chosen.ram_total_mb - chosen.ram_used_mb) / 1024))} GB free RAM
        </button>
      )}

      {chosenDown && (
        <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-3 text-[12.5px] text-amber-300">
          {chosen?.hostname} is currently offline and cannot accept jobs. Pick another node, or choose "Any available node".
        </div>
      )}
      {chosen && !chosenDown && chosen.gpus_free < (value.gpuCount ?? 1) && (
        <div className="rounded-md border border-amber-500/30 bg-amber-950/20 p-3 text-[12.5px] text-amber-300">
          {chosen.hostname} has {chosen.gpus_free} free GPU(s) right now. Your job will wait on it until {value.gpuCount ?? 1} are free.
        </div>
      )}
    </div>
  )
}
