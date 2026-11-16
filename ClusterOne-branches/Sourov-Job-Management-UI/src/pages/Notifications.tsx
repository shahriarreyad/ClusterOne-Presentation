import { Link } from 'react-router-dom'
import { CheckCircle2, PlayCircle, AlertTriangle, XCircle, Info, CheckCheck, Bell } from 'lucide-react'
import { useNotifications } from '@/context/NotificationsContext'
import { EmptyState } from '@/components/common/States'
import { formatRelativeTime, cn } from '@/lib/format'
import type { NotificationItem } from '@/types/job'

const ICONS: Record<NotificationItem['type'], typeof CheckCircle2> = {
  success: CheckCircle2,
  info: PlayCircle,
  warning: AlertTriangle,
  error: XCircle,
}

const ICON_STYLE: Record<NotificationItem['type'], string> = {
  success: 'text-status-running bg-status-running-soft',
  info: 'text-status-scheduled bg-status-scheduled-soft',
  warning: 'text-status-queued bg-status-queued-soft',
  error: 'text-status-failed bg-status-failed-soft',
}

export function Notifications() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications()
  const sorted = [...notifications].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Notifications</h1>
          <p className="mt-1 text-[13.5px] text-text-secondary">
            {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}` : 'You are all caught up.'}
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-[12.5px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <CheckCheck size={14} />
            Mark all as read
          </button>
        )}
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={Bell} title="No Notifications" description="Job status updates will show up here." />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-card)] border border-border">
          {sorted.map((n) => {
            const Icon = ICONS[n.type] ?? Info
            return (
              <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3.5 transition-colors', !n.read && 'bg-accent-soft/20')}>
                <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', ICON_STYLE[n.type])}>
                  <Icon size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <Link to={`/jobs/${n.jobId}`} onClick={() => markAsRead(n.id)} className="text-[13px] text-text-primary hover:text-accent">
                    {n.message}
                  </Link>
                  <div className="mt-0.5 text-[11.5px] text-text-muted">{formatRelativeTime(n.timestamp)}</div>
                </div>
                {!n.read && (
                  <button
                    onClick={() => markAsRead(n.id)}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] font-medium text-accent hover:bg-accent-soft"
                  >
                    Mark as read
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
