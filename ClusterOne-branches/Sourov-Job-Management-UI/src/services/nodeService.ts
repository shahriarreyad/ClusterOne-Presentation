import type { NodeInfo } from '@/data/mockData'
import { request } from './api'

// Live node/GPU data from the Core Cluster Engine (GET /api/v1/nodes).
interface ApiGpu {
  name: string
  vram_total_mb: number
  vram_used_mb: number
  utilization_pct: number
}

interface ApiNode {
  id: string
  hostname: string
  status: 'ONLINE' | 'BUSY' | 'DOWN' | 'DRAINING' | string
  gpus: ApiGpu[]
  cpu_util_pct: number
}

function toNodeInfo(n: ApiNode): NodeInfo {
  const gpu = n.gpus[0]
  const util = n.gpus.length
    ? Math.round(n.gpus.reduce((s, g) => s + g.utilization_pct, 0) / n.gpus.length)
    : Math.round(n.cpu_util_pct)
  const status: NodeInfo['status'] = n.status === 'BUSY' ? 'BUSY' : n.status === 'ONLINE' ? 'IDLE' : 'OFFLINE'
  return {
    id: n.hostname,
    gpuModel: gpu ? (n.gpus.length > 1 ? `${n.gpus.length}× ${gpu.name}` : gpu.name) : 'CPU only',
    status,
    utilization: status === 'OFFLINE' ? 0 : util,
    temperatureC: 0,
    jobId: null,
  }
}

export async function fetchNodes(): Promise<NodeInfo[]> {
  const nodes = await request<ApiNode[]>('/v1/nodes')
  return nodes.map(toNodeInfo)
}
