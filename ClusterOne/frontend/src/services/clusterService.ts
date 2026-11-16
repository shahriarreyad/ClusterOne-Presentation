import { request } from './api'

export interface MasterInfo {
  hostname: string
  ip_address: string
  role: string
  scheduler: string // "slurm" | "dev"
  slurm_reachable: boolean | null
}

export interface ApiGpuInfo {
  name: string
  vram_total_mb: number
  vram_used_mb: number
  utilization_pct: number
  temperature_c?: number | null
  power_w?: number | null
  driver_version?: string | null
  cuda_version?: string | null
}

export interface NodeJobRef {
  id: string
  name: string
  status: string
  submitted_by: string
  gpu_count: number
  slurm_job_id?: string | null
}

export interface NodeDetailResponse {
  id: string
  hostname: string
  ip_address: string | null
  cpu_cores: number
  ram_total_mb: number
  ram_used_mb: number
  cpu_util_pct: number
  gpus: ApiGpuInfo[]
  status: 'ONLINE' | 'BUSY' | 'OFFLINE' | 'DOWN'
  registered_at: string
  last_heartbeat: string | null
  net_rx_mbps?: number | null
  net_tx_mbps?: number | null
  agent_version?: string | null
  os_info?: string | null
  slurm_state?: string | null
  reserved_by?: string | null
  reserved_at?: string | null
  capabilities?: Record<string, string | number | boolean | null> | null
  availability?: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'ERROR'
  gpu_count: number
  gpus_free: number
  heartbeat_age_seconds?: number | null
  current_jobs: NodeJobRef[]
}

export interface ClusterTopologyResponse {
  generated_at: string
  master: MasterInfo
  nodes: NodeDetailResponse[]
}

export interface ClusterSummaryResponse {
  nodes_total: number
  nodes_online: number
  nodes_down: number
  gpus_total: number
  gpus_allocated: number
  gpus_idle: number
  gpus_unavailable: number
  jobs_running: number
  jobs_pending: number
  jobs_completed: number
  jobs_failed: number
  mode: string // "slurm" | "dev"
  generated_at?: string | null
}

export interface ClusterHealthResponse {
  status: 'ok' | 'degraded' | 'critical'
  version: string
  mode: string
  time: string
  database: { ok: boolean }
  slurm: { enabled: boolean; reachable: boolean | null; error?: string | null }
  prometheus: { configured: boolean; reachable: boolean | null }
  nodes?: { total: number; online: number }
}

export interface ActivityEventResponse {
  id: string
  timestamp: string
  event_type: string
  message: string
  tone: 'info' | 'success' | 'warning' | 'error'
  target_id?: string | null
  target_type?: 'job' | 'node' | null
}

export interface StorageShareResponse {
  name: string
  path: string
  type: string
  total_gb: number
  used_gb: number
  free_gb: number
  usage_pct: number
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL'
}

export interface StorageSummaryResponse {
  total_gb: number
  used_gb: number
  free_gb: number
  usage_pct: number
  shares: StorageShareResponse[]
}

export interface PartitionSummaryResponse {
  name: string
  description: string
  allocation_mode: string
  default_time_limit: string
  max_time_limit: string
  max_gpus_per_job: number
  nodes_count?: number | null
  active_jobs: number
  pending_jobs?: number
}

export interface ClusterUserResponse {
  username: string
  name: string
  role: string
  total_jobs: number
  active_jobs: number
  gpu_hours: number
  last_active?: string | null
}

export async function fetchClusterSummary(): Promise<ClusterSummaryResponse> {
  return request<ClusterSummaryResponse>('/v1/cluster/summary')
}

export async function fetchClusterTopology(): Promise<ClusterTopologyResponse> {
  return request<ClusterTopologyResponse>('/v1/cluster/topology')
}

export async function fetchClusterHealth(): Promise<ClusterHealthResponse> {
  return request<ClusterHealthResponse>('/v1/health')
}

export async function fetchClusterActivity(limit = 50): Promise<ActivityEventResponse[]> {
  return request<ActivityEventResponse[]>(`/v1/cluster/activity?limit=${limit}`)
}

export async function fetchStorageSummary(): Promise<StorageSummaryResponse> {
  return request<StorageSummaryResponse>('/v1/cluster/storage')
}

export async function fetchPartitions(): Promise<PartitionSummaryResponse[]> {
  return request<PartitionSummaryResponse[]>('/v1/cluster/partitions')
}

export async function fetchClusterUsers(): Promise<ClusterUserResponse[]> {
  return request<ClusterUserResponse[]>('/v1/cluster/users')
}

