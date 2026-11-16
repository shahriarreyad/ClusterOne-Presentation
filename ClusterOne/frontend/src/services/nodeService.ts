import type { NodeDetailResponse } from './clusterService'
import { request, currentUsername } from './api'

export interface NodeMetricsPoint {
  t: number
  v: number
}

export interface NodeMetricsResponse {
  node_id: string
  hostname: string
  source: string // "heartbeat" | "prometheus"
  generated_at: string
  last_heartbeat: string | null
  cpu_util_pct: number
  ram_used_mb: number
  ram_total_mb: number
  net_rx_mbps?: number | null
  net_tx_mbps?: number | null
  gpus: {
    name: string
    vram_total_mb: number
    vram_used_mb: number
    utilization_pct: number
    temperature_c?: number | null
    power_w?: number | null
  }[]
  series?: Record<string, NodeMetricsPoint[]> | null
}

export interface NodeInfo {
  id: string
  hostname: string
  ipAddress: string
  gpuModel: string
  gpuCount: number
  status: 'ONLINE' | 'BUSY' | 'OFFLINE' | 'DOWN'
  gpuUtilization: number
  gpuMemoryUsedMb: number
  gpuMemoryTotalMb: number
  cpuUtilization: number
  ramUsedMb: number
  ramTotalMb: number
  temperatureC: number
  powerWatts: number
  runningJobsCount: number
  currentJobs: { id: string; name: string; submitted_by: string; gpu_count: number }[]
  heartbeatAgeSeconds: number | null
  raw: NodeDetailResponse
}

export function toNodeInfo(n: NodeDetailResponse): NodeInfo {
  const gpus = n.gpus || []
  const firstGpu = gpus[0]
  const avgGpuUtil = gpus.length
    ? Math.round(gpus.reduce((acc, g) => acc + (g.utilization_pct || 0), 0) / gpus.length)
    : Math.round(n.cpu_util_pct || 0)
  const totGpuVramUsed = gpus.reduce((acc, g) => acc + (g.vram_used_mb || 0), 0)
  const totGpuVramTotal = gpus.reduce((acc, g) => acc + (g.vram_total_mb || 0), 0)
  const maxTemp = gpus.reduce((acc, g) => Math.max(acc, g.temperature_c || 0), 0)
  const totPower = gpus.reduce((acc, g) => acc + (g.power_w || 0), 0)

  return {
    id: n.id,
    hostname: n.hostname,
    ipAddress: n.ip_address || '10.20.0.x',
    gpuModel: firstGpu ? (gpus.length > 1 ? `${gpus.length} × ${firstGpu.name}` : firstGpu.name) : 'CPU only',
    gpuCount: n.gpu_count || gpus.length,
    status: n.status,
    gpuUtilization: n.status === 'DOWN' || n.status === 'OFFLINE' ? 0 : avgGpuUtil,
    gpuMemoryUsedMb: totGpuVramUsed,
    gpuMemoryTotalMb: totGpuVramTotal,
    cpuUtilization: n.status === 'DOWN' || n.status === 'OFFLINE' ? 0 : Math.round(n.cpu_util_pct || 0),
    ramUsedMb: n.ram_used_mb || 0,
    ramTotalMb: n.ram_total_mb || 1,
    temperatureC: maxTemp || (n.status === 'ONLINE' ? 62 : 0),
    powerWatts: totPower || (n.status === 'ONLINE' ? 140 : 0),
    runningJobsCount: (n.current_jobs || []).length,
    currentJobs: n.current_jobs || [],
    heartbeatAgeSeconds: n.heartbeat_age_seconds ?? null,
    raw: n,
  }
}

export async function fetchNodes(): Promise<NodeDetailResponse[]> {
  return request<NodeDetailResponse[]>('/v1/nodes')
}

export async function fetchNodesInfo(): Promise<NodeInfo[]> {
  const nodes = await fetchNodes()
  return nodes.map(toNodeInfo)
}

export async function fetchNode(nodeId: string): Promise<NodeDetailResponse> {
  return request<NodeDetailResponse>(`/v1/nodes/${nodeId}`)
}

export async function fetchNodeMetrics(nodeId: string, range = '15m', step = '15s'): Promise<NodeMetricsResponse> {
  return request<NodeMetricsResponse>(`/v1/nodes/${nodeId}/metrics?range=${encodeURIComponent(range)}&step=${encodeURIComponent(step)}`)
}

/** Reserve the whole node: only your jobs are placed on it until you release it. */
export async function claimNode(nodeId: string): Promise<NodeDetailResponse> {
  return request<NodeDetailResponse>(`/v1/nodes/${nodeId}/claim`, {
    method: 'POST',
    body: JSON.stringify({ user: currentUsername() }),
  })
}

export async function releaseNode(nodeId: string): Promise<NodeDetailResponse> {
  return request<NodeDetailResponse>(`/v1/nodes/${nodeId}/claim?user=${encodeURIComponent(currentUsername())}`, {
    method: 'DELETE',
  })
}
