import { useState } from 'react'
import { Database, Upload, Hash, Check } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import { DATASETS } from '@/data/mockData'
import { formatDateTime, cn } from '@/lib/format'
import { Field, inputClass } from './Field'

interface StepProps {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
  errors: Record<string, string>
}

type Mode = 'EXISTING' | 'UPLOAD' | 'PATH'

export function StepDataset({ value, update, errors }: StepProps) {
  const [mode, setMode] = useState<Mode>('EXISTING')
  const selected = DATASETS.find((d) => d.id === value.datasetId)

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <ModeTab icon={Database} label="Existing Dataset" active={mode === 'EXISTING'} onClick={() => setMode('EXISTING')} />
        <ModeTab icon={Upload} label="Upload Dataset" active={mode === 'UPLOAD'} onClick={() => setMode('UPLOAD')} />
        <ModeTab icon={Hash} label="Dataset ID / Path" active={mode === 'PATH'} onClick={() => setMode('PATH')} />
      </div>

      {mode === 'EXISTING' && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            {DATASETS.map((d) => (
              <button
                key={d.id}
                onClick={() => update({ datasetId: d.id })}
                className={cn(
                  'flex items-start justify-between gap-2 rounded-md border p-3 text-left transition-colors',
                  d.id === value.datasetId ? 'border-accent bg-accent-soft' : 'border-border bg-surface hover:border-border-strong',
                )}
              >
                <div>
                  <div className="text-[13px] font-semibold text-text-primary">{d.name}</div>
                  <div className="mt-0.5 text-[11.5px] text-text-secondary">
                    {d.sizeGb} GB · {d.samples.toLocaleString()} samples · {d.format}
                  </div>
                </div>
                {d.id === value.datasetId && <Check size={16} className="mt-0.5 shrink-0 text-accent" />}
              </button>
            ))}
          </div>
          {errors.datasetId && <p className="text-[11.5px] font-medium text-status-failed">{errors.datasetId}</p>}

          {selected && (
            <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-muted">Dataset Details</h3>
              <div className="grid grid-cols-2 gap-y-2 text-[12.5px] sm:grid-cols-3">
                <Detail label="Size" value={`${selected.sizeGb} GB`} />
                <Detail label="Samples" value={selected.samples.toLocaleString()} />
                <Detail label="Format" value={selected.format} />
                <Detail label="Owner" value={selected.owner} />
                <Detail label="Access" value={selected.access === 'READ_ONLY' ? 'Read Only' : 'Read/Write'} />
                <Detail label="Last Updated" value={formatDateTime(selected.lastUpdated)} />
              </div>
            </div>
          )}
        </div>
      )}

      {mode === 'UPLOAD' && (
        <div className="rounded-[var(--radius-card)] border-2 border-dashed border-border p-8 text-center">
          <Upload size={22} className="mx-auto mb-2 text-text-muted" />
          <p className="text-[13px] text-text-secondary">Drag and drop a dataset archive, or</p>
          <label className="mt-2 inline-block cursor-pointer rounded-md border border-border bg-surface px-3.5 py-2 text-[12.5px] font-medium text-text-primary hover:bg-surface-hover">
            Browse Files
            <input type="file" className="hidden" onChange={() => update({ datasetId: DATASETS[0].id })} />
          </label>
          <p className="mt-3 text-[11px] text-text-muted">
            Uploaded datasets are staged to centralized storage and reviewed before jobs can access them. This demo uses the
            catalog dataset above as a stand-in.
          </p>
        </div>
      )}

      {mode === 'PATH' && (
        <Field label="Dataset ID or Path" hint="Reference an existing dataset already registered on the cluster.">
          <input
            placeholder="ds-dental or /projects/datasets/dental"
            onChange={(e) => update({ datasetId: e.target.value ? DATASETS[0].id : value.datasetId })}
            className={inputClass}
          />
        </Field>
      )}
    </div>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-text-muted">{label}</div>
      <div className="font-medium text-text-primary">{value}</div>
    </div>
  )
}

function ModeTab({ icon: Icon, label, active, onClick }: { icon: typeof Database; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-md border px-3 py-2 text-[12.5px] font-medium transition-colors',
        active ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text-secondary hover:bg-surface-hover',
      )}
    >
      <Icon size={14} />
      {label}
    </button>
  )
}
