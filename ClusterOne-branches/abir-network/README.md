# ClusterOne — Pilot Architecture & Build Plan

**Project:** ClusterOne — DIU campus research compute platform
**Phase:** Pilot (12 weeks)
**Owner:** Department of Computer Science & Engineering
**Document status:** Build specification. Everything below is intended to be executed, not discussed.

---

## 0. Pilot definition

### 0.1 What the pilot is

A single-building, Linux-only, always-on cluster of 4–6 GPU nodes plus one anchor node, running Slurm, Apptainer, Open OnDemand and Prometheus/Grafana, serving 20–30 real users for 90 days.

### 0.2 What the pilot is deliberately not

| Excluded | Why | Returns in |
|---|---|---|
| Scavenging / preemption | Solve identity, storage, containers and the portal against stable nodes first. Adding preemption on top of an unproven base means every failure has two possible causes | Phase 2 |
| Windows nodes | No cgroups, no CRIU, GPU containers need WSL2, EDR interferes with job execution. Real work, not a checkbox | Phase 3 |
| Multi-node distributed training | 1 GbE makes two-node NCCL slower than a single GPU. Multi-GPU means within one chassis | When 25 GbE exists |
| Fractional GPU sharing on `gpu` partition | MPS has weaker fault isolation than MIG. Not for long unattended training | `teaching` partition only, from week 9 |
| Hosted inference services | Requires the batch layer to be stable first | Phase 3 |
| ML-based scheduling | No training data exists yet. Bin-packing heuristics beat ML at 6 nodes | Phase 4, if data justifies it |

Writing these down is what keeps the pilot finishable. Every one of them will be requested during the 12 weeks.

### 0.3 Success criteria (pilot exit gate)

All six must be met before Phase 2 is approved:

1. ≥20 active users, ≥300 completed jobs
2. Median queue wait on `gpu` published and under 30 minutes
3. Zero data-loss incidents
4. Control-plane availability ≥99% over the final 30 days
5. Measured kWh-per-completed-job baseline established
6. **A second person rebuilds a compute node from Ansible, from bare metal, without the original builder present, in under 2 hours.** Tested, timed, documented.

Criterion 6 is the one that matters most. A cluster nobody but its author can rebuild is a prototype, not infrastructure.

---

## 1. Architecture

### 1.1 Logical view

```
   Campus network (VLAN 10 — user)
              │
     ┌────────┴────────┐
     │  Users: browser │  no client install, no VPN, no SSH keys to distribute
     └────────┬────────┘
              │ HTTPS 443
   ┌──────────┴───────────────────────────────────────────┐
   │              c1-anchor   (10.20.0.10)                │
   │ ──────────────────────────────────────────────────── │
   │  Open OnDemand      nginx + PUN per user             │
   │  Keycloak / OIDC ──▶ AD (existing DIU directory)     │
   │  slurmctld          scheduler control plane          │
   │  slurmdbd + MariaDB accounting & fairshare           │
   │  Prometheus + Grafana + Alertmanager + Loki          │
   │  NFSv4 server       /home /projects /datasets /opt   │
   │  Apptainer image registry (read-only export)         │
   │  munge key authority                                 │
   │                                                      │
   │  On UPS · nightly backup · Ansible-rebuildable       │
   └──────────┬───────────────────────────────────────────┘
              │  VLAN 20 — compute  10.20.0.0/24
              │  no inbound internet · egress via proxy allowlist
   ┌──────────┼──────────┬──────────┬──────────┬──────────┐
   │          │          │          │          │          │
┌──┴───┐  ┌───┴──┐  ┌────┴─┐  ┌─────┴┐  ┌──────┴┐  ┌──────┴┐
│gpu01 │  │gpu02 │  │gpu03 │  │gpu04 │  │gpu05  │  │gpu06  │
│      │  │      │  │      │  │      │  │teaching│ │teaching│
└──────┘  └──────┘  └──────┘  └──────┘  └───────┘  └───────┘
 partition: gpu (whole cards)            partition: teaching (MPS)
 every node: slurmd · munge · apptainer · dcgm-exporter ·
             node_exporter · promtail · local NVMe /scratch
```

