import type { Job, JobStatus, ExecutionMode, JobFilters, SortKey, DatasetRef, EnvironmentRef, JobPriority } from '@/types/job'
import { MOCK_JOBS, DATASETS, ENVIRONMENTS } from '@/data/mockData'
import { mockDelay, ApiError } from './api'

// -----------------------------------------------------------------------
// Mock implementation of the ClusterOne Job API described in the project
// plan (section 42):
//
//   GET    /api/jobs
//   GET    /api/jobs/:id
//   POST   /api/jobs
//   POST   /api/jobs/:id/cancel
//   POST   /api/jobs/:id/retry
//   POST   /api/jobs/:id/clone
//   GET    /api/jobs/:id/logs
//   GET    /api/jobs/:id/metrics
//   GET    /api/jobs/:id/resources
//   GET    /api/jobs/:id/results
//
// Every exported function here has the same name and shape it would have
// once backed by `request()` from ./api — pages and hooks never see the
// difference. Swap the body of each function for the matching `request<T>`
// call when the real API is available; nothing upstream changes.
// -----------------------------------------------------------------------

let store: Job[] = structuredClone(MOCK_JOBS)
let nextIdCounter = Math.max(...MOCK_JOBS.map((j) => Number(j.id))) + 1

// -----------------------------------------------------------------------
// Lightweight client-side simulation so RUNNING jobs feel alive when the
// UI polls them (progress ticking up, new utilization/metric samples,
// occasional log lines) instead of returning static demo data forever.
// A real backend would push this from the node agent instead — see the
// integration note in ./api.ts. Throttled per job so bursts of polling
// don't fast-forward a job to completion.
// -----------------------------------------------------------------------
const lastTickAt = new Map<string, number>()

function simulateTick(job: Job): void {
  if (job.status !== 'RUNNING') return
  const last = lastTickAt.get(job.id) ?? 0
  const now = Date.now()
  if (now - last < 2200) return
  lastTickAt.set(job.id, now)

  job.progress = Math.min(99, Number((job.progress + Math.random() * 1.8).toFixed(1)))

  const t = (job.utilization.at(-1)?.t ?? 0) + 30
  job.utilization.push({
    t,
    gpuUtilization: Math.min(100, Math.max(35, 80 + (Math.random() - 0.5) * 22)),
    gpuMemoryGb: Number((7 + Math.random() * 2.5).toFixed(1)),
    cpuUtilization: Math.min(100, Math.max(15, 55 + (Math.random() - 0.5) * 28)),
    ramGb: Number((9 + Math.random() * 3).toFixed(1)),
    temperatureC: Math.round(62 + (Math.random() - 0.5) * 10),
    networkMbps: Number((400 + Math.random() * 900).toFixed(0)),
  })
  if (job.utilization.length > 150) job.utilization.shift()

  const lastMetric = job.metrics.at(-1)
  const nextLoss = Math.max(0.02, (lastMetric?.loss ?? 1) * (0.985 + Math.random() * 0.02))
  const nextAcc = Math.min(99.4, (lastMetric?.accuracy ?? 45) + Math.random() * 0.35)
  job.metrics.push({
    t,
    epoch: lastMetric?.epoch ?? 1,
    iteration: (lastMetric?.iteration ?? 0) + 1,
    loss: Number(nextLoss.toFixed(4)),
    accuracy: Number(nextAcc.toFixed(2)),
    learningRate: lastMetric?.learningRate ?? 0.0001,
  })
  if (job.metrics.length > 150) job.metrics.shift()

  if (Math.random() < 0.35) {
    job.logs.push({
      id: job.logs.length + 1,
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `iteration ${job.metrics.length} — loss=${nextLoss.toFixed(3)} accuracy=${nextAcc.toFixed(1)}%`,
    })
  }
}

