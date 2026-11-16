# ClusterOne — Security Design



*Version 1.0*

| **Field** | **Detail** |
| --- | --- |
| Document | Security Design |
| Project | ClusterOne — Distributed GPU Cluster Computing Platform |
| Target Environment | DIU Campus |
| Traces to | SRS FR-1, FR-4, FR-10, NFR-5, NFR-7 |
| Status | Draft — Pilot / Phase 1 |

# 1. Purpose and Scope

This document specifies how ClusterOne authenticates users, authorises their actions, isolates their workloads from one another, protects data, and produces the logging needed to investigate an incident.

Scope is the pilot: one anchor node, four to six Linux compute nodes, 20–30 users, on campus, in a single building. Windows nodes, scavenging and hosted inference are out of scope and carry their own threat surfaces to be assessed when they arrive.

# 2. Threat Model

## 2.1 Assets

| Asset | Why it matters |
| --- | --- |
| User source code and notebooks (`/home`) | Unpublished research; loss or exposure is unrecoverable |
| Shared project data (`/projects`) | Multi-user research working data |
| Accounting database | Usage history; the basis of fairshare and all reporting |
| Munge key | Compromise allows job submission as any user |
| GPU capacity itself | The most likely target of abuse |
| Anchor node availability | Single point of failure for the whole platform |

## 2.2 Threat actors and realistic scenarios

| Actor | Scenario | Likelihood |
| --- | --- | --- |
| Curious authorised user | Reads another user's files; runs `nvidia-smi` and uses an unallocated card | High |
| Careless authorised user | Runs untrusted code from a public repository that exfiltrates data or joins a botnet | Medium |
| Opportunistic abuser | Uses pooled GPU capacity for cryptocurrency mining | Medium |
| External attacker | Scans for exposed services; attempts to reach compute nodes directly | Medium |
| Compromised account | Credentials phished from a student; used to submit jobs and read data | Medium |
| Insider with physical access | Removes a disk from a compute node | Low |

## 2.3 Explicit non-goals for the pilot

ClusterOne is not designed to hold regulated or sensitive data. It does not attempt to defend against a determined attacker with physical access to the anchor rack, nor to provide cryptographic isolation between tenants. Workloads requiring either of those do not run here — this is stated as policy in §7.2, not left to interpretation.

# 3. Identity and Authentication

## 3.1 Two paths, one source of truth

| Path | Mechanism | Used for |
| --- | --- | --- |
| POSIX identity | SSSD joined to the existing DIU Active Directory | File ownership, job ownership, cluster-wide UID/GID |
| Web identity | Keycloak as OIDC provider in front of the same directory | Open OnDemand portal login |

No local user accounts are created on cluster nodes except the service accounts deployed by Ansible. Account lifecycle — creation, suspension, deletion — is handled by the existing university directory, which means a departing student loses cluster access through the normal process rather than through a cluster-specific one that will be forgotten.

## 3.2 UID/GID consistency

This is a security control, not merely an operational convenience. NFSv4 maps file ownership by numeric identifier. If two nodes disagree about a user's UID, one user's files become readable and writable as another's, silently. Verification is mandatory before the first job runs and is re-asserted by Ansible on every playbook run: `id <user>` must return identical output on the anchor and on every compute node.

## 3.3 Inter-service authentication

Slurm daemons authenticate to one another with munge. The key is generated once on the anchor node, distributed by Ansible with restrictive permissions, and rotated annually. Compromise of the munge key allows an attacker to submit jobs as any user, so it is treated as the most sensitive secret in the system after the directory credentials.

# 4. Authorisation

| Boundary | Control |
| --- | --- |
| Who may submit jobs | Slurm association: a user must exist in `sacctmgr` with an account and a QOS. Directory membership alone is not sufficient |
| Which partitions | Partition access is granted per account. Coursework accounts receive `teaching` and `interactive` only |
| How much | Per-QOS limits on concurrent jobs, GPUs, and walltime. Fairshare (weight 100000, 7-day decay half-life) governs contention over time |
| Which files | POSIX permissions plus ACLs on `/projects`. Home directories are mode 700 |
| Which projects | Membership in a project is a POSIX group, granted by the faculty sponsor's approval, not self-service |
| Node access | No SSH to compute nodes except through a live Slurm allocation, enforced by `pam_slurm_adopt` |

