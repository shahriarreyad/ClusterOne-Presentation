import type { ReactNode } from 'react'
import { Cpu, MemoryStick, Zap, Thermometer, Server } from 'lucide-react'
import type { Job } from '@/types/job'
import { ProgressBar } from '@/components/common/ProgressBar'

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between py-2 text-[13px]">
      <span className="text-text-secondary">{label}</span>
      <span className="tabular font-medium text-text-primary">{value}</span>
    </div>
  )
}

export function ResourceSummary({ job }: { job: Job }) {
  const { request, actual } = job

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Requested Resources</h3>
        <div className="divide-y divide-border">
          <Row label="CPU" value={`${request.cpuCores} cores`} />
          <Row label="RAM" value={`${request.ramGb} GB`} />
          <Row label="GPU" value={`${request.gpuCount} × ${request.gpuType}`} />
          <Row label="Minimum VRAM" value={`≥ ${request.gpuMinVramGb} GB`} />
          <Row label="Max Runtime" value={`${request.maxRuntimeHours}h`} />
          <Row label="Priority" value={request.priority.charAt(0) + request.priority.slice(1).toLowerCase()} />
        </div>
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Actual Resources</h3>
        {actual ? (
          <div className="divide-y divide-border">
            <Row label="Node" value={actual.node} />
            <Row label="GPU" value={actual.gpuModel} />
            <Row label="CPU" value={`${actual.cpuCores} cores`} />
            <Row label="RAM" value={`${actual.ramUsedGb} / ${actual.ramGb} GB`} />
            <Row label="VRAM" value={`${actual.gpuVramUsedGb} / ${actual.gpuVramGb} GB`} />
          </div>
        ) : (
          <p className="py-6 text-center text-[12.5px] text-text-muted">Not yet allocated — actual resources appear once the job is scheduled.</p>
        )}
      </div>

      {actual && (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 md:col-span-2">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Live Utilization</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <UtilStat icon={Cpu} label="GPU Utilization" value={`${actual.gpuUtilization}%`} progress={actual.gpuUtilization} />
            <UtilStat icon={MemoryStick} label="GPU Memory" value={`${actual.gpuVramUsedGb} / ${actual.gpuVramGb} GB`} progress={(actual.gpuVramUsedGb / actual.gpuVramGb) * 100} />
            <UtilStat icon={Zap} label="Power Usage" value={`${actual.powerWatts} W`} />
            <UtilStat icon={Thermometer} label="Temperature" value={`${actual.temperatureC}°C`} />
            <UtilStat icon={Cpu} label="CPU Utilization" value={`${actual.cpuUtilization}%`} progress={actual.cpuUtilization} />
            <UtilStat icon={MemoryStick} label="RAM" value={`${actual.ramUsedGb} / ${actual.ramGb} GB`} progress={(actual.ramUsedGb / actual.ramGb) * 100} />
            <UtilStat icon={Server} label="Network" value={`${(actual.networkMbps / 1000).toFixed(1)} Gbps`} />
          </div>
        </div>
      )}

      {job.allocations.length > 1 && (
        <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 md:col-span-2">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Per-Node Allocation</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {job.allocations.map((a) => (
              <div key={a.nodeId} className="rounded-md border border-border bg-bg-secondary p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-text-primary">{a.nodeId}</span>
                  <span className="rounded bg-distributed-soft px-1.5 py-0.5 text-[10px] font-bold text-distributed">{a.role}</span>
                </div>
                <div className="mt-1 text-[11.5px] text-text-secondary">
                  {a.gpuId} · {a.gpuModel}
                </div>
                <ProgressBar value={a.utilization} size="sm" showLabel className="mt-2" />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function UtilStat({
  icon: Icon,
  label,
  value,
  progress,
}: {
  icon: typeof Cpu
  label: string
  value: string
  progress?: number
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11.5px] text-text-muted">
        <Icon size={13} />
        {label}
      </div>
      <div className="tabular mt-1 text-[15px] font-semibold text-text-primary">{value}</div>
      {progress !== undefined && <ProgressBar value={progress} size="sm" className="mt-1.5" />}
    </div>
  )
}
