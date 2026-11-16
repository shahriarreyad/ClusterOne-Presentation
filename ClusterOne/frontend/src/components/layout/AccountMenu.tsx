import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserCircle, Settings, LogOut } from 'lucide-react'
import { useUser } from '@/context/UserContext'
import { useLogout } from '@/hooks/useLogout'
import { ConfirmationModal } from '@/components/common/ConfirmationModal'

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export function AccountMenu() {
  const { profile } = useUser()
  const { confirmOpen, requestLogout, cancelLogout, confirmLogout } = useLogout()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full p-0.5 hover:ring-2 hover:ring-border-strong"
      >
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
        ) : (
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-distributed-soft text-[12px] font-bold text-distributed">
            {initials(profile.name)}
          </span>
        )}
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-11 z-20 w-56 animate-fade-in overflow-hidden rounded-md border border-border bg-surface-raised py-1 shadow-xl">
          <div className="border-b border-border px-3.5 py-3">
            <div className="truncate text-[13px] font-semibold text-text-primary">{profile.name}</div>
            <div className="truncate text-[11.5px] text-text-muted">{profile.email}</div>
          </div>
          <Link
            to="/account/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <UserCircle size={14} />
            Profile
          </Link>
          <Link
            to="/account/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2 text-[12.5px] text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
          >
            <Settings size={14} />
            Settings
          </Link>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false)
              requestLogout()
            }}
            className="flex w-full items-center gap-2.5 border-t border-border px-3.5 py-2 text-left text-[12.5px] text-status-failed transition-colors hover:bg-status-failed-soft"
          >
            <LogOut size={14} />
            Log Out
          </button>
        </div>
      )}

      <ConfirmationModal
        open={confirmOpen}
        title="Log out of ClusterOne?"
        description="You'll need to sign back in to view your jobs and dashboard."
        confirmLabel="Log Out"
        cancelLabel="Stay Signed In"
        destructive
        onConfirm={confirmLogout}
        onCancel={cancelLogout}
      />
    </div>
  )
}
