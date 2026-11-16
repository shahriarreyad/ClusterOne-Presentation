import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import { submitJob } from '@/services/jobService'
import { ApiError } from '@/services/api'
import { DATASETS } from '@/data/mockData'
import { Stepper, STEP_LABELS } from '@/components/submit/Stepper'
import { StepBasicInfo } from '@/components/submit/StepBasicInfo'
import { StepExecutionMode } from '@/components/submit/StepExecutionMode'
import { StepResources } from '@/components/submit/StepResources'
import { StepDataset } from '@/components/submit/StepDataset'
import { StepEnvironment } from '@/components/submit/StepEnvironment'
import { StepCode } from '@/components/submit/StepCode'
import { StepReview } from '@/components/submit/StepReview'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { Job } from '@/types/job'

const DEFAULT_VALUE: SubmitJobPayload = {
  name: '',
  description: '',
  executionMode: 'SINGLE_GPU',
  gpuCount: 1,
  nodeCount: 1,
  cpuCores: 4,
  ramGb: 16,
  gpuType: 'Any GPU',
  gpuMinVramGb: 8,
  maxRuntimeHours: 4,
  priority: 'NORMAL',
  datasetId: DATASETS[0].id,
  environmentId: 'pytorch-cuda',
  codeType: 'GIT',
  repository: '',
  branch: 'main',
  entryPoint: 'train.py',
  arguments: '--epochs 50 --batch-size 32 --learning-rate 0.001',
}

function validateStep(step: number, v: SubmitJobPayload): Record<string, string> {
  const errors: Record<string, string> = {}
  if (step === 0) {
    if (!v.name.trim()) errors.name = 'Job name is required.'
    else if (v.name.trim().length < 3) errors.name = 'Job name must be at least 3 characters.'
  }
  if (step === 1) {
    if (v.executionMode === 'DISTRIBUTED' && v.gpuCount < 2) errors.gpuCount = 'Distributed mode requires at least 2 GPUs.'
    else if (v.gpuCount < 1) errors.gpuCount = 'GPU count must be at least 1.'
  }
  if (step === 2) {
    if (v.cpuCores < 1) errors.cpuCores = 'CPU cores must be at least 1.'
    if (v.ramGb <= 0) errors.ramGb = 'RAM must be greater than 0.'
    if (v.gpuMinVramGb < 0) errors.gpuMinVramGb = 'VRAM cannot be negative.'
    if (v.maxRuntimeHours <= 0) errors.maxRuntimeHours = 'Maximum runtime must be greater than 0.'
  }
  if (step === 3) {
    if (!v.datasetId) errors.datasetId = 'Please select a dataset.'
  }
  if (step === 4) {
    if (!v.environmentId) errors.environmentId = 'Please select an environment.'
  }
  if (step === 5) {
    if (!v.entryPoint.trim()) errors.entryPoint = 'Entry point is required.'
    if (v.codeType === 'GIT' && !v.repository?.trim()) errors.repository = 'Repository URL is required.'
  }
  return errors
}

export function SubmitJobPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [furthest, setFurthest] = useState(0)
  const [value, setValue] = useState<SubmitJobPayload>(DEFAULT_VALUE)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [created, setCreated] = useState<Job | null>(null)

  const update = (patch: Partial<SubmitJobPayload>) => setValue((v) => ({ ...v, ...patch }))

  const goNext = () => {
    const stepErrors = validateStep(step, value)
    setErrors(stepErrors)
    if (Object.keys(stepErrors).length > 0) return
    const next = Math.min(STEP_LABELS.length - 1, step + 1)
    setStep(next)
    setFurthest((f) => Math.max(f, next))
  }

  const goBack = () => setStep((s) => Math.max(0, s - 1))

  const goToStep = (i: number) => {
    if (i > furthest) return
    setStep(i)
  }

  const handleSubmit = async () => {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const job = await submitJob(value)
      setCreated(job)
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : 'Unable to submit the job. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (created) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center rounded-[var(--radius-card)] border border-border bg-surface px-6 py-14 text-center animate-fade-in">
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-status-running-soft text-status-running">
          <CheckCircle2 size={28} />
        </span>
        <h2 className="text-[18px] font-bold text-text-primary">Job Submitted Successfully</h2>
        <p className="mt-1 text-[13px] text-text-secondary">Your job has entered the queue and will be scheduled automatically.</p>
        <div className="mt-5 flex items-center gap-3 rounded-md border border-border bg-bg-secondary px-4 py-3">
          <span className="text-[12.5px] text-text-secondary">
            Job ID <span className="tabular font-semibold text-text-primary">#{created.id}</span>
          </span>
          <StatusBadge status={created.status} />
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate(`/jobs/${created.id}`)}
            className="rounded-md bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-bg transition-colors hover:bg-accent/90"
          >
            View Job
          </button>
          <button
            onClick={() => navigate('/jobs')}
            className="rounded-md border border-border px-4 py-2.5 text-[13.5px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-1 flex items-center gap-2 text-[12px] text-text-muted">
        <Link to="/jobs" className="hover:text-text-primary">
          Jobs
        </Link>
        <span>/</span>
        <span className="text-text-secondary">Submit Job</span>
      </div>
      <h1 className="mb-1 text-[22px] font-bold text-text-primary">Submit Job</h1>
      <p className="mb-5 text-[13px] text-text-secondary">Configure and submit a new AI workload to the cluster.</p>

      <div className="mb-5">
        <Stepper current={step} furthestReached={furthest} onStepClick={goToStep} />
      </div>

      <div className="rounded-[var(--radius-card)] border border-border bg-bg-secondary p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-text-primary">
          Step {step + 1}: {STEP_LABELS[step]}
        </h2>

        {step === 0 && <StepBasicInfo value={value} update={update} errors={errors} />}
        {step === 1 && <StepExecutionMode value={value} update={update} errors={errors} />}
        {step === 2 && <StepResources value={value} update={update} errors={errors} />}
        {step === 3 && <StepDataset value={value} update={update} errors={errors} />}
        {step === 4 && <StepEnvironment value={value} update={update} errors={errors} />}
        {step === 5 && <StepCode value={value} update={update} errors={errors} />}
        {step === 6 && <StepReview value={value} />}

        {submitError && <p className="mt-4 text-[12.5px] font-medium text-status-failed">{submitError}</p>}

        <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
          <button
            onClick={goBack}
            disabled={step === 0 || submitting}
            className="flex items-center gap-1.5 rounded-md border border-border px-4 py-2.5 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft size={14} />
            Back
          </button>

          {step < STEP_LABELS.length - 1 ? (
            <button
              onClick={goNext}
              className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-[13px] font-semibold text-bg transition-colors hover:bg-accent/90"
            >
              Next
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1.5 rounded-md bg-accent px-5 py-2.5 text-[13px] font-semibold text-bg transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Submitting Job...
                </>
              ) : (
                'Submit Job'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
