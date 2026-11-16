# ClusterOne — Installation & Deployment Guide



*Version 1.0*

| **Field** | **Detail** |
| --- | --- |
| Document | Installation & Deployment Guide |
| Project | ClusterOne — Distributed GPU Cluster Computing Platform |
| Audience | Systems administrator and student operators |
| Traces to | SRS FR-11, NFR-6 |
| Status | Draft — Pilot / Phase 1 |

# 0. How to Use This Guide

This guide is written to be followed by a person who did not build the cluster. That is not a stylistic preference: the pilot exit criterion is that a second operator rebuilds a compute node from bare metal, without the original builder present, in under two hours. If a step here cannot be followed without asking the author a question, the step is defective and must be corrected.

**The governing rule: nothing is configured by hand on a live node.** Every change is made in the Ansible repository, committed, and applied by a playbook run. A setting applied by hand will be silently reverted by the next playbook run and will not survive the rebuild drill.

# 1. Prerequisites

## 1.1 Before starting

| Prerequisite | Verify |
| --- | --- |
| Faculty sponsor confirmed in writing | Email on file |
| Named systems administrator | Post funded, person identified |
| Anchor node procured and racked | Physically present, powered, on UPS |
| VLAN 20 configured on the switch | Netops ticket closed |
| `clusterone.diu.edu.bd` reserved | Resolves to the anchor's VLAN 10 address |
| AD service account for SSSD bind | Credentials issued, stored in Ansible Vault |
| Candidate GPU nodes qualified | Checklist complete in the GPU/Hardware Inventory document; MOU signed |
| Git repository created | `diu-cse/clusterone-infra` |

## 1.2 Control machine

Deployment is driven from an Ansible control machine — the administrator's workstation or a dedicated management VM. It requires:

```bash
sudo apt update
sudo apt install -y ansible git python3-pip
ansible --version    # 2.16 or later
git clone git@github.com:diu-cse/clusterone-infra.git
cd clusterone-infra
```

The Ansible Vault password is held by the systems administrator and the faculty sponsor. Two people must be able to run a deployment; this is part of the bus-factor rule.

# 2. Repository Layout

```
clusterone-infra/
├── inventory/
│   ├── pilot.yml                  hosts, groups, per-node vars
│   └── group_vars/
│       ├── all.yml
│       ├── gpu_nodes.yml
│       └── anchor.yml
├── roles/
│   ├── common/                    users, sshd, ntp, apt-hold, ufw
│   ├── identity/                  sssd -> AD, uid/gid consistency
│   ├── nfs_server/                zfs pools, exports
│   ├── nfs_client/                autofs mounts
│   ├── munge/                     key distribution
│   ├── slurm_common/              slurm.conf, cgroup.conf
│   ├── slurm_controller/          slurmctld, slurmdbd, mariadb
│   ├── slurm_compute/             slurmd, prolog/epilog
│   ├── gpu_node/                  driver hold, persistence, power cap, dcgm
│   ├── apptainer/
│   ├── monitoring_server/         prometheus, grafana, alertmanager, loki
│   ├── monitoring_agent/          node_exporter, dcgm-exporter, promtail
│   └── ood_portal/                open ondemand, apps, oidc
├── playbooks/
│   ├── site.yml                   everything
│   ├── anchor.yml                 control plane only
│   ├── compute.yml                compute nodes only
│   └── rebuild-node.yml           the criterion-6 drill
└── docs/
    ├── runbooks/                  one page per Alertmanager rule
    └── user-guide/
```

# 3. Inventory

`inventory/pilot.yml`:

```yaml
all:
  children:
    anchor:
      hosts:
        c1-anchor:
          ansible_host: 10.20.0.10
    gpu_nodes:
      children:
        gpu_partition:
          hosts:
            c1-gpu01: { ansible_host: 10.20.0.21, gpu_count: 2 }
            c1-gpu02: { ansible_host: 10.20.0.22, gpu_count: 2 }
            c1-gpu03: { ansible_host: 10.20.0.23, gpu_count: 2 }
            c1-gpu04: { ansible_host: 10.20.0.24, gpu_count: 2 }
        teaching_partition:
          hosts:
            c1-gpu05: { ansible_host: 10.20.0.25, gpu_count: 1, mps: true }
            c1-gpu06: { ansible_host: 10.20.0.26, gpu_count: 1, mps: true }
```

