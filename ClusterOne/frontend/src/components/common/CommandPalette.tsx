import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search,
  PlusCircle,
  PlayCircle,
  Server,
  Activity,
  FileText,
  User,
  Cpu,
  Database,
  HardDrive,
  ArrowRight,
} from 'lucide-react'

interface CommandPaletteProps {
  open: boolean
  onClose: () => void
}

interface ActionItem {
  id: string
  title: string
  subtitle: string
  category: string
  icon: typeof Search
  action: () => void
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  const actions: ActionItem[] = [
    {
      id: 'submit-job',
      title: 'Submit New Job',
      subtitle: 'Open the multi-step job creation wizard',
      category: 'Workloads',
      icon: PlusCircle,
      action: () => {
        navigate('/jobs/new')
        onClose()
      },
    },
    {
      id: 'running-jobs',
      title: 'View Running Jobs',
      subtitle: 'See real-time workloads on GPU compute nodes',
      category: 'Workloads',
      icon: PlayCircle,
      action: () => {
        navigate('/jobs/running')
        onClose()
      },
    },
    {
      id: 'all-jobs',
      title: 'All Cluster Jobs',
      subtitle: 'Browse complete job scheduler history',
      category: 'Workloads',
      icon: Cpu,
      action: () => {
        navigate('/jobs')
        onClose()
      },
    },
    {
      id: 'nodes',
      title: 'Compute Nodes',
      subtitle: 'Inspect physical GPU servers & telemetry',
      category: 'Infrastructure',
      icon: Server,
      action: () => {
        navigate('/resources/nodes')
        onClose()
      },
    },
    {
      id: 'gpus',
      title: 'GPU Inventory & Allocation',
      subtitle: 'Per-card VRAM, temperature & power status',
      category: 'Infrastructure',
      icon: Cpu,
      action: () => {
        navigate('/resources/gpus')
        onClose()
      },
    },
    {
      id: 'monitoring',
      title: 'Cluster Monitoring',
      subtitle: 'Grafana & Prometheus infrastructure metrics',
      category: 'Observability',
      icon: Activity,
      action: () => {
        navigate('/monitoring')
        onClose()
      },
    },
    {
      id: 'datasets',
      title: 'Shared Research Datasets',
      subtitle: 'NFS /datasets mount points & files',
      category: 'Storage',
      icon: Database,
      action: () => {
        navigate('/resources/datasets')
        onClose()
      },
    },
    {
      id: 'storage',
      title: 'NFS & ZFS Storage Pools',
      subtitle: 'Capacity quotas, /home, /projects, /scratch',
      category: 'Storage',
      icon: HardDrive,
      action: () => {
        navigate('/storage')
        onClose()
      },
    },
    {
      id: 'docs',
      title: 'Cluster Documentation & Runbooks',
      subtitle: 'Slurm batch scripts, Apptainer guide, FAQ',
      category: 'Help',
      icon: FileText,
      action: () => {
        navigate('/documentation')
        onClose()
      },
    },
    {
      id: 'profile',
      title: 'My Profile & SSH Keys',
      subtitle: 'Manage user access and resource allocation',
      category: 'User',
      icon: User,
      action: () => {
        navigate('/account/profile')
        onClose()
      },
    },
  ]

  const filtered = actions.filter(
    (a) =>
      a.title.toLowerCase().includes(query.toLowerCase()) ||
      a.subtitle.toLowerCase().includes(query.toLowerCase()) ||
      a.category.toLowerCase().includes(query.toLowerCase()),
  )

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[selectedIndex]) {
        filtered[selectedIndex].action()
      } else if (query.trim()) {
        navigate(`/jobs?search=${encodeURIComponent(query.trim())}`)
        onClose()
      }
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 p-4 pt-20 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border-strong bg-[#0F172A] shadow-2xl"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input bar */}
        <div className="relative flex items-center border-b border-border/80 px-4 py-3">
          <Search size={18} className="text-accent shrink-0 mr-3" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Type a command or search jobs, nodes, users (Ctrl+K)..."
            className="w-full bg-transparent text-[14px] text-text-primary placeholder:text-text-muted focus:outline-none"
          />
          {query ? (
            <button
              onClick={() => setQuery('')}
              className="text-text-muted hover:text-text-primary text-[12px] px-1"
            >
              Clear
            </button>
          ) : (
            <span className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-text-muted">
              ESC
            </span>
          )}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 scrollbar-thin">
          {filtered.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-[13px] text-text-secondary">No exact commands matching "{query}"</p>
              <button
                onClick={() => {
                  navigate(`/jobs?search=${encodeURIComponent(query.trim())}`)
                  onClose()
                }}
                className="mt-2 text-[12px] text-accent hover:underline flex items-center justify-center gap-1 mx-auto"
              >
                Search jobs table for "{query}" <ArrowRight size={12} />
              </button>
            </div>
          ) : (
            filtered.map((item, index) => {
              const isSelected = index === selectedIndex
              const Icon = item.icon
              return (
                <div
                  key={item.id}
                  onClick={item.action}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 transition-colors ${
                    isSelected ? 'bg-accent/15 text-accent' : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`p-1.5 rounded-md ${isSelected ? 'bg-accent-soft text-accent' : 'bg-surface text-text-muted'}`}>
                      <Icon size={16} />
                    </span>
                    <div>
                      <div className={`text-[13.5px] font-semibold ${isSelected ? 'text-accent' : 'text-text-primary'}`}>
                        {item.title}
                      </div>
                      <div className="text-[11.5px] text-text-muted">{item.subtitle}</div>
                    </div>
                  </div>
                  <span className="rounded bg-surface px-2 py-0.5 text-[10px] uppercase font-bold text-text-muted">
                    {item.category}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="flex items-center justify-between border-t border-border/60 bg-surface/40 px-4 py-2 text-[11px] text-text-muted">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-[10px]">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="rounded border border-border bg-surface px-1 py-0.5 font-mono text-[10px]">↵</kbd> Select
            </span>
          </div>
          <span>ClusterOne Command Palette</span>
        </div>
      </div>
    </div>
  )
}
