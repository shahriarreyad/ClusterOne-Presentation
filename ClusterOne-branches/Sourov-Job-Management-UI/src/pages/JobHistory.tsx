import { CheckCircle2, XCircle, Ban, AlarmClockOff, History as HistoryIcon } from 'lucide-react'
import type { JobStatus } from '@/types/job'
import { useJobs } from '@/hooks/useJobs'
import { useJobActions } from '@/hooks/useJobActions'
import { StatCard } from '@/components/common/StatCard'
import { JobFilterBar } from '@/components/jobs/JobFilterBar'
import { JobTable } from '@/components/jobs/JobTable'
import { Pagination } from '@/components/common/Pagination'
import { EmptyState, ErrorState, TableSkeleton, CardSkeleton } from '@/components/common/States'
import { ConfirmationModal } from '@/components/common/ConfirmationModal'

const HISTORY_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'] as const
// Stable module-level array (not recreated on every render) — passing a fresh
// `[...HISTORY_STATUSES]` literal inline as a hook argument would give useJobs'
// internal effect a new array reference on every render and cause a refetch loop.
const HISTORY_STATUS_LIST: JobStatus[] = [...HISTORY_STATUSES]

export function JobHistory() {
  const {
    jobs, total, totalPages, stats, loading, error, filters, setFilter, clearFilters, sort, setSort, page, setPage, pageSize, setPageSize, refetch,
  } = useJobs({ statusIn: HISTORY_STATUS_LIST, pageSize: 10 })
  const actions = useJobActions(() => refetch({ silent: true }))

  const historyTotal = stats ? stats.counts.COMPLETED + stats.counts.FAILED + stats.counts.CANCELLED + stats.counts.TIMEOUT : 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary">Job History</h1>
        <p className="mt-1 text-[13.5px] text-text-secondary">A complete record of every job that has finished running.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {loading || !stats ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} className="h-[104px]" />)
        ) : (
          <>
            <StatCard label="Total" value={historyTotal} icon={HistoryIcon} tone="default" />
            <StatCard label="Completed" value={stats.counts.COMPLETED} icon={CheckCircle2} tone="info" />
            <StatCard label="Failed" value={stats.counts.FAILED} icon={XCircle} tone="error" />
            <StatCard label="Cancelled" value={stats.counts.CANCELLED} icon={Ban} tone="default" />
            <StatCard label="Timeout" value={stats.counts.TIMEOUT} icon={AlarmClockOff} tone="warning" />
          </>
        )}
      </div>

      <JobFilterBar
        filters={filters}
        setFilter={setFilter}
        clearFilters={clearFilters}
        sort={sort}
        setSort={setSort}
        statusOptions={HISTORY_STATUS_LIST}
      />

      {actions.error && <p className="text-[12.5px] font-medium text-status-failed">{actions.error}</p>}

      {error ? (
        <ErrorState message={error} onRetry={() => refetch()} />
      ) : loading ? (
        <TableSkeleton rows={6} cols={9} />
      ) : jobs.length === 0 ? (
        <EmptyState title="No Job History" description="Completed, failed, cancelled and timed-out jobs will appear here." />
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
        description="This will stop the running workload and release its allocated resources."
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
