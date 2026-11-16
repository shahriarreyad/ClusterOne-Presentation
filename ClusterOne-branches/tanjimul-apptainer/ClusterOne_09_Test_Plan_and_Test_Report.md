# ClusterOne — Test Plan & Test Report



*Version 1.0*

| **Field** | **Detail** |
| --- | --- |
| Document | Test Plan & Test Report |
| Project | ClusterOne — Distributed GPU Cluster Computing Platform |
| Traces to | SRS FR-1 … FR-11, NFR-1 … NFR-8 |
| Status | **Test Plan complete. Test Report pending execution** — results are recorded against the cases below as the build progresses |
| Owner | Systems administrator, with student operators executing and recording |

> **Note on completeness.** Sections 1–7 (the Test Plan) are final. Section 8 (the Test Report) is a results register with the outcome columns empty; it is filled in during weeks 5–12 and reissued as version 1.1 at the end of the pilot. No result is entered from expectation — a case is Pass only when it has been run and observed.

# 1. Purpose and Scope

This document defines how ClusterOne is verified: what is tested, how, by whom, against which requirement, and what constitutes a pass. It also serves as the record of results.

In scope: functional verification of the pilot system (one anchor node, four to six Linux compute nodes, three partitions, portal, monitoring, storage, security controls) and measurement of the eight non-functional targets in the SRS.

Out of scope: features deliberately excluded from the pilot — scavenging and preemption, Windows nodes, multi-node distributed training, fractional sharing on the `gpu` partition, hosted inference, and ML-based scheduling.

# 2. Test Approach

| Level | What it covers | When |
| --- | --- | --- |
| Component test | A single role or service behaves correctly after deployment | Immediately after each Ansible role is applied |
| Integration test | Two or more components work together (portal → scheduler → GPU → storage) | Weeks 6–10 |
| System test | End-to-end user workflows on the assembled cluster | Weeks 10–11 |
| Acceptance test | The six pilot exit criteria and the ten KPIs | Week 12 |
| Non-functional measurement | Continuous measurement against NFR targets | Weeks 6–12, reported monthly |

Verification is by observation, not inspection. A configuration file containing the right setting is not evidence; the observed behaviour is.

# 3. Test Environment

| Element | Configuration |
| --- | --- |
| Anchor | `c1-anchor`, 10.20.0.10, Ubuntu 24.04 LTS |
| Compute | `c1-gpu01`–`c1-gpu06`, 10.20.0.21–26, Ubuntu 24.04 LTS, NVIDIA driver 550 |
| Partitions | `gpu` (24 h), `interactive` (8 h), `teaching` (4 h, MPS) |
| Containers | `pytorch.sif`, `tensorflow.sif`, `cuda-base.sif` |
| Test accounts | `ops` (admin), `research-test` (researcher role), `course-test` (student role) |
| Client | Windows laptop, browser only, no SSH key and no CUDA installed — this is the realistic user configuration and must be used for portal tests |

There is no separate staging cluster. Component tests are run against a single node held in `DRAIN` before it is released to users; system tests are run on the live cluster during the onboarding weeks, before the general user population is admitted.

# 4. Entry and Exit Criteria

**Entry to system testing:** every node reports `IDLE` in `sinfo`; every node is an `UP` Prometheus target; `id <user>` is identical cluster-wide; the container image set is published.

**Exit from testing (pilot acceptance):** all Priority-High cases Pass; no open Severity-1 defect; all six exit criteria met; all ten KPIs measured and published.

# 5. Defect Severity

| Severity | Definition | Response |
| --- | --- | --- |
| S1 | Data loss, isolation failure, or the cluster is unusable | Stop, fix before any further testing |
| S2 | A requirement is not met; a workaround exists | Fix before user onboarding |
| S3 | Degraded behaviour or poor usability | Fix within the pilot if capacity allows |
| S4 | Cosmetic or documentation defect | Log and batch |

An isolation failure is always S1 regardless of how difficult it is to trigger.

# 6. Functional Test Cases

## 6.1 Authentication and access control

