import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'

export function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
      <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-hover text-text-muted">
        <Compass size={26} />
      </span>
      <h1 className="text-[20px] font-bold text-text-primary">Page Not Found</h1>
      <p className="mt-1 max-w-sm text-[13.5px] text-text-secondary">The page you're looking for doesn't exist or may have been moved.</p>
      <Link to="/dashboard" className="mt-5 rounded-md bg-accent px-4 py-2.5 text-[13.5px] font-semibold text-bg hover:bg-accent/90">
        Back to Dashboard
      </Link>
    </div>
  )
}
