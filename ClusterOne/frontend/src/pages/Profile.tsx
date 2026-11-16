import { useRef, useState } from 'react'
import { Mail, Phone, MapPin, Building2, ListChecks, Clock3, Cpu, Camera, Trash2, Pencil, LogOut, CalendarDays } from 'lucide-react'
import { useUser } from '@/context/UserContext'
import { useLogout } from '@/hooks/useLogout'
import { StatCard } from '@/components/common/StatCard'
import { DemoDataBadge } from '@/components/common/States'
import { ConfirmationModal } from '@/components/common/ConfirmationModal'
import { inputClass } from '@/components/submit/Field'
import { formatDateTime } from '@/lib/format'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024 // 5 MB

function initials(name: string): string {
  return name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
}

export function Profile() {
  const { profile, updateProfile, setAvatar } = useUser()
  const { confirmOpen, requestLogout, cancelLogout, confirmLogout } = useLogout()

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState({ name: profile.name, phone: profile.phone, location: profile.location, bio: profile.bio })
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const startEditing = () => {
    setDraft({ name: profile.name, phone: profile.phone, location: profile.location, bio: profile.bio })
    setEditing(true)
  }

  const saveEditing = () => {
    updateProfile({
      name: draft.name.trim() || profile.name,
      phone: draft.phone.trim(),
      location: draft.location.trim(),
      bio: draft.bio.trim(),
    })
    setEditing(false)
  }

  const handleAvatarPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAvatarError(null)
    if (!file.type.startsWith('image/')) {
      setAvatarError('Please choose an image file (PNG, JPG, etc.).')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setAvatarError('Image is too large — please choose one under 5 MB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setAvatar(reader.result as string)
    reader.onerror = () => setAvatarError('Could not read that image — please try another file.')
    reader.readAsDataURL(file)
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h1 className="text-[22px] font-bold text-text-primary">Profile</h1>
          <DemoDataBadge />
        </div>
        <button
          onClick={requestLogout}
          className="flex items-center gap-1.5 rounded-md border border-status-failed/40 px-3 py-2 text-[12.5px] font-medium text-status-failed transition-colors hover:bg-status-failed-soft"
        >
          <LogOut size={14} />
          Log Out
        </button>
      </div>

      {/* Identity card */}
      <div className="rounded-[var(--radius-card)] border border-border bg-surface p-5">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            {profile.avatarUrl ? (
              <img src={profile.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-distributed-soft text-[20px] font-bold text-distributed">
                {initials(profile.name)}
              </span>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              aria-label="Change profile picture"
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-surface bg-accent text-bg hover:bg-accent/90"
            >
              <Camera size={12} />
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarPick} className="hidden" />
          </div>

          <div className="min-w-0 flex-1">
            {!editing ? (
              <>
                <div className="text-[16px] font-semibold text-text-primary">{profile.name}</div>
                <div className="mt-0.5 flex items-center gap-1.5 text-[12.5px] text-text-secondary">
                  <Building2 size={12} />
                  {profile.role} · {profile.department}
                </div>
                {profile.bio && <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">{profile.bio}</p>}
              </>
            ) : (
              <div className="space-y-2">
                <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="Full name" className={inputClass} />
                <textarea
                  value={draft.bio}
                  onChange={(e) => setDraft((d) => ({ ...d, bio: e.target.value.slice(0, 160) }))}
                  placeholder="Short bio"
                  rows={2}
                  className={`${inputClass} resize-none`}
                />
              </div>
            )}
          </div>

          {!editing && (
            <button
              onClick={startEditing}
              className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary"
            >
              <Pencil size={12} />
              Edit Profile
            </button>
          )}
        </div>

        {avatarError && <p className="mt-3 text-[11.5px] font-medium text-status-failed">{avatarError}</p>}

        {profile.avatarUrl && !editing && (
          <button onClick={() => setAvatar(null)} className="mt-3 flex items-center gap-1.5 text-[11.5px] font-medium text-text-muted hover:text-status-failed">
            <Trash2 size={12} />
            Remove photo
          </button>
        )}

        {/* Full information */}
        <div className="mt-5 grid grid-cols-1 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-2">
          <InfoField icon={Mail} label="Email" value={profile.email} readOnlyNote="Managed by admin" />
          {editing ? (
            <EditableField icon={Phone} label="Phone" value={draft.phone} onChange={(v) => setDraft((d) => ({ ...d, phone: v }))} />
          ) : (
            <InfoField icon={Phone} label="Phone" value={profile.phone} />
          )}
          {editing ? (
            <EditableField icon={MapPin} label="Location" value={draft.location} onChange={(v) => setDraft((d) => ({ ...d, location: v }))} />
          ) : (
            <InfoField icon={MapPin} label="Location" value={profile.location} />
          )}
          <InfoField icon={CalendarDays} label="Member Since" value={formatDateTime(profile.memberSince)} />
        </div>

        {editing && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
            <p className="text-[11px] text-text-muted">Saved to this browser only — no account backend is connected yet.</p>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-md border border-border px-3 py-1.5 text-[12.5px] font-medium text-text-secondary hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button onClick={saveEditing} className="rounded-md bg-accent px-3 py-1.5 text-[12.5px] font-semibold text-bg hover:bg-accent/90">
                Save Changes
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Jobs Submitted" value={profile.jobsSubmitted} icon={ListChecks} />
        <StatCard label="Compute Time" value={`${profile.computeHours}h`} icon={Clock3} tone="info" />
        <StatCard label="GPU Time" value={`${profile.gpuHours}h`} icon={Cpu} tone="success" />
      </div>

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

function InfoField({ icon: Icon, label, value, readOnlyNote }: { icon: typeof Mail; label: string; value: string; readOnlyNote?: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        <Icon size={11} />
        {label}
      </div>
      <div className="tabular mt-0.5 text-[13px] text-text-primary">{value || '—'}</div>
      {readOnlyNote && <div className="text-[10.5px] text-text-muted">{readOnlyNote}</div>}
    </div>
  )
}

function EditableField({
  icon: Icon,
  label,
  value,
  onChange,
}: {
  icon: typeof Mail
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-text-muted">
        <Icon size={11} />
        {label}
      </div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-1 py-1.5 text-[13px]`} />
    </label>
  )
}