| ID | Requirement | Case | Method | Pass criterion | Priority |
| --- | --- | --- | --- | --- | --- |
| TC-01 | FR-1 | Valid user logs in to the portal | Browser, valid AD credentials via OIDC | Portal dashboard loads as the correct POSIX user | High |
| TC-02 | FR-1 | Invalid credentials rejected | Browser, wrong password | Access refused; failure logged in Keycloak | High |
| TC-03 | FR-1, FR-10 | Unauthenticated access blocked | Request a portal URL with no session | Redirected to login; no data returned | High |
| TC-04 | FR-10 | Cross-user file access denied | User A attempts to read `/home/userB` | Permission denied | High |
| TC-05 | FR-10 | SSH to a compute node without an allocation | `ssh c1-gpu01` with no running job | Connection refused by `pam_slurm_adopt` | High |
| TC-06 | FR-10 | SSH permitted within an allocation | Submit a job, then `ssh` to the allocated node | Connection accepted, placed in the job's cgroup | Medium |
| TC-07 | FR-1 | UID/GID consistency | `id <user>` on anchor and every compute node | Identical output everywhere | High |

## 6.2 Job submission, scheduling and execution

| ID | Requirement | Case | Method | Pass criterion | Priority |
| --- | --- | --- | --- | --- | --- |
| TC-10 | FR-2 | Submit a batch GPU job from the portal | Job composer, `--gres=gpu:1` | Job accepted, job ID returned | High |
| TC-11 | FR-2 | Submit with an unsatisfiable resource request | Request more GPUs than any node has | Rejected at submission with a clear message | Medium |
| TC-12 | FR-3 | Queue ordering by partition priority | Submit to `gpu` and `interactive` while busy | `interactive` job starts first | High |
| TC-13 | FR-3 | Walltime enforcement | Submit a job exceeding its `--time` | Job killed cleanly at the limit; state `TIMEOUT` | High |
| TC-14 | FR-3 | Backfill scheduling | Submit a long job, then a short job that fits the gap | Short job runs without delaying the long job's start estimate | Medium |
| TC-15 | FR-3 | Fairshare | Two accounts submit heavy loads; one has consumed more | Priority favours the lower-usage account | Medium |
| TC-16 | FR-5 | Containerised execution | `apptainer exec --nv pytorch.sif python -c "import torch; print(torch.cuda.is_available())"` inside an allocation | Prints `True` | High |
| TC-17 | FR-5 | Same result on every node | Run TC-16 on each compute node in turn | Identical result on all nodes | High |
| TC-18 | FR-6 | Result retrieval | Job writes output; user opens it in the portal file browser | Output file present, readable, complete | High |
| TC-19 | FR-2, FR-5 | Job template library works unmodified | Submit the published template with a real small dataset | Completes successfully with no edits beyond the script name | High |

## 6.3 GPU allocation and isolation

| ID | Requirement | Case | Method | Pass criterion | Priority |
| --- | --- | --- | --- | --- | --- |
| TC-20 | FR-4 | Allocated GPU visible | 1-GPU job runs `nvidia-smi` | Exactly one card listed | High |
| TC-21 | FR-4 | Unallocated GPU not visible | 1-GPU job on a 2-GPU node runs `nvidia-smi` | The second card is absent, not merely idle | High |
| TC-22 | FR-4 | `CUDA_VISIBLE_DEVICES` set correctly | Echo the variable inside the job | Zero-based index matching the allocation | High |
| TC-23 | FR-4 | Device access denied at the kernel level | Attempt to open an unallocated `/dev/nvidiaN` inside a job | Permission denied | High |
| TC-24 | FR-4 | Memory constraint enforced | Job allocates more RAM than requested | Job killed by cgroup, other jobs on the node unaffected | High |
| TC-25 | FR-4 | MPS on `teaching` | Two coursework jobs share one card | Both run; neither can see the other's memory | Medium |

## 6.4 Storage

| ID | Requirement | Case | Method | Pass criterion | Priority |
| --- | --- | --- | --- | --- | --- |
| TC-30 | FR-9 | Home directory mounted and private | `ls -ld /home/<user>` on a compute node | Mounted, mode 700, correct owner | High |
| TC-31 | FR-9 | `/datasets` is read-only | Attempt to write inside a job | Write refused | High |
| TC-32 | FR-9 | Scratch created per job | Check `/scratch/$SLURM_JOB_ID` during the job | Exists, mode 700, owned by the job user | High |
| TC-33 | FR-9 | Scratch wiped after the job | Check the same path after exit | Removed | High |
| TC-34 | FR-9 | Dataset staged by the prolog | Submit with `--comment=dataset:<name>` | Dataset present under `/scratch/_datasets/<name>` before the job body starts | High |
| TC-35 | FR-9 | Dataset cache reused | Submit the same job again on the same node | No re-copy; job starts measurably faster | Medium |
| TC-36 | FR-9 | Project ACLs | User outside the project attempts access to `/projects/<proj>` | Permission denied | High |
| TC-37 | NFR-5 | Quota enforcement | Exceed the 20 GB home quota | Write refused with a clear error; no other user affected | Medium |

