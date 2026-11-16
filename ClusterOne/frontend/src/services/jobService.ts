import type {
  Job,
  JobStatus,
  ExecutionMode,
  JobFilters,
  SortKey,
  DatasetRef,
  EnvironmentRef,
  JobPriority,
  LogLine,
  TrainingMetricPoint,
  UtilizationPoint,
  TimelineEvent,
} from '@/types/job'
import { request, ApiError, currentUsername } from './api'
import { fetchNodes } from './nodeService'
import type { NodeDetailResponse } from './clusterService'

// Raw backend Job representation from FastAPI Core Cluster Engine
export interface BackendJobResponse {
  id: string
  name: string
  submitted_by: string
  requires_gpu: boolean
  min_vram_mb: number
  cpu_cores: number
  ram_mb: number
  script?: string | null
  environment?: string | null
  status: JobStatus
  node_id?: string | null
  slurm_job_id?: string | null
  logs?: string | null
  created_at: string
  updated_at: string
  gpu_count?: number | null
  partition?: string | null
  time_limit_minutes?: number | null
  image?: string | null
  working_dir?: string | null
  dataset_path?: string | null
  output_dir?: string | null
  command?: string | null
  started_at?: string | null
  ended_at?: string | null
  exit_code?: number | null
  allocated_nodes?: string | null
  allocated_cpus?: number | null
  allocated_ram_mb?: number | null
  allocated_gpus?: number | null
  slurm_state?: string | null
  state_reason?: string | null
  runtime_seconds?: number | null
  env_keys?: string[]
  node_hostname?: string | null
  node_ip?: string | null
  status_message?: string | null
}

export interface BackendJobLogs {
  job_id: string
  source: string
  size_bytes: number
  mode: string
  lines: { line?: number; timestamp?: string; text: string }[]
  total_lines?: number
  truncated: boolean
}

export interface BackendJobMetrics {
  job_id: string
  status: JobStatus
  runtime_seconds?: number | null
  started_at?: string | null
  ended_at?: string | null
  requested: Record<string, unknown>
  allocated: Record<string, unknown>
  node?: {
    hostname: string
    cpu_util_pct: number
    ram_used_mb: number
    ram_total_mb: number
    gpus: { name: string; vram_total_mb: number; vram_used_mb: number; utilization_pct: number; temperature_c?: number; power_w?: number }[]
    net_rx_mbps?: number
    net_tx_mbps?: number
  } | null
}

export interface SubmitJobPayload {
  name: string
  description?: string
  executionMode?: ExecutionMode
  gpuCount: number
  nodeCount?: number
  cpuCores: number
  ramGb: number
  gpuType?: string
  gpuMinVramGb?: number
  maxRuntimeHours?: number
  priority?: JobPriority
  partition?: string
  image?: string
  datasetPath?: string
  outputDir?: string
  workingDir?: string
  command: string
  environmentVars?: Record<string, string>
  targetNodeId?: string | null
  targetNodeName?: string | null // display only (not sent to the API)
}

export interface ListJobsParams {
  filters?: Partial<JobFilters>
  sort?: SortKey
  page?: number
  pageSize?: number
  statusIn?: JobStatus[]
}

export interface ListJobsResult {
  jobs: Job[]
  total: number
}

/** Number of nodes in a Slurm hostlist such as "gpu01", "gpu[01-03,05]" or "a1,gpu[01-02]"; 1 when unknown. */
export function countHosts(hostlist?: string | null): number {
  if (!hostlist) return 1
  let total = 0
  for (const m of hostlist.matchAll(/[^,[\]]+(?:\[([^\]]*)\])?/g)) {
    if (!m[1]) {
      total += 1
      continue
    }
    for (const part of m[1].split(',')) {
      const range = part.match(/^(\d+)-(\d+)$/)
      total += range ? Math.abs(Number(range[2]) - Number(range[1])) + 1 : 1
    }
  }
  return Math.max(total, 1)
}

