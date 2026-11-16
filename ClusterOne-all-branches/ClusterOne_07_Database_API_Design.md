# ClusterOne — Database & API Design



*Version 1.0*

| **Field** | **Detail** |
| --- | --- |
| Document | Database & API Design |
| Project | ClusterOne — Distributed GPU Cluster Computing Platform |
| Target Environment | DIU Campus |
| Traces to | SRS FR-2, FR-3, FR-6, FR-7, FR-8, FR-10 |
| Status | Draft — Pilot / Phase 1 |

# 1. Purpose and Design Position

This document specifies the data stores ClusterOne operates and the programmatic interfaces it exposes and consumes.

The governing decision is stated first, because it shapes everything below: **ClusterOne does not design a new job or accounting schema.** Slurm's accounting database is the system of record for jobs, users, accounts, associations and resource consumption. Building a parallel job database would create two sources of truth that drift, and would have to be maintained by students after Slurm already solves the problem.

What ClusterOne does design is thin: a small read-only aggregation service for the public wall board, and a documented contract for the interfaces used by the portal and dashboards.

# 2. Data Stores

| Store | Engine | Host | Purpose | Backup |
| --- | --- | --- | --- | --- |
| `slurm_acct_db` | MariaDB 10.11 | `c1-anchor` | Slurm accounting: jobs, users, accounts, associations, QOS, TRES usage | Nightly `mysqldump` + ZFS snapshot |
| `keycloak` | MariaDB (separate database) | `c1-anchor` | OIDC realm, clients, sessions | Nightly |
| `grafana` | SQLite (default) | `c1-anchor` | Dashboards, users, alert state | Nightly file copy; dashboards also exported as JSON to Git |
| Prometheus TSDB | Prometheus local storage | `c1-anchor` | Metric time series, 90-day retention | Not backed up — re-derivable; retention accepted as the recovery point |
| Loki | Loki local storage | `c1-anchor` | Logs, 30-day retention | Not backed up |
| Asset register | Spreadsheet in Git | Repository | Physical hardware inventory | Git history |

MariaDB is used because slurmdbd requires it. Grafana remains on its default SQLite in the pilot; moving it to MariaDB is a Phase 2 task and is only justified once Grafana is made highly available.

# 3. Slurm Accounting Database

## 3.1 Configuration

```ini
# slurm.conf — accounting
AccountingStorageType=accounting_storage/slurmdbd
AccountingStorageHost=c1-anchor
AccountingStorageTRES=gres/gpu
JobAcctGatherType=jobacct_gather/cgroup
JobAcctGatherFrequency=30
```

`AccountingStorageTRES=gres/gpu` is the single most consequential line. It makes GPU seconds a first-class trackable resource, which is what allows fairshare to be computed on GPU usage rather than CPU usage, and what makes the kWh-per-completed-job metric possible.

`ClusterName=clusterone` must be set before the first job runs. The cluster name is embedded in the name of every accounting table; changing it later orphans the entire usage history.

## 3.2 Logical schema (the tables that matter)

Slurm creates its own schema. The tables actually queried during the pilot are:

| Table | Contents | Used for |
| --- | --- | --- |
| `clusterone_job_table` | One row per job: job ID, user ID, account, partition, submit/start/end time, exit code, state, allocated TRES, consumed energy | Every usage and KPI report |
| `clusterone_step_table` | Per job step: CPU time, max RSS, I/O counters | Diagnosing inefficient jobs |
| `clusterone_assoc_table` | User ↔ account ↔ partition associations, with limits | Authorisation and fairshare |
| `clusterone_usage_*` (hour/day/month) | Rolled-up TRES usage | Fairshare computation, monthly reporting |
| `acct_table`, `user_table`, `qos_table` | Accounts, users, QOS definitions | Administration |
| `tres_table` | Trackable resource definitions including `gres/gpu` | Interpreting TRES columns |

## 3.3 Key entities and relationships

```
  user  ----<  association  >----  account
                   |
                   +----  qos       (limits: max jobs, max GPUs, walltime)
                   |
                   +----  partition (gpu | interactive | teaching)

  job  >---- user
  job  >---- account
  job  ----<  step
  job  ----<  tres_usage  (cpu, mem, gres/gpu, energy)
```

## 3.4 Account and QOS model for the pilot