## 6.5 Monitoring and alerting

| ID | Requirement | Case | Method | Pass criterion | Priority |
| --- | --- | --- | --- | --- | --- |
| TC-40 | FR-8 | Metrics collected from every node | Prometheus targets page | All nodes `UP` on ports 9100 and 9400 | High |
| TC-41 | FR-8 | GPU metrics present | Query `DCGM_FI_DEV_GPU_UTIL`, `_TEMP`, `_POWER_USAGE` | Non-null series for every card | High |
| TC-42 | FR-8 | `NodeDown` alert | Pull a network cable from a compute node | Alert fires within two minutes; the runbook resolves it | High |
| TC-43 | FR-8 | `GPUOverTemp` auto-drain | Simulate or lower the threshold temporarily | Node automatically drained | Medium |
| TC-44 | FR-8 | `GPUIdleWhileAllocated` | Hold an allocation idle for 30 minutes | Informational alert fires | Low |
| TC-45 | FR-8 | Dashboards render | Open wall board, operations board, and the per-user view | All panels populated with live data | Medium |
| TC-46 | FR-8 | Every alert has a runbook | Cross-check alert rules against `docs/runbooks/` | One page per rule, no gaps | High |

## 6.6 Accounting

| ID | Requirement | Case | Method | Pass criterion | Priority |
| --- | --- | --- | --- | --- | --- |
| TC-50 | FR-7 | Job record written | `sacct -j <id>` after completion | User, account, partition, elapsed time and exit state all correct | High |
| TC-51 | FR-7 | GPU seconds tracked | `sacct --format=AllocTRES` | `gres/gpu` present and correct | High |
| TC-52 | FR-7 | Failed jobs recorded | Submit a job that exits non-zero | State `FAILED` with the exit code | Medium |
| TC-53 | FR-7 | Energy recorded | `sacct --format=ConsumedEnergy` | Non-zero value | Medium |
| TC-54 | FR-7 | Usage report by account | `sreport cluster AccountUtilizationByUser --tres=gres/gpu` | Report generates with plausible totals | Medium |

## 6.7 Security

| ID | Requirement | Case | Method | Pass criterion | Priority |
| --- | --- | --- | --- | --- | --- |
| TC-60 | NFR-7 | Egress allowlist enforced | From a compute node, reach an unlisted external host | Blocked | High |
| TC-61 | NFR-7 | Allowlisted egress works | `pip install` from PyPI inside a job | Succeeds | High |
| TC-62 | NFR-7 | Compute nodes unreachable from the user VLAN | Attempt to connect to `c1-gpu01` from a user workstation | No route | High |
| TC-63 | NFR-7 | Rootless containers | Attempt `apptainer exec --writable` | Refused | High |
| TC-64 | NFR-7 | Secrets absent from Git | Scan repository history for credentials | No plaintext secrets found | High |
| TC-65 | NFR-7 | Munge authentication required | Present an invalid credential to `slurmd` | Rejected and logged | Medium |

## 6.8 Reproducibility and recovery

| ID | Requirement | Case | Method | Pass criterion | Priority |
| --- | --- | --- | --- | --- | --- |
| TC-70 | FR-11 | Playbook idempotence | Run `compute.yml` twice against a healthy node | Second run reports no changes | High |
| TC-71 | FR-11 | Hand edits are reverted | Change a setting by hand, re-run the playbook | Setting restored from the repository | Medium |
| TC-72 | NFR-6 | **Node rebuild drill** | Second operator rebuilds a node from bare metal, original builder absent, timed | Node back in service in under two hours, no undocumented step | High |
| TC-73 | NFR-5 | Backup restore | Restore `slurm_acct_db` and a user home directory from backup | Data restored intact and verified | High |
| TC-74 | NFR-4 | Control-plane restart | Restart `slurmctld` while jobs are running | Running jobs unaffected; queue state preserved | High |

# 7. Non-Functional Measurement

