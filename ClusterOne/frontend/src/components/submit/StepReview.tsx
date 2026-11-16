import { Server, Boxes, Terminal, Shield } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'

interface StepProps {
  value: SubmitJobPayload
}

export function StepReview({ value }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-text-secondary">
        Review your research workload configuration before dispatching to the Slurm scheduler.
      </p>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-4">
        {/* Job Info */}
        <div className="border-b border-border/80 pb-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted">Job Definition</div>
          <div className="mt-1 text-[16px] font-bold text-text-primary">{value.name || 'Untitled Job'}</div>
          {value.description && <div className="mt-0.5 text-[12.5px] text-text-secondary">{value.description}</div>}
        </div>

        {/* Resources */}
        <div className="border-b border-border/80 pb-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Server size={13} className="text-accent" />
            Allocated Cluster Resources
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4 font-mono text-[13px]">
            <div className="rounded bg-bg-secondary p-2">
              <span className="text-[11px] text-text-muted block">ACCELERATOR</span>
              <strong className="text-accent">{value.gpuCount ?? 1} × {value.gpuType || 'Any GPU'}</strong>
            </div>
            <div className="rounded bg-bg-secondary p-2">
              <span className="text-[11px] text-text-muted block">CPU CORES</span>
              <strong className="text-text-primary">{value.cpuCores} cores</strong>
            </div>
            <div className="rounded bg-bg-secondary p-2">
              <span className="text-[11px] text-text-muted block">SYSTEM RAM</span>
              <strong className="text-text-primary">{value.ramGb} GB</strong>
            </div>
            <div className="rounded bg-bg-secondary p-2">
              <span className="text-[11px] text-text-muted block">MAX RUNTIME</span>
              <strong className="text-text-primary">{value.maxRuntimeHours ?? 4} hours</strong>
            </div>
          </div>
        </div>

        {/* Where it runs */}
        <div className="border-b border-border/80 pb-3">
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
            <Server size={13} className="text-accent" />
            Runs on
          </div>
          <div className="mt-1 font-mono text-[13px] font-semibold text-text-primary">
            {value.targetNodeName ?? 'any available node (chosen by the scheduler)'}
          </div>
          <div className="text-[11.5px] text-text-muted">Uses that machine's GPU, CPU and RAM, not the PC you are working on.</div>
        </div>

        {/* Partition & Environment */}
        <div className="border-b border-border/80 pb-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Shield size={13} className="text-indigo-400" />
              Partition
            </div>
            <div className="mt-1 font-mono text-[13px] font-semibold text-text-primary">
              {value.partition || 'gpu'} (Whole GPU allocation)
            </div>
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5">
              <Boxes size={13} className="text-cyan-400" />
              Container
            </div>
            <div className="mt-1 font-mono text-[12.5px] font-semibold text-text-primary truncate">
              {value.image || '/opt/apptainer/pytorch-cuda.sif'}
            </div>
          </div>
        </div>

        {/* Paths */}
        <div className="border-b border-border/80 pb-3 grid gap-3 sm:grid-cols-2 text-[12px]">
          <div>
            <span className="text-text-muted block">Dataset Path:</span>
            <code className="text-accent font-mono">{value.datasetPath || 'none'}</code>
          </div>
          <div>
            <span className="text-text-muted block">Output Path:</span>
            <code className="text-accent font-mono">{value.outputDir || 'default (your home directory)'}</code>
          </div>
        </div>

        {/* Command */}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-text-muted flex items-center gap-1.5 mb-1.5">
            <Terminal size={13} className="text-accent" />
            Execution Command
          </div>
          <div className="overflow-x-auto rounded-md bg-[#070A11] p-3 font-mono text-[12px] text-accent leading-relaxed whitespace-pre-wrap">
            {value.command || 'python train.py --epochs 50 --batch-size 32 --device cuda'}
          </div>
        </div>
      </div>
    </div>
  )
}