export interface SubmitJobPayload {
  name: string
  description: string
  executionMode: ExecutionMode
  gpuCount: number
  nodeCount: number
  cpuCores: number
  ramGb: number
  gpuType: string
  gpuMinVramGb: number
  maxRuntimeHours: number
  priority: JobPriority
  datasetId: string
  environmentId: string
  codeType: 'UPLOAD' | 'GIT'
  fileName?: string
  repository?: string
  branch?: string
  entryPoint: string
  arguments: string
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

function matchesFilters(job: Job, filters?: Partial<JobFilters>, statusIn?: JobStatus[]): boolean {
  if (statusIn && statusIn.length && !statusIn.includes(job.status)) return false
  if (!filters) return true
  if (filters.search) {
    const q = filters.search.toLowerCase()
    const haystack = `${job.id} ${job.name} ${job.dataset.name} ${job.owner}`.toLowerCase()
    if (!haystack.includes(q)) return false
  }
  if (filters.status && filters.status.length && !filters.status.includes(job.status)) return false
  if (filters.executionMode && filters.executionMode.length && !filters.executionMode.includes(job.executionMode)) return false
  if (filters.gpuType && filters.gpuType.length && !filters.gpuType.includes(job.request.gpuType)) return false
  if (filters.dataset && filters.dataset.length && !filters.dataset.includes(job.dataset.id)) return false
  return true
}

function sortJobs(jobs: Job[], sort?: SortKey): Job[] {
  const copy = [...jobs]
  switch (sort) {
    case 'oldest':
      return copy.sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime())
    case 'runtime':
      return copy.sort((a, b) => (b.startedAt ? Date.now() - new Date(b.startedAt).getTime() : 0) - (a.startedAt ? Date.now() - new Date(a.startedAt).getTime() : 0))
    case 'status':
      return copy.sort((a, b) => a.status.localeCompare(b.status))
    case 'progress':
      return copy.sort((a, b) => b.progress - a.progress)
    case 'id':
      return copy.sort((a, b) => Number(b.id) - Number(a.id))
    case 'newest':
    default:
      return copy.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
  }
}

export async function listJobs(params: ListJobsParams = {}): Promise<ListJobsResult> {
  await mockDelay()
  const { filters, sort = 'newest', page = 1, pageSize = 10, statusIn } = params
  const filtered = sortJobs(store.filter((j) => matchesFilters(j, filters, statusIn)), sort)
  const start = (page - 1) * pageSize
  return { jobs: filtered.slice(start, start + pageSize), total: filtered.length }
}

export async function getJob(id: string): Promise<Job> {
  await mockDelay()
  const job = store.find((j) => j.id === id)
  if (!job) throw new ApiError(`Job #${id} was not found.`, 404)
  simulateTick(job)
  return structuredClone(job)
}

export async function getJobStats() {
  await mockDelay(80, 180)
  const counts: Record<JobStatus, number> = {
    SUBMITTED: 0, QUEUED: 0, SCHEDULED: 0, RUNNING: 0, COMPLETED: 0, FAILED: 0, CANCELLED: 0, TIMEOUT: 0,
  }
  store.forEach((j) => { counts[j.status]++ })
  return { total: store.length, counts }
}

export async function submitJob(payload: SubmitJobPayload): Promise<Job> {
  await mockDelay(500, 900)
  if (!payload.name.trim()) throw new ApiError('Job name is required.')

  const id = String(nextIdCounter++)
  const dataset: DatasetRef = DATASETS.find((d) => d.id === payload.datasetId) ?? DATASETS[0]
  const environment: EnvironmentRef = Object.values(ENVIRONMENTS).find((e) => e.id === payload.environmentId) ?? ENVIRONMENTS.pytorch
  const submittedAt = new Date().toISOString()

  const job: Job = {
    id,
    name: payload.name.trim(),
    description: payload.description.trim(),
    owner: 'Rahat Shahriar Reyad',
    status: 'QUEUED',
    executionMode: payload.executionMode,
    distributionStrategy: payload.executionMode === 'DISTRIBUTED' ? 'PYTORCH_DDP' : undefined,
    nodeCount: payload.executionMode === 'DISTRIBUTED' ? payload.nodeCount : 1,
    request: {
      cpuCores: payload.cpuCores,
      ramGb: payload.ramGb,
      gpuRequired: true,
      gpuType: payload.gpuType,
      gpuMinVramGb: payload.gpuMinVramGb,
      gpuCount: payload.gpuCount,
      maxRuntimeHours: payload.maxRuntimeHours,
      priority: payload.priority,
    },
    actual: null,
    allocations: [],
    dataset,
    environment,
    code: {
      type: payload.codeType,
      fileName: payload.fileName,
      repository: payload.repository,
      branch: payload.branch,
      entryPoint: payload.entryPoint,
      arguments: payload.arguments,
    },
    submittedAt,
    startedAt: null,
    completedAt: null,
    progress: 0,
    queuePosition: store.filter((j) => j.status === 'QUEUED').length + 1,
    estimatedStart: new Date(Date.now() + 4 * 60_000).toISOString(),
    metrics: [],
    utilization: [],
    logs: [{ id: 1, timestamp: submittedAt, level: 'INFO', message: 'Job submitted and waiting to be scheduled.' }],
    results: null,
    timeline: [
      { stage: 'SUBMITTED', timestamp: submittedAt },
      { stage: 'QUEUED', timestamp: submittedAt },
      { stage: 'SCHEDULED', timestamp: null },
      { stage: 'RUNNING', timestamp: null },
    ],
  }

  store = [job, ...store]
  return structuredClone(job)
}