// Convert BackendJobResponse + Node info into frontend Job model
export function transformBackendJob(
  bj: BackendJobResponse,
  nodeMap: Map<string, NodeDetailResponse> = new Map(),
  logsDetail?: BackendJobLogs | null,
): Job {
  const node = bj.node_id ? nodeMap.get(bj.node_id) : undefined
  const gpus = node?.gpus || []
  const primaryGpu = gpus[0]
  const gpuCount = bj.allocated_gpus ?? bj.gpu_count ?? (bj.requires_gpu ? 1 : 0)
  // Distributed only if Slurm really gave the job more than one node (several GPUs on one node is not).
  const allocatedNodeCount = countHosts(bj.allocated_nodes)
  const isDistributed = allocatedNodeCount > 1

  // Parse log lines
  const parsedLogs: LogLine[] = []
  if (logsDetail?.lines?.length) {
    logsDetail.lines.forEach((l, idx) => {
      let level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'
      const lower = l.text.toLowerCase()
      if (lower.includes('error') || lower.includes('fail') || lower.includes('exception')) level = 'ERROR'
      else if (lower.includes('warn')) level = 'WARN'
      parsedLogs.push({
        id: idx + 1,
        timestamp: l.timestamp || bj.started_at || bj.created_at,
        level,
        message: l.text,
      })
    })
  } else if (bj.logs) {
    bj.logs.split('\n').filter(Boolean).forEach((line, idx) => {
      let level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'
      const lower = line.toLowerCase()
      if (lower.includes('error') || lower.includes('fail') || lower.includes('exception')) level = 'ERROR'
      else if (lower.includes('warn')) level = 'WARN'
      parsedLogs.push({
        id: idx + 1,
        timestamp: bj.started_at || bj.created_at,
        level,
        message: line,
      })
    })
  }

  // Extract ML metrics if emitted in logs (e.g. "Epoch 10/50, loss: 0.231, acc: 91.2%")
  const trainingMetrics: TrainingMetricPoint[] = []
  for (const l of parsedLogs) {
    const epochMatch = l.message.match(/epoch\s*[:=]?\s*(\d+)/i)
    const lossMatch = l.message.match(/loss\s*[:=]?\s*([0-9.]+)/i)
    const accMatch = l.message.match(/acc(?:uracy)?\s*[:=]?\s*([0-9.]+)/i)
    if (epochMatch && lossMatch) {
      trainingMetrics.push({
        t: trainingMetrics.length * 30,
        epoch: parseInt(epochMatch[1], 10),
        iteration: trainingMetrics.length + 1,
        loss: parseFloat(lossMatch[1]),
        accuracy: accMatch ? parseFloat(accMatch[1]) : 0,
        learningRate: 0.0001,
      })
    }
  }

  // Calculate runtime progress
  const maxMinutes = bj.time_limit_minutes || 60
  let progress = 0
  if (bj.status === 'COMPLETED') {
    progress = 100
  } else if (bj.status === 'RUNNING' && bj.started_at) {
    const elapsedSec = bj.runtime_seconds || Math.max(0, (Date.now() - new Date(bj.started_at).getTime()) / 1000)
    progress = Math.min(99, Math.round((elapsedSec / (maxMinutes * 60)) * 100))
  }

  // Build timeline
  const timeline: TimelineEvent[] = [
    { stage: 'SUBMITTED', timestamp: bj.created_at },
  ]
  if (bj.status !== 'SUBMITTED') {
    timeline.push({ stage: 'QUEUED', timestamp: bj.created_at })
  }
  if (bj.node_id || bj.status === 'SCHEDULED' || bj.status === 'RUNNING' || bj.status === 'COMPLETED' || bj.status === 'FAILED') {
    timeline.push({ stage: 'SCHEDULED', timestamp: bj.started_at || bj.updated_at })
  }
  if (bj.started_at || bj.status === 'RUNNING' || bj.status === 'COMPLETED' || bj.status === 'FAILED') {
    timeline.push({ stage: 'RUNNING', timestamp: bj.started_at ?? null })
  }
  if (bj.status === 'COMPLETED') {
    timeline.push({ stage: 'COMPLETED', timestamp: bj.ended_at || bj.updated_at })
  } else if (bj.status === 'FAILED') {
    timeline.push({ stage: 'FAILED', timestamp: bj.ended_at || bj.updated_at })
  } else if (bj.status === 'CANCELLED') {
    timeline.push({ stage: 'CANCELLED', timestamp: bj.ended_at || bj.updated_at })
  }

  // Real utilization series
  const utilizationSeries: UtilizationPoint[] = []
  if (node && bj.status === 'RUNNING') {
    const avgUtil = gpus.length ? Math.round(gpus.reduce((acc, g) => acc + g.utilization_pct, 0) / gpus.length) : Math.round(node.cpu_util_pct)
    const vramGb = Number((gpus.reduce((acc, g) => acc + g.vram_used_mb, 0) / 1024).toFixed(1))
    const ramGb = Number((node.ram_used_mb / 1024).toFixed(1))
    const reportedTemp = gpus.reduce((acc, g) => Math.max(acc, g.temperature_c || 0), 0)
    const temp = reportedTemp > 0 ? reportedTemp : null
    const net = Math.round((node.net_rx_mbps || 0) + (node.net_tx_mbps || 0))
    utilizationSeries.push({
      t: 0,
      gpuUtilization: avgUtil,
      gpuMemoryGb: vramGb,
      cpuUtilization: Math.round(node.cpu_util_pct),
      ramGb,
      temperatureC: temp,
      networkMbps: net,
    })
  }

  const dataset: DatasetRef = {
    id: bj.dataset_path || '',
    name: bj.dataset_path ? bj.dataset_path.split('/').filter(Boolean).pop() || bj.dataset_path : 'none',
    sizeGb: 0, // not known to the Core Engine
    samples: 0,
    format: '',
    owner: bj.submitted_by,
    lastUpdated: bj.created_at,
    access: 'READ_ONLY',
  }

  const environment: EnvironmentRef = {
    id: bj.image?.includes('tensorflow') ? 'tensorflow-cuda' : 'pytorch-cuda',
    name: bj.image || 'none (runs directly on the node)',
    framework: '', // versions live inside the container image; the Core Engine does not inspect it
    pythonVersion: '',
    frameworkVersion: '',
    cudaVersion: '',
  }

  return {
    id: bj.id,
    name: bj.name,
    description: bj.partition ? `Partition: ${bj.partition} · Image: ${bj.image || 'default'}` : 'Batch GPU Workload',
    owner: bj.submitted_by,
    status: bj.status,
    executionMode: isDistributed ? 'DISTRIBUTED' : 'SINGLE_GPU',
    distributionStrategy: isDistributed ? 'PYTORCH_DDP' : undefined,
    nodeCount: allocatedNodeCount,
    request: {
      cpuCores: bj.cpu_cores,
      ramGb: Math.round(bj.ram_mb / 1024) || 1,
      gpuRequired: Boolean(bj.requires_gpu),
      gpuType: primaryGpu ? primaryGpu.name : 'NVIDIA GPU',
      gpuMinVramGb: Math.round((bj.min_vram_mb || 0) / 1024),
      gpuCount,
      maxRuntimeHours: Math.round(maxMinutes / 60) || 1,
      priority: 'NORMAL',
    },
    actual: node ? {
      cpuCores: bj.allocated_cpus || node.cpu_cores,
      ramGb: Math.round((bj.allocated_ram_mb || node.ram_total_mb) / 1024),
      ramUsedGb: Number((node.ram_used_mb / 1024).toFixed(1)),
      gpuModel: primaryGpu ? primaryGpu.name : 'NVIDIA GPU',
      gpuVramGb: Number(((primaryGpu?.vram_total_mb ?? 0) / 1024).toFixed(1)),
      gpuVramUsedGb: Number(((primaryGpu?.vram_used_mb || 0) / 1024).toFixed(1)),
      gpuUtilization: primaryGpu?.utilization_pct || Math.round(node.cpu_util_pct),
      cpuUtilization: Math.round(node.cpu_util_pct),
      powerWatts: primaryGpu?.power_w ?? null,
      temperatureC: primaryGpu?.temperature_c ?? null,
      networkMbps: Math.round((node.net_rx_mbps || 0) + (node.net_tx_mbps || 0)),
      node: bj.node_hostname ?? node.hostname,
    } : null,
    allocations: node ? gpus.slice(0, gpuCount).map((g, idx) => ({
      nodeId: node.id,
      gpuId: `gpu-${idx}`,
      gpuModel: g.name,
      role: idx === 0 ? 'MASTER' : 'WORKER',
      utilization: g.utilization_pct,
    })) : [],
    dataset,
    environment,
    code: {
      type: 'UPLOAD',
      entryPoint: bj.command || bj.script || 'python train.py',
      arguments: '',
    },
    submittedAt: bj.created_at,
    startedAt: bj.started_at || null,
    completedAt: bj.ended_at || null,
    progress,
    queuePosition: null, // the Core Engine does not expose a queue position
    estimatedStart: null,
    metrics: trainingMetrics,
    utilization: utilizationSeries,
    logs: parsedLogs,
    results: null, // output files are not listed by the Core Engine
    timeline,
    failureReason: bj.status_message || bj.state_reason || undefined,
    nodeHostname: bj.node_hostname ?? null,
    nodeIp: bj.node_ip ?? null,
    statusMessage: bj.status_message ?? null,
    partition: bj.partition ?? null,
    image: bj.image ?? null,
    workingDir: bj.working_dir ?? null,
    datasetPath: bj.dataset_path ?? null,
    outputDir: bj.output_dir ?? null,
    envKeys: bj.env_keys ?? [],
    exitCode: bj.exit_code ?? null,
    slurmJobId: bj.slurm_job_id ?? null,
    timeLimitMinutes: bj.time_limit_minutes ?? null,
  }
}

