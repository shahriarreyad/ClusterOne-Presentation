import type {
  Job,
  JobStatus,
  ExecutionMode,
  TrainingMetricPoint,
  UtilizationPoint,
  LogLine,
  TimelineEvent,
  NodeAllocation,
  NotificationItem,
  DatasetRef,
  EnvironmentRef,
} from '@/types/job'

// -----------------------------------------------------------------------
// This module is CLEARLY-MARKED demo data (see `isDemoData`). It stands in
// for the response of a real ClusterOne API — see src/services/jobService.ts
// for the abstraction boundary that would be swapped for real HTTP calls.
// -----------------------------------------------------------------------

export const isDemoData = true

const now = Date.now()
const minutesAgo = (m: number) => new Date(now - m * 60_000).toISOString()
const daysAgo = (d: number) => new Date(now - d * 86_400_000).toISOString()

const DATASETS: DatasetRef[] = [
  { id: 'ds-dental', name: 'Dental Image Dataset', sizeGb: 12.4, samples: 24000, format: 'JPEG', owner: 'Rahat Shahriar Reyad', lastUpdated: daysAgo(6), access: 'READ_ONLY' },
  { id: 'ds-imagenet-sub', name: 'ImageNet-1K (subset)', sizeGb: 148.2, samples: 300000, format: 'JPEG', owner: 'Cluster Storage', lastUpdated: daysAgo(40), access: 'READ_ONLY' },
  { id: 'ds-coco', name: 'COCO Detection 2017', sizeGb: 25.6, samples: 118000, format: 'JPEG + JSON', owner: 'Cluster Storage', lastUpdated: daysAgo(90), access: 'READ_ONLY' },
  { id: 'ds-squad', name: 'SQuAD v2 Text Corpus', sizeGb: 0.9, samples: 130000, format: 'JSON', owner: 'Cluster Storage', lastUpdated: daysAgo(120), access: 'READ_ONLY' },
  { id: 'ds-librispeech', name: 'LibriSpeech ASR', sizeGb: 59.3, samples: 28539, format: 'FLAC', owner: 'Cluster Storage', lastUpdated: daysAgo(75), access: 'READ_ONLY' },
  { id: 'ds-sensor', name: 'Lab Sensor Logs Q3', sizeGb: 3.1, samples: 890000, format: 'CSV', owner: 'Reyad Hasan', lastUpdated: daysAgo(2), access: 'READ_WRITE' },
]

const ENVIRONMENTS: Record<string, EnvironmentRef> = {
  pytorch: { id: 'pytorch-cuda', name: 'PyTorch + CUDA', framework: 'PyTorch', pythonVersion: '3.11', frameworkVersion: '2.4', cudaVersion: '12.4' },
  tensorflow: { id: 'tensorflow-cuda', name: 'TensorFlow + CUDA', framework: 'TensorFlow', pythonVersion: '3.10', frameworkVersion: '2.16', cudaVersion: '12.2' },
  custom: { id: 'custom', name: 'Custom Environment', framework: 'Custom', pythonVersion: '3.11', frameworkVersion: 'user-defined', cudaVersion: '12.4' },
}

const GPU_MODELS = ['RTX 3050', 'RTX 3060', 'RTX 4060', 'RTX 2060']