| ID | Target | Measurement method | Reporting |
| --- | --- | --- | --- |
| NFR-1 | Median `gpu` queue wait under 30 min | `sacct` submit-to-start over the reporting window | Monthly, published on the wall board |
| NFR-2 | Portal login to running kernel under 3 min (p95) | Open OnDemand logs, timed manually during onboarding | Weeks 10–12 |
| NFR-3 | Mean GPU utilisation while allocated above 60% | `DCGM_FI_DEV_GPU_UTIL` averaged over allocated periods | Monthly |
| NFR-4 | Control-plane availability at least 99% over the final 30 days | Prometheus `up` on `slurmctld` and the portal | Week 12 |
| NFR-5 | Zero data-loss incidents | Incident log | Continuous |
| NFR-6 | Node rebuild under 2 hours by a second operator | TC-72, timed | Week 12 |
| NFR-7 | No unauthorised access to GPUs, files or projects | TC-04, TC-21, TC-23, TC-36, TC-60, TC-62 | Weeks 8 and 12 |
| NFR-8 | A user with no CUDA or SSH experience can submit a job from a browser alone | Observed at the week-11 hands-on session, unaided | Week 11 |

Additional pilot KPIs measured alongside the NFRs: active monthly users (target ≥20), completed jobs (target ≥300), and kWh per completed job (baseline to be established from metered PDU data and `sacct` energy figures).

## 7.1 Power cap benchmark sweep (week 7)

Not a pass/fail test but a measurement that produces a committed configuration value.

```bash
for PL in 450 400 350 300 250; do
  nvidia-smi -pl $PL
  sleep 5
  sbatch --wait --partition=gpu --gres=gpu:1 \
         --job-name="pl-$PL" bench/resnet50_train.sbatch
  echo "=== $PL W ==="; sacct -j $SLURM_JOB_ID --format=Elapsed,ConsumedEnergy
done
```

Select the largest power reduction costing under 10% throughput. Commit the chosen value to `roles/gpu_node/defaults/main.yml`. The result is card-model specific; the sweep is repeated for each distinct GPU model in the cluster.

# 8. Test Report

**Status: pending execution.** Results are recorded here as each case is run.

## 8.1 Execution summary

| Metric | Value |
| --- | --- |
| Test cases defined | 58 |
| Executed | *pending* |
| Passed | *pending* |
| Failed | *pending* |
| Blocked / not run | *pending* |
| Open S1 defects | *pending* |
| Open S2 defects | *pending* |

## 8.2 Results register

Populated as testing proceeds. Every row requires a date, an executor and an evidence reference (log excerpt, screenshot, or command output stored in `docs/test-evidence/`).

| ID | Date | Executed by | Result | Evidence | Defect ID | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| TC-01 | | | | | | |
| TC-02 | | | | | | |
| … | | | | | | |
| TC-74 | | | | | | |

## 8.3 Non-functional results

| ID | Target | Measured | Met? | Measurement window |
| --- | --- | --- | --- | --- |
| NFR-1 | Median `gpu` queue wait < 30 min | *pending* | | |
| NFR-2 | Portal → kernel < 3 min (p95) | *pending* | | |
| NFR-3 | GPU utilisation > 60% | *pending* | | |
| NFR-4 | Control-plane availability ≥ 99% | *pending* | | |
| NFR-5 | Data-loss incidents = 0 | *pending* | | |
| NFR-6 | Node rebuild < 2 h, second operator | *pending* | | |
| NFR-7 | No unauthorised access | *pending* | | |
| NFR-8 | Browser-only submission by a novice | *pending* | | |

## 8.4 Defect log

| Defect ID | Case | Severity | Description | Status | Resolution |
| --- | --- | --- | --- | --- | --- |
| | | | | | |

## 8.5 Pilot exit criteria

All six must be met before Phase 2 is approved.

| # | Criterion | Status |
| --- | --- | --- |
| 1 | ≥20 active users and ≥300 completed jobs | *pending* |
| 2 | Median queue wait on `gpu` published and under 30 minutes | *pending* |
| 3 | Zero data-loss incidents | *pending* |
| 4 | Control-plane availability ≥99% over the final 30 days | *pending* |
| 5 | Measured kWh-per-completed-job baseline established | *pending* |
| 6 | A second person rebuilds a compute node from Ansible, from bare metal, without the original builder present, in under 2 hours — tested, timed and documented | *pending* |

Criterion 6 is the one that matters most. A cluster nobody but its author can rebuild is a prototype, not infrastructure.

## 8.6 Conclusion and sign-off

*To be written at the end of week 12, stating whether the pilot passed, which defects remain open, and the recommendation on proceeding to Phase 2.*

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Systems administrator | | | |
| Faculty sponsor | | | |
