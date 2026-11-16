import { useEffect } from 'react'
import { Link, NavLink, useSearchParams } from 'react-router-dom'
import { PlusCircle } from 'lucide-react'
import type { JobStatus } from '@/types/job'
import { useJobs } from '@/hooks/useJobs'
import { useJobActions } from '@/hooks/useJobActions'
import { JobFilterBar } from '@/components/jobs/JobFilterBar'
import { JobTable } from '@/components/jobs/JobTable'
import { Pagination } from '@/components/common/Pagination'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/common/States'
import { ConfirmationModal } from '@/components/common/ConfirmationModal'
import { cn } from '@/lib/format'

const TABS: { label: string; to: string; statusIn?: JobStatus[] }[] = [
  { label: 'Overview', to: '/dashboard' },
  { label: 'All Jobs', to: '/jobs' },
  { label: 'Running', to: '/jobs/running', statusIn: ['RUNNING'] },
  { label: 'Queued', to: '/jobs/queued', statusIn: ['QUEUED'] },
  { label: 'Completed', to: '/jobs/completed', statusIn: ['COMPLETED'] },
  { label: 'Failed', to: '/jobs/failed', statusIn: ['FAILED', 'TIMEOUT'] },
  { label: 'Cancelled', to: '/jobs/cancelled', statusIn: ['CANCELLED'] },
]

interface JobsListProps {
  statusIn?: JobStatus[]
  title: string
  emptyTitle: string
  emptyDescription: string
}

export function JobsList({ statusIn, title, emptyTitle, emptyDescription }: JobsListProps) {
  const [searchParams] = useSearchParams()
  const {
    jobs, total, totalPages, loading, error, filters, setFilter, clearFilters, sort, setSort, page, setPage, pageSize, setPageSize, refetch,
  } = useJobs({ statusIn, pageSize: 10 })
  const actions = useJobActions(() => refetch({ silent: true }))

  useEffect(() => {
    const q = searchParams.get('search')
    if (q) setFilter('search', q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="text-[22px] font-bold text-text-primary">{title}</h1>
        <Link
          to="/jobs/new"
          className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-bg transition-colors hover:bg-accent/90"
        >
          <PlusCircle size={16} />
          Submit Job
        </Link>
      </div>

      <nav className="scrollbar-thin flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end
            className={({ isActive }) =>
              cn(
                'shrink-0 border-b-2 px-3.5 py-2.5 text-[13px] font-medium transition-colors',
                isActive ? 'border-accent text-accent' : 'border-transparent text-text-secondary hover:text-text-primary',
              )
            }
          >
            {tab.label}
          </NavLink>
        ))}
      </nav>

      <JobFilterBar filters={filters} setFilter={setFilter} clearFilters={clearFilters} sort={sort} setSort={setSort} />

      {actions.error && <p className="text-[12.5px] font-medium text-status-failed">{actions.error}</p>}

      {error ? (
        <ErrorState message={error} onRetry={() => refetch()} />
      ) : loading ? (
        <TableSkeleton rows={pageSize > 10 ? 8 : 6} cols={9} />
      ) : jobs.length === 0 ? (
        <EmptyState
          title={emptyTitle}
          description={emptyDescription}
          action={
            <Link to="/jobs/new" className="rounded-md bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-bg hover:bg-accent/90">
              Submit Your First Job
            </Link>
          }
        />
      ) : (
        <JobTable
          jobs={jobs}
          onCancel={actions.requestCancel}
          onRetry={actions.retry}
          onClone={actions.clone}
          pendingId={actions.cancelTarget?.id}
          footer={
            <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
          }
        />
      )}

      <ConfirmationModal
        open={!!actions.cancelTarget}
        title={`Cancel Job #${actions.cancelTarget?.id}?`}
        description="This will stop the running workload and release its allocated resources. This cannot be undone."
        confirmLabel="Cancel Job"
        cancelLabel="Keep Running"
        destructive
        loading={actions.pending === 'cancel'}
        onConfirm={actions.confirmCancel}
        onCancel={actions.dismissCancel}
      />
    </div>
  )
}
