import type { ComponentType } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ListChecks,
  PlusCircle,
  History,
  Server,
  Cpu,
  Database,
  Boxes,
  ActivitySquare,
  Bell,
  UserCircle,
  Settings,
  Layers3,
  X,
} from 'lucide-react'
import { cn } from '@/lib/format'
import { useNotifications } from '@/context/NotificationsContext'

interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ size?: number; className?: string }>
  badge?: number
  end?: boolean
}

interface NavSection {
  title?: string
  items: NavItem[]
}

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export function Sidebar({ open, onClose }: SidebarProps) {
  const { unreadCount } = useNotifications()

  const sections: NavSection[] = [
    { items: [{ label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard, end: true }] },
    {
      title: 'Workload',
      items: [
        { label: 'Run on GPUs', to: '/run', icon: Cpu },
        { label: 'Jobs', to: '/jobs', icon: ListChecks },
        { label: 'Submit Job', to: '/jobs/new', icon: PlusCircle },
        { label: 'Job History', to: '/jobs/history', icon: History },
      ],
    },
    {
      title: 'Resources',
      items: [
        { label: 'Nodes', to: '/resources/nodes', icon: Server },
        { label: 'GPUs', to: '/resources/gpus', icon: Cpu },
        { label: 'Datasets', to: '/resources/datasets', icon: Database },
        { label: 'Environments', to: '/resources/environments', icon: Boxes },
      ],
    },
    {
      title: 'Monitoring',
      items: [
        { label: 'Cluster Monitoring', to: '/monitoring', icon: ActivitySquare },
        { label: 'Notifications', to: '/notifications', icon: Bell, badge: unreadCount },
      ],
    },
    {
      title: 'Account',
      items: [
        { label: 'Profile', to: '/account/profile', icon: UserCircle },
        { label: 'Settings', to: '/account/settings', icon: Settings },
      ],
    },
  ]

  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-bg-secondary transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-5">
          <a href="/dashboard" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <Layers3 size={18} />
            </span>
            <span className="text-[15px] font-bold tracking-tight text-text-primary">ClusterOne</span>
          </a>
          <button
            aria-label="Close navigation"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4">
          {sections.map((section, i) => (
            <div key={i} className={cn(i > 0 && 'mt-5')}>
              {section.title && (
                <div className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  {section.title}
                </div>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      onClick={onClose}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center justify-between gap-2 rounded-md px-3 py-2 text-[13.5px] font-medium transition-colors',
                          isActive
                            ? 'bg-accent-soft text-accent'
                            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                        )
                      }
                    >
                      <span className="flex items-center gap-2.5">
                        <item.icon size={16} />
                        {item.label}
                      </span>
                      {!!item.badge && (
                        <span className="rounded-full bg-status-queued-soft px-1.5 py-0.5 text-[10.5px] font-semibold text-status-queued">
                          {item.badge}
                        </span>
                      )}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-border p-3">
          <div className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[11.5px] text-text-muted">
            <span className="font-semibold text-text-secondary">ClusterOne</span> v1.0 · Demo cluster
          </div>
        </div>
      </aside>
    </>
  )
}
