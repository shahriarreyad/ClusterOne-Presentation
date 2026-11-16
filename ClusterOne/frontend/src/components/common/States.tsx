import type { ComponentType, ReactNode } from 'react'
import { Inbox, AlertTriangle, RotateCcw } from 'lucide-react'

interface EmptyStateProps {
  icon?: ComponentType<{ size?: number; className?: string }>
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-dashed border-border bg-surface/50 px-6 py-14 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-surface-hover text-text-muted">
        <Icon size={20} />
      </span>
      <h3 className="text-[14.5px] font-semibold text-text-primary">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-[13px] text-text-secondary">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-card)] border border-status-failed/30 bg-status-failed-soft px-6 py-12 text-center">
      <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-status-failed/15 text-status-failed">
        <AlertTriangle size={20} />
      </span>
      <h3 className="text-[14.5px] font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 max-w-sm text-[13px] text-text-secondary">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3.5 py-2 text-[13px] font-medium text-text-primary transition-colors hover:bg-surface-hover"
        >
          <RotateCcw size={14} />
          Try Again
        </button>
      )}
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-border">
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex items-center gap-4 px-4 py-4">
            {Array.from({ length: cols }).map((_, c) => (
              <div key={c} className="h-3.5 flex-1 animate-pulse rounded bg-surface-hover" style={{ animationDelay: `${(r + c) * 40}ms` }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export function CardSkeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-[var(--radius-card)] border border-border bg-surface ${className}`} />
}

export function DemoDataBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted ${className}`}
      title="This view is powered by mock data — no live cluster is connected."
    >
      Demo Data
    </span>
  )
}