### 1.2 Design decisions and why

| Decision | Rationale |
|---|---|
| **Slurm, not Kubernetes or HTCondor** | Native `gres/gpu`, native MPS, native preemption, native fairshare, native power saving, first-class Open OnDemand integration. It is what academic HPC runs, so students gain a transferable skill and every problem has a published answer. HTCondor is the better scavenging engine and arrives in Phase 3 with the Windows tier — running two batch systems from day one consumes the entire ops budget |
| **Apptainer, not Docker** | Rootless. The Docker daemon runs as root and is a privilege-escalation path in a multi-tenant campus setting. Apptainer images are single files on NFS, which also removes the need for a registry service |
| **NFS + ZFS, not Ceph/BeeGFS** | Below roughly 50 nodes, distributed filesystems cost more in operations than they return in throughput |
| **Anchor node is a purchase, not a repurpose** | Everything depends on it. Running the control plane on a borrowed desktop is how pilots die in month 4 |
| **Prometheus only; no Zabbix** | The two overlap heavily for compute monitoring and doubling the maintenance surface at 6 nodes is not justified. Add Zabbix later only if netops already runs it for SNMP on switches and UPS |
| **AD for POSIX identity, OIDC for web** | Consistent UID/GID across every node is non-negotiable — NFS silently corrupts ownership otherwise |
| **Whole cards on `gpu`, MPS on `teaching`** | MPS gives performance isolation but weaker fault isolation than MIG. Acceptable for 4-hour coursework jobs, not for 20-hour unattended training |

### 1.3 Naming and addressing

| Item | Convention | Example |
|---|---|---|
| Cluster name | `clusterone` | `ClusterName=clusterone` in slurm.conf |
| Hostnames | `c1-<role><NN>` | `c1-anchor`, `c1-gpu01` |
| Compute VLAN | 20 | `10.20.0.0/24` |
| Anchor | `.10` | `10.20.0.10` |
| GPU nodes | `.21`–`.40` | `c1-gpu01 = 10.20.0.21` |
| Portal | | `clusterone.diu.edu.bd` |
| Git | | `diu-cse/clusterone-infra` |

Set `ClusterName=clusterone` before the first job runs — it is written into every accounting record and changing it later orphans your history.

### 1.4 Storage layout

| Mount | Backing | Quota | Backed up | Purpose |
|---|---|---|---|---|
| `/home/<user>` | NFS, NVMe RAID1 | 20 GB | Nightly | Code, notebooks, configs. Never datasets |
| `/projects/<proj>` | NFS, HDD RAIDZ2 | 500 GB | Weekly | Shared project working space |
| `/datasets` | NFS, HDD RAIDZ2, **read-only** | — | No (re-downloadable) | Curated shared datasets |
| `/scratch` | Node-local NVMe | node size | No | Per-job working space. Wiped by epilog |
| `/opt/apptainer` | NFS, read-only | — | Weekly | Container images |

**The single most important storage rule:** no training job reads directly from `/datasets` over NFS. A prolog stages to `/scratch` first. On 1 GbE, four concurrent jobs streaming ImageNet from NFS will saturate the anchor node's uplink and every user will report "the cluster is slow." Enforce this in the job templates from day one.

---

## 2. Hardware

### 2.1 Bill of materials

| # | Item | Spec | Qty | Notes |
|---|---|---|---|---|
| 1 | Anchor node | 1× EPYC or Xeon (16c+), 128 GB ECC, 2× 1 TB NVMe (RAID1), 6× 8 TB HDD (RAIDZ2), dual 10 GbE, redundant PSU | 1 | **Must be purchased.** Do not repurpose |
| 2 | UPS | 3 kVA online, ≥30 min at load | 1 | Anchor + switch only. Do not attempt to UPS compute nodes |
| 3 | Switch | 24-port managed, 4× 10 GbE SFP+, 20× 1 GbE, VLAN + LACP capable | 1 | |
| 4 | Metered PDU | Per-outlet energy reporting, 8 outlets | 2 | Required for the energy baseline. Smart plugs acceptable if PDU is unavailable |
| 5 | Cat6a | Anchor rack to GPU room | as measured | |
| 6 | GPU nodes | Existing hardware | 4–6 | See 2.2 |
| 7 | Spare GPU fund | Budget line | — | Reserve replacement cost for ~10% of pooled cards/year. Shared cards fail more than personal ones |

