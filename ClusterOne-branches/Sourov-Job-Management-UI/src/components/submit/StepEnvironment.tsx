import { Flame, Box, Settings2, Check } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import { ENVIRONMENTS } from '@/data/mockData'
import { cn } from '@/lib/format'

interface StepProps {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
  errors: Record<string, string>
}

const ICONS: Record<string, typeof Flame> = {
  'pytorch-cuda': Flame,
  'tensorflow-cuda': Box,
  custom: Settings2,
}

export function StepEnvironment({ value, update, errors }: StepProps) {
  const envs = Object.values(ENVIRONMENTS)

  return (
    <div className="space-y-3">
      <p className="text-[12.5px] text-text-secondary">
        Environments run in isolated Apptainer containers — no manual container commands required.
      </p>
      <div className="grid gap-3 sm:grid-cols-3">
        {envs.map((env) => {
          const Icon = ICONS[env.id] ?? Box
          const selected = value.environmentId === env.id
          return (
            <button
              key={env.id}
              onClick={() => update({ environmentId: env.id })}
              className={cn(
                'flex flex-col items-start gap-2 rounded-[var(--radius-card)] border-2 p-4 text-left transition-colors',
                selected ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-strong',
              )}
            >
              <div className="flex w-full items-center justify-between">
                <span className={cn('flex h-8 w-8 items-center justify-center rounded-lg', selected ? 'bg-accent text-bg' : 'bg-surface-hover text-text-secondary')}>
                  <Icon size={15} />
                </span>
                {selected && <Check size={16} className="text-accent" />}
              </div>
              <div className="text-[13.5px] font-semibold text-text-primary">{env.name}</div>
              <dl className="w-full space-y-1 text-[11.5px] text-text-secondary">
                <div className="flex justify-between">
                  <dt className="text-text-muted">Python</dt>
                  <dd className="tabular">{env.pythonVersion}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">Framework</dt>
                  <dd className="tabular">{env.frameworkVersion}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-text-muted">CUDA</dt>
                  <dd className="tabular">{env.cudaVersion}</dd>
                </div>
              </dl>
            </button>
          )
        })}
      </div>
      {errors.environmentId && <p className="text-[11.5px] font-medium text-status-failed">{errors.environmentId}</p>}
    </div>
  )
}
