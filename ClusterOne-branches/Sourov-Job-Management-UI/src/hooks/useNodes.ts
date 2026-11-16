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
 * Live nodes from the backend, polled every 2s. If the backend is
 * unreachable it falls back to the demo data and reports `live: false`
 * so pages can show the Demo Data badge.
 */
export function useNodes() {
  const [nodes, setNodes] = useState<NodeInfo[]>(NODES)
  const [live, setLive] = useState(false)

  const load = useCallback(async () => {
    try {
      setNodes(await fetchNodes())
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
