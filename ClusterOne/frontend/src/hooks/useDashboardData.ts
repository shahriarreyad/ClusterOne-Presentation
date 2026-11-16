import { useCallback, useEffect, useState } from 'react'
import type { Job, JobStatus } from '@/types/job'
import { listJobs, getJobStats } from '@/services/jobService'
import {
  fetchClusterSummary,
  fetchClusterTopology,
  type ClusterSummaryResponse,
  type ClusterTopologyResponse,
} from '@/services/clusterService'
import { fetchNodesInfo, type NodeInfo } from '@/services/nodeService'
import { ApiError } from '@/services/api'
import { usePolling } from './usePolling'

export interface DashboardStats {
  total: number
  counts: Record<JobStatus, number>
}

export function useDashboardData() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [summary, setSummary] = useState<ClusterSummaryResponse | null>(null)
  const [topology, setTopology] = useState<ClusterTopologyResponse | null>(null)
  const [nodesInfo, setNodesInfo] = useState<NodeInfo[]>([])
  const [running, setRunning] = useState<Job[]>([])
  const [queued, setQueued] = useState<Job[]>([])
  const [recent, setRecent] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!opts.silent) setLoading(true)
    setError(null)
    try {
      const [
        statResult,
        summaryResult,
        topologyResult,
        nodesInfoResult,
        runningResult,
        queuedResult,
        recentResult,
      ] = await Promise.all([
        getJobStats().catch(() => ({ total: 0, counts: { SUBMITTED: 0, QUEUED: 0, SCHEDULED: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0, CANCELLED: 0, TIMEOUT: 0 } })),
        fetchClusterSummary().catch(() => null),
        fetchClusterTopology().catch(() => null),
        fetchNodesInfo().catch(() => []),
        listJobs({ statusIn: ['RUNNING'], sort: 'newest', pageSize: 6 }).catch(() => ({ jobs: [], total: 0 })),
        listJobs({ statusIn: ['QUEUED', 'SUBMITTED', 'SCHEDULED'], sort: 'newest', pageSize: 6 }).catch(() => ({ jobs: [], total: 0 })),
        listJobs({ statusIn: ['COMPLETED', 'FAILED', 'CANCELLED'], sort: 'newest', pageSize: 6 }).catch(() => ({ jobs: [], total: 0 })),
      ])

      setStats(statResult)
      setSummary(summaryResult)
      setTopology(topologyResult)
      setNodesInfo(nodesInfoResult)
      setRunning(runningResult.jobs)
      setQueued(queuedResult.jobs)
      setRecent(recentResult.jobs)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Unable to connect to ClusterOne control plane.')
    } finally {
      if (!opts.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  usePolling(() => fetchAll({ silent: true }), 3000, true)

  return {
    stats,
    summary,
    topology,
    nodesInfo,
    running,
    queued,
    recent,
    loading,
    error,
    refetch: fetchAll,
  }
}
