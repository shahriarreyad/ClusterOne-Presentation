import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MoreVertical, Eye, Ban, RotateCcw, Copy, FileText, BarChart3, Download } from 'lucide-react'
import type { Job } from '@/types/job'
import { cn } from '@/lib/format'

interface JobActionMenuProps {
  job: Job
  onCancel: (job: Job) => void
  onRetry: (job: Job) => void
  onClone: (job: Job) => void
  pending?: boolean
}

export function JobActionMenu({ job, onCancel, onRetry, onClone, pending }: JobActionMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const canCancel = ['RUNNING', 'QUEUED', 'SCHEDULED', 'SUBMITTED'].includes(job.status)
  const canRetry = job.status === 'FAILED' || job.status === 'TIMEOUT'
  const canClone = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(job.status)
  const canViewResults = job.status === 'COMPLETED'

  return (
    <div className="flex items-center justify-end gap-1.5">
      <Link
        to={`/jobs/${job.id}`}
        className="rounded-md border border-border px-2.5 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
      >
        View
      </Link>
      <div className="relative" ref={ref}>
        <button
          aria-label={`More actions for job ${job.id}`}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <MoreVertical size={15} />
        </button>
        {open && (
          <div
            role="menu"
            className="absolute right-0 top-9 z-20 w-44 animate-fade-in overflow-hidden rounded-md border border-border bg-surface-raised py-1 shadow-xl"
          >
            <MenuLink to={`/jobs/${job.id}`} icon={Eye} label="View Details" onClick={() => setOpen(false)} />
            <MenuLink to={`/jobs/${job.id}/logs`} icon={FileText} label="Logs" onClick={() => setOpen(false)} />
            {job.status === 'RUNNING' && (
              <MenuLink to={`/jobs/${job.id}/metrics`} icon={BarChart3} label="Metrics" onClick={() => setOpen(false)} />
            )}
            {canViewResults && (
              <MenuLink to={`/jobs/${job.id}/results`} icon={Download} label="Results" onClick={() => setOpen(false)} />
            )}
            {canCancel && (
              <MenuButton
                icon={Ban}
                label="Cancel Job"
                tone="danger"
                disabled={pending}
                onClick={() => {
                  setOpen(false)
                  onCancel(job)
                }}
              />
            )}
            {canRetry && (
              <MenuButton
                icon={RotateCcw}
                label="Retry Job"
                disabled={pending}
                onClick={() => {
                  setOpen(false)
                  onRetry(job)
                }}
              />
            )}
            {canClone && (
              <MenuButton
                icon={Copy}
                label="Clone Job"
                disabled={pending}
                onClick={() => {
                  setOpen(false)
                  onClone(job)
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function MenuLink({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string
  icon: typeof Eye
  label: string
  onClick: () => void
}) {
  return (
    <Link
      to={to}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
    >
      <Icon size={14} />
      {label}
    </Link>
  )
}

function MenuButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = 'default',
}: {
  icon: typeof Eye
  label: string
  onClick: () => void
  disabled?: boolean
  tone?: 'default' | 'danger'
}) {
  return (
    <button
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2.5 px-3 py-2 text-left text-[12.5px] transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        tone === 'danger' ? 'text-status-failed hover:bg-status-failed-soft' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
