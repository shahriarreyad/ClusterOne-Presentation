import { Flame, Box, Settings2 } from 'lucide-react'
import { ENVIRONMENTS } from '@/data/mockData'

const ICONS: Record<string, typeof Flame> = { 'pytorch-cuda': Flame, 'tensorflow-cuda': Box, custom: Settings2 }

export function EnvironmentsPage() {
  return (
    <div className="space-y-5">
      <h1 className="text-[22px] font-bold text-text-primary">Environments</h1>
      <p className="text-[13.5px] text-text-secondary">
        Containerized runtimes (Apptainer) available to jobs. No manual container commands required.
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        {Object.values(ENVIRONMENTS).map((env) => {
          const Icon = ICONS[env.id] ?? Box
          return (
            <div key={env.id} className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
              <span className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Icon size={17} />
              </span>
              <div className="text-[14px] font-semibold text-text-primary">{env.name}</div>
              <dl className="mt-2 space-y-1 text-[12px]">
                <div className="flex justify-between text-text-secondary">
                  <dt className="text-text-muted">Python</dt>
                  <dd className="tabular">{env.pythonVersion}</dd>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <dt className="text-text-muted">Framework</dt>
                  <dd className="tabular">{env.frameworkVersion}</dd>
                </div>
                <div className="flex justify-between text-text-secondary">
                  <dt className="text-text-muted">CUDA</dt>
                  <dd className="tabular">{env.cudaVersion}</dd>
                </div>
              </dl>
            </div>
          )
        })}
      </div>
    </div>
  )
}
