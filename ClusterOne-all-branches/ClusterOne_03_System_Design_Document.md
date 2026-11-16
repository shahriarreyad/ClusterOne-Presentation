# ClusterOne — System Design Document (SDD)



*Version 1.0*

| **Field** | **Detail** |
| --- | --- |
| Document | System Design Document |
| Project | ClusterOne — Distributed GPU Cluster Computing Platform |
| Target Environment | DIU Campus |
| Traces to | ClusterOne SRS v1.0 (FR-1 … FR-11, NFR-1 … NFR-8) |
| Status | Draft — Pilot / Phase 1 |

# 1. Introduction

## 1.1 Purpose

This System Design Document (SDD) describes *how* ClusterOne will be built. The SRS states what the system must do; this document states the architecture, module decomposition, workflows, technology choices, and the reasoning behind each choice. It is the reference a developer or system administrator uses when implementing or rebuilding the platform.

## 1.2 Design Principles

Five principles govern every decision recorded in this document.

1. **Prefer upstream tools over custom code.** Every custom component is a future maintenance liability owned by a student who will graduate. Slurm, Apptainer, Open OnDemand, Prometheus and Grafana are used as-is wherever they solve the problem.
2. **Everything is reproducible from the repository.** If a setting is not in the Ansible repository, it does not exist. Nothing is edited by hand on a live node.
3. **Isolation is enforced by the kernel, not by convention.** GPU, CPU, memory and device access limits are applied through cgroup v2 and Slurm GRES, not through user policy alone.
4. **The control plane is a purchase, not a repurpose.** The anchor node is dedicated, protected by UPS, and backed up nightly. Everything depends on it.
5. **Bus factor 1 is a blocker.** No component is considered complete until a second person has independently operated it.

# 2. System Architecture

## 2.1 Architectural Style

ClusterOne is a **centralised control-plane / distributed execution-plane** system. A single anchor node owns identity, scheduling, accounting, storage and observability. A set of compute nodes owns nothing but their GPUs, their local scratch disk, and an agent that accepts work.

This style is chosen because it matches the operational reality of a campus pilot: one machine must be reliable, and the rest must be replaceable. A compute node can be lost, reimaged, or returned to its owning lab without affecting the state of the system.

## 2.2 Layered View

| Layer | Responsibility | Components |
| --- | --- | --- |
| Access layer | Browser-based user entry, authentication, session management | Open OnDemand, nginx, per-user NGINX node (PUN), Keycloak/OIDC |
| Control layer | Scheduling, resource allocation, accounting, policy enforcement | slurmctld, slurmdbd, MariaDB, munge |
| Execution layer | Job execution inside isolated container environments | slurmd, Apptainer, cgroup v2, NVIDIA driver + GRES |
| Storage layer | Persistent and temporary data | NFSv4 over ZFS, node-local NVMe scratch |
| Observability layer | Metrics, logs, alerts, dashboards | Prometheus, node_exporter, dcgm-exporter, Grafana, Alertmanager, Loki, promtail |
| Provisioning layer | Reproducible build and rebuild of every node | Ansible, Git |

## 2.3 Deployment View

```
   Campus network (VLAN 10 - user)
              |
     +--------+--------+
     |  Users: browser |   no client install, no VPN,
     +--------+--------+   no SSH keys distributed
              | HTTPS 443
   +----------+-------------------------------------+
   |            c1-anchor  (10.20.0.10)             |
   | ---------------------------------------------- |
   |  Open OnDemand     nginx + PUN per user        |
   |  Keycloak / OIDC --> AD (existing DIU)         |
   |  slurmctld         scheduler control plane     |
   |  slurmdbd + MariaDB accounting & fairshare     |
   |  Prometheus / Grafana / Alertmanager / Loki    |
   |  NFSv4 server      /home /projects /datasets   |
   |  Apptainer image store (read-only export)      |
   |  munge key authority                           |
   |                                                |
   |  On UPS | nightly backup | Ansible-rebuildable |
   +----------+-------------------------------------+
              |  VLAN 20 - compute  10.20.0.0/24
              |  no inbound internet; egress via allowlist
   +----------+--------+--------+--------+---------+
   |          |        |        |        |         |
+--+---+  +---+--+ +---+--+ +---+--+ +---+---+ +---+---+
|gpu01 |  |gpu02 | |gpu03 | |gpu04 | |gpu05  | |gpu06  |
|      |  |      | |      | |      | |teachng| |teachng|
+------+  +------+ +------+ +------+ +-------+ +-------+
 partition: gpu (whole cards)     partition: teaching (MPS)

 every node: slurmd, munge, apptainer, dcgm-exporter,
             node_exporter, promtail, local NVMe /scratch
```

