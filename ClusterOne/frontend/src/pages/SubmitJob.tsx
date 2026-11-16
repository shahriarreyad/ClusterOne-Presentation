import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react'
import type { SubmitJobPayload } from '@/services/jobService'
import { submitJob } from '@/services/jobService'
import { ApiError } from '@/services/api'
import { Stepper, STEP_LABELS } from '@/components/submit/Stepper'
import { StepBasicInfo } from '@/components/submit/StepBasicInfo'
import { StepResources } from '@/components/submit/StepResources'
import { StepPartition } from '@/components/submit/StepPartition'
import { StepEnvironment } from '@/components/submit/StepEnvironment'
import { StepCommand } from '@/components/submit/StepCommand'
import { StepReview } from '@/components/submit/StepReview'
import { StatusBadge } from '@/components/common/StatusBadge'
import type { Job } from '@/types/job'

const DEFAULT_VALUE: SubmitJobPayload = {
  name: '',
  description: '',
  executionMode: 'SINGLE_GPU',
  gpuCount: 1,
  nodeCount: 1,
  cpuCores: 8,
  ramGb: 32,
  gpuType: 'Any GPU (Best Fit)',
  gpuMinVramGb: 0, // only require a minimum VRAM if the user asks for one
  maxRuntimeHours: 4,
  priority: 'NORMAL',
  partition: 'gpu',
  image: 'pytorch',
  datasetPath: '',
  outputDir: '',
  command: 'python train.py --epochs 50 --batch-size 32',
  environmentVars: {
    PYTHONUNBUFFERED: '1',
  },
}

function validateStep(step: number, v: SubmitJobPayload): Record<string, string> {
  const errors: Record<string, string> = {}
  if (step === 0) {
    if (!v.name.trim()) errors.name = 'Job name is required.'
    else if (v.name.trim().length < 3) errors.name = 'Job name must be at least 3 characters.'
  }
  if (step === 1) {
    if (v.cpuCores < 1) errors.cpuCores = 'CPU cores must be at least 1.'
    if (v.ramGb <= 0) errors.ramGb = 'RAM must be greater than 0.'
    if ((v.maxRuntimeHours ?? 0) <= 0) errors.maxRuntimeHours = 'Maximum runtime must be greater than 0.'
  }
  if (step === 3) {
    if (!v.image?.trim()) errors.image = 'Container image is required.'
  }
  if (step === 4) {
    if (!v.command?.trim()) errors.command = 'Execution command is required.'
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
      setSubmitError(e instanceof ApiError ? e.message : 'Unable to submit the job. Please verify cluster reachability.')
    } finally {
      setSubmitting(false)
    }
  }

  // SUCCESS SCREEN
  if (created) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-[var(--radius-card)] border border-accent/30 bg-[#0B0F19] px-6 py-14 text-center shadow-xl animate-fade-in">
        <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-status-running/15 text-status-running border border-status-running/30">
          <CheckCircle2 size={34} />
        </span>
        <h2 className="text-[22px] font-extrabold tracking-wide text-text-primary uppercase font-sans">
          JOB #{created.id} SUBMITTED
        </h2>
        <p className="mt-1 text-[13.5px] text-text-secondary">
          Your job has entered the queue. Slurm will schedule it to a physical GPU node.
        </p>

        {/* Remote Compute Guarantee */}
        <div className="mt-5 w-full rounded-lg border border-border bg-surface/70 p-3.5 text-left text-[12px] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Workload Name:</span>
            <span className="font-semibold text-text-primary">{created.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">State:</span>
            <StatusBadge status={created.status} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-text-muted">Target Architecture:</span>
            <span className="font-mono text-accent">Remote Physical Node (0% Laptop Overhead)</span>
          </div>
        </div>

        <div className="mt-7 flex gap-3">
          <button
            onClick={() => navigate(`/jobs/${created.id}`)}
            className="rounded-md bg-accent px-5 py-2.5 text-[13.5px] font-semibold text-bg transition-colors hover:bg-accent/90"
          >
            View Job
          </button>
          <button
            onClick={() => navigate('/jobs')}
            className="rounded-md border border-border px-5 py-2.5 text-[13.5px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            Back to Jobs
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Breadcrumb */}
      <div className="mb-1 flex items-center gap-2 text-[12px] text-text-muted">
        <Link to="/jobs" className="hover:text-text-primary transition-colors">
          Jobs
        </Link>
        <span>/</span>
        <span className="text-text-secondary">Submit Job</span>
      </div>

      <h1 className="mb-1 text-[22px] font-bold text-text-primary">Submit Job</h1>
      <p className="mb-5 text-[13.5px] text-text-secondary">
        Configure and submit a new AI training or inference workload to the GPU cluster.
      </p>

      {/* Stepper Header */}
      <div className="mb-5">
        <Stepper current={step} furthestReached={furthest} onStepClick={goToStep} />
      </div>

      {/* Step Container */}
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <h2 className="mb-4 text-[15px] font-semibold text-text-primary">
          Step {step + 1}: {STEP_LABELS[step]}
        </h2>

        {step === 0 && <StepBasicInfo value={value} update={update} errors={errors} />}
        {step === 1 && <StepResources value={value} update={update} errors={errors} />}
        {step === 2 && <StepPartition value={value} update={update} errors={errors} />}
        {step === 3 && <StepEnvironment value={value} update={update} errors={errors} />}
        {step === 4 && <StepCommand value={value} update={update} errors={errors} />}
        {step === 5 && <StepReview value={value} />}

        {submitError && (
          <div className="mt-4 rounded-md border border-status-failed/40 bg-status-failed-soft p-3 text-[12.5px] font-medium text-status-failed">
            {submitError}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="mt-6 flex items-center justify-between border-t border-border/80 pt-4">
          <button
            type="button"
            disabled={step === 0}
            onClick={goBack}
            className="flex items-center gap-1.5 rounded-md border border-border px-3.5 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ArrowLeft size={14} /> Back
          </button>

          {step < STEP_LABELS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-[13px] font-semibold text-bg transition-colors hover:bg-accent/90"
            >
              Continue <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting}
              onClick={handleSubmit}
              className="flex items-center gap-2 rounded-md bg-accent px-5 py-2 text-[13.5px] font-semibold text-bg transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 size={15} className="animate-spin" /> Submitting Workload…
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