Administrative access is separate: the systems administrator and student operators use named accounts with `sudo`, never a shared root password. Student operator access is time-limited to their term and revoked at handover.

# 5. Workload Isolation

Isolation is enforced by the kernel, not by policy. Three mechanisms operate together.

## 5.1 GPU isolation

```ini
# cgroup.conf
CgroupPlugin=cgroup/v2
ConstrainCores=yes
ConstrainRAMSpace=yes
ConstrainSwapSpace=yes
ConstrainDevices=yes
```

`ConstrainDevices=yes` is the line that removes unallocated GPU device nodes from the job's device cgroup. Without it, `nvidia-smi` inside a job lists every card on the machine, and users will use them. Slurm GRES selects specific device files per node; `CUDA_VISIBLE_DEVICES` then presents the allocated cards to the application with a consistent zero-based index.

The acceptance test is explicit and is run in week 8: a job allocated two GPUs on a node holding three must not be able to see or use the third card.

## 5.2 CPU, memory and process isolation

`ProctrackType=proctrack/cgroup` and `TaskPlugin=task/cgroup,task/affinity` place every job in its own cgroup. Memory and swap limits are enforced, so a runaway job is killed rather than driving the node into swap and taking down every other job on it. `PrologFlags=Contain` ensures processes started outside the job step are still tracked and cleaned up.

## 5.3 Container isolation

Apptainer runs rootless. `--writable` is prohibited; images are read-only `.sif` files on a read-only NFS export. Docker is excluded from the design because its daemon runs as root and constitutes a privilege-escalation path in a multi-tenant campus environment.

Users may not build images on cluster nodes during the pilot. The curated image set (`pytorch.sif`, `tensorflow.sif`, `cuda-base.sif`) is built by the operations team and published to `/opt/apptainer/images`. Requests for additional images go through the operations team, which keeps the supply chain reviewable.

# 6. Network Security

| Control | Detail |
| --- | --- |
| Segmentation | Compute VLAN 20 is isolated from the staff VLAN. Compute nodes are not routable from user workstations |
| Single ingress | The anchor node is the only dual-homed device. Users reach it on TCP 443 only |
| No inbound internet | Compute nodes accept no inbound connections from outside VLAN 20 |
| Egress allowlist | Outbound traffic proxied; permitted destinations are PyPI, conda, Hugging Face Hub, GitHub, and Ubuntu/NVIDIA repositories |
| Host firewall | `ufw` deployed by the `common` role, default deny, with only the ports listed in the Infrastructure & Network Design document opened |
| Node admission | A machine joins only after admin approval and an Ansible run. Munge keys are never distributed by hand |
| Transport | HTTPS for all user traffic; certificate renewal automated and alert-monitored |

**The egress allowlist is the single most valuable control in this document.** It blocks both cryptocurrency mining and botnet participation — the two realistic abuse cases for pooled campus GPU capacity — without requiring anyone to detect the abuse first.

# 7. Data Security

## 7.1 Data at rest and in transit

| Area | Protection |
| --- | --- |
| `/home` | Mode 700, per-user. Nightly backup. On ZFS with checksumming |
| `/projects` | POSIX ACLs, group-owned per project. Weekly backup |
| `/datasets` | Read-only bind mount. No user writes possible |
| `/scratch` | Per-job directory, mode 700, owned by the job user, wiped by the epilog |
| Anchor pools | ZFS checksums detect silent corruption; RAIDZ2 tolerates two disk failures |
| Secrets | Ansible Vault. No credentials in Git plaintext, including Grafana admin passwords, database credentials and directory bind accounts |
| Transit | HTTPS from user to portal. Cluster-internal traffic is confined to VLAN 20 |

Full-disk encryption is not applied to compute nodes in the pilot. It would not defend against the realistic threats above, and it complicates unattended reboot. This is a recorded decision rather than an oversight; it is revisited if the data classification policy is ever relaxed.

## 7.2 Data classification policy (binding)

The following must not be placed on ClusterOne:

- Student academic records
- HR or payroll data
- Unanonymised human-subject research data
- Any personally identifiable information

A project requiring any of these does not run on ClusterOne. This is enforced by policy and by the account-creation conversation, not by technical control, and is stated as such.