# 3. Module Decomposition

## 3.1 Module Catalogue

| Module ID | Module | Responsibility | Implements (SRS) |
| --- | --- | --- | --- |
| M-1 | Identity & Access | POSIX identity from AD via SSSD; web SSO via Keycloak/OIDC; consistent UID/GID cluster-wide | FR-1, FR-10, NFR-7 |
| M-2 | Portal | Job submission forms, interactive app launch, file browser, job status | FR-2, FR-6, NFR-2, NFR-8 |
| M-3 | Scheduler | Queueing, partition rules, backfill, fairshare, walltime enforcement | FR-3, NFR-1 |
| M-4 | Resource Allocation & Isolation | GRES GPU binding, cgroup v2 device/CPU/memory constraints, `CUDA_VISIBLE_DEVICES` | FR-4, NFR-7 |
| M-5 | Container Runtime | Rootless Apptainer execution from a curated read-only image set | FR-5 |
| M-6 | Storage | NFSv4 exports over ZFS; per-job local scratch; prolog staging; epilog cleanup | FR-9, NFR-5 |
| M-7 | Accounting | Per-job user, resources, timing, exit state, energy | FR-7 |
| M-8 | Monitoring & Alerting | Metric and log collection, dashboards, alert rules, runbooks | FR-8, NFR-4 |
| M-9 | Provisioning | Ansible roles and playbooks; node rebuild | FR-11, NFR-6 |

## 3.2 Module Interaction

```
  User --HTTPS--> M-2 Portal --auth--> M-1 Identity
                     |
                     | sbatch / salloc
                     v
                  M-3 Scheduler ----> M-7 Accounting (MariaDB)
                     |
                     | allocation decision
                     v
                  M-4 Isolation (GRES + cgroup v2)
                     |
                     v
                  M-5 Container Runtime (Apptainer)
                     |
              +------+------+
              |             |
         M-6 Storage    GPU device
        (/scratch,      (allocated cards only)
         /projects)
              |
              v
           Results --> M-2 Portal --> User

  M-8 Monitoring observes every module continuously.
  M-9 Provisioning builds every module from Git.
```

# 4. Component Design

## 4.1 M-1 Identity & Access

Two identity paths, one identity source.

- **POSIX identity** is provided by SSSD joined to the existing DIU Active Directory. Every node resolves the same user to the same UID and GID.
- **Web identity** is provided by Keycloak acting as an OIDC provider in front of the same directory. Open OnDemand consumes OIDC only.

The single most important design constraint in this module is UID/GID consistency. NFSv4 maps ownership by numeric ID; if two nodes disagree about a user's UID, file ownership silently corrupts across the cluster. Verification is explicit: `id <user>` must return identical output on the anchor and on every compute node before the first job runs.

## 4.2 M-2 Portal

Open OnDemand is deployed on the anchor node behind nginx with TLS. Each authenticated user receives a per-user NGINX node (PUN) running as their own POSIX identity, which means portal file access and job submission inherit the same permissions as the command line.

Published applications for the pilot:

