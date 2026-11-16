import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Menu, Search, Bell, PlusCircle, Command } from 'lucide-react'
import { useNotifications } from '@/context/NotificationsContext'
import { AccountMenu } from './AccountMenu'
import { ActiveNodeMenu } from './ActiveNodeMenu'
import { CommandPalette } from '@/components/common/CommandPalette'

interface TopHeaderProps {
  title: string
  onMenuClick: () => void
  clusterStatus?: 'ok' | 'degraded' | 'critical'
}

export function TopHeader({ title, onMenuClick, clusterStatus = 'ok' }: TopHeaderProps) {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const { unreadCount } = useNotifications()

  const isHealthy = clusterStatus === 'ok'

  return (
    <>
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-3 border-b border-border bg-[#0B0F19]/90 px-4 backdrop-blur-md sm:px-6">
        <button
          aria-label="Open navigation"
          onClick={onMenuClick}
          className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary lg:hidden"
        >
          <Menu size={19} />
        </button>

        <h1 className="hidden shrink-0 text-[15px] font-bold text-text-primary sm:block tracking-tight">
          {title}
        </h1>

        {/* Global Search / Command Palette input */}
        <div className="ml-2 hidden max-w-md flex-1 sm:block">
          <div
            onClick={() => setPaletteOpen(true)}
            className="group flex cursor-pointer items-center justify-between rounded-lg border border-border/80 bg-surface/70 px-3 py-1.5 transition-all hover:border-accent hover:bg-surface"
          >
            <div className="flex items-center gap-2 text-[12.5px] text-text-muted">
              <Search size={14} className="text-text-muted group-hover:text-accent" />
              <span>Search jobs, nodes, users, datasets...</span>
            </div>
            <kbd className="flex items-center gap-0.5 rounded border border-border bg-bg/70 px-1.5 py-0.5 font-mono text-[10.5px] text-text-muted group-hover:text-text-secondary">
              <Command size={10} /> K
            </kbd>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <ActiveNodeMenu />
          {/* Cluster Status pill */}
          <Link
            to="/admin/system"
            className="hidden items-center gap-1.5 rounded-full border border-border/80 bg-surface/70 px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:bg-surface md:flex transition-colors"
          >
            <span
              className={
                isHealthy
                  ? 'h-2 w-2 rounded-full bg-status-running animate-pulse-dot'
                  : 'h-2 w-2 rounded-full bg-status-timeout animate-pulse-dot'
              }
            />
            <span className="font-semibold text-text-primary">Cluster:</span>
            <span className={isHealthy ? 'text-status-running font-medium' : 'text-status-timeout font-medium'}>
              {isHealthy ? 'Online (10.20.0.10)' : 'Degraded'}
            </span>
          </Link>

          {/* Quick Submit Job Button */}
          <Link
            to="/jobs/new"
            className="flex items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[13px] font-semibold text-bg transition-all hover:bg-accent/90 shadow-sm shadow-accent/20 active:scale-95"
          >
            <PlusCircle size={15} />
            <span>Submit Job</span>
          </Link>

          {/* Notifications */}
          <Link
            to="/notifications"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
            className="relative rounded-md p-2 text-text-secondary hover:bg-surface-hover hover:text-text-primary transition-colors"
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

      {/* Global Command Palette modal */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  )
}
