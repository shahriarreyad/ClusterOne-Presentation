import { Search, X } from 'lucide-react'
import type { JobFilters, JobStatus, SortKey, ExecutionMode } from '@/types/job'
import { STATUS_LABEL } from '@/lib/format'
import { DATASETS } from '@/data/mockData'

interface JobFilterBarProps {
  filters: JobFilters
  setFilter: <K extends keyof JobFilters>(key: K, value: JobFilters[K]) => void
  clearFilters: () => void
  sort: SortKey
  setSort: (s: SortKey) => void
  statusOptions?: JobStatus[]
  sortOptions?: { value: SortKey; label: string }[]
}

const GPU_TYPES = ['Any GPU', 'RTX 3050', 'RTX 3060', 'RTX 4060', 'RTX 2060']
const EXECUTION_MODES: { value: ExecutionMode; label: string }[] = [
  { value: 'SINGLE_GPU', label: 'Single GPU' },
  { value: 'DISTRIBUTED', label: 'Distributed' },
]

const DEFAULT_SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'runtime', label: 'Runtime' },
  { value: 'status', label: 'Status' },
  { value: 'progress', label: 'Progress' },
  { value: 'id', label: 'Job ID' },
]

export function JobFilterBar({ filters, setFilter, clearFilters, sort, setSort, statusOptions, sortOptions = DEFAULT_SORTS }: JobFilterBarProps) {
  const hasActiveFilters =
    !!filters.search || filters.status.length > 0 || filters.executionMode.length > 0 || filters.gpuType.length > 0 || filters.dataset.length > 0

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-border bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center">
      <div className="relative min-w-[220px] flex-1">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
        <input
          value={filters.search}
          onChange={(e) => setFilter('search', e.target.value)}
          placeholder="Search jobs by name or ID..."
          aria-label="Search jobs"
          className="w-full rounded-md border border-border bg-bg-secondary py-2 pl-9 pr-3 text-[13px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {statusOptions && statusOptions.length > 0 && (
        <select
          aria-label="Filter by status"
          value={filters.status[0] ?? ''}
          onChange={(e) => setFilter('status', e.target.value ? [e.target.value as JobStatus] : [])}
          className="rounded-md border border-border bg-bg-secondary px-2.5 py-2 text-[13px] text-text-primary focus:border-accent focus:outline-none"
        >
          <option value="">All statuses</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
      )}

      <select
        aria-label="Filter by execution mode"
        value={filters.executionMode[0] ?? ''}
        onChange={(e) => setFilter('executionMode', e.target.value ? [e.target.value as ExecutionMode] : [])}
        className="rounded-md border border-border bg-bg-secondary px-2.5 py-2 text-[13px] text-text-primary focus:border-accent focus:outline-none"
      >
        <option value="">All modes</option>
        {EXECUTION_MODES.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by GPU type"
        value={filters.gpuType[0] ?? ''}
        onChange={(e) => setFilter('gpuType', e.target.value ? [e.target.value] : [])}
        className="rounded-md border border-border bg-bg-secondary px-2.5 py-2 text-[13px] text-text-primary focus:border-accent focus:outline-none"
      >
        <option value="">All GPU types</option>
        {GPU_TYPES.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>

      <select
        aria-label="Filter by dataset"
        value={filters.dataset[0] ?? ''}
        onChange={(e) => setFilter('dataset', e.target.value ? [e.target.value] : [])}
        className="rounded-md border border-border bg-bg-secondary px-2.5 py-2 text-[13px] text-text-primary focus:border-accent focus:outline-none"
      >
        <option value="">All datasets</option>
        {DATASETS.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </select>

      <select
        aria-label="Sort jobs"
        value={sort}
        onChange={(e) => setSort(e.target.value as SortKey)}
        className="rounded-md border border-border bg-bg-secondary px-2.5 py-2 text-[13px] text-text-primary focus:border-accent focus:outline-none"
      >
        {sortOptions.map((o) => (
          <option key={o.value} value={o.value}>
            Sort: {o.label}
          </option>
        ))}
      </select>

      {hasActiveFilters && (
        <button
          onClick={clearFilters}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-2 text-[12.5px] font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text-primary"
        >
          <X size={13} />
          Clear Filters
        </button>
      )}
    </div>
  )
}
