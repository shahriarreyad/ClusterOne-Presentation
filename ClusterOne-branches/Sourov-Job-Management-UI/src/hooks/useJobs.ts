import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Job, JobFilters, JobStatus, SortKey } from '@/types/job'
import { listJobs, getJobStats } from '@/services/jobService'
import { ApiError } from '@/services/api'
import { usePolling } from './usePolling'

const EMPTY_FILTERS: JobFilters = {
  search: '',
  status: [],
  executionMode: [],
  gpuType: [],
  dataset: [],
}

interface UseJobsOptions {
  statusIn?: JobStatus[]
  pageSize?: number
  pollMs?: number
}

export interface JobStats {
  total: number
  counts: Record<JobStatus, number>
}

export function useJobs(options: UseJobsOptions = {}) {
  const { statusIn, pageSize = 10, pollMs = 4000 } = options

  const [filters, setFilters] = useState<JobFilters>(EMPTY_FILTERS)
  const [sort, setSort] = useState<SortKey>('newest')
  const [page, setPage] = useState(1)
  const [size, setSize] = useState(pageSize)

  const [jobs, setJobs] = useState<Job[]>([])
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState<JobStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!opts.silent) setLoading(true)
      setError(null)
      try {
        const [result, statResult] = await Promise.all([
          listJobs({ filters, sort, page, pageSize: size, statusIn }),
          getJobStats(),
        ])
        setJobs(result.jobs)
        setTotal(result.total)
        setStats(statResult)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Unable to load jobs. Check your connection and try again.')
      } finally {
        if (!opts.silent) setLoading(false)
      }
    },
    [filters, sort, page, size, statusIn],
  )

  useEffect(() => {
    fetchJobs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sort, page, size, statusIn])

  usePolling(() => fetchJobs({ silent: true }), pollMs, true)

  const setFilter = useCallback(<K extends keyof JobFilters>(key: K, value: JobFilters[K]) => {
    setPage(1)
    setFilters((prev) => ({ ...prev, [key]: value }))
  }, [])

  const clearFilters = useCallback(() => {
    setPage(1)
    setFilters(EMPTY_FILTERS)
  }, [])

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / size)), [total, size])

  return {
    jobs,
    total,
    totalPages,
    stats,
    loading,
    error,
    filters,
    setFilter,
    clearFilters,
    sort,
    setSort,
    page,
    setPage,
    pageSize: size,
    setPageSize: (n: number) => {
      setPage(1)
      setSize(n)
    },
    refetch: fetchJobs,
  }
}