Items 1–5 are the honest cost of "zero new GPU purchases." Name them in the budget request rather than letting a reviewer find them.

### 2.2 GPU node qualification checklist

A machine joins the pilot only if every box is ticked. Record in the asset register.

- [ ] GPU compute capability ≥ 6.0 (below this, current PyTorch builds will not run)
- [ ] VRAM ≥ 8 GB for `gpu`, ≥ 4 GB for `teaching`
- [ ] ≥ 32 GB system RAM (rule of thumb: ≥ 2× total VRAM)
- [ ] ≥ 500 GB free local NVMe/SSD for `/scratch`
- [ ] 1 GbE minimum, switch port confirmed and documented
- [ ] Wake-on-LAN available in BIOS and enabled (needed in Phase 2; requires a physical visit, so do it now)
- [ ] Room has AC, or overnight thermal log shows sustained load stays under 80 °C
- [ ] Owner has signed the MOU
- [ ] Machine can be reimaged — no irreplaceable local data

### 2.3 OS and driver baseline

Pin these and version-lock them. Mismatched drivers across nodes are the single most common cause of "works on gpu02, fails on gpu04."

| Component | Version |
|---|---|
| OS | Ubuntu 24.04 LTS |
| NVIDIA driver | 550+ (required for `cuda-checkpoint` later; use one version everywhere) |
| CUDA | Provided inside containers, not on the host |
| Slurm | 24.05.x from distro or built once and served from `/opt` |
| Apptainer | 1.3+ |

```bash
# hold the driver so unattended-upgrades cannot break the cluster overnight
apt-mark hold nvidia-driver-550 nvidia-dkms-550 libnvidia-compute-550
```

---

## 3. Configuration reference

Every file below lives in git and is deployed by Ansible. Nothing is edited on a live node.

### 3.1 `slurm.conf` (essentials)

```ini
ClusterName=clusterone
SlurmctldHost=c1-anchor(10.20.0.10)

# --- scheduling ---
SchedulerType=sched/backfill
SelectType=select/cons_tres
SelectTypeParameters=CR_Core_Memory
GresTypes=gpu,mps

# --- isolation ---
ProctrackType=proctrack/cgroup
TaskPlugin=task/cgroup,task/affinity

# --- preemption (config now, activated Phase 2) ---
PreemptType=preempt/partition_prio
PreemptMode=SUSPEND,GANG

# --- fairshare ---
PriorityType=priority/multifactor
PriorityWeightFairshare=100000
PriorityWeightAge=10000
PriorityWeightJobSize=1000
PriorityWeightQOS=50000
PriorityDecayHalfLife=7-0

# --- accounting ---
AccountingStorageType=accounting_storage/slurmdbd
AccountingStorageHost=c1-anchor
AccountingStorageTRES=gres/gpu
JobAcctGatherType=jobacct_gather/cgroup
JobAcctGatherFrequency=30

# --- job lifecycle ---
PrologFlags=Contain,X11
Prolog=/etc/slurm/prolog.d/*
Epilog=/etc/slurm/epilog.d/*
KillWait=30
MaxJobCount=20000

# --- power saving (config now, activated Phase 2) ---
# SuspendProgram=/usr/local/sbin/c1-suspend
# ResumeProgram=/usr/local/sbin/c1-resume
# SuspendTime=1200
# ResumeTimeout=300
# SuspendExcNodes=c1-anchor

# --- nodes ---
NodeName=c1-gpu[01-04] CPUs=16 RealMemory=64000 Gres=gpu:2 State=UNKNOWN
NodeName=c1-gpu[05-06] CPUs=8  RealMemory=32000 Gres=gpu:1,mps:100 State=UNKNOWN

# --- partitions ---
PartitionName=gpu         Nodes=c1-gpu[01-04] Default=YES MaxTime=24:00:00 \
                          PriorityTier=10 DefMemPerCPU=4000 State=UP
PartitionName=interactive Nodes=c1-gpu[01-02] MaxTime=08:00:00 \
                          PriorityTier=20 MaxNodes=1 State=UP
PartitionName=teaching    Nodes=c1-gpu[05-06] MaxTime=04:00:00 \
                          PriorityTier=5 State=UP
```

