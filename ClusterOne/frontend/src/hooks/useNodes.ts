import { useCallback, useEffect, useState } from 'react'
import { NODES, AVAILABLE_GPUS, type NodeInfo } from '@/data/mockData'
import { fetchNodes } from '@/services/nodeService'
import { usePolling } from './usePolling'

export interface GpuModelSummary {
  model: string
  total: number
  available: number
}

export function summarizeGpus(nodes: NodeInfo[]): GpuModelSummary[] {
  const map = new Map<string, GpuModelSummary>()
  for (const n of nodes) {
    const s = map.get(n.gpuModel) ?? { model: n.gpuModel, total: 0, available: 0 }
    s.total += 1
    if (n.status === 'IDLE') s.available += 1
    map.set(n.gpuModel, s)
  }
  return [...map.values()]
}

/**
 * Live nodes from backend, polled every 2s. If backend is unreachable,
 * falls back to demo nodes and reports `live: false`.
 */
export function useNodes() {
  const [nodes, setNodes] = useState<NodeInfo[]>(NODES)
  const [live, setLive] = useState(false)

  const load = useCallback(async () => {
    try {
      const rawNodes = await fetchNodes()
      const converted: NodeInfo[] = rawNodes.map((n) => {
        const gpus = n.gpus || []
        const avgUtil = gpus.length
          ? Math.round(gpus.reduce((s, g) => s + g.utilization_pct, 0) / gpus.length)
          : Math.round(n.cpu_util_pct)
        const maxTemp = gpus.reduce((m, g) => Math.max(m, g.temperature_c || 0), 0)
        const status =
          n.status === 'OFFLINE' || n.status === 'DOWN'
            ? 'OFFLINE'
            : n.current_jobs.length > 0 || avgUtil > 20
            ? 'BUSY'
            : 'IDLE'

        return {
          id: n.hostname,
          gpuModel: gpus[0]?.name || 'No GPU reported',
          status,
          utilization: avgUtil,
          temperatureC: maxTemp,
          jobId: n.current_jobs[0]?.id || null,
        }
      })
      setNodes(converted)
      setLive(true)
    } catch {
      setNodes(NODES)
      setLive(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])
  usePolling(() => void load(), 2000)

  const gpuSummary = live ? summarizeGpus(nodes) : AVAILABLE_GPUS
  return { nodes, live, gpuSummary }
}
