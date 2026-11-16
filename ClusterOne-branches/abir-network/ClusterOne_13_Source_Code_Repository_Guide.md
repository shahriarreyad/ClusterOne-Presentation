# ClusterOne — Source Code & Configuration / Git Repository Guide



*Version 1.0*

| **Field** | **Detail** |
| --- | --- |
| Document | Source Code & Configuration / Git Repository Guide |
| Project | ClusterOne — Distributed GPU Cluster Computing Platform |
| Repository | `diu-cse/clusterone-infra` |
| Traces to | SRS FR-11, NFR-6 |
| Status | **Structure and conventions final. Code population in progress across weeks 2–12** |

> **Note on completeness.** This document specifies the repository layout, conventions and contribution rules. The code itself is written progressively as each Ansible role is built during the twelve-week schedule, so the repository is not complete at the time of this submission. The directories marked *pending* below indicate what remains.

# 1. Purpose and Governing Rule

ClusterOne's deliverable is not a novel application. It is a *reproducible configuration* of well-established upstream tools. The repository is therefore the primary technical artefact of the project, and its quality is measured by one test: can a second person rebuild the cluster from it?

**The governing rule: if it is not in this repository, it does not exist.** A setting applied by hand on a live node will be silently reverted by the next playbook run and will not survive the rebuild drill.

This rule has a corollary that shapes the whole codebase: **prefer upstream tools over custom code.** Every custom component is a maintenance liability owned by a student who will graduate. Slurm, Apptainer, Open OnDemand, Prometheus and Grafana are used as shipped wherever they solve the problem.

# 2. Repository Layout

```
clusterone-infra/
├── README.md                      what this is, how to run it
├── ansible.cfg
├── requirements.yml               Ansible collections
├── .gitignore
├── .pre-commit-config.yaml        lint hooks
│
├── inventory/
│   ├── pilot.yml                  hosts, groups, per-node vars
│   └── group_vars/
│       ├── all.yml
│       ├── gpu_nodes.yml
│       └── anchor.yml             (vault-encrypted values referenced here)
│
├── roles/
│   ├── common/                    users, sshd, ntp, apt-hold, ufw
│   ├── identity/                  sssd -> AD, uid/gid consistency
│   ├── nfs_server/                zfs pools, exports, backup timers
│   ├── nfs_client/                autofs mounts
│   ├── munge/                     key distribution
│   ├── slurm_common/              slurm.conf, cgroup.conf
│   ├── slurm_controller/          slurmctld, slurmdbd, mariadb
│   ├── slurm_compute/             slurmd, prolog/epilog
│   ├── gpu_node/                  driver hold, persistence, power cap, dcgm
│   ├── apptainer/                 runtime + image publication
│   ├── monitoring_server/         prometheus, grafana, alertmanager, loki
│   ├── monitoring_agent/          node_exporter, dcgm-exporter, promtail
│   └── ood_portal/                open ondemand, apps, oidc
│
├── playbooks/
│   ├── site.yml                   everything
│   ├── anchor.yml                 control plane only
│   ├── compute.yml                compute nodes only
│   └── rebuild-node.yml           the criterion-6 drill
│
├── containers/                    Apptainer definition files
│   ├── pytorch.def
│   ├── tensorflow.def
│   └── cuda-base.def
│
├── templates/                     user-facing job templates
│   ├── train.sbatch
│   ├── interactive.sbatch
│   └── teaching.sbatch
│
├── bench/                         benchmark workloads
│   └── resnet50_train.sbatch      used for the power-cap sweep
│
├── dashboards/                    Grafana dashboards as JSON
│   ├── wallboard.json
│   ├── operations.json
│   └── my-jobs.json
│
└── docs/
    ├── asset-register.xlsx
    ├── runbooks/                  one page per Alertmanager rule
    ├── test-evidence/
    └── user-guide/
```

## 2.1 Mapping to the required source-code structure

The requirements list asks for `source-code/`, `frontend/`, `backend/`, `scheduler/` and `monitoring/`. ClusterOne's equivalents are listed below. The mapping is not one-to-one, because the project deliberately configures upstream systems rather than writing a new frontend and backend, and stating that plainly is more honest than creating empty directories to match a template.

| Required | ClusterOne equivalent | Notes |
| --- | --- | --- |
| `source-code/` | The whole repository | Infrastructure-as-code is the source |
| `frontend/` | `roles/ood_portal/` — Open OnDemand app definitions, `submit.yml.erb` templates, OIDC configuration, branding | No bespoke web frontend is written. Customisation is by configuration, which is upgrade-safe |
| `backend/` | `roles/slurm_controller/`, `roles/nfs_server/`, `roles/identity/` | Control plane. The only bespoke backend code is the wall-board aggregation service (§4) |
| `scheduler/` | `roles/slurm_common/`, `roles/slurm_compute/` — `slurm.conf`, `cgroup.conf`, `gres.conf`, prolog and epilog scripts | The scheduling logic is Slurm configuration, not custom code |
| `monitoring/` | `roles/monitoring_server/`, `roles/monitoring_agent/`, `dashboards/` | Prometheus rules, Alertmanager routes, Grafana JSON |

# 3. Role Standard

Every role follows the same structure, so that an operator who has read one role can read any of them.

```
roles/<name>/
├── defaults/main.yml     tunable values, documented, with sane defaults
├── vars/main.yml         internal constants
├── tasks/main.yml        idempotent tasks, tagged
├── handlers/main.yml     service restarts
├── templates/            jinja2 templates for config files
├── files/                static files
└── README.md             what it does, what it needs, how to verify it worked
```

