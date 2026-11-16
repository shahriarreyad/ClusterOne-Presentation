export function AdminPoliciesPage() {
  const policies = [
    {
      name: 'GPU Allocation Quota',
      target: 'Individual User',
      rule: 'Max 2 Concurrent GPUs (Default Tier)',
      desc: 'Users can burst up to 4 GPUs with advisor or admin approval during thesis deadlines.',
    },
    {
      name: 'Walltime Ceilings',
      target: 'gpu Partition',
      rule: '72 Hours Maximum Continuous Walltime',
      desc: 'Jobs exceeding 72h are automatically checkpointed and stopped to prevent cluster starvation.',
    },
    {
      name: 'Idle Node Auto-Reclaim',
      target: 'Interactive Partition',
      rule: '30 Minutes Zero-GPU Activity Timeout',
      desc: 'Interactive Jupyter or terminal sessions with 0% GPU activity for 30 minutes are preempted.',
    },
    {
      name: 'Fair-Share Scheduler Decay',
      target: 'Slurm Multi-Factor',
      rule: 'Half-Life Decay = 7 Days',
      desc: 'Historical GPU hour usage decays over 7 days to grant fair turnaround to infrequent users.',
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-bold text-text-primary">Cluster Scheduling Policies & QoS</h1>
        <p className="text-[13.5px] text-text-secondary">
          Quality of Service (QoS) rules, compute quotas, and fair-share scheduling decay formulas.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {policies.map((p) => (
          <div key={p.name} className="rounded-[var(--radius-card)] border border-border bg-surface p-4.5 space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-[14.5px] text-text-primary">{p.name}</h3>
              <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-accent">
                {p.target}
              </span>
            </div>
            <div className="rounded bg-bg-secondary p-2 font-mono text-[12px] font-bold text-text-primary">
              {p.rule}
            </div>
            <p className="text-[12.5px] text-text-secondary leading-relaxed pt-1">{p.desc}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
