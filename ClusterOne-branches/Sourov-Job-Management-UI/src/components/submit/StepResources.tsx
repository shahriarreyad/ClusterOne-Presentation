import { useState } from 'react'
import { ChevronDown, Cpu, MemoryStick, Gauge, Clock } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import type { JobPriority } from '@/types/job'
import { AVAILABLE_GPUS } from '@/data/mockData'
import { Field, inputClass } from './Field'
import { DemoDataBadge } from '@/components/common/States'
import { cn } from '@/lib/format'

interface StepProps {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
  errors: Record<string, string>
}

const GPU_TYPES = ['Any GPU', 'RTX 3050', 'RTX 3060', 'RTX 4060', 'RTX 2060']
const PRIORITIES: JobPriority[] = ['LOW', 'NORMAL', 'HIGH']

export function StepResources({ value, update, errors }: StepProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CPU Cores" required error={errors.cpuCores}>
            <input type="number" min={1} max={64} value={value.cpuCores} onChange={(e) => update({ cpuCores: Number(e.target.value) })} className={inputClass} />
          </Field>
          <Field label="RAM (GB)" required error={errors.ramGb}>
            <input type="number" min={1} max={512} value={value.ramGb} onChange={(e) => update({ ramGb: Number(e.target.value) })} className={inputClass} />
          </Field>
          <Field label="GPU Type" hint="Any GPU lets the scheduler pick the best available match.">
            <select value={value.gpuType} onChange={(e) => update({ gpuType: e.target.value })} className={inputClass}>
              {GPU_TYPES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Minimum GPU VRAM (GB)" required error={errors.gpuMinVramGb}>
            <input
              type="number"
              min={1}
              max={80}
              value={value.gpuMinVramGb}
              onChange={(e) => update({ gpuMinVramGb: Number(e.target.value) })}
              className={inputClass}
            />
          </Field>
        </div>

        <div className="rounded-[var(--radius-card)] border border-border bg-surface">
          <button
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-[13px] font-medium text-text-primary"
          >
            Advanced Settings
            <ChevronDown size={16} className={cn('transition-transform', advancedOpen && 'rotate-180')} />
          </button>
          {advancedOpen && (
            <div className="grid gap-4 border-t border-border p-4 sm:grid-cols-2">
              <Field label="Maximum Runtime (hours)" required error={errors.maxRuntimeHours} hint="Job is stopped automatically if this is exceeded.">
                <input
                  type="number"
                  min={0.5}
                  max={48}
                  step={0.5}
                  value={value.maxRuntimeHours}
                  onChange={(e) => update({ maxRuntimeHours: Number(e.target.value) })}
                  className={inputClass}
                />
              </Field>
              <Field label="Priority">
                <select value={value.priority} onChange={(e) => update({ priority: e.target.value as JobPriority })} className={inputClass}>
                  {PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p.charAt(0) + p.slice(1).toLowerCase()}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          )}
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-text-muted">Available Resources</h3>
            <DemoDataBadge />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {AVAILABLE_GPUS.map((g) => (
              <div key={g.model} className="rounded-md border border-border bg-surface p-2.5 text-center">
                <div className="text-[12px] font-semibold text-text-primary">{g.model}</div>
                <div className={cn('tabular text-[11px]', g.available > 0 ? 'text-status-running' : 'text-status-failed')}>
                  {g.available} available
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <aside className="h-fit rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Resource Request</h3>
        <SummaryRow icon={Cpu} label="CPU" value={`${value.cpuCores} Cores`} />
        <SummaryRow icon={MemoryStick} label="RAM" value={`${value.ramGb} GB`} />
        <SummaryRow icon={Gauge} label="GPU" value={`${value.gpuCount} × ${value.gpuType}`} />
        <SummaryRow icon={MemoryStick} label="VRAM" value={`≥ ${value.gpuMinVramGb} GB`} />
        <SummaryRow icon={Clock} label="Max Runtime" value={`${value.maxRuntimeHours}h`} last />
      </aside>
    </div>
  )
}

function SummaryRow({ icon: Icon, label, value, last }: { icon: typeof Cpu; label: string; value: string; last?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between py-2 text-[12.5px]', !last && 'border-b border-border')}>
      <span className="flex items-center gap-1.5 text-text-secondary">
        <Icon size={13} />
        {label}
      </span>
      <span className="tabular font-medium text-text-primary">{value}</span>
    </div>
  )
}