export async function cancelJob(id: string): Promise<Job> {
  await mockDelay(300, 600)
  const job = store.find((j) => j.id === id)
  if (!job) throw new ApiError(`Job #${id} was not found.`, 404)
  if (!['RUNNING', 'QUEUED', 'SCHEDULED', 'SUBMITTED'].includes(job.status)) {
    throw new ApiError(`Job #${id} can no longer be cancelled.`)
  }
  job.status = 'CANCELLED'
  job.completedAt = new Date().toISOString()
  job.timeline.push({ stage: 'CANCELLED', timestamp: job.completedAt })
  return structuredClone(job)
}

export async function retryJob(id: string): Promise<Job> {
  await mockDelay(500, 800)
  const job = store.find((j) => j.id === id)
  if (!job) throw new ApiError(`Job #${id} was not found.`, 404)
  return submitJob({
    name: job.name,
    description: job.description,
    executionMode: job.executionMode,
    gpuCount: job.request.gpuCount,
    nodeCount: job.nodeCount,
    cpuCores: job.request.cpuCores,
    ramGb: job.request.ramGb,
    gpuType: job.request.gpuType,
    gpuMinVramGb: job.request.gpuMinVramGb,
    maxRuntimeHours: job.request.maxRuntimeHours,
    priority: job.request.priority,
    datasetId: job.dataset.id,
    environmentId: job.environment.id,
    codeType: job.code.type,
    fileName: job.code.fileName,
    repository: job.code.repository,
    branch: job.code.branch,
    entryPoint: job.code.entryPoint,
    arguments: job.code.arguments,
  })
}

export async function cloneJob(id: string): Promise<Job> {
  await mockDelay(400, 700)
  const job = store.find((j) => j.id === id)
  if (!job) throw new ApiError(`Job #${id} was not found.`, 404)
  return submitJob({
    name: `${job.name} (Clone)`,
    description: job.description,
    executionMode: job.executionMode,
    gpuCount: job.request.gpuCount,
    nodeCount: job.nodeCount,
    cpuCores: job.request.cpuCores,
    ramGb: job.request.ramGb,
    gpuType: job.request.gpuType,
    gpuMinVramGb: job.request.gpuMinVramGb,
    maxRuntimeHours: job.request.maxRuntimeHours,
    priority: job.request.priority,
    datasetId: job.dataset.id,
    environmentId: job.environment.id,
    codeType: job.code.type,
    fileName: job.code.fileName,
    repository: job.code.repository,
    branch: job.code.branch,
    entryPoint: job.code.entryPoint,
    arguments: job.code.arguments,
  })
}

export async function getJobLogs(id: string) {
  await mockDelay(150, 300)
  const job = store.find((j) => j.id === id)
  if (!job) throw new ApiError(`Job #${id} was not found.`, 404)
  return job.logs
}

export async function getJobMetrics(id: string) {
  await mockDelay(150, 300)
  const job = store.find((j) => j.id === id)
  if (!job) throw new ApiError(`Job #${id} was not found.`, 404)
  return { metrics: job.metrics, utilization: job.utilization }
}

export async function getJobResults(id: string) {
  await mockDelay(150, 300)
  const job = store.find((j) => j.id === id)
  if (!job) throw new ApiError(`Job #${id} was not found.`, 404)
  return job.results
}

export function resetMockStore() {
  store = structuredClone(MOCK_JOBS)
}