`interactive` gets the highest priority tier and a short walltime — this is what makes the portal feel responsive. A student opening a Jupyter notebook should not queue behind a 20-hour training run.

### 3.2 `cgroup.conf`

```ini
CgroupPlugin=cgroup/v2
ConstrainCores=yes
ConstrainRAMSpace=yes
ConstrainSwapSpace=yes
ConstrainDevices=yes
```

`ConstrainDevices=yes` is the line that stops a job from seeing GPUs it was not allocated. Without it, `nvidia-smi` inside a job shows every card on the node and users will use them.

### 3.3 `gres.conf`

```ini
# per node type
NodeName=c1-gpu[01-04] Name=gpu Type=rtx4090 File=/dev/nvidia[0-1]
NodeName=c1-gpu[05-06] Name=gpu Type=rtx3060 File=/dev/nvidia0
NodeName=c1-gpu[05-06] Name=mps Count=100   File=/dev/nvidia0
```

### 3.4 Prolog — stage dataset to local scratch

`/etc/slurm/prolog.d/10-scratch`

```bash
#!/bin/bash
set -euo pipefail
SCRATCH="/scratch/${SLURM_JOB_ID}"
mkdir -p "$SCRATCH"
chown "${SLURM_JOB_USER}" "$SCRATCH"
chmod 700 "$SCRATCH"
exit 0
```

`/etc/slurm/prolog.d/20-dataset`

```bash
#!/bin/bash
# Honours --comment=dataset:<name>. Copies once, caches on the node.
set -euo pipefail
DS=$(scontrol show job "$SLURM_JOB_ID" | grep -oP 'Comment=dataset:\K[\w-]+' || true)
[ -z "$DS" ] && exit 0
CACHE="/scratch/_datasets/${DS}"
if [ ! -d "$CACHE" ]; then
  mkdir -p "$CACHE"
  rsync -a --info=progress2 "/datasets/${DS}/" "$CACHE/"
fi
exit 0
```

### 3.5 Epilog — wipe scratch

`/etc/slurm/epilog.d/90-cleanup`

```bash
#!/bin/bash
rm -rf "/scratch/${SLURM_JOB_ID}"
# reset any GPU left in a bad state by a crashed job
nvidia-smi --gpu-reset -i "${CUDA_VISIBLE_DEVICES:-0}" 2>/dev/null || true
exit 0
```

Note: `_datasets` cache is intentionally not wiped — it is the point of the cache. A weekly cron prunes entries older than 30 days.

### 3.6 GPU power cap (systemd)

`/etc/systemd/system/clusterone-gpu-power.service`

```ini
[Unit]
Description=ClusterOne GPU persistence and power cap
After=nvidia-persistenced.service
Wants=nvidia-persistenced.service

[Service]
Type=oneshot
ExecStart=/usr/bin/nvidia-smi -pm 1
ExecStart=/usr/bin/nvidia-smi -pl 300
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
```

Set the `-pl` value from your own benchmark sweep (Section 6.2), not from this document. The value differs per card model.

### 3.7 Ansible repository layout

```
clusterone-infra/
├── inventory/
│   ├── pilot.yml                  # hosts, groups, per-node vars
│   └── group_vars/
│       ├── all.yml
│       ├── gpu_nodes.yml
│       └── anchor.yml
├── roles/
│   ├── common/                    # users, sshd, ntp, apt-hold, ufw
│   ├── identity/                  # sssd → AD, uid/gid consistency
│   ├── nfs_server/                # zfs pools, exports
│   ├── nfs_client/                # autofs mounts
│   ├── munge/                     # key distribution
│   ├── slurm_common/              # slurm.conf, cgroup.conf
│   ├── slurm_controller/          # slurmctld, slurmdbd, mariadb
│   ├── slurm_compute/             # slurmd, prolog/epilog
│   ├── gpu_node/                  # driver hold, persistence, power cap, dcgm
│   ├── apptainer/
│   ├── monitoring_server/         # prometheus, grafana, alertmanager, loki
│   ├── monitoring_agent/          # node_exporter, dcgm-exporter, promtail
│   └── ood_portal/                # open ondemand, apps, oidc
├── playbooks/
│   ├── site.yml
│   ├── anchor.yml
│   ├── compute.yml
│   └── rebuild-node.yml           # used for the criterion-6 drill
└── docs/
    ├── runbooks/                  # one page per Alertmanager rule
    └── user-guide/
```

