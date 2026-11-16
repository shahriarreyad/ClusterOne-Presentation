import { ShieldCheck, Users, TerminalSquare } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import { cn } from '@/lib/format'
import { NodePicker } from './NodePicker'

interface StepProps {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
  errors: Record<string, string>
}

const PARTITIONS = [
  {
    id: 'gpu',
    name: 'gpu',
    badge: 'Recommended for Training',
    desc: 'Dedicated physical GPU allocation with exclusive CUDA memory and compute access.',
    details: 'Best for: PyTorch DDP, Large Language Models, deep learning vision models. Guarantees 0% interference from other users.',
    icon: ShieldCheck,
    color: 'border-accent text-accent',
  },
  {
    id: 'teaching',
    name: 'teaching',
    badge: 'MPS / Shared GPU',
    desc: 'Multi-Process Service (MPS) GPU sharing for lightweight coursework and multi-student labs.',
    details: 'Best for: Introductory ML coursework, exploratory data analysis, small batches. Maximum 4 concurrent students per GPU.',
    icon: Users,
    color: 'border-indigo-400 text-indigo-400',
  },
  {
    id: 'interactive',
    name: 'interactive',
    badge: 'Rapid Testing / Debug',
    desc: 'High-priority interactive session for rapid code debugging and quick sanity checks.',
    details: 'Best for: Testing scripts before long runs, Jupyter sessions, single epoch smoke tests. Max time limit 1 hour.',
    icon: TerminalSquare,
    color: 'border-emerald-400 text-emerald-400',
  },
]

export function StepPartition({ value, update }: StepProps) {
  const current = value.partition || 'gpu'

  return (
    <div className="space-y-6">
      <NodePicker value={value} update={update} />
      <div className="space-y-4">
      <p className="text-[13px] text-text-secondary">
        Select the target cluster partition. Partitions control Slurm scheduling priority, GPU isolation, and maximum walltime.
      </p>

      <div className="space-y-3">
        {PARTITIONS.map((p) => {
          const selected = current === p.id
          const Icon = p.icon

          return (
            <div
              key={p.id}
              onClick={() => update({ partition: p.id })}
              className={cn(
                'cursor-pointer rounded-[var(--radius-card)] border p-4 transition-all',
                selected
                  ? 'border-accent bg-accent/10 shadow-sm'
                  : 'border-border bg-surface hover:border-border-strong hover:bg-surface-hover',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-surface',
                      p.color,
                    )}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[14px] font-bold text-text-primary">{p.name}</span>
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-[10.5px] font-semibold',
                          selected ? 'bg-accent/20 text-accent' : 'bg-surface-hover text-text-muted',
                        )}
                      >
                        {p.badge}
                      </span>
                    </div>
                    <div className="mt-1 text-[13px] text-text-secondary">{p.desc}</div>
                    <div className="mt-2 text-[12px] text-text-muted">{p.details}</div>
                  </div>
                </div>

                <div
                  className={cn(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    selected ? 'border-accent bg-accent' : 'border-border',
                  )}
                >
                  {selected && <div className="h-2 w-2 rounded-full bg-bg" />}
                </div>
              </div>
            </div>
          )
        })}
      </div>
      </div>
    </div>
  )
}