| Account | Members | Partitions | QOS | Limits |
| --- | --- | --- | --- | --- |
| `research-<lab>` | Faculty and postgraduate researchers | `gpu`, `interactive` | `normal` | Max 2 concurrent jobs, max 4 GPUs, 24 h walltime |
| `course-<code>` | Students enrolled in a course | `teaching`, `interactive` | `teaching` | Max 1 concurrent job, max 1 GPU, 4 h walltime |
| `ops` | Systems administrator, student operators | All | `admin` | Reserved for validation and maintenance jobs |

Owner labs that contribute hardware receive fairshare credit through a raised share value on their `research-<lab>` account. The exact mechanism is defined in the GPU Sharing & Governance Policy document.

## 3.5 Representative queries

Reports are produced with `sacct` and `sreport` rather than direct SQL wherever possible; direct SQL against Slurm's schema is fragile across versions.

```bash
# Completed jobs in a period (KPI: >=300 for the pilot)
sacct -a -S 2026-09-01 -E 2026-11-30 -X --state=COMPLETED --format=JobID,User,Account,Partition,AllocTRES,Elapsed,ConsumedEnergy

# Median queue wait on the gpu partition (KPI: <30 min)
sacct -a -S <start> -E <end> -X -r gpu --format=JobID,Submit,Start -P

# GPU hours by account, for monthly reporting
sreport cluster AccountUtilizationByUser start=<start> end=<end> -t hours --tres=gres/gpu

# Active users in the month (KPI: >=20)
sacct -a -S <start> -E <end> -X --format=User -P | sort -u | wc -l
```

## 3.6 Retention and growth

At a pilot scale of a few thousand jobs per month, the accounting database grows by a few tens of megabytes per year. No purge policy is applied during the pilot; the accounting history is deliberately retained for the life of the cluster because it is the evidence base for the Phase 2 proposal.

# 4. Interfaces Consumed

These are existing, documented APIs. ClusterOne consumes them; it does not reimplement them.

## 4.1 Slurm REST API (`slurmrestd`)

Enabled on the anchor node, bound to localhost, reachable only by the portal and the aggregation service. Authentication is by JWT issued from the munge-backed token service. No external exposure.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/slurm/v0.0.40/diag` | Scheduler health, used by the availability check |
| `GET` | `/slurm/v0.0.40/jobs` | Queue state |
| `GET` | `/slurm/v0.0.40/job/{job_id}` | Single job detail |
| `POST` | `/slurm/v0.0.40/job/submit` | Submit a job |
| `DELETE` | `/slurm/v0.0.40/job/{job_id}` | Cancel a job |
| `GET` | `/slurm/v0.0.40/nodes` | Node state and GRES |
| `GET` | `/slurm/v0.0.40/partitions` | Partition definitions and limits |

## 4.2 Prometheus HTTP API

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/query` | Instant metric query — used by the wall board |
| `GET` | `/api/v1/query_range` | Range query — used by Grafana panels |
| `GET` | `/api/v1/targets` | Scrape target health |

Metric families relied upon:

| Metric | Source | Used in |
| --- | --- | --- |
| `up` | All exporters | `NodeDown` alert, availability KPI |
| `DCGM_FI_DEV_GPU_UTIL` | dcgm-exporter | GPU utilisation KPI, `GPUIdleWhileAllocated` |
| `DCGM_FI_DEV_GPU_TEMP` | dcgm-exporter | `GPUOverTemp`, `GPUTempWarning` |
| `DCGM_FI_DEV_POWER_USAGE` | dcgm-exporter | Energy baseline |
| `DCGM_FI_DEV_ECC_DBE_VOL_TOTAL` | dcgm-exporter | `GPUEccError` |
| `node_filesystem_avail_bytes` | node_exporter | `DiskFull`, `ScratchFull` |
| PDU per-outlet energy | PDU exporter / smart plug | kWh per completed job |

## 4.3 Keycloak / OIDC

Standard OIDC authorisation code flow between Open OnDemand and Keycloak.

| Endpoint | Purpose |
| --- | --- |
| `/realms/clusterone/protocol/openid-connect/auth` | Authorisation |
| `/realms/clusterone/protocol/openid-connect/token` | Token exchange |
| `/realms/clusterone/protocol/openid-connect/userinfo` | Claims |
| `/realms/clusterone/.well-known/openid-configuration` | Discovery |

