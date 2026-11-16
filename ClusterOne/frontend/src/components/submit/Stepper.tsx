import { Check } from 'lucide-react'
import { cn } from '@/lib/format'

export const STEP_LABELS = [
  'Basic Info',
  'Resources',
  'Partition',
  'Environment',
  'Command',
  'Review',
] as const

interface StepperProps {
  current: number
  furthestReached: number
  onStepClick: (i: number) => void
}

export function Stepper({ current, furthestReached, onStepClick }: StepperProps) {
  return (
    <div className="scrollbar-thin overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center gap-1">
        {STEP_LABELS.map((label, i) => {
          const done = i < current
          const active = i === current
          const clickable = i <= furthestReached
          return (
            <li key={label} className="flex items-center">
              <button
                disabled={!clickable}
                onClick={() => onStepClick(i)}
                className={cn(
                  'flex items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3 text-[12.5px] font-medium transition-colors',
                  active && 'bg-accent-soft text-accent font-semibold',
                  !active && done && 'text-status-running',
                  !active && !done && 'text-text-muted',
                  clickable && !active && 'hover:bg-surface-hover hover:text-text-primary',
                  !clickable && 'cursor-not-allowed opacity-50',
                )}
              >
                <span
                  className={cn(
                    'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors',
                    active && 'border-accent bg-accent text-bg',
                    !active && done && 'border-status-running bg-status-running-soft text-status-running',
                    !active && !done && 'border-border text-text-muted',
                  )}
                >
                  {done ? <Check size={13} /> : i + 1}
                </span>
                <span className="hidden sm:inline">{label}</span>
              </button>
              {i < STEP_LABELS.length - 1 && <span className="mx-1 h-px w-6 shrink-0 bg-border" />}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