| App | Partition | Default walltime |
| --- | --- | --- |
| Jupyter Notebook / Lab | `interactive` | 4 h |
| VS Code Server | `interactive` | 4 h |
| Batch job composer (from template library) | `gpu` | 12 h |
| Shell access (inside allocation only) | `interactive` | 2 h |
| File browser (`/home`, `/projects`) | — | n/a |

The `interactive` partition carries the highest priority tier and the shortest walltime. This is the design decision that makes the portal feel responsive: a student opening a notebook must not queue behind a twenty-hour training run.

## 4.3 M-3 Scheduler

Slurm 24.05 with backfill scheduling and `select/cons_tres` for consumable trackable resources.

| Partition | Nodes | Max walltime | Priority tier | Purpose |
| --- | --- | --- | --- | --- |
| `gpu` | c1-gpu01–04 | 24 h | 10 | Research and long training runs; whole cards |
| `interactive` | c1-gpu01–02 | 8 h | 20 | Notebooks, debugging, portal sessions |
| `teaching` | c1-gpu05–06 | 4 h | 5 | Coursework; MPS fractional sharing |

Priority is multifactor, weighted toward fairshare (100000) with age (10000), job size (1000) and QOS (50000) contributing, and a seven-day fairshare decay half-life. Preemption (`preempt/partition_prio`, `SUSPEND,GANG`) and power saving are **configured but commented out** in the pilot; they are activated in Phase 2 without a configuration redesign.

`ClusterName=clusterone` is set before the first job runs. The cluster name is written into every accounting record, and changing it later orphans the accounting history.

## 4.4 M-4 Resource Allocation and Isolation

Isolation is enforced at three levels simultaneously:

1. **Slurm GRES** — `gres.conf` maps named GPU resources to device files per node type, so the scheduler allocates specific cards rather than a count.
2. **cgroup v2** — `ConstrainDevices=yes` in `cgroup.conf` removes unallocated GPU device nodes from the job's device cgroup. Without this line, `nvidia-smi` inside a job lists every card on the machine and users will use them.
3. **`CUDA_VISIBLE_DEVICES`** — set by Slurm inside the job environment, giving a consistent zero-based view of the allocated cards to the application.

CPU, memory and swap are constrained by the same cgroup configuration, which prevents one job from starving another sharing the node.

## 4.5 M-5 Container Runtime

Apptainer 1.3+, rootless, with `--writable` prohibited. Images are single `.sif` files stored on a read-only NFS export at `/opt/apptainer/images`, which removes the need to operate a registry service.

Base image set for the pilot: `pytorch.sif`, `tensorflow.sif`, `cuda-base.sif`. CUDA lives inside the container; the host carries only the NVIDIA driver. This is what eliminates the "works on gpu02, fails on gpu04" class of failure.

Docker is explicitly excluded. The Docker daemon runs as root and represents a privilege-escalation path in a multi-tenant campus environment.

## 4.6 M-6 Storage

| Mount | Backing | Quota | Backed up | Purpose |
| --- | --- | --- | --- | --- |
| `/home/<user>` | NFS, NVMe RAID1 | 20 GB | Nightly | Code, notebooks, configs — never datasets |
| `/projects/<proj>` | NFS, HDD RAIDZ2 | 500 GB | Weekly | Shared project working space |
| `/datasets` | NFS, HDD RAIDZ2, read-only | — | No (re-downloadable) | Curated shared datasets |
| `/scratch` | Node-local NVMe | Node size | No | Per-job working space, wiped by epilog |
| `/opt/apptainer` | NFS, read-only | — | Weekly | Container images |

**The controlling storage rule:** no training job reads directly from `/datasets` over NFS. A Slurm prolog stages the requested dataset to node-local `/scratch` and caches it there. On 1 GbE, four concurrent jobs streaming a large image dataset from NFS will saturate the anchor node's uplink, and every user will report that the cluster is slow. The rule is enforced in the prolog and encoded in the published job templates from day one.

Job lifecycle hooks:

