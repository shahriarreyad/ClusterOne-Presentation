import type { SubmitJobPayload } from '@/services/jobService'
import { DATASETS, ENVIRONMENTS } from '@/data/mockData'

interface StepReviewProps {
  value: SubmitJobPayload
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 text-[13px] last:border-0">
      <span className="text-text-secondary">{label}</span>
      <span className="max-w-[60%] text-right font-medium text-text-primary">{value}</span>
    </div>
  )
}

export function StepReview({ value }: StepReviewProps) {
  const dataset = DATASETS.find((d) => d.id === value.datasetId)
  const env = Object.values(ENVIRONMENTS).find((e) => e.id === value.environmentId)

  return (
    <div className="space-y-4">
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Job Summary</h3>
        <Row label="Name" value={value.name || '—'} />
        {value.description && <Row label="Description" value={value.description} />}
        <Row label="Execution" value={value.executionMode === 'DISTRIBUTED' ? `Distributed (${value.nodeCount} nodes)` : 'Single GPU'} />
        <Row label="GPU" value={`${value.gpuCount} × ${value.gpuType}`} />
        <Row label="Minimum VRAM" value={`${value.gpuMinVramGb} GB`} />
        <Row label="CPU" value={`${value.cpuCores} cores`} />
        <Row label="RAM" value={`${value.ramGb} GB`} />
        <Row label="Priority" value={value.priority.charAt(0) + value.priority.slice(1).toLowerCase()} />
        <Row label="Dataset" value={dataset?.name ?? '—'} />
        <Row label="Environment" value={env?.name ?? '—'} />
        <Row label="Entry Point" value={value.entryPoint || '—'} />
        {value.codeType === 'GIT' && value.repository && <Row label="Repository" value={`${value.repository} @ ${value.branch || 'main'}`} />}
        {value.arguments && <Row label="Arguments" value={value.arguments} />}
        <Row label="Maximum Runtime" value={`${value.maxRuntimeHours} hours`} />
      </div>
      <p className="text-[12px] text-text-muted">
        Once submitted, this job enters the queue and is scheduled automatically — you'll be able to track it from the job's
        details page.
      </p>
    </div>
  )
}
