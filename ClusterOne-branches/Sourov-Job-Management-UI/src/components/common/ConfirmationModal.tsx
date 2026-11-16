import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/format'

interface ConfirmationModalProps {
  open: boolean
  title: string
  description: string
  confirmLabel: string
  cancelLabel?: string
  destructive?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmationModal({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4">
      <button aria-label="Dismiss" onClick={onCancel} className="fixed inset-0 bg-black/70 animate-fade-in" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-desc"
        className="relative z-10 w-full max-w-sm animate-fade-in rounded-[var(--radius-card)] border border-border bg-surface-raised p-5 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="confirm-modal-title" className="text-[15px] font-semibold text-text-primary">
            {title}
          </h2>
          <button aria-label="Close" onClick={onCancel} className="rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-primary">
            <X size={16} />
          </button>
        </div>
        <p id="confirm-modal-desc" className="mt-2 text-[13.5px] leading-relaxed text-text-secondary">
          {description}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md border border-border px-3.5 py-2 text-[13px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            onClick={onConfirm}
            disabled={loading}
            className={cn(
              'rounded-md px-3.5 py-2 text-[13px] font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60',
              destructive ? 'bg-status-failed hover:bg-status-failed/90' : 'bg-accent text-bg hover:bg-accent/90',
            )}
          >
            {loading ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
