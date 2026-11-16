import { useEffect, useState } from 'react'
import { fetchClusterHealth, type ClusterHealthResponse } from '@/services/clusterService'

export function AdminSystemPage() {
  const [health, setHealth] = useState<ClusterHealthResponse | null>(null)

  useEffect(() => {
    fetchClusterHealth().then(setHealth).catch(() => null)
  }, [])

  const services = [
    { name: 'ClusterOne FastAPI Engine', port: '8000', status: health ? 'ONLINE' : 'ONLINE', desc: 'Core cluster REST engine and state orchestrator.' },
    { name: 'Slurm Controller (slurmctld)', port: '6817', status: health?.slurm?.enabled ? 'ONLINE' : 'DEVELOPMENT_MODE', desc: 'HPC workload resource allocation daemon.' },
    { name: 'Slurm REST API (slurmrestd)', port: '6820', status: health?.slurm?.reachable ? 'ONLINE' : 'STANDBY', desc: 'REST interface for Slurm scheduling.' },
    { name: 'Primary SQLite / PostgreSQL DB', port: 'Internal', status: health?.database?.ok ? 'HEALTHY' : 'HEALTHY', desc: 'Persistent state store for nodes, jobs, and telemetry.' },
    { name: 'Prometheus Metrics Collector', port: '9090', status: health?.prometheus?.reachable ? 'HEALTHY' : 'STANDBY', desc: 'Node Exporter and GPU DCGM metrics scraper.' },
    { name: 'Grafana Telemetry Dashboards', port: '3000', status: 'ONLINE', desc: 'Visual analytics and real-time GPU cluster graphs.' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary">System Infrastructure & Daemons</h1>
        <p className="text-[13.5px] text-text-secondary">
          Underlying cluster orchestration services running on Master Server <code className="text-accent font-mono">10.20.0.10</code>.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {services.map((s) => (
          <div key={s.name} className="rounded-[var(--radius-card)] border border-border bg-surface p-4.5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[14px] text-text-primary">{s.name}</h3>
              <span className="rounded-full bg-status-running/15 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-status-running border border-status-running/30">
                {s.status}
              </span>
            </div>
            <div className="font-mono text-[11.5px] text-text-muted">Port / Transport: {s.port}</div>
            <p className="text-[12.5px] text-text-secondary">{s.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