# 8. Logging and Auditability

| Source | Content | Retention |
| --- | --- | --- |
| slurmdbd / MariaDB | Every job: user, account, partition, resources, GPU seconds, start, end, exit state | Life of the cluster |
| Open OnDemand / nginx | Authentication events, session starts, portal actions | 90 days |
| Keycloak | Login success and failure, token issuance | 90 days |
| System logs (via promtail → Loki) | `auth.log`, `sudo`, SSSD, slurmd, kernel | 30 days |
| Prometheus | Metric time series including per-GPU utilisation and power | 90 days |
| Git | Every configuration change, with author and timestamp | Life of the project |

Configuration change history is a security control in its own right: because nothing is edited by hand on a live node, `git log` is a complete record of who changed what.

# 9. Acceptable Use Policy (summary)

Signed by every user at account creation. The full text is maintained as a separate signed document.

Prohibited:

- Cryptocurrency mining
- Password cracking or credential attacks
- Personal commercial work
- Any attempt to access another user's jobs, files, or allocated GPUs
- Circumventing walltime, quota, or isolation controls
- Sharing account credentials

Consequences escalate from a warning, to suspension of the Slurm association, to referral to the department. The systems administrator may drain a node or cancel a job immediately where there is a suspected security incident, without prior notice.

# 10. Incident Response

## 10.1 Severity levels

| Level | Definition | Response time |
| --- | --- | --- |
| S1 | Confirmed compromise, or suspected data exposure | Immediate; notify faculty sponsor and DIU IT |
| S2 | Suspected abuse (mining, unauthorised access attempt) | Same working day |
| S3 | Policy violation with no security impact | Within three working days |

## 10.2 Standard actions

**Suspected node compromise**

1. `scontrol update NodeName=<host> State=DRAIN Reason="security"` — stop new work reaching it.
2. Isolate the node at the switch port. Do not power it off; volatile evidence is lost.
3. Notify the faculty sponsor and DIU IT.
4. Preserve logs from Loki and the node itself before any rebuild.
5. Rebuild from Ansible after investigation. Never return a suspect node to service by cleaning it in place.
6. Rotate the munge key across the cluster if there is any possibility it was read.

**Suspected credential compromise**

1. Disable the account in the directory.
2. Cancel the user's queued and running jobs.
3. Review accounting and portal logs for the affected window.
4. Restore any altered data from backup.

**Suspected data exposure**

1. Identify the scope from POSIX permissions and the audit log.
2. Notify the affected users and the faculty sponsor.
3. Correct the permissions and record the root cause.

Each Alertmanager rule has a corresponding runbook page in `docs/runbooks/`. No alert is deployed without one.

# 11. Security Controls Traceability

| Requirement | Control | Verification |
| --- | --- | --- |
| FR-1 Authentication | SSSD/AD + Keycloak OIDC (§3) | Unauthenticated portal access is refused |
| FR-4 GPU allocation and isolation | GRES + cgroup v2 `ConstrainDevices` + `CUDA_VISIBLE_DEVICES` (§5.1) | A 2-GPU job on a 3-GPU node cannot see the third card |
| FR-10 Access control | Slurm associations, POSIX/ACL, `pam_slurm_adopt` (§4) | A user cannot read another user's home directory; SSH without an allocation is refused |
| NFR-5 Data integrity | ZFS checksums, RAIDZ2, backup schedule (§7.1) | Restore drill succeeds; zero data-loss incidents recorded |
| NFR-7 Security | All of §4–§7 | Egress to an unlisted destination is blocked from a compute node |

# 12. Security Work Scheduled in the Pilot

| Week | Activity |
| --- | --- |
| 4–8 | Write and obtain sign-off for the Acceptable Use Policy, Data Classification Policy, Owner MOU, Incident Response Runbook and Service Description |
| 5 | Verify UID/GID consistency across the anchor and first compute node |
| 8 | Test GPU device isolation and walltime enforcement |
| 9 | Deploy Alertmanager rules with one runbook page each; test the node-down path end to end |
| 10 | Configure OIDC on the portal; verify session handling and logout |
| 11 | Sign the AUP with the first cohort of users at the hands-on onboarding session |
| 12 | Verify egress allowlist enforcement; confirm secrets are absent from Git history |
