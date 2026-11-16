import { useState } from 'react'
import { getAuthToken, setAuthToken } from '@/services/api'

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

function ApiKeyCard() {
  const [value, setValue] = useState(getAuthToken() ?? '')
  const [saved, setSaved] = useState(false)

  return (
    <div className="rounded-[var(--radius-card)] border border-border bg-surface p-4">
      <div className="text-[13px] font-medium text-text-primary">Controller API key</div>
      <p className="mt-0.5 text-[11.5px] text-text-secondary">
        Only needed if the ClusterOne controller was started with <code>CLUSTERONE_API_KEY</code>. It is kept in this browser only
        and sent with each request.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setSaved(false)
          }}
          placeholder="paste the key"
          className="min-w-0 flex-1 rounded-md border border-border bg-bg-secondary px-3 py-2 font-mono text-[12.5px] text-text-primary"
        />
        <button
          onClick={() => {
            setAuthToken(value.trim() || null)
            setSaved(true)
          }}
          className="rounded-md border border-accent/50 bg-accent/10 px-3.5 py-2 text-[12.5px] font-semibold text-accent"
        >
          Save
        </button>
      </div>
      {saved && <p className="mt-2 text-[11.5px] text-status-running">{value.trim() ? 'Saved. Reload the page to use it.' : 'Key removed.'}</p>}
    </div>
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

      <ApiKeyCard />

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