Node facts (CPU count, real memory, GPU model) are taken from the completed asset register, not guessed. A wrong `RealMemory` value in `slurm.conf` causes nodes to be marked `DRAIN` with an unhelpful message.

# 4. Anchor Node Installation

## 4.1 Base operating system

1. Install Ubuntu 24.04 LTS. Minimal server profile, no desktop.
2. Configure both network interfaces: VLAN 10 (campus) and VLAN 20 (`10.20.0.10/24`).
3. Create the administrator account with an SSH key. Password authentication is disabled by the `common` role.
4. Confirm the machine is on the UPS and that the UPS is reporting.

## 4.2 Storage pools

```bash
sudo apt install -y zfsutils-linux

# Root/fast pool: OS, MariaDB, /home
sudo zpool create rpool mirror /dev/nvme0n1 /dev/nvme1n1

# Bulk pool: /projects, /datasets, /opt/apptainer, backups
sudo zpool create tank raidz2 /dev/sd{a,b,c,d,e,f}

sudo zfs create -o mountpoint=/home            rpool/home
sudo zfs create -o mountpoint=/projects        tank/projects
sudo zfs create -o mountpoint=/datasets        tank/datasets
sudo zfs create -o mountpoint=/opt/apptainer   tank/apptainer
sudo zfs create -o mountpoint=/tank/backup     tank/backup

zpool status     # must report both pools ONLINE with no errors
```

**Verification:** `zpool status` clean, and the anchor node reachable on both VLANs.

## 4.3 Control-plane roles

Run in this order. Each step is verified before the next begins.

```bash
ansible-playbook -i inventory/pilot.yml playbooks/anchor.yml --tags common
ansible-playbook -i inventory/pilot.yml playbooks/anchor.yml --tags identity
ansible-playbook -i inventory/pilot.yml playbooks/anchor.yml --tags nfs_server
ansible-playbook -i inventory/pilot.yml playbooks/anchor.yml --tags munge
ansible-playbook -i inventory/pilot.yml playbooks/anchor.yml --tags slurm_controller
ansible-playbook -i inventory/pilot.yml playbooks/anchor.yml --tags monitoring_server
ansible-playbook -i inventory/pilot.yml playbooks/anchor.yml --tags ood_portal
```

| After | Verify |
| --- | --- |
| `identity` | `id <ad-username>` resolves on the anchor |
| `nfs_server` | `exportfs -v` lists `/home`, `/projects`, `/datasets` (ro), `/opt/apptainer` (ro) |
| `munge` | `munge -n \| unmunge` succeeds |
| `slurm_controller` | `systemctl status slurmctld slurmdbd mariadb` all active; `sacctmgr show cluster` lists `clusterone` |
| `monitoring_server` | Grafana reachable; Prometheus targets page loads |
| `ood_portal` | Portal returns the login page over HTTPS |

## 4.4 Critical settings to confirm before the first job

```ini
# slurm.conf
ClusterName=clusterone
SlurmctldHost=c1-anchor(10.20.0.10)
```

`ClusterName` is written into every accounting record. Changing it after jobs have run orphans the entire usage history. Confirm it before the first `sbatch`.

# 5. Compute Node Installation

## 5.1 Base operating system

1. Confirm the machine passed the qualification checklist and the owner MOU is signed.
2. Install Ubuntu 24.04 LTS. Minimal server profile.
3. Configure the VLAN 20 address from the inventory (`10.20.0.21`–`10.20.0.40`).
4. Ensure at least 500 GB of free local NVMe/SSD is available for `/scratch`.
5. Confirm Wake-on-LAN is enabled in BIOS. This requires physical presence, so it is done now even though it is not used until Phase 2.
6. Install the administrator SSH key.

## 5.2 Driver baseline

Pin and hold. Mismatched drivers across nodes are the most common cause of a job that works on one node and fails on another.

```bash
sudo apt install -y nvidia-driver-550
sudo apt-mark hold nvidia-driver-550 nvidia-dkms-550 libnvidia-compute-550
sudo reboot
nvidia-smi        # must report driver 550.x and every installed card
```

CUDA is **not** installed on the host. It is provided inside containers.

## 5.3 Apply the compute roles

```bash
ansible-playbook -i inventory/pilot.yml playbooks/compute.yml --limit c1-gpu01
```

This applies `common`, `identity`, `nfs_client`, `munge`, `slurm_common`, `slurm_compute`, `gpu_node`, `apptainer` and `monitoring_agent`.

