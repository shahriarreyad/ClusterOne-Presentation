import type { ComponentType } from 'react'
import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard,
  ListChecks,
  Server,
  Cpu,
  Layers,
  Database,
  HardDrive,
  Activity,
  History,
  FileText,
  Users,
  Sliders,
  Shield,
  Cog,
  FileSpreadsheet,
  UserCircle,
  Settings,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/format'

interface NavItem {
  label: string
  to: string
  icon: ComponentType<{ size?: number; className?: string }>
  badge?: number | string
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
  const sections: NavSection[] = [
    {
      items: [
        { label: 'Overview', to: '/dashboard', icon: LayoutDashboard, end: true },
        { label: 'Jobs', to: '/jobs', icon: ListChecks },
        { label: 'Nodes', to: '/resources/nodes', icon: Server },
        { label: 'GPUs', to: '/resources/gpus', icon: Cpu },
        { label: 'Training', to: '/training', icon: Layers },
        { label: 'Datasets', to: '/resources/datasets', icon: Database },
        { label: 'Storage', to: '/storage', icon: HardDrive },
        { label: 'Monitoring', to: '/monitoring', icon: Activity },
        { label: 'Activity', to: '/activity', icon: History },
        { label: 'Documentation', to: '/documentation', icon: FileText },
      ],
    },
    {
      title: 'Admin',
      items: [
        { label: 'Users', to: '/admin/users', icon: Users },
        { label: 'Partitions', to: '/admin/partitions', icon: Sliders },
        { label: 'Policies', to: '/admin/policies', icon: Shield },
        { label: 'System', to: '/admin/system', icon: Cog },
        { label: 'Audit Logs', to: '/admin/audit', icon: FileSpreadsheet },
      ],
    },
  ]

  return (
    <>
      {open && (
        <button
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-[#0B0F19] transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        {/* Brand Header */}
        <div className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/80 px-5">
          <NavLink to="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-accent/25 to-distributed/25 border border-accent/40 text-accent shadow-sm">
              <Zap size={20} className="fill-accent/20" />
            </div>
            <div>
              <div className="text-[15px] font-extrabold tracking-wider text-text-primary uppercase leading-tight font-sans">
                ClusterOne
              </div>
              <div className="text-[10px] font-semibold tracking-widest text-accent uppercase">
                DIU CSE Research
              </div>
            </div>
          </NavLink>

          <button
            aria-label="Close navigation"
            onClick={onClose}
            className="rounded-md p-1.5 text-text-secondary hover:bg-surface-hover hover:text-text-primary lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {sections.map((section, i) => (
            <div key={i}>
              {section.title && (
                <div className="px-3 pb-1.5 text-[10.5px] font-bold uppercase tracking-wider text-text-muted">
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
                          'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors',
                          isActive
                            ? 'bg-accent/15 text-accent font-semibold border border-accent/20'
                            : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary',
                        )
                      }
                    >
                      <span className="flex items-center gap-2.5">
                        <item.icon size={16} />
                        {item.label}
                      </span>
                      {item.badge !== undefined && (
                        <span className="rounded-full bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-accent">
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

        {/* Bottom User Profile & Cluster Status */}
        <div className="border-t border-border/80 p-3 space-y-2">
          {/* Cluster Status pill */}
          <div className="rounded-lg border border-border/80 bg-surface/60 p-2.5 text-[11.5px]">
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-text-primary flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-status-running animate-pulse-dot" />
                Cluster Online
              </span>
              <span className="font-mono text-[10.5px] text-accent font-medium">10.20.0.10</span>
            </div>
            <div className="text-[10.5px] text-text-muted">
              DIU CSE 12-Week Pilot Architecture
            </div>
          </div>

          {/* Quick links to Profile & Settings */}
          <div className="flex items-center justify-between gap-1 pt-1 text-[12px] text-text-secondary">
            <NavLink
              to="/account/profile"
              className="flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover hover:text-text-primary transition-colors"
            >
              <UserCircle size={15} />
              <span>Reyad</span>
            </NavLink>
            <NavLink
              to="/account/settings"
              className="rounded-md p-1.5 hover:bg-surface-hover hover:text-text-primary transition-colors"
              title="Settings"
            >
              <Settings size={15} />
            </NavLink>
          </div>
        </div>
      </aside>
    </>
  )
}
