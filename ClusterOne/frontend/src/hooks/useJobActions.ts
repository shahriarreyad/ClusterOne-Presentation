import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Job } from '@/types/job'
import {
  cancelJob as cancelJobApi,
  retryJob as retryJobApi,
  cloneJob as cloneJobApi,
  requeueJob as requeueJobApi,
} from '@/services/jobService'
import { ApiError } from '@/services/api'

type PendingAction = 'cancel' | 'retry' | 'clone' | 'requeue' | null

/** Cancel/retry/clone/requeue with shared confirmation-modal state, reused by JobTable rows and the Job Details page. */
export function useJobActions(onChanged?: () => void) {
  const navigate = useNavigate()
  const [pending, setPending] = useState<PendingAction>(null)
  const [cancelTarget, setCancelTarget] = useState<Job | null>(null)
  const [error, setError] = useState<string | null>(null)

  const requestCancel = (job: Job) => setCancelTarget(job)
  const dismissCancel = () => setCancelTarget(null)

  const confirmCancel = async () => {
    if (!cancelTarget) return
    setPending('cancel')
    setError(null)
    try {
      await cancelJobApi(cancelTarget.id)
      onChanged?.()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to cancel this job right now.')
    } finally {
      setPending(null)
      setCancelTarget(null)
    }
  }

  const requeue = async (job: Job) => {
    setPending('requeue')
    setError(null)
    try {
      await requeueJobApi(job.id)
      onChanged?.()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to requeue this job right now.')
    } finally {
      setPending(null)
    }
  }

  const retry = async (job: Job) => {
    setPending('retry')
    setError(null)
    try {
      const created = await retryJobApi(job.id)
      onChanged?.()
      navigate(`/jobs/${created.id}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to retry this job right now.')
    } finally {
      setPending(null)
    }
  }

  const clone = async (job: Job) => {
    setPending('clone')
    setError(null)
    try {
      const created = await cloneJobApi(job.id)
      onChanged?.()
      navigate(`/jobs/${created.id}`)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to clone this job right now.')
    } finally {
      setPending(null)
    }
  }

  return {
    pending,
    cancelTarget,
    requestCancel,
    dismissCancel,
    confirmCancel,
    requeue,
    retry,
    clone,
    error,
    clearError: () => setError(null),
  }
}