**Rule: if it is not in this repository, it does not exist.** A setting applied by hand on a live node will be silently reverted by the next playbook run, and will not survive the rebuild drill.

---

## 4. Twelve-week build schedule

### Weeks 1–3 — Measure and prepare (build nothing)

This replaces every estimated number in the leadership deck with a measured one. It is also the Ansible bootstrap, so it is not lost time.

| Week | Actions | Deliverable |
|---|---|---|
| 1 | Create git repo. Confirm faculty sponsor in writing. Walk candidate labs; complete asset register (Section 2.2 checklist per machine). Enable Wake-on-LAN in BIOS while physically present. Request a recent electricity invoice from finance | Asset register; DIU's actual billed kWh rate |
| 2 | Write `common` + `monitoring_agent` Ansible roles. Stand up temporary Prometheus/Grafana. Deploy `node_exporter` + `dcgm-exporter` to all candidates — **read-only observation, no scheduler**. Install metered PDUs | Telemetry flowing from ≥10 machines |
| 3 | `iperf3` between candidate rooms; record real throughput. Log overnight GPU temperatures with AC off. Demand survey: which groups want compute, what they run, what they do today. Draft Owner MOU, circulate to one friendly lab head | Network map; thermal go/no-go per room; named first users |

**Gate:** present measured idle GPU-hours/week, measured power draw, measured throughput, and a named user list. Do not proceed without a named faculty sponsor and a named sysadmin.

### Weeks 4–6 — Foundation

| Week | Actions | Verification |
|---|---|---|
| 4 | Anchor node racked, UPS wired, VLAN 20 configured on switch. Ubuntu 24.04 installed. ZFS pools created. Ansible inventory written | `zpool status` clean; anchor reachable on both VLANs |
| 5 | `identity` role: SSSD joined to AD. `nfs_server` + `nfs_client` roles. Mount `/home` on anchor and one compute node | **Same UID/GID for the same user on both machines.** Verify with `id <user>` on each. This is the check that prevents months of NFS permission problems |
| 6 | `munge`, `slurm_common`, `slurm_controller`. MariaDB + slurmdbd. First compute node joins | `sinfo` shows one idle node; `srun -p gpu --gres=gpu:1 nvidia-smi` succeeds |

### Weeks 7–9 — Cluster

| Week | Actions | Verification |
|---|---|---|
| 7 | `gpu_node` role: driver hold, persistence mode, DCGM, power cap unit. `apptainer` role. Build base images: `pytorch`, `tensorflow`, `cuda-base`. Publish to `/opt/apptainer/images` | `apptainer exec --nv pytorch.sif python -c "import torch; print(torch.cuda.is_available())"` returns True inside a Slurm allocation |
| 8 | Remaining nodes added. `gres.conf` + `cgroup.conf` deployed. Prolog/epilog installed. Walltime enforcement tested. MPS enabled on `teaching` | A 2-GPU job cannot see the third card (`ConstrainDevices` working). A job exceeding walltime is killed cleanly. `/scratch` wiped after job exit |
| 9 | `monitoring_server` role: Prometheus, Grafana, Alertmanager, Loki. Wall dashboard built. Alert rules + one runbook page per rule | Pull a network cable; node-down alert fires within 2 min and the runbook resolves it |

### Weeks 10–12 — Users

