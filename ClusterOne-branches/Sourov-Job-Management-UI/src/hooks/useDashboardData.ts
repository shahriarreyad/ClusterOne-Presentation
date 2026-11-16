import { useCallback, useEffect, useState } from 'react'
import type { Job, JobStatus } from '@/types/job'
import { listJobs, getJobStats } from '@/services/jobService'
import { ApiError } from '@/services/api'
import { usePolling } from './usePolling'

export interface DashboardStats {
  total: number
  counts: Record<JobStatus, number>
}

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [running, setRunning] = useState<Job[]>([])
  const [queued, setQueued] = useState<Job[]>([])
  const [recent, setRecent] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true)
    setError(null)
    try {
      const [statResult, runningResult, queuedResult, recentResult] = await Promise.all([
        getJobStats(),
        listJobs({ statusIn: ['RUNNING'], sort: 'newest', pageSize: 5 }),
        listJobs({ statusIn: ['QUEUED'], sort: 'newest', pageSize: 5 }),
        listJobs({ statusIn: ['COMPLETED', 'FAILED'], sort: 'newest', pageSize: 6 }),
      ])
      setStats(statResult)
      setRunning(runningResult.jobs)
      setQueued(queuedResult.jobs)
      setRecent(recentResult.jobs)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to load the dashboard right now.')
    } finally {
      if (!opts.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  usePolling(() => fetchAll({ silent: true }), 4000, true)

  return { stats, running, queued, recent, loading, error, refetch: fetchAll }
}