- `prolog.d/10-scratch` — create `/scratch/$SLURM_JOB_ID`, `chown` to the job user, mode 700.
- `prolog.d/20-dataset` — read `--comment=dataset:<name>`, rsync `/datasets/<name>` into a node-local cache if not already present.
- `epilog.d/90-cleanup` — remove the per-job scratch directory and reset any GPU left in a bad state by a crashed job.

The dataset cache under `/scratch/_datasets` is deliberately **not** wiped after each job; caching is its purpose. A weekly cron prunes entries unused for more than 30 days.

## 4.7 M-7 Accounting

`slurmdbd` writes to MariaDB on the anchor node. `AccountingStorageTRES=gres/gpu` ensures GPU seconds are tracked as a first-class resource, which is what makes fairshare and the energy-per-job metric meaningful. `JobAcctGatherType=jobacct_gather/cgroup` samples at 30-second intervals.

## 4.8 M-8 Monitoring and Alerting

Prometheus scrapes `node_exporter` (host metrics) and `dcgm-exporter` (GPU utilisation, temperature, power, ECC, XID) from every node. Loki receives logs via promtail. Grafana serves three dashboards — a public wall board, an operations board, and a per-user "my jobs" view surfaced through the portal.

Zabbix is not deployed. It overlaps heavily with Prometheus for compute monitoring, and doubling the maintenance surface at six nodes is not justified.

Every alert rule has exactly one runbook page. An alert without a documented response is not deployed.

## 4.9 M-9 Provisioning

```
clusterone-infra/
  inventory/            pilot.yml, group_vars/{all,gpu_nodes,anchor}.yml
  roles/                common, identity, nfs_server, nfs_client, munge,
                        slurm_common, slurm_controller, slurm_compute,
                        gpu_node, apptainer, monitoring_server,
                        monitoring_agent, ood_portal
  playbooks/            site.yml, anchor.yml, compute.yml, rebuild-node.yml
  docs/                 runbooks/, user-guide/
```

`rebuild-node.yml` exists specifically to support the pilot exit criterion: a second person rebuilds a compute node from bare metal, without the original builder present, in under two hours.

# 5. Workflow Design

## 5.1 Job Submission and Execution

```
1. User authenticates to the portal          (M-1, M-2)
2. User selects a template or app and submits (M-2)
3. Portal issues sbatch/salloc as the user    (M-2 -> M-3)
4. Scheduler queues the job by partition,
   fairshare, age and size                    (M-3)
5. Scheduler selects a node and specific GPUs (M-3 -> M-4)
6. Prolog creates /scratch/$JOBID and stages
   the requested dataset                      (M-6)
7. cgroup v2 restricts devices, CPU, memory   (M-4)
8. Apptainer starts the container with --nv   (M-5)
9. Job runs; checkpoints written to /projects (M-5, M-6)
10. Epilog wipes scratch, resets GPU state    (M-6)
11. Accounting record written                 (M-7)
12. Output made available via the portal      (M-2)
```

## 5.2 Node Onboarding

```
Owner MOU signed
  -> Qualification checklist passed (Sec. 2.2, Hardware Inventory doc)
  -> Machine reimaged to Ubuntu 24.04 LTS
  -> Added to Ansible inventory under gpu_nodes
  -> ansible-playbook playbooks/compute.yml --limit c1-gpuNN
  -> Node appears IDLE in sinfo
  -> Validation job runs successfully
  -> Node released to the live partition
```

## 5.3 Node Failure and Rebuild

```
Alert fires (NodeDown / GPUEccError / GPUOverTemp)
  -> Runbook page opened
  -> scontrol update NodeName=c1-gpuNN State=DRAIN
  -> Running jobs complete or are requeued
  -> Hardware repaired or replaced
  -> ansible-playbook playbooks/rebuild-node.yml --limit c1-gpuNN
  -> Validation job runs
  -> scontrol update NodeName=c1-gpuNN State=RESUME
```

# 6. Technology Selection and Rationale

