import { useState } from 'react'
import { Upload, GitBranch, FileCode } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import { Field, inputClass } from './Field'
import { cn } from '@/lib/format'

interface StepProps {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
  errors: Record<string, string>
}

export function StepCode({ value, update, errors }: StepProps) {
  const [mode, setMode] = useState<'UPLOAD' | 'GIT'>(value.codeType)

  const setMode2 = (m: 'UPLOAD' | 'GIT') => {
    setMode(m)
    update({ codeType: m })
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => setMode2('UPLOAD')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md border p-3 text-[13px] font-medium transition-colors',
            mode === 'UPLOAD' ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text-secondary hover:bg-surface-hover',
          )}
        >
          <Upload size={15} />
          Upload Script
        </button>
        <button
          onClick={() => setMode2('GIT')}
          className={cn(
            'flex flex-1 items-center justify-center gap-2 rounded-md border p-3 text-[13px] font-medium transition-colors',
            mode === 'GIT' ? 'border-accent bg-accent-soft text-accent' : 'border-border bg-surface text-text-secondary hover:bg-surface-hover',
          )}
        >
          <GitBranch size={15} />
          Git Repository
        </button>
      </div>

      {mode === 'UPLOAD' ? (
        <div className="rounded-[var(--radius-card)] border-2 border-dashed border-border p-8 text-center">
          <FileCode size={22} className="mx-auto mb-2 text-text-muted" />
          <p className="text-[13px] text-text-secondary">
            {value.fileName ? <span className="font-medium text-text-primary">{value.fileName}</span> : 'Drag and drop your entry-point script, or'}
          </p>
          <label className="mt-2 inline-block cursor-pointer rounded-md border border-border bg-surface px-3.5 py-2 text-[12.5px] font-medium text-text-primary hover:bg-surface-hover">
            Browse Files
            <input
              type="file"
              accept=".py"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) update({ fileName: f.name, entryPoint: f.name })
              }}
            />
          </label>
          {errors.entryPoint && <p className="mt-2 text-[11.5px] font-medium text-status-failed">{errors.entryPoint}</p>}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Repository" required error={errors.repository}>
            <input
              value={value.repository ?? ''}
              onChange={(e) => update({ repository: e.target.value })}
              placeholder="github.com/example/project"
              className={inputClass}
            />
          </Field>
          <Field label="Branch">
            <input value={value.branch ?? ''} onChange={(e) => update({ branch: e.target.value })} placeholder="main" className={inputClass} />
          </Field>
          <Field label="Entry Point" required error={errors.entryPoint} hint="Script ClusterOne runs to start the job.">
            <input value={value.entryPoint} onChange={(e) => update({ entryPoint: e.target.value })} placeholder="train.py" className={inputClass} />
          </Field>
        </div>
      )}

      <Field label="Arguments" hint="Command-line arguments passed to the entry point.">
        <textarea
          value={value.arguments}
          onChange={(e) => update({ arguments: e.target.value })}
          rows={3}
          placeholder="--epochs 50 --batch-size 32 --learning-rate 0.001"
          className={`${inputClass} resize-none font-mono`}
        />
      </Field>
    </div>
  )
}
