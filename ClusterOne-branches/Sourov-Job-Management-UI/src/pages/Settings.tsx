import { useState } from 'react'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-surface-hover'}`}
    >
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

export function Settings() {
  const [emailNotifs, setEmailNotifs] = useState(true)
  const [jobComplete, setJobComplete] = useState(true)
  const [jobFailed, setJobFailed] = useState(true)
  const [queueUpdates, setQueueUpdates] = useState(false)

  const rows: [string, string, boolean, (v: boolean) => void][] = [
    ['Email notifications', 'Receive a summary email for important job events.', emailNotifs, setEmailNotifs],
    ['Job completed', 'Notify me when a job finishes successfully.', jobComplete, setJobComplete],
    ['Job failed', 'Notify me when a job fails or times out.', jobFailed, setJobFailed],
    ['Queue updates', 'Notify me when my queue position changes.', queueUpdates, setQueueUpdates],
  ]

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-[22px] font-bold text-text-primary">Settings</h1>

      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-1">
        {rows.map(([label, desc, value, setValue]) => (
          <div key={label} className="flex items-center justify-between gap-4 px-4 py-3.5">
            <div>
              <div className="text-[13px] font-medium text-text-primary">{label}</div>
              <div className="text-[11.5px] text-text-secondary">{desc}</div>
            </div>
            <Toggle checked={value} onChange={setValue} />
          </div>
        ))}
      </div>

      <p className="text-[11.5px] text-text-muted">
        Settings are stored locally for this demo session and are not persisted to a backend.
      </p>
    </div>
  )
}
