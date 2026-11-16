# ClusterOne — User & Administrator Manual



*Version 1.0*

| **Field** | **Detail** |
| --- | --- |
| Document | User & Administrator Manual |
| Project | ClusterOne — Distributed GPU Cluster Computing Platform |
| Audience | Part A: students, researchers and faculty. Part B: systems administrator and student operators |
| Portal | `https://clusterone.diu.edu.bd` |
| Status | Draft — Pilot / Phase 1 |

---

# PART A — USER MANUAL

# 1. What ClusterOne Is

ClusterOne is a shared GPU computing service. You submit a job through a web browser, the scheduler finds a free GPU, your job runs inside a ready-made container, and your results come back to your home directory.

You do **not** need to install CUDA, you do **not** need an SSH key, and you do **not** need to know which physical machine your job runs on. A Windows laptop and a browser are sufficient.

# 2. Getting an Account

1. Ask your supervisor or course instructor to request access from the ClusterOne operations team.
2. Read and sign the Acceptable Use Policy.
3. Log in at `https://clusterone.diu.edu.bd` with your normal DIU credentials.

Your account is tied to the university directory. There is no separate ClusterOne password.

You will be placed in one or more **accounts**, which determine what you can use:

| Account type | Partitions available | Typical limits |
| --- | --- | --- |
| `course-<code>` (coursework) | `teaching`, `interactive` | 1 job, 1 GPU, 4 h |
| `research-<lab>` (research) | `gpu`, `interactive` | 2 jobs, 4 GPUs, 24 h |

# 3. Choosing a Partition

| Partition | Use it for | Max time | Notes |
| --- | --- | --- | --- |
| `interactive` | Jupyter, VS Code, debugging, quick experiments | 8 h | Highest priority — starts fastest |
| `gpu` | Research training runs | 24 h | Whole GPU cards, no sharing |
| `teaching` | Coursework and assignments | 4 h | GPUs are shared via MPS |

If you are experimenting, use `interactive`. If you are training something that will run overnight, use `gpu`. Do not use `gpu` for a five-minute test — you will wait in a queue behind long jobs for no reason.

# 4. Running an Interactive Session (Jupyter)

1. Log in to the portal.
2. Choose **Interactive Apps → Jupyter**.
3. Set the partition to `interactive`, GPUs to 1, and the time you actually need.
4. Click **Launch**, wait for the session to start, then click **Connect**.

Ask for the time you need, not the maximum. A shorter request is scheduled sooner, because the backfill scheduler can fit it into gaps that a long request cannot.

# 5. Submitting a Batch Job

Use the published template. It already encodes the two habits that matter most on this cluster.

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

Submit it from the portal's job composer, or from a shell session with `sbatch train.sbatch`.

## 5.1 The two habits this template teaches

**Read from `/scratch`, never from NFS.** Your dataset is staged to fast local disk on the compute node before your job body starts. Reading directly from `/datasets` over the network saturates the shared uplink, and when four people do it at once, everyone reports that the cluster is slow.

**Checkpoint, and resume if a checkpoint exists.** Save periodically and pass `--resume-if-exists`. Jobs written this way survive walltime limits, node failures, and the preemption that arrives in Phase 2 — with no change to your script.

# 6. Storage: Where to Put Things

| Location | Quota | Backed up | Use it for |
| --- | --- | --- | --- |
| `/home/<you>` | 20 GB | Nightly | Code, notebooks, configs. **Never datasets** |
| `/projects/<proj>` | 500 GB | Weekly | Shared project data, checkpoints, results |
| `/datasets` | — | n/a | Read-only shared datasets. Ask the operations team to add one |
| `/scratch/$SLURM_JOB_ID` | Node disk | **No** | Working space during your job. **Deleted when the job ends** |

Anything left in `/scratch` when your job ends is gone. Copy results to `/home` or `/projects` before the job finishes.

# 7. Monitoring Your Jobs

| What you want | Command | Portal equivalent |
| --- | --- | --- |
| My queued and running jobs | `squeue -u $USER` | Active Jobs page |
| Why is my job still pending | `squeue -j <id> --start` | Active Jobs → job detail |
| Details of a running job | `scontrol show job <id>` | Job detail |
| History and resource usage | `sacct -u $USER --format=JobID,JobName,State,Elapsed,AllocTRES` | Job history |
| Cancel a job | `scancel <id>` | Cancel button |
| Cluster state | `sinfo` | Wall board |

The **My Jobs** dashboard in the portal shows your queue position, the GPU utilisation of your running jobs, and your fairshare standing.

Fairshare means that the more GPU time you have consumed recently, the lower your priority becomes relative to users who have consumed less. It decays with a seven-day half-life, so a heavy week does not penalise you permanently.

# 8. Container Images

Three images are provided at `/opt/apptainer/images`:

