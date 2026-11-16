import type { JobStatus } from '@/types/job'

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

export function formatRelativeTime(iso: string | null): string {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMin = Math.round(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.round(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.round(diffHr / 24)
  return `${diffDay}d ago`
}

export function formatClock(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function formatBytes(gb: number): string {
  if (gb < 1) return `${Math.round(gb * 1024)} MB`
  return `${gb.toFixed(1)} GB`
}

export function elapsedSeconds(startedAt: string | null, endedAt: string | null): number {
  if (!startedAt) return 0
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  return Math.max(0, Math.floor((end - new Date(startedAt).getTime()) / 1000))
}

export const STATUS_LABEL: Record<JobStatus, string> = {
  SUBMITTED: 'Submitted',
  QUEUED: 'Queued',
  SCHEDULED: 'Scheduled',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
  TIMEOUT: 'Timeout',
}

export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}