| Decision | Rationale |
| --- | --- |
| Slurm, not Kubernetes or HTCondor | Native `gres/gpu`, MPS, preemption, fairshare and power saving; first-class Open OnDemand integration; it is what academic HPC runs, so the skill transfers and every problem has a published answer. HTCondor is the better scavenging engine and arrives in Phase 3 with the Windows tier — running two batch systems from day one consumes the entire operations budget |
| Apptainer, not Docker | Rootless. The Docker daemon runs as root and is a privilege-escalation path in a multi-tenant setting. Apptainer images are single files on NFS, removing the need for a registry service |
| NFS + ZFS, not Ceph or BeeGFS | Below roughly 50 nodes, distributed filesystems cost more in operations than they return in throughput |
| Anchor node purchased, not repurposed | Everything depends on it. Running the control plane on a borrowed desktop is how pilots fail in month four |
| Prometheus only, no Zabbix | Heavy overlap for compute monitoring; doubling maintenance surface at six nodes is unjustified. Reconsider only if netops already runs Zabbix for SNMP on switches and UPS |
| AD for POSIX identity, OIDC for web | Consistent UID/GID on every node is non-negotiable; NFS silently corrupts ownership otherwise |
| Whole cards on `gpu`, MPS on `teaching` | MPS gives performance isolation but weaker fault isolation than MIG. Acceptable for four-hour coursework jobs, not for twenty-hour unattended training |
| Ansible, not manual configuration | The exit criterion is a timed rebuild by a second operator. Manual configuration cannot pass it |

# 7. Design Constraints and Exclusions

The following are deliberately **out of scope for the pilot**, with the phase in which each returns. Recording them is what keeps the pilot finishable; every one of them will be requested during the build.

| Excluded | Reason | Returns in |
| --- | --- | --- |
| Scavenging / preemption | Identity, storage, containers and the portal must be proven against stable nodes first. Preemption on an unproven base gives every failure two possible causes | Phase 2 |
| Windows compute nodes | No cgroups, no CRIU, GPU containers need WSL2, endpoint security interferes with job execution | Phase 3 |
| Multi-node distributed training | At 1 GbE, two-node NCCL is slower than a single GPU. Multi-GPU means within one chassis | When 25 GbE exists |
| Fractional GPU sharing on `gpu` | MPS has weaker fault isolation than MIG; unsuitable for long unattended training | `teaching` only, from week 9 |
| Hosted inference services | Requires a stable batch layer first | Phase 3 |
| ML-based scheduling | No training data exists yet; bin-packing heuristics beat ML at six nodes | Phase 4, if data justifies it |

# 8. Traceability Summary

| SRS Requirement | Design Element |
| --- | --- |
| FR-1 Authentication | M-1 (SSSD/AD, Keycloak OIDC), §4.1 |
| FR-2 Job submission | M-2 (Open OnDemand apps, template library), §4.2 |
| FR-3 Queueing and scheduling | M-3 (Slurm partitions, backfill, multifactor priority), §4.3 |
| FR-4 GPU allocation and isolation | M-4 (GRES, cgroup v2 `ConstrainDevices`, `CUDA_VISIBLE_DEVICES`), §4.4 |
| FR-5 Containerised execution | M-5 (Apptainer, curated `.sif` images), §4.5 |
| FR-6 Result retrieval | M-2 file browser + `--output` to `/home`, §4.2 |
| FR-7 Job accounting | M-7 (slurmdbd, MariaDB, `AccountingStorageTRES=gres/gpu`), §4.7 |
| FR-8 Monitoring | M-8 (Prometheus, DCGM, Grafana, Alertmanager, Loki), §4.8 |
| FR-9 Shared storage | M-6 (NFS/ZFS layout, scratch staging), §4.6 |
| FR-10 Access control | M-1 + M-4 + §5 of the Security Design document |
| FR-11 Reproducibility | M-9 (Ansible roles, `rebuild-node.yml`), §4.9 |
| NFR-1 … NFR-8 | §4.3, §4.2, §4.4, §4.8, §4.6, §4.9, §4.4, §4.2 respectively |