| Image | Contents |
| --- | --- |
| `pytorch.sif` | PyTorch with CUDA and cuDNN |
| `tensorflow.sif` | TensorFlow with GPU support |
| `cuda-base.sif` | CUDA runtime only, for building on |

Always pass `--nv` to `apptainer exec` — without it, your container cannot see the GPU.

You cannot build images on the cluster during the pilot. If you need a package that is not present, either `pip install --user` inside your job (PyPI is allowlisted), or request a new image from the operations team.

# 9. Rules You Must Follow

Signed at account creation. Prohibited:

- Cryptocurrency mining
- Password cracking or credential attacks
- Personal commercial work
- Any attempt to access another user's jobs, files or GPUs
- Circumventing walltime, quota or isolation controls
- Sharing your credentials

Not permitted on ClusterOne under any circumstances: student academic records, HR or payroll data, unanonymised human-subject data, or any personally identifiable information. A project needing those does not run here.

# 10. Common Problems

| Problem | Cause | Fix |
| --- | --- | --- |
| `torch.cuda.is_available()` returns `False` | `--nv` missing, or no GPU requested | Add `--nv`; check `--gres=gpu:1` is in your script |
| Job pending for a long time | Cluster busy, or your request is large | Request fewer GPUs, less time, or use `interactive` for short work |
| Job killed at exactly the walltime | Time limit reached | Increase `--time`, and make sure you are checkpointing |
| Job killed with an out-of-memory message | Exceeded `--mem` | Increase `--mem` or reduce your batch size |
| Results missing after the job ended | They were written to `/scratch` | Copy to `/home` or `/projects` before the job ends |
| "Permission denied" on a project directory | Not a member of that project group | Ask the project owner to request access |
| Training much slower than expected | Reading data over NFS instead of from `/scratch` | Use `--comment=dataset:<name>` and read from `/data` as in the template |
| Cannot see a GPU you know is on the node | It was not allocated to you | Working as designed. Request more GPUs if you need them |

# 11. Getting Help

1. Check the user documentation site and this manual.
2. Check the wall board — if nodes are down, the operations team already knows.
3. Contact the student operators on duty with your **job ID**. A job ID makes a problem diagnosable in minutes; a description of the symptom alone rarely does.

---

# PART B — ADMINISTRATOR MANUAL

# 12. Roles and Responsibilities

| Role | Commitment | Responsibility |
| --- | --- | --- |
| Faculty sponsor | Accountable | Budget, policy, leadership interface |
| Systems administrator | 0.5–1.0 FTE, salaried staff | Anchor node, Slurm, storage, security |
| Student operators | 2–3, stipended, rotating | Tier-1 support, monitoring, onboarding, documentation |
| User support | Rotating faculty | Helping researchers get jobs running |

**If a salaried systems administrator post cannot be funded, run the pilot as specified and stop there.** The pilot's always-on, no-scavenging scope is deliberately survivable by a small team; Phase 2 scavenging is what generates continuous operational load.

# 13. Daily and Weekly Operations

## 13.1 Daily

- Check the operations dashboard: node states, alert status, disk capacity.
- Review any alerts that fired overnight and confirm each was resolved through its runbook.
- Check the queue for jobs pending more than four hours while nodes sit idle — this indicates scheduler misconfiguration, not user error.

## 13.2 Weekly

- Confirm nightly and weekly backups completed.
- Review `GPUIdleWhileAllocated` notifications and contact the users holding cards without using them.
- Prune dataset cache entries older than 30 days (automated; verify it ran).
- Review the defect and incident logs.

## 13.3 Monthly

- Publish the KPIs on the wall board: active users, completed jobs, median queue wait, GPU utilisation, control-plane availability, kWh per completed job.
- Review the asset register against reality.
- Rotate student operator duties with a two-week overlap.

# 14. User and Account Administration

```bash
# Create an account (project or course)
sacctmgr add account research-vision \
    Description="Computer Vision Lab" Organization=diu-cse

# Add a user to an account with a QOS
sacctmgr add user shahriar Account=research-vision \
    DefaultAccount=research-vision QOS=normal

# Restrict a coursework account to the teaching partition
sacctmgr modify user where user=student01 set \
    MaxJobs=1 MaxTRES=gres/gpu=1

# Inspect a user's associations and limits
sacctmgr show assoc user=shahriar format=Account,Partition,QOS,MaxJobs,MaxTRES

# Suspend access (policy violation or departure)
sacctmgr modify user where user=shahriar set MaxJobs=0
```

Fairshare credit for hardware-contributing labs is applied by raising the share value on that lab's account. The mechanism and the amount are defined in the GPU Sharing & Governance Policy.

# 15. Node Administration

```bash
# Cluster and node state
sinfo -Nel
scontrol show node c1-gpu03

# Take a node out of service (drain: existing jobs finish)
scontrol update NodeName=c1-gpu03 State=DRAIN Reason="thermal investigation"

# Return a node to service
scontrol update NodeName=c1-gpu03 State=RESUME

# Reload configuration after a slurm.conf change deployed by Ansible
scontrol reconfigure

# Job administration
scontrol hold <jobid>
scontrol release <jobid>
scancel <jobid>
scancel -u <username>
```