| Week | Actions | Verification |
|---|---|---|
| 10 | `ood_portal` role. Open OnDemand with OIDC. Jupyter, VS Code Server, shell, file browser apps configured | A user with no SSH key, on a Windows laptop, reaches a GPU Jupyter kernel through a browser in under 3 minutes |
| 11 | Job template library published. User documentation site live. Onboard first 10 users with a hands-on session | 10 users have each submitted a real job |
| 12 | Onboard to 20–30 users. **Run the rebuild drill** (criterion 6). Baseline all KPIs. Write the Phase 2 proposal from real data | Node rebuilt from bare metal by the second operator, timed, under 2 hours |

---

## 5. Security and governance

### 5.1 Controls

| Layer | Control |
|---|---|
| Network | Compute VLAN 20, isolated from staff VLAN. No inbound internet to compute nodes |
| Egress | Proxy allowlist: PyPI, conda, Hugging Face Hub, GitHub, Ubuntu/NVIDIA repos. **This is the single control that blocks both crypto mining and botnet participation** |
| Node admission | Admin-approved certificate before any node joins. Munge keys distributed by Ansible, rotated annually |
| Job isolation | Apptainer rootless, no `--writable`. cgroup v2 limits on CPU/RAM/devices |
| Filesystem | `/datasets` read-only bind. `/scratch` per-job, mode 700, wiped by epilog. POSIX ACLs on `/projects` |
| Access | No SSH to compute nodes except through a Slurm allocation (`pam_slurm_adopt`) |
| Secrets | Ansible Vault. No credentials in git plaintext |

### 5.2 Documents to write in weeks 4–8

These take longer than expected and are as load-bearing as the software.

1. **Acceptable Use Policy** — no cryptocurrency mining, no password cracking, no personal commercial work, no attempts to access other users' jobs or data. Signed at account creation.
2. **Data Classification Policy** — no student records, no HR data, no unanonymised human-subject data, no PII on ClusterOne. A project needing those does not run here.
3. **Owner MOU** — reclaim guarantee and measured latency, fairshare credit received, damage and warranty terms, opt-out procedure and notice period, support commitments.
4. **Incident Response Runbook** — compromised node, suspected data exposure, hardware failure. Who to call, in what order.
5. **Service Description** — what ClusterOne promises, in measurable terms: 99% control-plane availability, job durability via checkpointing, published median queue wait. Not a 99.98% figure.

---

## 6. Energy

### 6.1 Framing

ClusterOne **increases** total campus electricity consumption. Machines that were idle now run under load. Presenting this as an energy-saving initiative will not survive contact with the facilities office.

Report these metrics instead:

- **kWh per completed job** (falls sharply with consolidation and power capping)
- **Useful GPU-hours per kWh** (rises)
- Avoided embodied carbon from GPUs not purchased
- Avoided cloud spend

Efficiency of energy use, not reduction of it. Both true and still compelling.

### 6.2 Power cap benchmark sweep (week 7)

The largest single efficiency lever, and it is one command. Do the sweep on your own cards; the knee of the curve differs per model.

```bash
for PL in 450 400 350 300 250; do
  nvidia-smi -pl $PL
  sleep 5
  sbatch --wait --partition=gpu --gres=gpu:1 \
         --job-name="pl-$PL" bench/resnet50_train.sbatch
  echo "=== $PL W ==="; sacct -j $SLURM_JOB_ID --format=Elapsed,ConsumedEnergy
done
```

Pick the highest power reduction that costs under 10% throughput. Typical result on a 450 W card is a cap near 300–320 W. Commit the chosen value to `roles/gpu_node/defaults/main.yml`.

### 6.3 Pilot energy baseline

Record from the metered PDUs, for the whole 12 weeks:

| Measurement | Purpose |
|---|---|
| Node idle W, load W, suspended W | Phase 2 power-saving business case |
| Cooling multiplier (room AC draw ÷ IT draw) | Real Dhaka figure; the 1.35 rule of thumb is a placeholder |
| Total cluster kWh/month | Denominator for kWh-per-job |
| Overnight GPU temperature with AC off | Decides which rooms qualify for Phase 2 scavenging |

Cost formula for the leadership deck, using DIU's billed rate (the June 2026 BERC education-institution tariff is Tk 9.05/kWh; confirm against an actual invoice):

```
Annual cost = kWh_measured_per_month × 12 × cooling_multiplier × tariff
```

