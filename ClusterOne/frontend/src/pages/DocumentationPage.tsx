import { Server, Laptop, Database, Boxes, ShieldCheck } from 'lucide-react'

export function DocumentationPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-[24px] font-extrabold tracking-wide text-text-primary uppercase font-sans">
          ClusterOne Documentation & User Manual
        </h1>
        <p className="mt-1 text-[14px] text-text-secondary">
          Architecture, workflow, and submission guidelines for the DIU CSE Research GPU Cluster.
        </p>
      </div>

      {/* CORE ARCHITECTURE CALLOUT */}
      <div className="rounded-[var(--radius-card)] border border-accent/40 bg-gradient-to-r from-accent/10 via-[#0B0F19] to-indigo-950/20 p-5 shadow-sm space-y-3">
        <div className="flex items-center gap-2.5">
          <Server size={20} className="text-accent" />
          <h2 className="text-[16px] font-bold text-text-primary uppercase tracking-wide">
            1. Core Architectural Model
          </h2>
        </div>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          ClusterOne is a dedicated research-computing platform. It operates with <strong>1 Master / Anchor Server</strong> (<code className="text-accent">10.20.0.10</code>) coordinating <strong>4–6 physical GPU compute nodes</strong> (<code className="text-accent">10.20.0.21+</code>) over a private high-speed <code className="text-accent">10.20.0.0/24</code> subnet.
        </p>

        <div className="rounded-lg border border-border bg-[#070A11] p-4 font-mono text-[12px] text-cyan-300 leading-relaxed overflow-x-auto">
{`User Laptop (Browser)
       │
       ▼  (HTTPS / REST Web Control Plane)
Anchor Master (10.20.0.10)  [FastAPI Engine + Slurm Scheduler]
       │
       ▼  (Slurm Controller / slurmd Dispatch)
GPU Compute Nodes (10.20.0.21+)  [RTX 4090 / CUDA / Apptainer]
       │
       ▼  (0% Laptop Overhead · Full Dedicated Hardware)
PyTorch / TensorFlow / JAX Training & Inference Workloads`}
        </div>

        <div className="flex items-center gap-2 rounded bg-surface/80 border border-border p-3 text-[12.5px] text-text-secondary">
          <Laptop size={16} className="text-status-running shrink-0" />
          <span>
            <strong>Remote Execution Guarantee:</strong> When you submit training workloads through ClusterOne, your laptop functions solely as a web control interface. All GPU tensor cores, CUDA memory, CPU cycles, and RAM are strictly provisioned on the cluster nodes.
          </span>
        </div>
      </div>

      {/* 2. PARTITIONS & SCHEDULING */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-indigo-400" />
          <h2 className="text-[17px] font-bold text-text-primary">2. Cluster Partitions & Scheduling</h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 text-[13px]">
          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-2">
            <span className="font-mono font-bold text-accent">partition: gpu</span>
            <div className="text-[11px] text-status-running font-semibold uppercase">Exclusive Physical GPU</div>
            <p className="text-text-secondary text-[12.5px]">
              Allocates entire dedicated GPUs with zero resource contention. Ideal for heavy PyTorch models, LLM fine-tuning, and computer vision training.
            </p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-2">
            <span className="font-mono font-bold text-indigo-400">partition: teaching</span>
            <div className="text-[11px] text-indigo-300 font-semibold uppercase">NVIDIA MPS Shared</div>
            <p className="text-text-secondary text-[12.5px]">
              Allows multiple undergraduate/postgraduate student workloads to share GPU compute via NVIDIA Multi-Process Service.
            </p>
          </div>

          <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4 space-y-2">
            <span className="font-mono font-bold text-emerald-400">partition: interactive</span>
            <div className="text-[11px] text-emerald-300 font-semibold uppercase">Rapid Debug Session</div>
            <p className="text-text-secondary text-[12.5px]">
              High priority, short walltime (max 1 hour) for rapid code verification, Jupyter notebooks, and test dry-runs before batch submission.
            </p>
          </div>
        </div>
      </div>

      {/* 3. APPTAINER CONTAINER GUIDELINES */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Boxes size={18} className="text-cyan-400" />
          <h2 className="text-[17px] font-bold text-text-primary">3. Apptainer Container Runtimes</h2>
        </div>
        <p className="text-[13px] text-text-secondary leading-relaxed">
          All workloads run inside immutable Apptainer (Singularity) <code className="text-accent">.sif</code> containers mounted at <code className="text-accent">/opt/apptainer</code>. This eliminates dependency conflicts and guarantees reproducible research.
        </p>

        <div className="overflow-hidden rounded-[var(--radius-card)] border border-border font-mono text-[12px]">
          <table className="w-full text-left">
            <thead className="bg-bg-secondary text-[11px] text-text-muted border-b border-border">
              <tr>
                <th className="px-4 py-2.5">CONTAINER SIF</th>
                <th className="px-4 py-2.5">FRAMEWORK</th>
                <th className="px-4 py-2.5">CUDA VERSION</th>
                <th className="px-4 py-2.5">PATH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-surface">
              <tr>
                <td className="px-4 py-2.5 text-accent font-semibold">pytorch-cuda.sif</td>
                <td className="px-4 py-2.5 text-text-primary">PyTorch 2.3.0 + TorchVision</td>
                <td className="px-4 py-2.5 text-text-secondary">CUDA 12.4</td>
                <td className="px-4 py-2.5 text-text-muted">/opt/apptainer/pytorch-cuda.sif</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-accent font-semibold">tensorflow-cuda.sif</td>
                <td className="px-4 py-2.5 text-text-primary">TensorFlow 2.16 + Keras 3</td>
                <td className="px-4 py-2.5 text-text-secondary">CUDA 12.3</td>
                <td className="px-4 py-2.5 text-text-muted">/opt/apptainer/tensorflow-cuda.sif</td>
              </tr>
              <tr>
                <td className="px-4 py-2.5 text-accent font-semibold">huggingface-llm.sif</td>
                <td className="px-4 py-2.5 text-text-primary">Transformers + Accelerate + PEFT</td>
                <td className="px-4 py-2.5 text-text-secondary">CUDA 12.4</td>
                <td className="px-4 py-2.5 text-text-muted">/opt/apptainer/huggingface-llm.sif</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. STORAGE MOUNTS HIERARCHY */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Database size={18} className="text-amber-400" />
          <h2 className="text-[17px] font-bold text-text-primary">4. Storage Hierarchy</h2>
        </div>
        <div className="space-y-2 text-[13px]">
          <div className="rounded-md border border-border bg-surface p-3 flex items-start gap-3">
            <code className="font-mono text-accent text-[12.5px] w-28 shrink-0">/datasets</code>
            <div className="text-text-secondary">
              <strong>ZFS Shared Dataset Pool (Read-Only):</strong> Read-only central storage for curated benchmarks and training sets. Do not write outputs here.
            </div>
          </div>
          <div className="rounded-md border border-border bg-surface p-3 flex items-start gap-3">
            <code className="font-mono text-accent text-[12.5px] w-28 shrink-0">/home/$USER</code>
            <div className="text-text-secondary">
              <strong>NFS Persistent Home:</strong> Personal research workspace for code, configurations, and small output artifacts.
            </div>
          </div>
          <div className="rounded-md border border-border bg-surface p-3 flex items-start gap-3">
            <code className="font-mono text-accent text-[12.5px] w-28 shrink-0">/scratch/$USER</code>
            <div className="text-text-secondary">
              <strong>Local NVMe Scratch:</strong> Ephemeral high-bandwidth scratch space for intermediate model weights, dataloader caches, and temp checkpoints.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