| After | Verify |
| --- | --- |
| `identity` | **`id <user>` returns identical UID/GID on the anchor and this node.** Do not proceed otherwise |
| `nfs_client` | `/home`, `/projects`, `/datasets`, `/opt/apptainer` mounted; `/datasets` read-only |
| `munge` | Node can authenticate to the controller |
| `slurm_compute` | `sinfo` on the anchor shows the node `IDLE` |
| `gpu_node` | `nvidia-smi -q \| grep Persistence` shows enabled; power cap applied |
| `monitoring_agent` | Node appears as an `UP` target in Prometheus for both port 9100 and 9400 |

## 5.4 Node validation job

Run before releasing the node to users:

```bash
srun -p gpu --gres=gpu:1 nvidia-smi
srun -p gpu --gres=gpu:1 apptainer exec --nv \
  /opt/apptainer/images/pytorch.sif \
  python -c "import torch; print(torch.cuda.is_available())"
```

Both must succeed, and the second must print `True`.

Then release the node:

```bash
scontrol update NodeName=c1-gpu01 State=RESUME
```

# 6. Cluster Configuration Files

All of these live in the repository and are deployed by `slurm_common`. They are reproduced here for reference; the repository is authoritative.

## 6.1 `slurm.conf` (essentials)

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

# --- preemption (configured now, activated in Phase 2) ---
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

# --- power saving (configured now, activated in Phase 2) ---
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

`interactive` carries the highest priority tier and the shortest walltime. This is what makes the portal feel responsive — a student opening a notebook must not queue behind a twenty-hour training run.

## 6.2 `cgroup.conf`

```ini
CgroupPlugin=cgroup/v2
ConstrainCores=yes
ConstrainRAMSpace=yes
ConstrainSwapSpace=yes
ConstrainDevices=yes
```

`ConstrainDevices=yes` is the line that stops a job from seeing GPUs it was not allocated. Without it, `nvidia-smi` inside a job shows every card on the node, and users will use them.

## 6.3 `gres.conf`

```ini
NodeName=c1-gpu[01-04] Name=gpu Type=rtx4090 File=/dev/nvidia[0-1]
NodeName=c1-gpu[05-06] Name=gpu Type=rtx3060 File=/dev/nvidia0
NodeName=c1-gpu[05-06] Name=mps Count=100   File=/dev/nvidia0
```

## 6.4 Prolog — create scratch

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

## 6.5 Prolog — stage dataset to local scratch

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

## 6.6 Epilog — wipe scratch

`/etc/slurm/epilog.d/90-cleanup`

```bash
#!/bin/bash
rm -rf "/scratch/${SLURM_JOB_ID}"
# reset any GPU left in a bad state by a crashed job
nvidia-smi --gpu-reset -i "${CUDA_VISIBLE_DEVICES:-0}" 2>/dev/null || true
exit 0
```

The `_datasets` cache is intentionally not wiped — caching is its purpose. A weekly cron prunes entries older than 30 days.

## 6.7 GPU power cap unit

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

The `-pl` value is set from your own benchmark sweep, not from this document — the knee of the curve differs per card model. The chosen value is committed to `roles/gpu_node/defaults/main.yml`.

# 7. Container Images

Built once on the anchor node and published to the read-only NFS export.

```bash
cd /tank/apptainer/build
apptainer build pytorch.sif    docker://pytorch/pytorch:2.4.0-cuda12.1-cudnn9-runtime
apptainer build tensorflow.sif docker://tensorflow/tensorflow:2.17.0-gpu
apptainer build cuda-base.sif  docker://nvidia/cuda:12.4.1-runtime-ubuntu24.04
sudo mv *.sif /opt/apptainer/images/
```

Verification, run from inside a Slurm allocation:

```bash
srun -p gpu --gres=gpu:1 apptainer exec --nv \
  /opt/apptainer/images/pytorch.sif \
  python -c "import torch; print(torch.cuda.is_available())"
```

Users may not build images on cluster nodes during the pilot. Requests for additional images go to the operations team, which keeps the software supply chain reviewable.

# 8. Portal Deployment

1. Apply the `ood_portal` role.
2. Configure the OIDC client in Keycloak; the `preferred_username` claim must match the POSIX username exactly.
3. Install the TLS certificate for `clusterone.diu.edu.bd`.
4. Enable the pilot applications: Jupyter, VS Code Server, shell, file browser, and the batch job composer.
5. Pre-load the job template library.