function buildTimeline(status: JobStatus, submittedAt: string, startedAt: string | null, completedAt: string | null): TimelineEvent[] {
  const stages: TimelineEvent['stage'][] = ['SUBMITTED', 'QUEUED', 'SCHEDULED', 'RUNNING']
  const events: TimelineEvent[] = stages.map((stage, i) => ({
    stage,
    timestamp: i === 0 ? submittedAt : startedAt && i <= 3 ? submittedAt : null,
  }))
  if (status === 'RUNNING') {
    events[3] = { stage: 'RUNNING', timestamp: startedAt }
  }
  if (['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(status)) {
    events[1].timestamp = submittedAt
    events[2].timestamp = submittedAt
    events[3].timestamp = startedAt
    events.push({ stage: status as TimelineEvent['stage'], timestamp: completedAt })
  }
  return events
}

function buildMetrics(points: number, finalEpoch: number, totalEpochs: number, startLoss = 2.1, finalLoss = 0.3): TrainingMetricPoint[] {
  const out: TrainingMetricPoint[] = []
  for (let i = 0; i < points; i++) {
    const frac = i / Math.max(1, points - 1)
    const loss = startLoss * Math.exp(-2.2 * frac) + finalLoss * frac + (Math.random() - 0.5) * 0.03
    const accuracy = Math.min(99, 40 + frac * 58 + (Math.random() - 0.5) * 1.5)
    out.push({
      t: i * 45,
      epoch: Math.max(1, Math.round(frac * finalEpoch)),
      iteration: Math.round(frac * finalEpoch * 180),
      loss: Number(Math.max(0.02, loss).toFixed(4)),
      accuracy: Number(accuracy.toFixed(2)),
      learningRate: 0.0001 * Math.pow(0.95, Math.floor(frac * totalEpochs)),
    })
  }
  return out
}

function buildUtilization(points: number, gpuBase = 80): UtilizationPoint[] {
  const out: UtilizationPoint[] = []
  for (let i = 0; i < points; i++) {
    out.push({
      t: i * 30,
      gpuUtilization: Math.min(100, Math.max(10, gpuBase + (Math.random() - 0.5) * 18)),
      gpuMemoryGb: Number((7 + Math.random() * 2.5).toFixed(1)),
      cpuUtilization: Math.min(100, Math.max(10, 55 + (Math.random() - 0.5) * 25)),
      ramGb: Number((9 + Math.random() * 3).toFixed(1)),
      temperatureC: Math.round(62 + (Math.random() - 0.5) * 10),
      networkMbps: Number((400 + Math.random() * 900).toFixed(0)),
    })
  }
  return out
}

function buildLogs(lines: [string, LogLine['level']][], startIso: string): LogLine[] {
  const start = new Date(startIso).getTime()
  return lines.map(([message, level], i) => ({
    id: i + 1,
    timestamp: new Date(start + i * 8000).toISOString(),
    level,
    message,
  }))
}

const STANDARD_LOG_HEAD: [string, LogLine['level']][] = [
  ['Starting job...', 'INFO'],
  ['Allocated node and GPU resources.', 'INFO'],
  ['Pulling container image (pytorch-cuda:2.4).', 'INFO'],
  ['Container ready.', 'INFO'],
  ['Staging dataset to node-local scratch...', 'INFO'],
  ['Dataset staged (12.4 GB).', 'INFO'],
  ['Initializing model...', 'INFO'],
  ['Model initialized on device cuda:0.', 'INFO'],
]

function makeAllocations(mode: ExecutionMode, count: number): NodeAllocation[] {
  if (mode === 'SINGLE_GPU') {
    return [{ nodeId: 'GPU03', gpuId: 'GPU0', gpuModel: 'RTX 3060', role: 'MASTER', utilization: 87 }]
  }
  return Array.from({ length: count }, (_, i) => ({
    nodeId: `GPU0${i + 1}`,
    gpuId: `GPU${i}`,
    gpuModel: GPU_MODELS[i % GPU_MODELS.length],
    role: i === 0 ? 'MASTER' : 'WORKER',
    utilization: Math.round(70 + Math.random() * 25),
  }))
}

interface JobSeed {
  id: string
  name: string
  description: string
  status: JobStatus
  mode: ExecutionMode
  nodeCount: number
  progress: number
  dataset: DatasetRef
  env: EnvironmentRef
  gpuType: string
  submittedMinAgo: number
  startedMinAgo: number | null
  completedMinAgo: number | null
  entryPoint: string
  args: string
  queuePosition?: number | null
  failureReason?: string
  owner?: string
}

const seeds: JobSeed[] = [
  {
    id: '1025', name: 'YOLO Object Detection', description: 'Train YOLOv8 on the COCO detection dataset across 4 GPUs.',
    status: 'RUNNING', mode: 'DISTRIBUTED', nodeCount: 4, progress: 32,
    dataset: DATASETS[2], env: ENVIRONMENTS.pytorch, gpuType: 'Any GPU',
    submittedMinAgo: 68, startedMinAgo: 51, completedMinAgo: null,
    entryPoint: 'train_yolo.py', args: '--epochs 100 --batch-size 64 --img-size 640',
  },
  {
    id: '1024', name: 'ResNet Training', description: 'Train ResNet-50 from scratch on an ImageNet-1K subset.',
    status: 'RUNNING', mode: 'SINGLE_GPU', nodeCount: 1, progress: 67,
    dataset: DATASETS[1], env: ENVIRONMENTS.pytorch, gpuType: 'RTX 3060',
    submittedMinAgo: 105, startedMinAgo: 102, completedMinAgo: null,
    entryPoint: 'train.py', args: '--epochs 50 --batch-size 32 --learning-rate 0.001',
  },
  {
    id: '1026', name: 'LLM Inference Benchmark', description: 'Batch inference benchmark for a fine-tuned instruction model.',
    status: 'QUEUED', mode: 'SINGLE_GPU', nodeCount: 1, progress: 0,
    dataset: DATASETS[3], env: ENVIRONMENTS.pytorch, gpuType: 'Any GPU',
    submittedMinAgo: 6, startedMinAgo: null, completedMinAgo: null,
    entryPoint: 'infer.py', args: '--batch-size 16', queuePosition: 2,
  },
  {
    id: '1027', name: 'Sensor Data ETL', description: 'Clean and reshape Q3 lab sensor logs for downstream training.',
    status: 'QUEUED', mode: 'SINGLE_GPU', nodeCount: 1, progress: 0,
    dataset: DATASETS[4], env: ENVIRONMENTS.custom, gpuType: 'Any GPU',
    submittedMinAgo: 3, startedMinAgo: null, completedMinAgo: null,
    entryPoint: 'etl_pipeline.py', args: '--workers 8', queuePosition: 3, owner: 'Reyad Hasan',
  },
  {
    id: '1023', name: 'CNN Training', description: 'Baseline CNN classifier for image triage.',
    status: 'COMPLETED', mode: 'SINGLE_GPU', nodeCount: 1, progress: 100,
    dataset: DATASETS[1], env: ENVIRONMENTS.pytorch, gpuType: 'RTX 3050',
    submittedMinAgo: 320, startedMinAgo: 315, completedMinAgo: 180,
    entryPoint: 'train_cnn.py', args: '--epochs 30 --batch-size 32',
  },
  {
    id: '1019', name: 'Dental Caries Classification', description: 'Train a CNN model for dental image classification.',
    status: 'COMPLETED', mode: 'SINGLE_GPU', nodeCount: 1, progress: 100,
    dataset: DATASETS[0], env: ENVIRONMENTS.pytorch, gpuType: 'RTX 3060',
    submittedMinAgo: 1500, startedMinAgo: 1494, completedMinAgo: 1360,
    entryPoint: 'train.py', args: '--epochs 40 --batch-size 32 --learning-rate 0.0005',
  },
  {
    id: '1020', name: 'BERT Fine-tuning', description: 'Fine-tune a BERT-base model on SQuAD v2 for extractive QA.',
    status: 'COMPLETED', mode: 'DISTRIBUTED', nodeCount: 2, progress: 100,
    dataset: DATASETS[3], env: ENVIRONMENTS.pytorch, gpuType: 'Any GPU',
    submittedMinAgo: 2100, startedMinAgo: 2094, completedMinAgo: 1920,
    entryPoint: 'finetune_bert.py', args: '--epochs 3 --batch-size 16',
  },
  {
    id: '1016', name: 'Segmentation Model', description: 'U-Net segmentation for tissue boundary detection.',
    status: 'COMPLETED', mode: 'SINGLE_GPU', nodeCount: 1, progress: 100,
    dataset: DATASETS[1], env: ENVIRONMENTS.tensorflow, gpuType: 'RTX 4060',
    submittedMinAgo: 4200, startedMinAgo: 4195, completedMinAgo: 4000,
    entryPoint: 'train_unet.py', args: '--epochs 60',
  },
  {
    id: '1015', name: 'Speech Recognition', description: 'Fine-tune a Conformer ASR model on LibriSpeech.',
    status: 'COMPLETED', mode: 'DISTRIBUTED', nodeCount: 3, progress: 100,
    dataset: DATASETS[4], env: ENVIRONMENTS.pytorch, gpuType: 'Any GPU',
    submittedMinAgo: 5800, startedMinAgo: 5790, completedMinAgo: 5500,
    entryPoint: 'train_asr.py', args: '--epochs 20 --batch-size 24',
  },
  {
    id: '1022', name: 'Image Classification', description: 'Transfer-learning classifier; failed during data loading.',
    status: 'FAILED', mode: 'SINGLE_GPU', nodeCount: 1, progress: 14,
    dataset: DATASETS[1], env: ENVIRONMENTS.pytorch, gpuType: 'RTX 3050',
    submittedMinAgo: 900, startedMinAgo: 895, completedMinAgo: 860,
    entryPoint: 'train.py', args: '--epochs 20',
    failureReason: 'CUDA out of memory while loading batch 412. Requested 8.2 GB, 6.1 GB free on RTX 3050.',
  },
  {
    id: '1017', name: 'GAN Training', description: 'DCGAN experiment for synthetic sensor-image augmentation.',
    status: 'FAILED', mode: 'SINGLE_GPU', nodeCount: 1, progress: 3,
    dataset: DATASETS[4], env: ENVIRONMENTS.custom, gpuType: 'Any GPU',
    submittedMinAgo: 7200, startedMinAgo: 7195, completedMinAgo: 7180,
    entryPoint: 'train_gan.py', args: '--epochs 200',
    failureReason: 'Entry point exited with code 1: ModuleNotFoundError: No module named \'torchvision\'.',
  },
  {
    id: '1021', name: 'Data Processing', description: 'Batch preprocessing job cancelled after a scope change.',
    status: 'CANCELLED', mode: 'SINGLE_GPU', nodeCount: 1, progress: 40,
    dataset: DATASETS[4], env: ENVIRONMENTS.custom, gpuType: 'Any GPU',
    submittedMinAgo: 1100, startedMinAgo: 1096, completedMinAgo: 1060,
    entryPoint: 'process.py', args: '--workers 4',
  },
  {
    id: '1014', name: 'Reinforcement Learning Agent', description: 'PPO agent training, cancelled to free GPUs for coursework deadline.',
    status: 'CANCELLED', mode: 'DISTRIBUTED', nodeCount: 2, progress: 55,
    dataset: DATASETS[1], env: ENVIRONMENTS.pytorch, gpuType: 'Any GPU',
    submittedMinAgo: 8800, startedMinAgo: 8790, completedMinAgo: 8600,
    entryPoint: 'train_ppo.py', args: '--episodes 5000',
  },
  {
    id: '1018', name: 'Object Tracking Eval', description: 'Long-running evaluation sweep that exceeded its requested runtime.',
    status: 'TIMEOUT', mode: 'SINGLE_GPU', nodeCount: 1, progress: 88,
    dataset: DATASETS[2], env: ENVIRONMENTS.pytorch, gpuType: 'RTX 2060',
    submittedMinAgo: 3200, startedMinAgo: 3195, completedMinAgo: 2960,
    entryPoint: 'eval_tracker.py', args: '--max-runtime 04:00:00',
    failureReason: 'Job exceeded its maximum runtime of 4h 00m and was terminated by the scheduler.',
  },
]

function seedToJob(seed: JobSeed): Job {
  const submittedAt = minutesAgo(seed.submittedMinAgo)
  const startedAt = seed.startedMinAgo != null ? minutesAgo(seed.startedMinAgo) : null
  const completedAt = seed.completedMinAgo != null ? minutesAgo(seed.completedMinAgo) : null
  const isRunning = seed.status === 'RUNNING'
  const isFinished = ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(seed.status)
  const gpuCount = seed.mode === 'DISTRIBUTED' ? seed.nodeCount : 1

  const request = {
    cpuCores: seed.mode === 'DISTRIBUTED' ? 8 : 4,
    ramGb: seed.mode === 'DISTRIBUTED' ? 32 : 16,
    gpuRequired: true,
    gpuType: seed.gpuType,
    gpuMinVramGb: 8,
    gpuCount,
    maxRuntimeHours: seed.mode === 'DISTRIBUTED' ? 8 : 4,
    priority: 'NORMAL' as const,
  }

  const actual = isRunning || isFinished
    ? {
        cpuCores: request.cpuCores,
        ramGb: request.ramGb,
        ramUsedGb: Number((request.ramGb * 0.7).toFixed(1)),
        gpuModel: seed.mode === 'DISTRIBUTED' ? `${gpuCount} × Mixed` : seed.gpuType === 'Any GPU' ? 'RTX 3060' : seed.gpuType,
        gpuVramGb: 12,
        gpuVramUsedGb: 9.4,
        gpuUtilization: 87,
        cpuUtilization: 62,
        powerWatts: 178,
        temperatureC: 68,
        networkMbps: seed.mode === 'DISTRIBUTED' ? 1200 : 140,
        node: seed.mode === 'DISTRIBUTED' ? 'GPU01–GPU0' + gpuCount : 'GPU03',
      }
    : null

  const points = isRunning ? 40 : isFinished ? 60 : 0
  const metrics = points > 0 ? buildMetrics(points, Math.round((seed.progress / 100) * 50) || 50, 50) : []
  const utilization = points > 0 ? buildUtilization(points) : []

  const logTail: [string, LogLine['level']][] = isRunning
    ? [...STANDARD_LOG_HEAD, ['Epoch 1 started.', 'INFO'], ['loss=0.824 accuracy=64.2%', 'INFO'], ['Checkpoint saved (epoch 1).', 'INFO'], ['Epoch 2 started.', 'INFO'], ['loss=0.612 accuracy=71.8%', 'INFO']]
    : seed.status === 'FAILED'
      ? [...STANDARD_LOG_HEAD, ['Epoch 1 started.', 'INFO'], [seed.failureReason ?? 'Job failed.', 'ERROR'], ['Job terminated with a non-zero exit code.', 'ERROR']]
      : seed.status === 'TIMEOUT'
        ? [...STANDARD_LOG_HEAD, ['Evaluation sweep running...', 'INFO'], ['Runtime limit approaching (3h 50m / 4h 00m).', 'WARN'], [seed.failureReason ?? 'Job timed out.', 'ERROR']]
        : seed.status === 'CANCELLED'
          ? [...STANDARD_LOG_HEAD, ['Job running...', 'INFO'], ['Cancellation requested by owner.', 'WARN'], ['Job cancelled; resources released.', 'INFO']]
          : seed.status === 'COMPLETED'
            ? [...STANDARD_LOG_HEAD, ['Training complete.', 'INFO'], ['Final checkpoint saved.', 'INFO'], ['Artifacts uploaded to /projects/output.', 'INFO'], ['Job completed successfully.', 'INFO']]
            : []

  const logs = logTail.length ? buildLogs(logTail, submittedAt) : []

  const results = seed.status === 'COMPLETED'
    ? {
        accuracy: Number((94 + Math.random() * 4.5).toFixed(2)),
        precision: Number((93 + Math.random() * 5).toFixed(2)),
        recall: Number((92 + Math.random() * 5).toFixed(2)),
        f1: Number((93 + Math.random() * 4.5).toFixed(2)),
        trainingTime: formatHm(seed.submittedMinAgo - (seed.completedMinAgo ?? 0) - (seed.submittedMinAgo - (seed.startedMinAgo ?? 0))),
        artifacts: [
          { name: 'model.pth', sizeMb: 245, kind: 'model' },
          { name: 'metrics.json', sizeMb: 1, kind: 'metrics' },
          { name: 'training.log', sizeMb: 3, kind: 'log' },
          { name: 'confusion_matrix.png', sizeMb: 1, kind: 'image' },
        ],
      }
    : null

  return {
    id: seed.id,
    name: seed.name,
    description: seed.description,
    owner: seed.owner ?? 'Rahat Shahriar Reyad',
    status: seed.status,
    executionMode: seed.mode,
    distributionStrategy: seed.mode === 'DISTRIBUTED' ? 'PYTORCH_DDP' : undefined,
    nodeCount: seed.nodeCount,
    request,
    actual,
    allocations: isRunning || isFinished ? makeAllocations(seed.mode, gpuCount) : [],
    dataset: seed.dataset,
    environment: seed.env,
    code: {
      type: 'GIT',
      repository: 'github.com/clusterone-lab/job-scripts',
      branch: 'main',
      entryPoint: seed.entryPoint,
      arguments: seed.args,
    },
    submittedAt,
    startedAt,
    completedAt,
    progress: seed.progress,
    queuePosition: seed.queuePosition ?? null,
    estimatedStart: seed.status === 'QUEUED' ? new Date(now + (seed.queuePosition ?? 1) * 4 * 60_000).toISOString() : null,
    metrics,
    utilization,
    logs,
    results,
    timeline: buildTimeline(seed.status, submittedAt, startedAt, completedAt),
    failureReason: seed.failureReason,
  }
}

function formatHm(totalMinutes: number): string {
  const h = Math.floor(Math.max(0, totalMinutes) / 60)
  const m = Math.round(Math.max(0, totalMinutes) % 60)
  return `${h}h ${m}m`
}

export const MOCK_JOBS: Job[] = seeds.map(seedToJob)

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  { id: 'n1', jobId: '1023', jobName: 'CNN Training', type: 'success', message: 'Job #1023 completed successfully.', timestamp: minutesAgo(180), read: false },
  { id: 'n2', jobId: '1024', jobName: 'ResNet Training', type: 'info', message: 'Job #1024 started running on GPU03.', timestamp: minutesAgo(102), read: false },
  { id: 'n3', jobId: '1022', jobName: 'Image Classification', type: 'error', message: 'Job #1022 failed — GPU memory exceeded.', timestamp: minutesAgo(860), read: true },
  { id: 'n4', jobId: '1018', jobName: 'Object Tracking Eval', type: 'warning', message: 'Job #1018 exceeded its runtime limit and was stopped.', timestamp: minutesAgo(2960), read: true },
  { id: 'n5', jobId: '1026', jobName: 'LLM Inference Benchmark', type: 'info', message: 'Job #1026 entered the queue at position #2.', timestamp: minutesAgo(6), read: false },
  { id: 'n6', jobId: '1025', jobName: 'YOLO Object Detection', type: 'info', message: 'Job #1025 started running across 4 GPUs.', timestamp: minutesAgo(51), read: true },
  { id: 'n7', jobId: '1021', jobName: 'Data Processing', type: 'warning', message: 'Job #1021 was cancelled by its owner.', timestamp: minutesAgo(1060), read: true },
]

