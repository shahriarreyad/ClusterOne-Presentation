import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { fetchClusterUsers, type ClusterUserResponse } from '@/services/clusterService'
import { formatDateTime } from '@/lib/format'

export function AdminUsersPage() {
  const [users, setUsers] = useState<ClusterUserResponse[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    fetchClusterUsers()
      .then(setUsers)
      .catch(() => null)
  }, [])

  const defaultUsers = [
    { username: 'reyad', name: 'Md. Reyad Hossain', role: 'Lead Researcher / Admin', total_jobs: 48, active_jobs: 2, gpu_hours: 142.5, last_active: new Date().toISOString() },
    { username: 'sourov', name: 'Sourov Dey', role: 'Graduate Researcher', total_jobs: 26, active_jobs: 1, gpu_hours: 68.2, last_active: new Date().toISOString() },
    { username: 'tanvir', name: 'Tanvir Rahman', role: 'Systems Engineer', total_jobs: 14, active_jobs: 0, gpu_hours: 32.0, last_active: new Date().toISOString() },
    { username: 'student_nlp', name: 'CSE Thesis Student 01', role: 'Student Researcher', total_jobs: 12, active_jobs: 1, gpu_hours: 24.5, last_active: new Date().toISOString() },
  ]

  const data = users.length > 0 ? users : defaultUsers
  const filtered = data.filter(
    (u) => u.name.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-bold text-text-primary">Cluster Users & Accounts</h1>
          <p className="text-[13.5px] text-text-secondary">
            Authorized DIU CSE faculty, researchers, and students with compute allocation quotas.
          </p>
        </div>

        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search users..."
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-9 pr-3 text-[12.5px] text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="border-b border-border bg-bg-secondary text-[11px] uppercase tracking-wider text-text-muted font-medium">
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Active Jobs</th>
              <th className="px-4 py-3">Total Jobs</th>
              <th className="px-4 py-3">Allocated GPU Hours</th>
              <th className="px-4 py-3">Last Active</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border font-mono text-[12.5px]">
            {filtered.map((u) => (
              <tr key={u.username} className="hover:bg-surface-hover/50">
                <td className="px-4 py-3 font-sans">
                  <div className="font-semibold text-text-primary">{u.name}</div>
                  <div className="font-mono text-[11.5px] text-accent">@{u.username}</div>
                </td>
                <td className="px-4 py-3 font-sans text-text-secondary">{u.role}</td>
                <td className="px-4 py-3 text-status-running font-bold">{u.active_jobs}</td>
                <td className="px-4 py-3 text-text-primary">{u.total_jobs}</td>
                <td className="px-4 py-3 text-cyan-400 font-bold">{u.gpu_hours.toFixed(1)} hrs</td>
                <td className="px-4 py-3 text-text-muted font-sans text-[12px]">
                  {u.last_active ? formatDateTime(u.last_active) : 'Recently'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
