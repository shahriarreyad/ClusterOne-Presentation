import type { ComponentType } from 'react'
import { cn } from '@/lib/format'

interface StatCardProps {
  label: string
  value: number | string
  icon: ComponentType<{ size?: number; className?: string }>
  tone?: 'default' | 'success' | 'warning' | 'error' | 'info'
  trend?: { value: string; direction: 'up' | 'down' | 'flat' }
  active?: boolean
  onClick?: () => void
}

const TONE_CLASS: Record<NonNullable<StatCardProps['tone']>, string> = {
  default: 'text-accent bg-accent-soft',
  success: 'text-status-running bg-status-running-soft',
  warning: 'text-status-queued bg-status-queued-soft',
  error: 'text-status-failed bg-status-failed-soft',
  info: 'text-status-scheduled bg-status-scheduled-soft',
}

export function StatCard({ label, value, icon: Icon, tone = 'default', trend, active, onClick }: StatCardProps) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      onClick={onClick}
      className={cn(
        'flex flex-col gap-3 rounded-[var(--radius-card)] border bg-surface p-4 text-left transition-colors',
        active ? 'border-accent' : 'border-border',
        onClick && 'hover:border-border-strong hover:bg-surface-hover',
      )}
    >
      <div className="flex items-center justify-between">
        <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', TONE_CLASS[tone])}>
          <Icon size={17} />
        </span>
        {trend && (
          <span
            className={cn(
              'text-[11px] font-medium',
              trend.direction === 'up' && 'text-status-running',
              trend.direction === 'down' && 'text-status-failed',
              trend.direction === 'flat' && 'text-text-muted',
            )}
          >
            {trend.value}
          </span>
        )}
      </div>
      <div>
        <div className="tabular text-2xl font-bold text-text-primary">{value}</div>
        <div className="mt-0.5 text-[12.5px] text-text-secondary">{label}</div>
      </div>
    </Tag>
  )
}