export const AVAILABLE_GPUS = [
  { model: 'RTX 3050', total: 3, available: 2 },
  { model: 'RTX 3060', total: 2, available: 1 },
  { model: 'RTX 4060', total: 1, available: 0 },
  { model: 'RTX 2060', total: 1, available: 1 },
]

export interface NodeInfo {
  id: string
  gpuModel: string
  status: 'BUSY' | 'IDLE' | 'OFFLINE'
  utilization: number
  temperatureC: number
  jobId: string | null
}

const busyNodeIds = new Set(MOCK_JOBS.filter((j) => j.status === 'RUNNING').flatMap((j) => j.allocations.map((a) => a.nodeId)))

export const NODES: NodeInfo[] = [
  { id: 'GPU01', gpuModel: 'RTX 3050', status: busyNodeIds.has('GPU01') ? 'BUSY' : 'IDLE', utilization: busyNodeIds.has('GPU01') ? 82 : 0, temperatureC: busyNodeIds.has('GPU01') ? 66 : 38, jobId: '1025' },
  { id: 'GPU02', gpuModel: 'RTX 3050', status: busyNodeIds.has('GPU02') ? 'BUSY' : 'IDLE', utilization: busyNodeIds.has('GPU02') ? 79 : 0, temperatureC: busyNodeIds.has('GPU02') ? 64 : 37, jobId: '1025' },
  { id: 'GPU03', gpuModel: 'RTX 3060', status: 'BUSY', utilization: 87, temperatureC: 68, jobId: '1024' },
  { id: 'GPU04', gpuModel: 'RTX 4060', status: busyNodeIds.has('GPU04') ? 'BUSY' : 'IDLE', utilization: busyNodeIds.has('GPU04') ? 91 : 0, temperatureC: busyNodeIds.has('GPU04') ? 71 : 39, jobId: '1025' },
  { id: 'GPU05', gpuModel: 'RTX 3050', status: 'IDLE', utilization: 0, temperatureC: 36, jobId: null },
  { id: 'GPU06', gpuModel: 'RTX 2060', status: 'IDLE', utilization: 0, temperatureC: 35, jobId: null },
  { id: 'GPU07', gpuModel: 'RTX 3060', status: 'OFFLINE', utilization: 0, temperatureC: 0, jobId: null },
]

export const CLUSTER_HEALTH: 'HEALTHY' | 'DEGRADED' = 'HEALTHY'

export const CURRENT_USER = {
  name: 'Rahat Shahriar Reyad',
  email: 'reyad@clusterone.dev',
  phone: '01641183540',
  location: 'DSC Dhaka',
  role: 'Cluster Administrator (Master PC)',
  department: 'Computer Science & Engineering',
  bio: 'Working on GPU-efficient training pipelines for medical imaging models.',
  memberSince: '2025-02-10T00:00:00Z',
  avatarUrl: null as string | null,
  jobsSubmitted: MOCK_JOBS.length,
  computeHours: 128,
  gpuHours: 96,
}

export type UserProfile = typeof CURRENT_USER

export { DATASETS, ENVIRONMENTS }
