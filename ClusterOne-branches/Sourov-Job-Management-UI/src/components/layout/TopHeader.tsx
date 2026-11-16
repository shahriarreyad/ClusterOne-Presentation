import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Menu, Search, Bell, PlusCircle } from 'lucide-react'
import { CLUSTER_HEALTH } from '@/data/mockData'
import { useNotifications } from '@/context/NotificationsContext'
import { AccountMenu } from './AccountMenu'

interface TopHeaderProps {
  title: string
  onMenuClick: () => void
}

export function TopHeader({ title, onMenuClick }: TopHeaderProps) {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { unreadCount } = useNotifications()
  const healthy = CLUSTER_HEALTH === 'HEALTHY'

  const handleSearch = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim()) navigate(`/jobs?search=${encodeURIComponent(query.trim())}`)
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-bg/90 px-4 backdrop-blur sm:px-6">
      <button
        aria-label="Open navigation"
        onClick={onMenuClick}
        className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary lg:hidden"
      >
        <Menu size={19} />
      </button>

      <h1 className="hidden shrink-0 text-[15px] font-semibold text-text-primary sm:block">{title}</h1>

      <form onSubmit={handleSearch} className="ml-1 hidden max-w-sm flex-1 sm:block">
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search jobs by name, ID, dataset..."
            aria-label="Search jobs"
            className="w-full rounded-md border border-border bg-surface py-2 pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>
      </form>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="hidden items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-[12px] font-medium text-text-secondary md:flex">
          <span
            className={
              healthy
                ? 'h-1.5 w-1.5 rounded-full bg-status-running animate-pulse-dot'
                : 'h-1.5 w-1.5 rounded-full bg-status-timeout animate-pulse-dot'
            }
          />
          Cluster: {healthy ? 'Healthy' : 'Degraded'}
        </div>

        <Link
          to="/jobs/new"
          className="hidden items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent/90 md:flex"
        >
          <PlusCircle size={15} />
          Submit Job
        </Link>

        <Link
          to="/notifications"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
          className="relative rounded-md p-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-status-failed text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Link>

        <AccountMenu />
      </div>
    </header>
  )
}
