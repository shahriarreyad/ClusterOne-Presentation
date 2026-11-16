import { useNavigate } from 'react-router-dom'
import { Play, Sparkles, Activity } from 'lucide-react'
import { useDashboardData } from '@/hooks/useDashboardData'
import { StatusBadge } from '@/components/common/StatusBadge'
import { ProgressBar } from '@/components/common/ProgressBar'
import type { Job } from '@/types/job'

const TRAINING_TEMPLATES = [
  {
    id: 'bengali-nlp',
    title: 'Bengali LLM / RoBERTa Fine-Tuning',
    desc: 'Fine-tune pre-trained language models on Bengali NLP datasets with PyTorch & HuggingFace.',
    gpu: '2 × RTX 4090',
    cpus: 8,
    ram: '32 GB',
    partition: 'gpu',
    time: '4 hours',
    cmd: 'python train_bengali_nlp.py --epochs 50 --batch-size 32 --device cuda',
  },
  {
    id: 'pytorch-ddp',
    title: 'Distributed Multi-GPU Vision (DDP)',
    desc: 'PyTorch DistributedDataParallel across 2+ physical GPUs with NCCL backend.',
    gpu: '2 × RTX 4090',
    cpus: 16,
    ram: '64 GB',
    partition: 'gpu',
    time: '6 hours',
    cmd: 'torchrun --nproc_per_node=2 train_ddp.py --batch-size 64 --precision fp16',
  },
  {
    id: 'medical-imaging',
    title: 'Medical Imaging Diagnostics',
    desc: 'Train high-resolution CNN/Vision Transformer on radiology DICOM and dental images.',
    gpu: '1 × RTX 4090',
    cpus: 8,
    ram: '32 GB',
    partition: 'gpu',
    time: '3 hours',
    cmd: 'python train_medical.py --model densenet121 --epochs 40',
  },
  {
    id: 'coursework-teaching',
    title: 'Coursework Lab / MPS Shared GPU',
    desc: 'Lightweight batch training for academic coursework on shared teaching partition.',
    gpu: 'MPS Shared (0.5 GPU)',
    cpus: 4,
    ram: '16 GB',
    partition: 'teaching',
    time: '2 hours',
    cmd: 'python lab_exercise.py --epochs 10 --batch-size 16',
  },
]

export function TrainingPage() {
  const navigate = useNavigate()
  const { running } = useDashboardData()
  const runningWorkloads: Job[] = running

  const launchTemplate = (template: typeof TRAINING_TEMPLATES[0]) => {
    navigate('/jobs/new', { state: { template } })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold text-text-primary">Research Training Workspace</h1>
        <p className="text-[13.5px] text-text-secondary">
          Launch and track deep learning workloads running across physical cluster GPU nodes.
        </p>
      </div>

      {/* Quick Launch Templates */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-accent" />
            <h2 className="text-[15px] font-bold text-text-primary">Research Workload Presets</h2>
          </div>
          <span className="text-[12px] text-text-muted">Pre-optimized for DIU CSE cluster hardware</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {TRAINING_TEMPLATES.map((t) => (
            <div
              key={t.id}
              className="flex flex-col justify-between rounded-[var(--radius-card)] border border-border bg-surface p-4.5 transition-all hover:border-accent/40"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold text-[15px] text-text-primary">{t.title}</h3>
                  <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[11px] font-semibold text-accent">
                    {t.partition}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-text-secondary leading-relaxed">{t.desc}</p>

                <div className="mt-3 grid grid-cols-2 gap-2 rounded-md bg-bg-secondary p-2.5 font-mono text-[11.5px] text-text-secondary">
                  <div>Accelerator: <strong className="text-text-primary">{t.gpu}</strong></div>
                  <div>CPU/RAM: <strong className="text-text-primary">{t.cpus}c / {t.ram}</strong></div>
                  <div>Walltime: <strong className="text-text-primary">{t.time}</strong></div>
                  <div>Backend: <strong className="text-accent">Apptainer SIF</strong></div>
                </div>

                <div className="mt-2.5 overflow-hidden rounded bg-[#070A11] p-2 font-mono text-[11px] text-cyan-400 truncate">
                  {t.cmd}
                </div>
              </div>

              <div className="mt-4 pt-2">
                <button
                  onClick={() => launchTemplate(t)}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg hover:bg-accent/90 transition-colors"
                >
                  <Play size={14} /> Launch this Workload
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Workloads */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={16} className="text-status-running" />
            <h2 className="text-[15px] font-bold text-text-primary">Active Training Workloads</h2>
          </div>
          <span className="text-[12px] text-text-muted">{runningWorkloads.length} jobs currently training</span>
        </div>

        {runningWorkloads.length === 0 ? (
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-8 text-center text-text-muted text-[13px]">
            No jobs currently training. Use a preset above or click "Submit Job" to queue a new training workload.
          </div>
        ) : (
          <div className="space-y-3">
            {runningWorkloads.map((j: Job) => (
              <div
                key={j.id}
                onClick={() => navigate(`/jobs/${j.id}`)}
                className="cursor-pointer rounded-[var(--radius-card)] border border-border bg-surface p-4 transition-all hover:border-accent hover:bg-surface-hover"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[13px] font-bold text-accent">#{j.id}</span>
                      <h4 className="font-semibold text-[14.5px] text-text-primary">{j.name}</h4>
                      <StatusBadge status={j.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[12px] text-text-muted">
                      <span>Owner: <strong className="text-text-secondary">{j.owner}</strong></span>
                      <span>·</span>
                      <span>Node: <strong className="text-accent font-mono">{j.nodeHostname ?? j.actual?.node ?? 'not started'}</strong></span>
                      <span>·</span>
                      <span>GPU: <strong className="text-text-secondary">{j.actual?.gpuModel ?? `${j.request.gpuCount} GPU(s)`}</strong></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="w-32 text-right">
                      <div className="text-[11.5px] font-mono text-text-muted mb-1">{j.progress}% complete</div>
                      <ProgressBar value={j.progress} size="sm" tone="accent" />
                    </div>
                    <button className="rounded border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary hover:border-accent hover:text-accent">
                      Inspect
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