Always give a `Reason` when draining. Six weeks later, nobody remembers why a node was drained, and an unexplained drained node is capacity lost permanently.

# 16. Making Configuration Changes

**Nothing is edited by hand on a live node.** The procedure is always:

1. Edit the file in `clusterone-infra` on your workstation.
2. Commit with a message explaining *why*, not *what*.
3. Push and open a pull request. A second person reviews it.
4. Run the playbook: `ansible-playbook -i inventory/pilot.yml playbooks/<x>.yml --limit <host>`.
5. `scontrol reconfigure` if Slurm configuration changed.
6. Verify the observable behaviour, not just the file contents.

A setting applied by hand will be silently reverted by the next playbook run and will not survive the rebuild drill.

# 17. Monitoring and Alert Response

| Alert | Condition | Severity | First action |
| --- | --- | --- | --- |
| `NodeDown` | `up == 0` for 2 min | Critical | Check power and network; consult the runbook |
| `SlurmctldDown` | Controller unreachable 1 min | Critical | Check the anchor node; restart `slurmctld` |
| `GPUOverTemp` | `DCGM_FI_DEV_GPU_TEMP > 85` for 5 min | Critical | Node auto-drains; investigate room cooling |
| `GPUTempWarning` | `> 80` for 10 min | Warning | Check airflow; review the room's thermal log |
| `GPUEccError` | `DCGM_FI_DEV_ECC_DBE_VOL_TOTAL` increases | Critical | Drain the node. **Do not reallocate the card** |
| `GPUXidError` | Any XID reported by DCGM | Warning | Log it; watch for repetition |
| `DiskFull` | Any filesystem above 85% | Warning | Identify the consumer; enforce quota |
| `ScratchFull` | `/scratch` above 90% | Warning | Prune the dataset cache; check epilog cleanup is running |
| `NFSLatencyHigh` | p99 above 100 ms for 10 min | Warning | Look for jobs reading directly from NFS |
| `QueueStalled` | Jobs pending over 4 h with idle nodes | Warning | Scheduler misconfiguration — check partitions and limits |
| `GPUIdleWhileAllocated` | Utilisation below 5% for 30 min on an allocated card | Info | Notify the user. Do not automate reclamation until the false-positive rate is known |

Every alert has a runbook page in `docs/runbooks/`. No alert is deployed without one.

## 17.1 Dashboards

| Dashboard | Audience | Contents |
| --- | --- | --- |
| Wall board | Public, on a screen in the department | Nodes up/down, GPU utilisation heatmap, jobs running/queued, users active today, cluster kWh today |
| Operations | Operations team | Per-node CPU/RAM/GPU/temperature/power, NFS throughput, `slurmctld` health, disk capacity, alert status |
| My Jobs | Per user, via the portal | Queue position, running jobs, GPU utilisation, fairshare standing |

The wall board is not decoration. It is the single most effective tool for recruiting users and for demonstrating value to leadership without writing a report.

# 18. Incident Handling

| Situation | Immediate action |
| --- | --- |
| Suspected node compromise | Drain, isolate at the switch port, **do not power off**, notify sponsor and DIU IT, preserve logs, rebuild from Ansible |
| Suspected credential compromise | Disable in the directory, cancel the user's jobs, review portal and accounting logs |
| Hardware failure | Drain with a reason, record in the asset register, replace or repair, rebuild from Ansible |
| Data loss report | Stop writes to the affected area, restore from backup, record as an incident against NFR-5 |
| Policy violation | Warning, then suspension of the Slurm association, then referral to the department |

A node under investigation is never returned to service by cleaning it in place. It is rebuilt from the repository.

# 19. Backup and Restore

Summary only; the full procedure is in the Backup & Recovery Procedure document.

| Item | Frequency | Location |
| --- | --- | --- |
| `/home` | Nightly | `/tank/backup` + off-anchor copy |
| `/projects` | Weekly | `/tank/backup` + off-anchor copy |
| `slurm_acct_db`, `keycloak` | Nightly `mysqldump` | `/tank/backup` |
| Grafana dashboards | On change, as JSON | Git |
| Configuration | On change | Git |

A backup that has never been restored is not a backup. A restore drill is performed at least once during the pilot.

# 20. Continuity Rules

These are not aspirations. They are the conditions under which the project survives its founders.

1. **Everything in Git** — playbooks, Slurm configuration, Grafana dashboards as JSON, container definitions, documentation.
2. **Bus factor 1 is a blocker.** No component ships until a second person has independently operated it.
3. **Quarterly rebuild drill, timed.** If it fails, the documentation is wrong — fix the documentation.
4. **Written handover** at the end of every student operator's term, with a two-week overlap.
5. **Every alert links to a runbook.** No alert without a documented response.
