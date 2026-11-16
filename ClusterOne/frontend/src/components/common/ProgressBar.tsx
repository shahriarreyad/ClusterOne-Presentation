import { cn } from '@/lib/format'

interface ProgressBarProps {
  value: number
  tone?: 'accent' | 'success' | 'error' | 'warning'
  showLabel?: boolean
  size?: 'sm' | 'md'
  className?: string
}

const TONE_CLASS: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  accent: 'bg-accent',
  success: 'bg-status-running',
  error: 'bg-status-failed',
  warning: 'bg-status-queued',
}

export function ProgressBar({ value, tone = 'accent', showLabel = false, size = 'md', className }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn('flex-1 overflow-hidden rounded-full bg-surface-hover', size === 'sm' ? 'h-1.5' : 'h-2')}
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={cn('h-full rounded-full transition-all duration-500 ease-out', TONE_CLASS[tone])}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && <span className="tabular w-10 shrink-0 text-right text-[12px] text-text-secondary">{Math.round(clamped)}%</span>}
    </div>
  )
}
