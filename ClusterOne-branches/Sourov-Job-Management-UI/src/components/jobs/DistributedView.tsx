import { Cpu, Radio, Link2 } from 'lucide-react'
import type { Job } from '@/types/job'
import { ProgressBar } from '@/components/common/ProgressBar'

const STRATEGY_LABEL: Record<string, string> = {
  PYTORCH_DDP: 'PyTorch DDP',
  FSDP: 'Fully Sharded Data Parallel',
  HOROVOD: 'Horovod',
}

export function DistributedView({ job }: { job: Job }) {
  if (job.executionMode !== 'DISTRIBUTED') return null
  const isActive = job.status === 'RUNNING'

  return (
    <div className="rounded-[var(--radius-card)] border border-distributed/30 bg-distributed-soft/30 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-[13.5px] font-semibold text-text-primary">Distributed Training</h3>
          <p className="text-[12px] text-text-secondary">
            {job.nodeCount} nodes · {job.request.gpuCount} GPUs · {STRATEGY_LABEL[job.distributionStrategy ?? 'PYTORCH_DDP']}
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-distributed-soft px-2.5 py-1 text-[11px] font-semibold text-distributed">
          <Radio size={12} />
          {isActive ? 'Communicating' : 'Idle'}
        </span>
      </div>

      <div className="mt-5 flex flex-col items-center">
        <div className="rounded-md border border-distributed/40 bg-surface px-4 py-2 text-[12.5px] font-semibold text-text-primary">
          Job #{job.id}
        </div>
        <div className="h-6 w-px bg-distributed/40" />

        <div className="flex w-full flex-wrap justify-center gap-3">
          {job.allocations.map((a) => (
            <div key={a.nodeId} className="flex flex-col items-center">
              <div className="w-36 rounded-md border border-border bg-surface p-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-[12px] font-semibold text-text-primary">
                    <Cpu size={12} />
                    {a.nodeId}
                  </span>
                  <span className="rounded bg-distributed-soft px-1.5 py-0.5 text-[9.5px] font-bold text-distributed">{a.role}</span>
                </div>
                <div className="mt-1 text-[11px] text-text-muted">{a.gpuModel}</div>
                <ProgressBar value={a.utilization} size="sm" showLabel className="mt-2" />
              </div>
              <div className="h-4 w-px bg-distributed/40" />
            </div>
          ))}
        </div>

        <div className="flex items-center gap-1.5 rounded-full border border-distributed/40 bg-surface px-3 py-1.5 text-[11.5px] font-medium text-distributed">
          <Link2 size={13} />
          Synchronization {isActive ? 'active' : 'pending'} — gradients all-reduced across {job.allocations.length} GPUs
        </div>
      </div>
    </div>
  )
}
