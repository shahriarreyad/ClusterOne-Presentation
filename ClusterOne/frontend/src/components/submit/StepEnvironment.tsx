import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import { Field, inputClass } from './Field'

interface StepProps {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
  errors: Record<string, string>
}

const CONTAINER_PRESETS = [
  { id: 'pytorch-cuda', name: 'pytorch-cuda.sif', path: '/opt/apptainer/pytorch-cuda.sif', desc: 'PyTorch 2.3 · CUDA 12.4 · cuDNN 9 · TorchVision' },
  { id: 'tensorflow-cuda', name: 'tensorflow-cuda.sif', path: '/opt/apptainer/tensorflow-cuda.sif', desc: 'TensorFlow 2.16 · CUDA 12.3 · Keras 3' },
  { id: 'huggingface-llm', name: 'huggingface-llm.sif', path: '/opt/apptainer/huggingface-llm.sif', desc: 'Transformers · Accelerate · PEFT · BitsAndBytes' },
  { id: 'custom', name: 'Custom .sif Container Path', path: '', desc: 'Provide an absolute path to a custom Apptainer container' },
]

export function StepEnvironment({ value, update, errors }: StepProps) {
  const [selectedPreset, setSelectedPreset] = useState(
    CONTAINER_PRESETS.find((p) => p.path === value.image)?.id || 'pytorch-cuda'
  )
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')

  const envs = value.environmentVars || {
    CUDA_VISIBLE_DEVICES: '0',
    NCCL_DEBUG: 'INFO',
    PYTHONUNBUFFERED: '1',
  }

  const addEnv = () => {
    if (!newKey.trim()) return
    update({
      environmentVars: { ...envs, [newKey.trim()]: newVal.trim() },
    })
    setNewKey('')
    setNewVal('')
  }

  const removeEnv = (k: string) => {
    const next = { ...envs }
    delete next[k]
    update({ environmentVars: next })
  }

  return (
    <div className="space-y-5">
      {/* Container selection */}
      <Field label="Apptainer / Singularity Container Image" required error={errors.image} hint="Pre-configured immutable GPU runtime environment container.">
        <select
          value={selectedPreset}
          onChange={(e) => {
            const id = e.target.value
            setSelectedPreset(id)
            const preset = CONTAINER_PRESETS.find((p) => p.id === id)
            if (preset && preset.path) {
              update({ image: preset.path })
            }
          }}
          className={inputClass}
        >
          {CONTAINER_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} — {p.desc}
            </option>
          ))}
        </select>
      </Field>

      {selectedPreset === 'custom' && (
        <Field label="Custom Container Image (.sif path)" required hint="Absolute path on cluster NFS/ZFS.">
          <input
            value={value.image || ''}
            onChange={(e) => update({ image: e.target.value })}
            placeholder="/opt/apptainer/custom-image.sif"
            className={inputClass}
          />
        </Field>
      )}

      {/* Dataset & Output Paths */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Dataset / Input Path" hint="Cluster read-only mount (e.g. ZFS /datasets pool).">
          <input
            value={value.datasetPath ?? ''}
            onChange={(e) => update({ datasetPath: e.target.value })}
            placeholder="/datasets/your-dataset (optional)"
            className={inputClass}
          />
        </Field>

        <Field label="Output & Checkpoint Directory" hint="Cluster read/write mount for logs and saved model weights.">
          <input
            value={value.outputDir ?? ''}
            onChange={(e) => update({ outputDir: e.target.value })}
            placeholder="/home/<you>/output (default: your home directory)"
            className={inputClass}
          />
        </Field>
      </div>

      {/* Environment Variables */}
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[12px] font-semibold text-text-primary">Environment Variables</h3>
          <span className="text-[11px] text-text-muted">Injected into Apptainer container session</span>
        </div>

        <div className="space-y-2">
          {Object.entries(envs).map(([k, v]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-1/3 truncate rounded bg-bg-secondary px-2 py-1 font-mono text-[12px] text-accent">
                {k}
              </span>
              <span className="flex-1 truncate rounded bg-bg-secondary px-2 py-1 font-mono text-[12px] text-text-primary">
                {v}
              </span>
              <button
                type="button"
                onClick={() => removeEnv(k)}
                className="p-1 text-text-muted hover:text-status-failed"
                title="Remove variable"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-2 border-t border-border/80">
            <input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="VARIABLE_NAME"
              className={`${inputClass} w-1/3 font-mono text-[11.5px] uppercase`}
            />
            <input
              value={newVal}
              onChange={(e) => setNewVal(e.target.value)}
              placeholder="Value"
              className={`${inputClass} flex-1 font-mono text-[11.5px]`}
            />
            <button
              type="button"
              onClick={addEnv}
              disabled={!newKey.trim()}
              className="flex items-center gap-1 rounded-md bg-surface-hover px-2.5 py-1.5 text-[12px] font-medium text-text-primary hover:bg-surface-active disabled:opacity-40"
            >
              <Plus size={13} /> Add
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