Required claims: `preferred_username` (must match the POSIX username exactly), `email`, and group membership used to map to Slurm accounts.

## 4.4 Open OnDemand

Open OnDemand is used as shipped. Job submission is configured through app definitions and `submit.yml.erb` templates rather than through custom API code, which keeps the customisation reviewable and upgrade-safe.

# 5. Interface Designed by ClusterOne

## 5.1 Wall board aggregation service

The only bespoke service in the pilot, and deliberately small. It exists because the public wall board must not hold Slurm or Prometheus credentials, and must be safe to display on an unauthenticated screen in a public corridor.

- Read-only. No endpoint mutates state.
- Runs on the anchor node, exposes no personally identifying information.
- Caches for 15 seconds to protect `slurmctld` from a refresh loop.

| Method | Path | Response | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/v1/cluster/summary` | Nodes up/down, GPUs total/allocated/idle, jobs running/pending, active users today, cluster kWh today | Wall board |
| `GET` | `/api/v1/cluster/nodes` | Per node: name, state, GPU count, GPU utilisation, temperature | Utilisation heatmap |
| `GET` | `/api/v1/cluster/queue` | Aggregate queue depth and median wait per partition | Published queue-wait KPI |
| `GET` | `/healthz` | Liveness | Monitored |

Example response for `/api/v1/cluster/summary`:

```json
{
  "generated_at": "2026-09-15T10:32:00+06:00",
  "nodes": { "total": 6, "up": 6, "drained": 0 },
  "gpus":  { "total": 10, "allocated": 7, "idle": 3 },
  "jobs":  { "running": 7, "pending": 12 },
  "users_active_today": 14,
  "energy_kwh_today": 38.4,
  "median_queue_wait_minutes": { "gpu": 22, "interactive": 1, "teaching": 4 }
}
```

Error responses use standard HTTP status codes with a JSON body of the form `{"error": "<short message>"}`. Because the service is read-only and cached, the correct behaviour on an upstream failure is to serve the last good cached payload with a stale flag rather than to fail the wall board.

## 5.2 What is deliberately not built

| Not built | Why | Alternative used |
| --- | --- | --- |
| Custom job submission API | Slurm REST API already provides it, with authentication and authorisation already solved | `slurmrestd` |
| Custom user database | Identity belongs to the university directory | AD + Keycloak |
| Custom job/accounting schema | Would drift from Slurm's own records | `slurm_acct_db` |
| Custom monitoring store | Prometheus is already deployed | Prometheus + Loki |
| Public write API | No pilot requirement justifies the attack surface | — |

Every custom component is a maintenance liability owned by a student who will graduate. This table is the applied form of that principle.

# 6. Data Integrity, Access and Backup

| Concern | Approach |
| --- | --- |
| Database credentials | Ansible Vault; never in Git plaintext. The slurmdbd account has privileges on `slurm_acct_db` only |
| Network exposure | MariaDB binds to localhost. `slurmrestd` binds to localhost. Neither is reachable from VLAN 20 or VLAN 10 |
| Backup | Nightly `mysqldump` of `slurm_acct_db` and `keycloak` to `/tank/backup`, plus a ZFS snapshot. Detailed in the Backup & Recovery Procedure document |
| Restore verification | Restore drill performed at least once during the pilot; a backup that has never been restored is not a backup |
| Schema migrations | Handled by slurmdbd on upgrade. Slurm minor versions are upgraded one at a time, with the accounting database backed up immediately before |
| Auditability | Grafana dashboards exported as JSON to Git; all configuration changes tracked in Git history |

# 7. Traceability

| SRS Requirement | Interface or store |
| --- | --- |
| FR-2 Job submission | Open OnDemand → `slurmrestd` `POST /job/submit` (§4.1, §4.4) |
| FR-3 Queueing and scheduling | `slurmctld`; queue state via `GET /jobs` (§4.1) |
| FR-6 Result retrieval | Portal file browser over NFS `/home`, `/projects` (§4.4) |
| FR-7 Job accounting | `slurm_acct_db` (§3) |
| FR-8 Monitoring | Prometheus HTTP API, DCGM metric families (§4.2) |
| FR-10 Access control | Keycloak OIDC claims → Slurm associations (§3.4, §4.3) |