// --------------------------------------------------------------------------
// Service Functions
// --------------------------------------------------------------------------

export async function listJobs(params: ListJobsParams = {}): Promise<ListJobsResult> {
  const [backendJobs, nodes] = await Promise.all([
    request<BackendJobResponse[]>('/v1/jobs'),
    fetchNodes().catch(() => [] as NodeDetailResponse[]),
  ])

  const nodeMap = new Map<string, NodeDetailResponse>()
  for (const n of nodes) nodeMap.set(n.id, n)

  let jobs = backendJobs.map((bj) => transformBackendJob(bj, nodeMap))

  const { filters, sort = 'newest', page = 1, pageSize = 10, statusIn } = params

  if (statusIn?.length) {
    jobs = jobs.filter((j) => statusIn.includes(j.status))
  }

  if (filters?.search) {
    const q = filters.search.toLowerCase()
    jobs = jobs.filter((j) =>
      j.id.toLowerCase().includes(q) ||
      j.name.toLowerCase().includes(q) ||
      j.owner.toLowerCase().includes(q) ||
      (j.actual?.node && j.actual.node.toLowerCase().includes(q))
    )
  }

  if (filters?.status?.length) {
    jobs = jobs.filter((j) => filters.status!.includes(j.status))
  }

  // Sort
  jobs.sort((a, b) => {
    switch (sort) {
      case 'oldest':
        return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
      case 'runtime':
        return (b.startedAt ? Date.now() - new Date(b.startedAt).getTime() : 0) -
               (a.startedAt ? Date.now() - new Date(a.startedAt).getTime() : 0)
      case 'status':
        return a.status.localeCompare(b.status)
      case 'newest':
      default:
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    }
  })

  const total = jobs.length
  const start = (page - 1) * pageSize
  return {
    jobs: jobs.slice(start, start + pageSize),
    total,
  }
}

