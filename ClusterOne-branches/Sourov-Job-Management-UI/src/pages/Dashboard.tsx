import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PlusCircle, ListChecks, PlayCircle, Clock3, CheckCircle2, XCircle, Ban } from 'lucide-react'
import { useDashboardData } from '@/hooks/useDashboardData'
import { useJobActions } from '@/hooks/useJobActions'
import { StatCard } from '@/components/common/StatCard'
import { JobTable } from '@/components/jobs/JobTable'
import { QueueList } from '@/components/jobs/QueueList'
import { EmptyState, ErrorState, CardSkeleton, TableSkeleton, DemoDataBadge } from '@/components/common/States'
import { ConfirmationModal } from '@/components/common/ConfirmationModal'

export function Dashboard() {
  const { stats, running, queued, recent, loading, error, refetch } = useDashboardData()
  const actions = useJobActions(() => refetch({ silent: true }))

  if (error && !stats) return <ErrorState message={error} onRetry={() => refetch()} />

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold text-text-primary">Job Management</h1>
            <DemoDataBadge />
          </div>
          <p className="mt-1 text-[13.5px] text-text-secondary">Submit, monitor and manage your AI workloads.</p>
        </div>
        <Link
          to="/jobs/new"
          className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-bg transition-colors hover:bg-accent/90"
        >
          <PlusCircle size={16} />
          Submit Job
        </Link>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {loading || !stats ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} className="h-[104px]" />)
        ) : (
          <>
            <Link to="/jobs">
              <StatCard label="Total Jobs" value={stats.total} icon={ListChecks} tone="default" />
            </Link>
            <Link to="/jobs/running">
              <StatCard label="Running" value={stats.counts.RUNNING} icon={PlayCircle} tone="success" />
            </Link>
            <Link to="/jobs/queued">
              <StatCard label="Queued" value={stats.counts.QUEUED} icon={Clock3} tone="warning" />
            </Link>
            <Link to="/jobs/completed">
              <StatCard label="Completed" value={stats.counts.COMPLETED} icon={CheckCircle2} tone="info" />
            </Link>
            <Link to="/jobs/failed">
              <StatCard label="Failed" value={stats.counts.FAILED} icon={XCircle} tone="error" />
            </Link>
            <Link to="/jobs/cancelled">
              <StatCard label="Cancelled" value={stats.counts.CANCELLED} icon={Ban} tone="default" />
            </Link>
          </>
        )}
      </div>

      {actions.error && <p className="text-[12.5px] font-medium text-status-failed">{actions.error}</p>}

      {/* Running */}
      <Section title="Running Jobs" viewAllHref="/jobs/running">
        {loading ? (
          <TableSkeleton rows={3} cols={7} />
        ) : running.length === 0 ? (
          <EmptyState title="No Running Jobs" description="Your compute resources are currently free." />
        ) : (
          <JobTable jobs={running} onCancel={actions.requestCancel} onRetry={actions.retry} onClone={actions.clone} pendingId={actions.cancelTarget?.id} />
        )}
      </Section>

      {/* Queued */}
      <Section title="Queued Jobs" viewAllHref="/jobs/queued">
        {loading ? (
          <TableSkeleton rows={2} cols={4} />
        ) : queued.length === 0 ? (
          <EmptyState title="Queue is Empty" description="No jobs are currently waiting for resources." />
        ) : (
          <div className="rounded-[var(--radius-card)] border border-border">
            <QueueList jobs={queued} />
          </div>
        )}
      </Section>

      {/* Recent */}
      <Section title="Recent Jobs" viewAllHref="/jobs/history">
        {loading ? (
          <TableSkeleton rows={4} cols={7} />
        ) : recent.length === 0 ? (
          <EmptyState title="No Job History" description="Completed and failed jobs will appear here." />
        ) : (
          <JobTable jobs={recent} onCancel={actions.requestCancel} onRetry={actions.retry} onClone={actions.clone} pendingId={actions.cancelTarget?.id} />
        )}
      </Section>

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

function Section({ title, viewAllHref, children }: { title: string; viewAllHref: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-[14.5px] font-semibold text-text-primary">{title}</h2>
        <Link to={viewAllHref} className="text-[12.5px] font-medium text-accent hover:underline">
          View All →
        </Link>
      </div>
      {children}
    </section>
  )
}
