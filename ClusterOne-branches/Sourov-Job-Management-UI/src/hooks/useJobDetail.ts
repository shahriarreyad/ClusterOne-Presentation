import { useCallback, useEffect, useState } from 'react'
import type { Job } from '@/types/job'
import { getJob } from '@/services/jobService'
import { ApiError } from '@/services/api'
import { usePolling } from './usePolling'

const LIVE_STATUSES = new Set(['RUNNING', 'QUEUED', 'SCHEDULED', 'SUBMITTED'])

export function useJobDetail(id: string | undefined) {
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchJob = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!id) return
      if (!opts.silent) setLoading(true)
      setError(null)
      try {
        const result = await getJob(id)
        setJob(result)
      } catch (e) {
        setError(e instanceof ApiError ? e.message : `Unable to load job #${id}.`)
      } finally {
        if (!opts.silent) setLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    fetchJob()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const isLive = !!job && LIVE_STATUSES.has(job.status)
  usePolling(() => fetchJob({ silent: true }), 2500, isLive)

  return { job, loading, error, refetch: fetchJob }
}
