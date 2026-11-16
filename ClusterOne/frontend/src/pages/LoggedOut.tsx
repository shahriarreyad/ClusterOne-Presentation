import { Link } from 'react-router-dom'
import { Layers3, LogIn } from 'lucide-react'

export function LoggedOut() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg px-4 text-center">
      <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <Layers3 size={22} />
      </span>
      <h1 className="text-[19px] font-bold text-text-primary">You've been logged out</h1>
      <p className="mt-1.5 max-w-xs text-[13.5px] text-text-secondary">
        Your ClusterOne session has ended. Sign back in to get back to your jobs and dashboard.
      </p>
      <Link
        to="/dashboard"
        className="mt-6 flex items-center gap-1.5 rounded-md bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-bg transition-colors hover:bg-accent/90"
      >
        <LogIn size={15} />
        Log Back In
      </Link>
      <p className="mt-4 text-[11px] text-text-muted">This demo has no real authentication backend, so logging back in simply returns you to the dashboard.</p>
    </div>
  )
}
