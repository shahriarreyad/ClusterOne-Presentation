import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useActiveNode } from '@/context/ActiveNodeContext'
import { Play, Square } from 'lucide-react'
import { request } from '@/services/api'
import { usePolling } from '@/hooks/usePolling'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { JobStatus } from '@/types/job'

interface ClusterJob {
  id: string
  name: string
  status: JobStatus
  node_id: string | null
  logs: string | null
  created_at: string
}

interface ClusterNode {
  id: string
  hostname: string
  status: string
  cpu_cores: number
  ram_total_mb: number
  gpus: { name: string }[]
}

const TEMPLATES: Record<string, { label: string; needsGpu: boolean; script: string }> = {
  burn: {
    label: 'GPU burn test (60 s at 90%)',
    needsGpu: true,
    script: `# Puts a heavy load on the node's GPU.
import os, subprocess, sys
burn = os.path.join(os.environ["CLUSTERONE_AGENT_DIR"], "gpu_burn.py")
subprocess.run([sys.executable, burn, "60", "90"], check=True)
`,
  },
  youtube: {
    label: 'Open YouTube on the node (2 min)',
    needsGpu: false,
    script: `# Opens YouTube in a browser ON THE NODE, using its GPU and RAM.
import os, subprocess, sys
page = os.path.join(os.environ["CLUSTERONE_AGENT_DIR"], "open_url.py")
subprocess.run([sys.executable, page, "https://www.youtube.com", "120"], check=True)
`,
  },
  custom: { label: 'My own Python script', needsGpu: false, script: 'print("hello from the node")\n' },
}

export function ClusterJobs() {
  const [params] = useSearchParams()
  const [jobs, setJobs] = useState<ClusterJob[]>([])
  const [nodeList, setNodeList] = useState<ClusterNode[]>([])
  const { activeNode } = useActiveNode()
  const [nodeId, setNodeId] = useState(params.get('node') ?? activeNode?.id ?? '')
  const [template, setTemplate] = useState('burn')
  const [name, setName] = useState(TEMPLATES.burn.label)
  const [script, setScript] = useState(TEMPLATES.burn.script)
  const [needsGpu, setNeedsGpu] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)

  const hostnames = Object.fromEntries(nodeList.map((n) => [n.id, n.hostname]))

  const load = useCallback(async () => {
    try {
      const [j, n] = await Promise.all([request<ClusterJob[]>('/v1/jobs'), request<ClusterNode[]>('/v1/nodes')])
      setJobs(j)
      setNodeList(n)
      setError((e) => (e?.startsWith('Cannot reach') ? null : e))
    } catch {
      setError('Cannot reach the ClusterOne backend (is it running on port 8000?).')
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  usePolling(() => void load(), 2000)

  async function submit() {
    setError(null)
    try {
      const job = await request<ClusterJob>('/v1/jobs', {
        method: 'POST',
        body: JSON.stringify({ name, script, requires_gpu: needsGpu, submitted_by: 'dashboard', node_id: nodeId || null }),
      })
      setSelected(job.id)
      await load()
    } catch (e) {
      setError(e instanceof Error && e.message.includes('409') ? 'That node is offline.' : 'Could not submit the job.')
    }
  }

  async function cancel(id: string) {
    await request(`/v1/jobs/${id}`, { method: 'DELETE' }).catch(() => undefined)
    await load()
  }

  const current = jobs.find((j) => j.id === selected) ?? jobs[0]

  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold text-text-primary">Run on Cluster GPUs</h1>
      <p className="text-[13.5px] text-text-secondary">
        Choose a node, choose what to run, and it executes on that machine. Output streams back here.
      </p>
      {error && <p className="rounded-md bg-status-failed-soft px-3 py-2 text-[13px] text-status-failed">{error}</p>}

      <div className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-[12px] text-text-muted">
            Run on node
            <select
              value={nodeId}
              onChange={(e) => setNodeId(e.target.value)}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text-primary"
            >
              <option value="">Any free node (scheduler decides)</option>
              {nodeList.map((n) => (
                <option key={n.id} value={n.id} disabled={n.status !== 'ONLINE'}>
                  {n.hostname} · {n.cpu_cores} cores · {(n.ram_total_mb / 1024).toFixed(0)} GB RAM · {n.gpus[0]?.name ?? 'no GPU'}
                  {n.status !== 'ONLINE' ? ' (offline)' : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-[12px] text-text-muted">
            What to run
            <select
              value={template}
              onChange={(e) => {
                const t = TEMPLATES[e.target.value]
                setTemplate(e.target.value)
                setScript(t.script)
                setNeedsGpu(t.needsGpu)
                setName(t.label)
              }}
              className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text-primary"
            >
              {Object.entries(TEMPLATES).map(([k, t]) => (
                <option key={k} value={k}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 text-[13px] text-text-primary"
          placeholder="Job name"
        />
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          rows={7}
          spellCheck={false}
          className="w-full rounded-md border border-border bg-bg px-3 py-2 font-mono text-[12.5px] text-text-primary"
        />
        <div className="flex flex-wrap items-center gap-4">
          {!nodeId && (
            <label className="flex items-center gap-2 text-[13px] text-text-secondary">
              <input type="checkbox" checked={needsGpu} onChange={(e) => setNeedsGpu(e.target.checked)} />
              Needs a free GPU (&lt; 10% busy)
            </label>
          )}
          <button
            onClick={() => void submit()}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-white"
          >
            <Play size={14} /> {nodeId ? `Run on ${hostnames[nodeId] ?? 'selected node'}` : 'Run on cluster'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
          {jobs.length === 0 && <li className="px-4 py-3 text-[13px] text-text-secondary">No jobs yet.</li>}
          {jobs.map((j) => (
            <li
              key={j.id}
              onClick={() => setSelected(j.id)}
              className={`flex cursor-pointer items-center justify-between gap-3 px-4 py-3 ${current?.id === j.id ? 'bg-surface-hover' : ''}`}
            >
              <div>
                <div className="text-[13px] font-medium text-text-primary">{j.name}</div>
                <div className="text-[11.5px] text-text-muted">
                  {j.node_id ? `on ${hostnames[j.node_id] ?? j.node_id}` : 'waiting for a free node'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={j.status} />
                {(j.status === 'RUNNING' || j.status === 'QUEUED' || j.status === 'SCHEDULED') && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      void cancel(j.id)
                    }}
                    title="Cancel"
                    className="rounded p-1 text-text-muted hover:text-status-failed"
                  >
                    <Square size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>

        <pre className="min-h-[200px] overflow-auto rounded-[var(--radius-card)] border border-border bg-bg-secondary p-4 font-mono text-[12px] text-text-primary">
          {current ? current.logs || `(no output yet — ${current.status})` : 'Select a job to see its output.'}
        </pre>
      </div>
    </div>
  )
}