Publish this number before anyone else discovers it. A project that has costed its own electricity is credible.

---

## 7. Monitoring and alerting

### 7.1 Dashboards

| Dashboard | Audience | Contents |
|---|---|---|
| Wall board | Public, on a screen in the department | Nodes up/down, GPU utilisation heatmap, jobs running/queued, users active today, cluster kWh today |
| Operations | Ops team | Per-node CPU/RAM/GPU/temp/power, NFS throughput, slurmctld health, disk capacity, alert status |
| My jobs | Per user, via portal | Their queue position, running jobs, GPU utilisation of their jobs, fairshare standing |

The wall board is not decoration. It is the single most effective tool for recruiting users and for demonstrating value to leadership without writing a report.

### 7.2 Alert rules — each needs a runbook page

| Alert | Condition | Severity |
|---|---|---|
| NodeDown | `up == 0` for 2 min | Critical |
| SlurmctldDown | slurmctld unreachable 1 min | Critical |
| GPUOverTemp | `DCGM_FI_DEV_GPU_TEMP > 85` for 5 min | Critical — auto-drain node |
| GPUTempWarning | `> 80` for 10 min | Warning |
| GPUEccError | `DCGM_FI_DEV_ECC_DBE_VOL_TOTAL` increases | Critical — drain, do not reallocate |
| GPUXidError | Any XID in DCGM | Warning |
| DiskFull | any filesystem > 85% | Warning |
| ScratchFull | `/scratch` > 90% | Warning |
| NFSLatencyHigh | p99 > 100 ms for 10 min | Warning |
| QueueStalled | jobs pending > 4 h with idle nodes | Warning — scheduler misconfiguration |
| GPUIdleWhileAllocated | `DCGM_FI_DEV_GPU_UTIL < 5%` for 30 min on an allocated card | Info — someone is holding a card without using it |

The last one is the CostCut idea implemented as a Prometheus rule rather than a custom service. Start with a notification to the user; automate reclamation only after seeing the false-positive rate.

---

## 8. User-facing job template

Publish this in the docs site and pre-load it in the portal. It encodes the storage rule and the checkpointing habit before Phase 2 makes both mandatory.

```bash
#!/bin/bash
#SBATCH --job-name=train
#SBATCH --partition=gpu
#SBATCH --gres=gpu:1
#SBATCH --cpus-per-task=8
#SBATCH --mem=32G
#SBATCH --time=12:00:00
#SBATCH --comment=dataset:imagenet-mini      # prolog stages this to /scratch
#SBATCH --output=%x-%j.out
#SBATCH --signal=B:USR1@300                  # 5 min warning before walltime

CKPT="/projects/${SLURM_JOB_ACCOUNT}/checkpoints/${SLURM_JOB_NAME}"
mkdir -p "$CKPT"

apptainer exec --nv \
  --bind /scratch/_datasets:/data:ro \
  --bind "$CKPT":/ckpt \
  /opt/apptainer/images/pytorch.sif \
  python train.py \
    --data /data/imagenet-mini \
    --checkpoint-dir /ckpt \
    --resume-if-exists \
    --save-every 600
```

Two habits taught here: read from `/scratch`, never NFS; and `--resume-if-exists` with periodic saves. When preemption arrives in Phase 2, jobs written this way survive it with no change.

---

## 9. Team and continuity

| Role | Commitment | Responsibility |
|---|---|---|
| Faculty sponsor | Accountable | Budget, policy, leadership interface |
| Systems administrator | 0.5–1.0 FTE, **salaried staff** | Anchor node, Slurm, storage, security |
| Student operators | 2–3, stipended, rotating | Tier-1 support, monitoring, onboarding, docs |
| User support | Rotating faculty | Helping researchers get jobs running |

**If a salaried sysadmin post cannot be funded, run the pilot as specified and stop there.** The pilot's always-on, no-scavenging scope is deliberately survivable by a small team. Phase 2 scavenging is what generates continuous operational load, and starting it without staff support is how these projects die.

### Continuity rules