export async function getJob(id: string): Promise<Job> {
  const [bj, nodes, logsDetail] = await Promise.all([
    request<BackendJobResponse>(`/v1/jobs/${id}`),
    fetchNodes().catch(() => [] as NodeDetailResponse[]),
    request<BackendJobLogs>(`/v1/jobs/${id}/logs?tail=300`).catch(() => null),
  ])

  const nodeMap = new Map<string, NodeDetailResponse>()
  for (const n of nodes) nodeMap.set(n.id, n)

  return transformBackendJob(bj, nodeMap, logsDetail)
}

export async function getJobStats(): Promise<{ total: number; counts: Record<JobStatus, number> }> {
  const backendJobs = await request<BackendJobResponse[]>('/v1/jobs')
  const counts: Record<JobStatus, number> = {
    SUBMITTED: 0,
    QUEUED: 0,
    SCHEDULED: 0,
    RUNNING: 0,
    COMPLETED: 0,
    FAILED: 0,
    CANCELLED: 0,
    TIMEOUT: 0,
  }
  for (const j of backendJobs) {
    if (counts[j.status] !== undefined) {
      counts[j.status]++
    }
  }
  return {
    total: backendJobs.length,
    counts,
  }
}

export async function submitJob(payload: SubmitJobPayload): Promise<Job> {
  if (!payload.name?.trim()) throw new ApiError('Job name is required.')

  const gpuCount = payload.gpuCount ?? 1
  const body = {
    name: payload.name.trim(),
    submitted_by: currentUsername(),
    gpu_count: gpuCount,
    requires_gpu: gpuCount > 0,
    cpu_cores: payload.cpuCores || 4,
    ram_mb: (payload.ramGb || 16) * 1024,
    min_vram_mb: (payload.gpuMinVramGb || 0) * 1024,
    partition: payload.partition || (gpuCount > 0 ? 'gpu' : 'teaching'),
    time_limit: `${payload.maxRuntimeHours || 2}:00:00`,
    image: payload.image || undefined,
    dataset_path: payload.datasetPath?.trim() || undefined,
    output_dir: payload.outputDir?.trim() || undefined,
    working_dir: payload.workingDir || undefined,
    command: payload.command.trim(),
    env: payload.environmentVars || undefined,
    node_id: payload.targetNodeId || undefined,
  }

  const bj = await request<BackendJobResponse>('/v1/jobs', {
    method: 'POST',
    body: JSON.stringify(body),
  })

  return transformBackendJob(bj)
}

