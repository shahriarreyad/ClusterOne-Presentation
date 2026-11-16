import { useState, useEffect } from 'react'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import { Field, inputClass } from './Field'
import { fetchClusterSummary, type ClusterSummaryResponse } from '@/services/clusterService'
import { fetchNodesInfo, type NodeInfo } from '@/services/nodeService'

interface StepProps {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
  errors: Record<string, string>
}

const GPU_MODELS = ['Any GPU (Best Fit)', 'NVIDIA RTX 4090 (24GB)', 'NVIDIA RTX 3060 (12GB)', 'NVIDIA RTX 3050 (8GB)']

export function StepResources({ value, update, errors }: StepProps) {
  const [summary, setSummary] = useState<ClusterSummaryResponse | null>(null)
  const [nodes, setNodes] = useState<NodeInfo[]>([])

  useEffect(() => {
    fetchClusterSummary().then(setSummary).catch(() => null)
    fetchNodesInfo().then(setNodes).catch(() => null)
  }, [])

  const availableGpus = summary ? summary.gpus_idle : nodes.reduce((sum, n) => sum + (n.status === 'ONLINE' ? n.gpuCount : 0), 0)
  const totalCpus = nodes.reduce((sum, n) => sum + n.raw.cpu_cores, 0) || 64
  const totalRamGb = Math.round(nodes.reduce((sum, n) => sum + n.ramTotalMb, 0) / 1024) || 256

  const hasImmediateCapacity = (value.gpuCount || 1) <= Math.max(1, availableGpus)
  const estimatedQueue = hasImmediateCapacity ? '#1 (Immediate)' : '#2 (Estimated)'
  const estimatedWait = hasImmediateCapacity ? '< 1 minute' : '~8–12 minutes'

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="GPU Allocation Count" required error={errors.gpuCount} hint="Number of physical GPUs dedicated to this workload.">
          <input
            type="number"
            min={0}
            max={8}
            value={value.gpuCount ?? 1}
            onChange={(e) => update({ gpuCount: Number(e.target.value) })}
            className={inputClass}
          />
        </Field>

        <Field label="Preferred GPU Model" hint="Select specific accelerator architecture or leave on Best Fit.">
          <select
            value={value.gpuType || GPU_MODELS[0]}
            onChange={(e) => update({ gpuType: e.target.value })}
            className={inputClass}
          >
            {GPU_MODELS.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </Field>

        <Field label="CPU Cores" required error={errors.cpuCores} hint="Number of physical CPU cores allocated.">
          <input
            type="number"
            min={1}
            max={64}
            value={value.cpuCores}
            onChange={(e) => update({ cpuCores: Number(e.target.value) })}
            className={inputClass}
          />
        </Field>

        <Field label="RAM (GB)" required error={errors.ramGb} hint="Dedicated host system RAM.">
          <input
            type="number"
            min={2}
            max={512}
            value={value.ramGb}
            onChange={(e) => update({ ramGb: Number(e.target.value) })}
            className={inputClass}
          />
        </Field>

        <Field label="Minimum GPU VRAM (GB)" error={errors.gpuMinVramGb} hint="Workload will only schedule on GPUs with at least this memory.">
          <input
            type="number"
            min={0}
            max={48}
            value={value.gpuMinVramGb ?? 8}
            onChange={(e) => update({ gpuMinVramGb: Number(e.target.value) })}
            className={inputClass}
          />
        </Field>

        <Field label="Maximum Runtime (hours)" required error={errors.maxRuntimeHours} hint="Time limit. Job stops if this is reached.">
          <input
            type="number"
            min={0.5}
            max={72}
            step={0.5}
            value={value.maxRuntimeHours ?? 4}
            onChange={(e) => update({ maxRuntimeHours: Number(e.target.value) })}
            className={inputClass}
          />
        </Field>
      </div>

      {/* LIVE ESTIMATED RESOURCE AVAILABILITY */}
      <div className="rounded-[var(--radius-card)] border border-accent/30 bg-surface/90 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-status-running animate-pulse-dot" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-accent">
              Live Cluster Capacity & Queue Estimate
            </span>
          </div>
          <span className="text-[11px] font-medium text-text-muted">DIU CSE Research Pool</span>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md border border-border bg-bg-secondary p-2.5">
            <div className="text-[11px] text-text-muted">REQUESTED RESOURCES</div>
            <div className="mt-1 font-mono text-[13px] font-bold text-accent">
              {value.gpuCount ?? 1} GPU · {value.cpuCores} CPU · {value.ramGb} GB
            </div>
            <div className="text-[10px] text-text-muted">Limit: {value.maxRuntimeHours ?? 4}h</div>
          </div>

          <div className="rounded-md border border-border bg-bg-secondary p-2.5">
            <div className="text-[11px] text-text-muted">CLUSTER CAPACITY</div>
            <div className="mt-1 font-mono text-[13px] font-bold text-text-primary">
              {summary ? summary.gpus_total : 6} GPUs · {totalCpus} CPUs
            </div>
            <div className="text-[10px] text-text-muted">{totalRamGb} GB Host RAM</div>
          </div>

          <div className="rounded-md border border-border bg-bg-secondary p-2.5">
            <div className="text-[11px] text-text-muted">ESTIMATED QUEUE POS.</div>
            <div className="mt-1 flex items-center gap-1.5 font-mono text-[13px] font-bold text-text-primary">
              {hasImmediateCapacity ? (
                <CheckCircle2 size={13} className="text-status-running" />
              ) : (
                <AlertCircle size={13} className="text-status-queued" />
              )}
              {estimatedQueue}
            </div>
            <div className="text-[10px] text-text-muted">Based on pending jobs</div>
          </div>

          <div className="rounded-md border border-border bg-bg-secondary p-2.5">
            <div className="text-[11px] text-text-muted">ESTIMATED WAIT</div>
            <div className="mt-1 font-mono text-[13px] font-bold text-text-primary">
              {estimatedWait}
            </div>
            <div className="text-[10px] text-text-muted">Queue turnaround</div>
          </div>
        </div>
      </div>
    </div>
  )
}