1. Everything in git — playbooks, Slurm config, Grafana dashboards as JSON, container definitions, docs.
2. **Bus factor 1 is a blocker.** No component ships until a second person has independently operated it.
3. Quarterly rebuild drill, timed. If it fails, the docs are wrong.
4. Written handover at the end of every student operator's term, two-week overlap.
5. Every alert links to a runbook. No alert without a documented response.

---

## 10. Pilot KPIs

Baseline in weeks 1–3, publish monthly on the wall board.

| Metric | Source | Pilot target |
|---|---|---|
| Active monthly users | Slurm accounting | ≥20 |
| Completed jobs | `sacct` | ≥300 |
| Median queue wait, `gpu` | `sacct` | <30 min |
| p95 portal login → running kernel | OOD logs | <3 min |
| Mean GPU utilisation while allocated | DCGM | >60% |
| Control-plane availability | Prometheus | ≥99% |
| Data-loss incidents | Incident log | 0 |
| kWh per completed job | PDU + `sacct` | Baseline established |
| Node rebuild time, second operator | Drill | <2 h |

---

## 11. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Sysadmin post not funded | Medium | Critical | Run pilot as scoped; do not start Phase 2 |
| Anchor node failure | Medium | Critical | UPS, nightly backup, Ansible rebuild, backup slurmctld in Phase 2 |
| Grid outage / generator cost | High | Medium | Anchor on UPS; compute jobs checkpoint; pause non-urgent compute during generator operation |
| Overnight thermal failure | High | Medium | Week-3 thermal log gates room eligibility; auto-drain at 85 °C |
| Lab owners refuse to join | High | High | Opt-in only, MOU, fairshare credit. Start with one enthusiastic lab and publicise its results |
| Driver version drift across nodes | High | Medium | `apt-mark hold`; version asserted by Ansible on every run |
| NFS bandwidth saturation | High | Medium | Stage-to-scratch enforced by prolog and job templates |
| Scope creep (Windows, scavenging, inference requested mid-pilot) | Very high | High | Section 0.2 exclusions agreed in writing with the sponsor before week 1 |
| Student-built components abandoned | High | High | Section 9 continuity rules; prefer upstream tools over custom code everywhere |
| Security incident from student code | Medium | High | Apptainer isolation, egress allowlist, compute VLAN, AUP |

---

## 12. What comes after the pilot

Named here so the pilot has a visible trajectory, not planned in detail until the exit gate is passed.

**Phase 2 (months 4–6) — Scavenging and scale.** Owner-reclaim daemon with measured p95 latency; `scavenge` partition with `PreemptMode=SUSPEND`; per-lab time windows from occupancy data; Slurm power saving with Wake-on-LAN; checkpoint policy enforced at submission; dataset storage tier; backup slurmctld; fairshare credit for hardware owners.

**Phase 3 (months 7–12) — Breadth.** Windows nodes via HTCondor, if the measured Windows GPU capacity justifies a second batch system; hosted inference (vLLM/Ollama) behind the portal — this is what makes the "replace external subscriptions" claim true rather than aspirational; `cuda-checkpoint` evaluation as an experiment, with its limitations documented (x64 only, single process, no UVM/IPC memory); monthly usage and energy reporting.

**Phase 4 (year 2) — Institutional.** Custom models on DIU data, after a data governance review. Published case study, backed by twelve months of operating data. Partner university access, which needs a legal framework rather than a VPN.

---

## Appendix — Week 1 checklist

Nothing here requires budget approval.

- [ ] Register `diu-cse/clusterone-infra`; commit this document
- [ ] Confirm faculty sponsor in writing
- [ ] Confirm named sysadmin, or escalate the funding question now
- [ ] Create asset register spreadsheet with the Section 2.2 columns
- [ ] Walk top 5 candidate labs; complete the qualification checklist per machine
- [ ] Enable Wake-on-LAN in BIOS on every candidate while physically present
- [ ] Request recent electricity invoice from finance
- [ ] Reserve `clusterone.diu.edu.bd` with IT
- [ ] Request VLAN 20 and switch ports from netops
- [ ] Draft Owner MOU; circulate to one friendly lab head
- [ ] Agree the Section 0.2 exclusion list with the sponsor, in writing
