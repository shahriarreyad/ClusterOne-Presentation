import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Job, UtilizationPoint } from '@/types/job'
import { getJob } from '@/services/jobService'
import { ApiError } from '@/services/api'
import { usePolling } from './usePolling'

const LIVE_STATUSES = new Set(['RUNNING', 'QUEUED', 'SCHEDULED', 'SUBMITTED'])
const MAX_SAMPLES = 360

export function useJobDetail(id: string | undefined) {
  const [job, setJob] = useState<Job | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  // Real node readings, one per poll while the job runs. The Core Engine reports the latest values;
  // the history shown is what this page has observed since it was opened (Prometheus holds the rest).
  const [samples, setSamples] = useState<UtilizationPoint[]>([])
  const startedAt = useRef(Date.now())

  const fetchJob = useCallback(
    async (opts: { silent?: boolean } = {}) => {
      if (!id) return
      if (!opts.silent) setLoading(true)
      setError(null)
      try {
        const result = await getJob(id)
        setJob(result)
        const latest = result.status === 'RUNNING' ? result.utilization.at(-1) : undefined
        if (latest) {
          const t = Math.round((Date.now() - startedAt.current) / 1000)
          setSamples((prev) => [...prev, { ...latest, t }].slice(-MAX_SAMPLES))
        }
      } catch (e) {
        setError(e instanceof ApiError ? e.message : `Unable to load job #${id}.`)
      } finally {
        if (!opts.silent) setLoading(false)
      }
    },
    [id],
  )

  useEffect(() => {
    startedAt.current = Date.now()
    setSamples([])
    fetchJob()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const isLive = !!job && LIVE_STATUSES.has(job.status)
  usePolling(() => fetchJob({ silent: true }), 2500, isLive)

  const withSamples = useMemo(() => (job ? { ...job, utilization: samples } : null), [job, samples])
  return { job: withSamples, loading, error, refetch: fetchJob }
}