**Acceptance test:** a user with no SSH key, on a Windows laptop, reaches a GPU Jupyter kernel through a browser in under three minutes.

# 9. Adding a Node Later

The routine path, and the one the operator will actually use most.

```bash
# 1. Qualify the machine and record it in the asset register.
# 2. Owner signs the MOU.
# 3. Reimage to Ubuntu 24.04, set the VLAN 20 address.
# 4. Add to inventory/pilot.yml.
# 5. Add the node to slurm.conf and the relevant partition.

ansible-playbook -i inventory/pilot.yml playbooks/compute.yml --limit c1-gpu07
ansible-playbook -i inventory/pilot.yml playbooks/anchor.yml  --tags slurm_common
sudo scontrol reconfigure

sinfo -n c1-gpu07
srun -p gpu -w c1-gpu07 --gres=gpu:1 nvidia-smi
scontrol update NodeName=c1-gpu07 State=RESUME
```

# 10. Node Rebuild Drill

This is the pilot's most important acceptance test. It is run in week 12 by a **second operator**, without the original builder present, and it is timed.

```bash
# 1. Drain and remove the node from service
scontrol update NodeName=c1-gpu03 State=DRAIN Reason="rebuild drill"

# 2. Reimage from bare metal: Ubuntu 24.04, VLAN 20 address, SSH key

# 3. Rebuild entirely from the repository
ansible-playbook -i inventory/pilot.yml playbooks/rebuild-node.yml --limit c1-gpu03

# 4. Validate
srun -p gpu -w c1-gpu03 --gres=gpu:1 apptainer exec --nv \
  /opt/apptainer/images/pytorch.sif \
  python -c "import torch; print(torch.cuda.is_available())"

# 5. Return to service
scontrol update NodeName=c1-gpu03 State=RESUME
```

Pass condition: under two hours, no undocumented step, no question asked of the original builder. If the drill fails, the documentation is wrong — correct this guide, not the drill.

# 11. Deployment Verification Checklist

Complete before releasing the cluster to users.

- [ ] `zpool status` clean on both pools
- [ ] Anchor reachable on VLAN 10 and VLAN 20
- [ ] `id <user>` identical on the anchor and every compute node
- [ ] `exportfs -v` shows `/datasets` and `/opt/apptainer` exported read-only
- [ ] `sinfo` shows every node `IDLE`
- [ ] `srun -p gpu --gres=gpu:1 nvidia-smi` succeeds
- [ ] A 1-GPU job on a 2-GPU node cannot see the second card
- [ ] A job exceeding its walltime is killed cleanly
- [ ] `/scratch/$SLURM_JOB_ID` is removed after job exit
- [ ] Every node is an `UP` target in Prometheus for ports 9100 and 9400
- [ ] Pulling a network cable fires `NodeDown` within two minutes, and the runbook resolves it
- [ ] Portal login → running Jupyter kernel in under three minutes
- [ ] Egress to an unlisted destination is blocked from a compute node
- [ ] Nightly backup job has run and a restore has been tested
- [ ] `ClusterName=clusterone` confirmed before the first accounted job

# 12. Common Deployment Problems

| Symptom | Likely cause | Action |
| --- | --- | --- |
| Node stuck in `DRAIN` immediately after joining | `RealMemory` or `CPUs` in `slurm.conf` exceeds actual hardware | Correct from the asset register; `scontrol reconfigure`; `scontrol update NodeName=... State=RESUME` |
| Jobs fail with authentication errors | munge key mismatch or clock skew | Re-run the `munge` role; verify NTP on all nodes |
| Files owned by numeric UIDs instead of names | SSSD not resolving, or UID mismatch | Re-run `identity`; verify `id <user>` on both ends before continuing |
| `torch.cuda.is_available()` returns `False` inside a container | `--nv` flag missing, or job has no GPU allocation | Add `--nv`; confirm `--gres=gpu:N` was requested |
| Job sees GPUs it was not allocated | `ConstrainDevices=yes` missing from `cgroup.conf` | Deploy `cgroup.conf`; restart `slurmd`; re-test |
| "The cluster is slow" reported by several users at once | Jobs reading datasets directly from NFS | Confirm the prolog is staging to `/scratch` and that job templates are being used |
| Different behaviour on one node only | Driver version drift | `apt-mark hold` was not applied; re-run `gpu_node` and verify the version everywhere |
