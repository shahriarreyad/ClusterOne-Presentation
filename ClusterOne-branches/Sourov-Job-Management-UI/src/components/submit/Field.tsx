import type { ReactNode } from 'react'

interface FieldProps {
  label: string
  error?: string
  hint?: string
  children: ReactNode
  required?: boolean
}

export function Field({ label, error, hint, children, required }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12.5px] font-medium text-text-secondary">
        {label}
        {required && <span className="text-status-failed"> *</span>}
      </span>
      {children}
      {hint && !error && <p className="mt-1 text-[11.5px] text-text-muted">{hint}</p>}
      {error && <p className="mt-1 text-[11.5px] font-medium text-status-failed">{error}</p>}
    </label>
  )
}

export const inputClass =
  'w-full rounded-md border border-border bg-bg-secondary px-3 py-2 text-[13.5px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none'
