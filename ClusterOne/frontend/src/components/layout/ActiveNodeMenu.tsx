import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Server } from 'lucide-react'
import { useActiveNode } from '@/context/ActiveNodeContext'
import { fetchNodes, claimNode, releaseNode } from '@/services/nodeService'
import { currentUsername } from '@/services/api'
import type { NodeDetailResponse } from '@/services/clusterService'
import { usePolling } from '@/hooks/usePolling'
import { cn } from '@/lib/format'

const isUp = (n: NodeDetailResponse) => n.status === 'ONLINE' || n.status === 'BUSY'

/** Header control: pick the machine whose GPU and RAM your jobs use. Remembered in this browser. */
export function ActiveNodeMenu() {
  const { activeNode, setActiveNode } = useActiveNode()
  const [nodes, setNodes] = useState<NodeDetailResponse[]>([])
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const box = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      setNodes(await fetchNodes())
    } catch {
      setNodes([])
    }
  }, [])
  useEffect(() => {
    void load()
  }, [load])
  usePolling(() => void load(), 5000, true)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const current = nodes.find((n) => n.id === activeNode?.id)
  const me = currentUsername()
  const heldByMe = !!current && current.reserved_by === me
  const heldByOther = !!current?.reserved_by && current.reserved_by !== me

  async function toggleReservation() {
    if (!current) return
    setBusy(true)
    setProblem(null)
    try {
      await (heldByMe ? releaseNode(current.id) : claimNode(current.id))
      await load()
    } catch (e) {
      setProblem(e instanceof Error ? e.message : 'Could not change the reservation.')
    } finally {
      setBusy(false)
    }
  }
  const down = !!activeNode && !!current && !isUp(current)

  return (
    <div ref={box} className="relative hidden md:block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors',
          activeNode ? (down ? 'border-status-failed/50 text-status-failed' : 'border-accent/50 text-accent') : 'border-border/80 text-text-secondary',
          'bg-surface/70 hover:bg-surface',
        )}
        title="The machine whose GPU, CPU and RAM your jobs use"
      >
        <Server size={13} />
        <span>
          {activeNode ? (
            <>
              My GPU: <strong className="font-mono">{activeNode.hostname}</strong>
              {down && ' (offline)'}
            </>
          ) : (
            'Choose my GPU node'
          )}
        </span>
        <ChevronDown size={13} />
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 rounded-lg border border-border bg-[#0F172A] p-2 shadow-xl">
          <p className="px-2 pb-2 pt-1 text-[11.5px] text-text-muted">
            Jobs you start run on this machine, using its GPU, CPU and RAM. Your own PC is not used.
          </p>
          {nodes.length === 0 && <p className="px-2 py-3 text-[12px] text-text-muted">No node is connected.</p>}
          {nodes.map((n) => (
            <button
              key={n.id}
              disabled={!isUp(n)}
              onClick={() => {
                setActiveNode({ id: n.id, hostname: n.hostname })
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-[12.5px] disabled:cursor-not-allowed disabled:opacity-45',
                activeNode?.id === n.id ? 'bg-accent/15 text-accent' : 'text-text-primary enabled:hover:bg-surface-hover',
              )}
            >
              <span>
                <span className="font-mono font-semibold">{n.hostname}</span>
                <span className="block text-[11px] text-text-muted">
                  {n.gpus[0] ? `${n.gpu_count} × ${n.gpus[0].name}` : 'no GPU'} · {(Math.max(0, n.ram_total_mb - n.ram_used_mb) / 1024).toFixed(1)} GB RAM free
                </span>
              </span>
              <span className={cn('text-[10.5px] font-semibold', isUp(n) ? 'text-status-running' : 'text-status-failed')}>
                {isUp(n) ? `${n.gpus_free} GPU free` : 'OFFLINE'}
              </span>
            </button>
          ))}
          {activeNode && current && (
            <div className="mt-2 border-t border-border/60 pt-2">
              <button
                disabled={busy || heldByOther}
                onClick={() => void toggleReservation()}
                className={cn(
                  'w-full rounded-md px-2 py-2 text-left text-[12.5px] font-semibold disabled:cursor-not-allowed disabled:opacity-50',
                  heldByMe ? 'bg-amber-500/15 text-amber-300' : 'bg-accent/15 text-accent',
                )}
              >
                {heldByMe ? `Release ${current.hostname} (it is reserved for you)` : `Reserve the whole of ${current.hostname} for me`}
              </button>
              <p className="px-2 pt-1 text-[11px] text-text-muted">
                {heldByOther
                  ? `Reserved by ${current.reserved_by}.`
                  : heldByMe
                    ? 'Only your jobs are placed on it. This is a ClusterOne reservation; it does not lock the PC itself.'
                    : 'While reserved, nobody else gets jobs on it, and the job form can use all of its GPU, CPU and RAM.'}
              </p>
              {problem && <p className="px-2 pt-1 text-[11.5px] text-status-failed">{problem}</p>}
            </div>
          )}
          {activeNode && (
            <button
              onClick={() => {
                setActiveNode(null)
                setOpen(false)
              }}
              className="mt-1 w-full rounded-md px-2 py-2 text-left text-[12px] text-text-secondary hover:bg-surface-hover"
            >
              Let the scheduler choose (no fixed node)
            </button>
          )}
        </div>
      )}
    </div>
  )
}
