import { Cpu, Network } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import type { DistributionStrategy } from '@/types/job'
import { Field, inputClass } from './Field'
import { cn } from '@/lib/format'

interface StepProps {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
  errors: Record<string, string>
}

const STRATEGIES: { value: DistributionStrategy; label: string }[] = [
  { value: 'PYTORCH_DDP', label: 'PyTorch DDP' },
  { value: 'FSDP', label: 'Fully Sharded (FSDP)' },
  { value: 'HOROVOD', label: 'Horovod' },
]

export function StepExecutionMode({ value, update, errors }: StepProps) {
  const isDistributed = value.executionMode === 'DISTRIBUTED'

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <ModeCard
          icon={Cpu}
          title="Single GPU"
          description="Run your workload on one available GPU. Best for most training, fine-tuning and inference jobs."
          selected={!isDistributed}
          onClick={() => update({ executionMode: 'SINGLE_GPU', gpuCount: 1, nodeCount: 1 })}
        />
        <ModeCard
          icon={Network}
          title="Distributed Multi-GPU"
          description="Run one workload across multiple GPUs/nodes. Best for large models or datasets that need more compute."
          selected={isDistributed}
          tone="distributed"
          onClick={() => update({ executionMode: 'DISTRIBUTED', gpuCount: Math.max(2, value.gpuCount), nodeCount: Math.max(2, value.nodeCount) })}
        />
      </div>

      {isDistributed && (
        <div className="animate-fade-in rounded-[var(--radius-card)] border border-distributed/30 bg-distributed-soft/30 p-4">
          <p className="mb-4 text-[12.5px] leading-relaxed text-text-secondary">
            Distributed mode allows one AI workload to use GPUs across multiple compute nodes. ClusterOne handles process
            groups, networking and synchronization for you — you only choose how much compute you need.
          </p>

          <div className="mb-4 flex items-center justify-center gap-2 overflow-x-auto rounded-md border border-border bg-surface p-3">
            <span className="rounded bg-distributed-soft px-2 py-1 text-[11px] font-semibold text-distributed">Job</span>
            <span className="h-px w-4 bg-border-strong sm:w-8" />
            {Array.from({ length: Math.min(value.nodeCount, 6) }).map((_, i) => (
              <span key={i} className="rounded border border-border bg-bg-secondary px-2 py-1 text-[11px] text-text-secondary">
                GPU{i + 1}
              </span>
            ))}
            {value.nodeCount > 6 && <span className="text-[11px] text-text-muted">+{value.nodeCount - 6} more</span>}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Number of GPUs" required error={errors.gpuCount} hint="Minimum 2 for distributed mode.">
              <input
                type="number"
                min={2}
                max={16}
                value={value.gpuCount}
                onChange={(e) => update({ gpuCount: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Number of Nodes" hint="Auto-selected by the scheduler by default.">
              <input
                type="number"
                min={1}
                max={value.gpuCount}
                value={value.nodeCount}
                onChange={(e) => update({ nodeCount: Number(e.target.value) })}
                className={inputClass}
              />
            </Field>
            <Field label="Distribution Strategy">
              <select value="PYTORCH_DDP" disabled className={`${inputClass} opacity-70`}>
                {STRATEGIES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <p className="mt-3 text-[11.5px] text-text-muted">
            Low-level NCCL and networking configuration is managed automatically. Open Advanced Settings in Step 3 to override it.
          </p>
        </div>
      )}
    </div>
  )
}

function ModeCard({
  icon: Icon,
  title,
  description,
  selected,
  onClick,
  tone = 'accent',
}: {
  icon: typeof Cpu
  title: string
  description: string
  selected: boolean
  onClick: () => void
  tone?: 'accent' | 'distributed'
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-2 rounded-[var(--radius-card)] border-2 p-4 text-left transition-colors',
        selected
          ? tone === 'distributed'
            ? 'border-distributed bg-distributed-soft/40'
            : 'border-accent bg-accent-soft'
          : 'border-border bg-surface hover:border-border-strong',
      )}
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-lg',
          selected ? (tone === 'distributed' ? 'bg-distributed text-bg' : 'bg-accent text-bg') : 'bg-surface-hover text-text-secondary',
        )}
      >
        <Icon size={17} />
      </span>
      <div className="text-[14px] font-semibold text-text-primary">{title}</div>
      <p className="text-[12.5px] leading-relaxed text-text-secondary">{description}</p>
    </button>
  )
}
