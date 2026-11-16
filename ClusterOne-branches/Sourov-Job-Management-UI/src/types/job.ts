// Core domain types for the ClusterOne Job Management module.
// Mirrors the data model described in the ClusterOne project plan (section 41)
// so the frontend can be pointed at a real ClusterOne API with no reshaping.

export type JobStatus =
  | 'SUBMITTED'
  | 'QUEUED'
  | 'SCHEDULED'
  | 'RUNNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'TIMEOUT'

export type ExecutionMode = 'SINGLE_GPU' | 'DISTRIBUTED'

export type DistributionStrategy = 'PYTORCH_DDP' | 'FSDP' | 'HOROVOD'

export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH'

export type EnvironmentId = 'pytorch-cuda' | 'tensorflow-cuda' | 'custom'

export interface NodeAllocation {
  nodeId: string
  gpuId: string
  gpuModel: string
  role: 'MASTER' | 'WORKER'
  utilization: number
}

export interface ResourceRequest {
  cpuCores: number
  ramGb: number
  gpuRequired: boolean
  gpuType: string // e.g. "Any GPU", "RTX 3060"
  gpuMinVramGb: number
  gpuCount: number
  maxRuntimeHours: number
  priority: JobPriority
}

export interface ResourceActual {
  cpuCores: number
  ramGb: number
  ramUsedGb: number
  gpuModel: string
  gpuVramGb: number
  gpuVramUsedGb: number
  gpuUtilization: number
  cpuUtilization: number
  powerWatts: number
  temperatureC: number
  networkMbps: number
  node: string
}

export interface DatasetRef {
  id: string
  name: string
  sizeGb: number
  samples: number
  format: string
  owner: string
  lastUpdated: string
  access: 'READ_ONLY' | 'READ_WRITE'
}

export interface EnvironmentRef {
  id: EnvironmentId
  name: string
  framework: string
  pythonVersion: string
  frameworkVersion: string
  cudaVersion: string
}

export interface CodeSource {
  type: 'UPLOAD' | 'GIT'
  fileName?: string
  repository?: string
  branch?: string
  entryPoint: string
  arguments: string
}

export interface TrainingMetricPoint {
  t: number // seconds since job start
  epoch: number
  iteration: number
  loss: number
  accuracy: number
  learningRate: number
}

export interface UtilizationPoint {
  t: number
  gpuUtilization: number
  gpuMemoryGb: number
  cpuUtilization: number
  ramGb: number
  temperatureC: number
  networkMbps: number
}

export interface LogLine {
  id: number
  timestamp: string
  level: 'INFO' | 'WARN' | 'ERROR'
  message: string
}

export interface JobResults {
  accuracy?: number
  precision?: number
  recall?: number
  f1?: number
  trainingTime: string
  artifacts: { name: string; sizeMb: number; kind: string }[]
}

export interface TimelineEvent {
  stage: 'SUBMITTED' | 'QUEUED' | 'SCHEDULED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'TIMEOUT'
  timestamp: string | null
}

export interface Job {
  id: string
  name: string
  description: string
  owner: string
  status: JobStatus
  executionMode: ExecutionMode
  distributionStrategy?: DistributionStrategy
  nodeCount: number
  request: ResourceRequest
  actual: ResourceActual | null
  allocations: NodeAllocation[]
  dataset: DatasetRef
  environment: EnvironmentRef
  code: CodeSource
  submittedAt: string
  startedAt: string | null
  completedAt: string | null
  progress: number // 0-100
  queuePosition: number | null
  estimatedStart: string | null
  metrics: TrainingMetricPoint[]
  utilization: UtilizationPoint[]
  logs: LogLine[]
  results: JobResults | null
  timeline: TimelineEvent[]
  failureReason?: string
}

export interface JobSummary
  extends Pick<
    Job,
    | 'id'
    | 'name'
    | 'status'
    | 'executionMode'
    | 'submittedAt'
    | 'progress'
    | 'owner'
  > {
  gpuLabel: string
  node: string
}

export interface NotificationItem {
  id: string
  jobId: string
  jobName: string
  type: 'success' | 'info' | 'warning' | 'error'
  message: string
  timestamp: string
  read: boolean
}

export interface JobFilters {
  search: string
  status: JobStatus[]
  executionMode: ExecutionMode[]
  gpuType: string[]
  dataset: string[]
}

export type SortKey = 'newest' | 'oldest' | 'runtime' | 'status' | 'progress' | 'id'
