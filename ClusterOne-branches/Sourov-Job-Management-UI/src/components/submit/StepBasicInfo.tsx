import type { SubmitJobPayload } from '@/services/jobService'
import { Field, inputClass } from './Field'

interface StepProps {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
  errors: Record<string, string>
}

export function StepBasicInfo({ value, update, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <Field label="Job Name" required error={errors.name} hint="A short, descriptive name for this workload.">
        <input
          value={value.name}
          onChange={(e) => update({ name: e.target.value.slice(0, 80) })}
          placeholder="e.g. Dental Caries Classification"
          className={inputClass}
          maxLength={80}
        />
      </Field>
      <Field label="Description" error={errors.description} hint="Optional — helps you and your team recognize this job later.">
        <textarea
          value={value.description}
          onChange={(e) => update({ description: e.target.value.slice(0, 400) })}
          placeholder="Train a CNN model for dental image classification."
          rows={4}
          className={`${inputClass} resize-none`}
          maxLength={400}
        />
        <div className="mt-1 text-right text-[11px] text-text-muted">{value.description.length}/400</div>
      </Field>
    </div>
  )
}
