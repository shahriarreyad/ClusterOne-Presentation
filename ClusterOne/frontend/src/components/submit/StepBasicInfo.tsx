import type { SubmitJobPayload } from '@/services/jobService'
import { Field, inputClass } from './Field'

interface StepProps {
  value: SubmitJobPayload
  update: (patch: Partial<SubmitJobPayload>) => void
  errors: Record<string, string>
}

const RESEARCH_PROJECTS = [
  'Bengali NLP & Speech Research',
  'Medical Imaging & Diagnostics',
  'DIU CSE Autonomous Robotics',
  'Distributed Deep Learning Lab',
  'Computer Vision & OCR',
  'Natural Language Processing',
  'Undergraduate Thesis Work',
  'Faculty Pilot Research',
]

export function StepBasicInfo({ value, update, errors }: StepProps) {
  return (
    <div className="space-y-4">
      <Field label="Job Name" required error={errors.name} hint="A distinct, identifiable name for your research workload.">
        <input
          value={value.name}
          onChange={(e) => update({ name: e.target.value.slice(0, 80) })}
          placeholder="e.g. Bengali-NLP-Training"
          className={inputClass}
          maxLength={80}
        />
      </Field>

      <Field label="Project / Research Domain" hint="Select the project or department domain this workload belongs to.">
        <select
          value={value.description?.split('|')[0]?.trim() || RESEARCH_PROJECTS[0]}
          onChange={(e) => {
            const domain = e.target.value
            const note = value.description?.split('|')[1]?.trim() || ''
            update({ description: note ? `${domain} | ${note}` : domain })
          }}
          className={inputClass}
        >
          {RESEARCH_PROJECTS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Description & Notes" error={errors.description} hint="Optional notes about model architecture, hyperparameters, or dataset split.">
        <textarea
          value={value.description?.includes('|') ? value.description.split('|').slice(1).join('|').trim() : (value.description || '')}
          onChange={(e) => {
            const domain = value.description?.split('|')[0]?.trim() || RESEARCH_PROJECTS[0]
            update({ description: `${domain} | ${e.target.value.slice(0, 300)}` })
          }}
          placeholder="Training RoBERTa fine-tuned on Bengali sentiment corpus with 50 epochs."
          rows={3}
          className={`${inputClass} resize-none`}
          maxLength={300}
        />
      </Field>
    </div>
  )
}