Every role's `README.md` must state the **verification command** — the observable check that proves the role worked. `systemctl status` is not sufficient on its own; the check must exercise the behaviour. For example, the `gpu_node` role verifies with a Slurm-allocated `apptainer exec --nv` that prints `torch.cuda.is_available()`.

## 3.1 Idempotence

Every role must be idempotent: running it twice against a healthy node produces no changes on the second run. This is test case TC-70 and is a merge requirement, not an aspiration. Non-idempotent roles make the rebuild drill unpredictable and make it impossible to distinguish an intended change from drift.

# 4. Custom Code Inventory

The pilot contains deliberately little bespoke code. It is listed exhaustively here so that its maintenance cost is visible.

| Component | Language | Lines (approx.) | Location | Purpose |
| --- | --- | --- | --- | --- |
| Prolog: scratch creation | Bash | 10 | `roles/slurm_compute/files/prolog.d/10-scratch` | Per-job scratch directory |
| Prolog: dataset staging | Bash | 15 | `roles/slurm_compute/files/prolog.d/20-dataset` | Stage `/datasets/<name>` to node-local cache |
| Epilog: cleanup | Bash | 8 | `roles/slurm_compute/files/epilog.d/90-cleanup` | Wipe scratch, reset GPU state |
| GPU power cap unit | systemd | 15 | `roles/gpu_node/files/clusterone-gpu-power.service` | Persistence mode and power cap |
| Dataset cache pruner | Bash + cron | 15 | `roles/slurm_compute/files/prune-dataset-cache` | Remove cache entries unused for 30 days |
| Backup timers | Bash + systemd | 60 | `roles/nfs_server/files/backup/` | Snapshots, `mysqldump`, off-anchor `rsync` |
| Wall-board aggregation service | Python | ~200 | `roles/monitoring_server/files/wallboard/` | Read-only JSON API for the public wall board |

Nothing else is written from scratch. Every addition to this table requires justification at the governance review, because the alternative to custom code is almost always an upstream feature that someone else maintains.

## 4.1 Wall-board aggregation service

The only non-trivial bespoke component. It exists because the public wall board must not hold Slurm or Prometheus credentials and must be safe to display on an unauthenticated screen in a corridor.

- Read-only; no endpoint mutates state.
- Exposes no personally identifying information.
- Caches for 15 seconds to protect `slurmctld` from a refresh loop.
- On upstream failure, serves the last good cached payload with a stale flag rather than failing the display.

Endpoints are specified in the Database & API Design document.

# 5. Conventions

## 5.1 Branching and review

| Branch | Purpose |
| --- | --- |
| `main` | Deployable. Every commit on `main` has passed review |
| `feat/<short-name>` | New role or feature |
| `fix/<short-name>` | Correction |

No direct pushes to `main`. Every change goes through a pull request with at least one reviewer. This is not process for its own sake — it is the mechanism that enforces the bus-factor rule, because a reviewer necessarily reads and understands the change.

## 5.2 Commit messages

Explain *why*, not *what*; the diff already shows what.

```
gpu_node: set power cap from benchmark sweep, not a fixed 300 W

The 300 W value was a placeholder from the design document. The
week-7 sweep on the RTX 4090 nodes found the knee at 320 W, costing
6% throughput for a 29% power reduction. Value moved to defaults so
each card model can be tuned separately.
```

## 5.3 Secrets

All secrets live in Ansible Vault. Nothing sensitive is committed in plaintext — including database passwords, the AD bind account, the Grafana admin password, TLS private keys, and the munge key.

The munge key is generated once and distributed by the `munge` role. Anyone holding it can submit jobs as any user, so it is treated as the most sensitive artefact after the directory credentials.

A pre-commit hook scans for common secret patterns. It is a safety net, not the control; the control is that secrets are never written outside Vault in the first place.

## 5.4 Linting

`ansible-lint`, `yamllint` and `shellcheck` run as pre-commit hooks and in CI. A pull request that fails linting is not reviewed until it passes, which keeps review attention on substance.

## 5.5 Documentation in the repository

- Every role has a `README.md` with a verification command.
- Every Alertmanager rule has exactly one page in `docs/runbooks/`. An alert without a runbook is not deployed.
- Grafana dashboards are exported to `dashboards/*.json` on change, so that dashboard work is reviewable and recoverable like any other configuration.

# 6. Build Status

| Component | Target week | Status |
| --- | --- | --- |
| Repository created; this document committed | 1 | Pending |
| `common`, `monitoring_agent` | 2 | Pending |
| `identity`, `nfs_server`, `nfs_client` | 5 | Pending |
| `munge`, `slurm_common`, `slurm_controller` | 6 | Pending |
| `gpu_node`, `apptainer`, `containers/` | 7 | Pending |
| `slurm_compute` (prolog/epilog), `gres.conf`, `cgroup.conf` | 8 | Pending |
| `monitoring_server`, `dashboards/`, `docs/runbooks/` | 9 | Pending |
| `ood_portal` | 10 | Pending |
| `templates/` job template library, `docs/user-guide/` | 11 | Pending |
| `playbooks/rebuild-node.yml` validated by the timed drill | 12 | Pending |

# 7. Continuity Rules

These apply to the repository specifically and are the conditions under which the codebase survives its authors.

1. **Everything in Git** — playbooks, Slurm configuration, Grafana dashboards as JSON, container definitions, documentation, runbooks.
2. **Bus factor 1 is a blocker.** No role is merged until a second person has independently run it and confirmed its verification command.
3. **Quarterly rebuild drill, timed.** The repository passes or fails on this. If the drill fails, the repository or its documentation is wrong.
4. **Written handover** at the end of every student operator's term, with a two-week overlap.
5. **Prefer upstream over custom.** Any addition to the custom code inventory in §4 is justified at the governance review, or it is not merged.