export async function cancelJob(id: string): Promise<Job> {
  const bj = await request<BackendJobResponse>(`/v1/jobs/${id}/cancel`, {
    method: 'POST',
  })
  return transformBackendJob(bj)
}

export async function requeueJob(id: string): Promise<Job> {
  const bj = await request<BackendJobResponse>(`/v1/jobs/${id}/requeue`, {
    method: 'POST',
  })
  return transformBackendJob(bj)
}

export async function retryJob(id: string): Promise<Job> {
  const bj = await request<BackendJobResponse>(`/v1/jobs/${id}/retry`, {
    method: 'POST',
  })
  return transformBackendJob(bj)
}

export async function cloneJob(id: string): Promise<Job> {
  const original = await request<BackendJobResponse>(`/v1/jobs/${id}`)
  return submitJob({
    name: `${original.name}-clone`.slice(0, 64),
    gpuCount: original.allocated_gpus ?? original.gpu_count ?? 1,
    cpuCores: original.allocated_cpus ?? original.cpu_cores ?? 4,
    ramGb: Math.round((original.allocated_ram_mb ?? original.ram_mb ?? 16384) / 1024),
    partition: original.partition ?? 'gpu',
    image: original.image ?? undefined,
    datasetPath: original.dataset_path ?? undefined,
    outputDir: original.output_dir ?? undefined,
    command: original.command || original.script || 'python train.py',
  })
}

export async function getJobLogs(id: string, tail = 200, search?: string): Promise<BackendJobLogs> {
  const query = search ? `&search=${encodeURIComponent(search)}` : `&tail=${tail}`
  return request<BackendJobLogs>(`/v1/jobs/${id}/logs?${query}`)
}

export async function getJobMetrics(id: string): Promise<BackendJobMetrics> {
  return request<BackendJobMetrics>(`/v1/jobs/${id}/metrics`)
}
