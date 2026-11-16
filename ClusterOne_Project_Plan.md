Yes. Since you want **both normal cluster scheduling + multi-PC distributed AI**, I would design the project as a proper **distributed AI compute platform**, not just a PC-combining experiment.

And your GitHub workflow is also good: **feature branch → PR → `develop` → testing/integration → `main` only at final stable releases**.

I’ll give you the **full project plan first**, without assigning any work to teammates. Later, when you give me the team members, we can divide these modules among them.

# 🚀 Project: ClusterOne — Distributed AI Computing Platform

### Main goal

Build a system where several physical computers/GPU machines are connected into one managed computing cluster.

It should support **two modes**:

```text
                    CLUSTERONE
                        │
              ┌─────────┴─────────┐
              │                   │
        MODE 1: CLUSTER      MODE 2: DISTRIBUTED
        Job Scheduling       Multi-PC AI Computing
              │                   │
        ┌─────┼─────┐       ┌─────┼─────┐
        ↓     ↓     ↓       ↓     ↓     ↓
       PC1   PC2   PC3     GPU1  GPU2  GPU3
        │     │     │       └─────┼─────┘
       JobA  JobB  JobC          │
                              One AI Job
```

---

# 1. First define what ClusterOne actually does

There are **two fundamentally different operations**.

### Mode A — Independent jobs

Suppose you have 5 PCs:

```text
PC1 → RTX 3050
PC2 → RTX 3050
PC3 → RTX 3060
PC4 → RTX 2060
PC5 → RTX 3050
```

Five students submit jobs:

```text
Student A → Training
Student B → Computer Vision
Student C → LLM inference
Student D → Data processing
Student E → Training
```

ClusterOne automatically decides:

```text
Job A → PC3
Job B → PC1
Job C → PC4
Job D → PC2
Job E → PC5
```

This is the **cluster scheduler** part.

---

# 2. Mode B — One job using multiple PCs

Now someone has a huge AI training job.

Instead of:

```text
Job → PC1 only
```

ClusterOne can eventually do:

```text
             ONE TRAINING JOB
                    │
          ┌─────────┼─────────┐
          ↓         ↓         ↓
        PC1       PC2       PC3
       GPU 1     GPU 2     GPU 3
          └─────────┼─────────┘
                    ↓
             Distributed AI
```

This requires **distributed computing**, such as:

* PyTorch Distributed
* NCCL
* DDP
* possibly FSDP/model parallelism later

This is the technically harder part.

---

# 3. Important architecture decision

Don't try to build everything simultaneously.

Build it in this order:

```text
Phase 1
Network
   ↓
Phase 2
Node management
   ↓
Phase 3
GPU detection
   ↓
Phase 4
Job scheduler
   ↓
Phase 5
Container system
   ↓
Phase 6
Web dashboard
   ↓
Phase 7
Monitoring
   ↓
Phase 8
Distributed AI
   ↓
Phase 9
Security
   ↓
Phase 10
Testing + production
```

That gives you a **working system at every major stage**.

---

# 4. Overall architecture

I'd structure it like this:

```text
                         ┌────────────────────┐
                         │      USERS         │
                         │ Students / Research│
                         └─────────┬──────────┘
                                   │
                                   ↓
                         ┌────────────────────┐
                         │   Web Dashboard    │
                         │     Open Web UI    │
                         └─────────┬──────────┘
                                   │
                                   ↓
                    ┌─────────────────────────────┐
                    │       CLUSTER CONTROL       │
                    │                             │
                    │ API / Authentication        │
                    │ Job Manager                 │
                    │ Scheduler                   │
                    │ Resource Manager            │
                    │ Database                    │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    ↓              ↓              ↓
                 PC/GPU1       PC/GPU2        PC/GPU3
                    │              │              │
                  GPU            GPU            GPU
                    │              │              │
                    └──────────────┼──────────────┘
                                   ↓
                         Distributed Computing
```

---

# 5. Physical infrastructure

Start with something realistic.

### Minimum prototype

```text
1 × Controller / Head Node
3–5 × GPU Compute Nodes
1 × Network Switch
Ethernet cables
```

Eventually:

```text
              Router / Internet
                     │
                     │
              ┌──────┴──────┐
              │   Switch    │
              └──────┬──────┘
                     │
        ┌────────────┼────────────┐
        ↓            ↓            ↓
     Anchor        GPU01        GPU02
                    ↓            ↓
                  GPU03        GPU04
                    ↓
                  GPU05
```

---

# 6. Controller / Anchor Node

One machine acts as the brain.

It manages:

* users
* authentication
* jobs
* scheduling
* nodes
* resources
* monitoring
* database
* web interface
* cluster configuration

Think:

> **Anchor = brain**

and

> **Compute nodes = workers**

---

# 7. Compute Node

Every PC connected to ClusterOne becomes a **compute node**.

Each node should report:

```text
CPU
RAM
GPU
GPU VRAM
GPU utilization
Disk
Network
Operating system
Node status
Running jobs
```

Example:

```text
GPU03

CPU: Ryzen 7
RAM: 32 GB

GPU: RTX 3060
VRAM: 12 GB

GPU utilization: 87%
Memory: 9.4/12 GB

Status: BUSY
Current Job: job-1024
```

---

# 8. Node Agent

This is an important part of your own system.

Create a lightweight **ClusterOne Agent** that runs on every compute machine.

For example:

```text
clusterone-agent
```

It communicates with the controller.

It can:

```text
Controller
     ↓
"What's your status?"
     ↓
Node Agent
     ↓
CPU = 50%
RAM = 18GB
GPU = 90%
GPU VRAM = 8GB
```

The agent sends that information back.

Later it can also:

* receive commands
* start jobs
* stop jobs
* report errors
* collect metrics
* manage containers

---

# 9. Scheduler

This is the heart of **Mode A**.

Suppose:

```text
GPU01 → 90% busy
GPU02 → 20% busy
GPU03 → free
GPU04 → 70% busy
```

A user submits:

```text
Train ResNet
GPU required
VRAM ≥ 8GB
```

Scheduler decides:

```text
GPU03 → selected
```

Your scheduler should consider:

* GPU availability
* VRAM
* CPU
* RAM
* queue length
* user priority
* job priority
* GPU type
* estimated resource requirement

---

# 10. Don't reinvent everything

For the actual production scheduler, use **Slurm** rather than writing a scheduler completely from scratch.

Your own ClusterOne software can sit **on top of Slurm**.

Architecture:

```text
User
 ↓
ClusterOne Web UI
 ↓
ClusterOne API
 ↓
Slurm
 ↓
Compute Nodes
```

This is much more realistic.

Your project then becomes:

> **ClusterOne = custom AI cluster management platform built around proven HPC infrastructure.**

The original pilot architecture also chose Slurm specifically for scheduling rather than Kubernetes/HTCondor. 

---

# 11. Container system

Different students may require different environments.

One student:

```text
Python 3.11
PyTorch 2.x
CUDA X
```

Another:

```text
Python 3.10
TensorFlow
CUDA Y
```

You don't want them destroying each other's environments.

Use:

### Apptainer

Example:

```text
student_job.sif
```

Inside:

```text
Python
PyTorch
CUDA libraries
OpenCV
Transformers
etc.
```

Then:

```text
ClusterOne
   ↓
Slurm
   ↓
Apptainer
   ↓
AI Job
```

This matches the existing ClusterOne architecture decision to use Apptainer. 

---

# 12. Job submission system

The user should NOT need to understand Slurm commands.

They should see something like:

```text
        CREATE JOB

Job name:
[ Image Classification ]

GPU:
[ Required ]

Minimum VRAM:
[ 8 GB ]

CPU:
[ 4 cores ]

RAM:
[ 16 GB ]

Dataset:
[ my_dataset ]

Script:
[ train.py ]

Environment:
[ pytorch-cuda ]

       [ SUBMIT JOB ]
```

Then ClusterOne converts this into the appropriate backend job.

---

# 13. Job lifecycle

Every job should have a state.

```text
SUBMITTED
    ↓
QUEUED
    ↓
SCHEDULED
    ↓
RUNNING
    ↓
COMPLETED
```

Or:

```text
FAILED
CANCELLED
TIMEOUT
```

The dashboard should show this clearly.

---

# 14. Job dashboard

Something like:

```text
CLUSTERONE

Nodes
────────────────────
GPU01   🟢 IDLE
GPU02   🔴 BUSY
GPU03   🔴 BUSY
GPU04   🟢 IDLE
GPU05   🟡 DOWN

Jobs
────────────────────
#1021  Training      RUNNING
#1022  YOLO          RUNNING
#1023  LLM           QUEUED
#1024  CNN           COMPLETED
```

---

# 15. Distributed AI module

Now we reach your **original idea**.

This should be a separate module.

### User chooses:

```text
Execution Mode:

○ Single GPU
○ Multi-GPU / Distributed
```

If distributed:

```text
Number of GPUs:
[ 4 ]

Nodes:
[ Automatically select ]
```

ClusterOne allocates:

```text
PC1 → GPU
PC2 → GPU
PC3 → GPU
PC4 → GPU
```

Then launches a distributed PyTorch job.

---

# 16. Distributed training architecture

For example:

```text
                 MASTER
                   │
             PC1 / GPU0
                   │
       ┌───────────┼───────────┐
       ↓           ↓           ↓
    PC2/GPU1    PC3/GPU2    PC4/GPU3
       │           │           │
       └───────────┼───────────┘
                   ↓
            Synchronization
                   ↓
             Model Training
```

PyTorch DDP handles synchronization.

NCCL handles GPU communication.

But this requires **fast networking**.

Your current pilot architecture explicitly keeps multi-node distributed training outside the pilot until faster networking such as 25 GbE is available. 

So:

**Prototype:** test distributed training on whatever suitable network you have.

**Serious production:** upgrade networking before claiming high-performance distributed training.

---

# 17. Storage architecture

You need centralized storage.

Something like:

```text
/home
/projects
/datasets
/scratch
```

But AI training should preferably stage data to local SSD/NVMe rather than repeatedly reading huge datasets across network storage.

Your existing plan specifically establishes `/datasets` as read-only and requires staging datasets to node-local scratch before training. 

---

# 18. Monitoring

You need to know what the cluster is doing.

Use:

```text
Prometheus
      ↓
Metrics
      ↓
Grafana
      ↓
Dashboard
```

Monitor:

```text
CPU
RAM
GPU utilization
GPU memory
temperature
power
disk
network
job count
queue time
node health
```

---

# 19. Energy monitoring

Since this is a university research cluster, measure electricity usage.

Don't claim:

> "ClusterOne saves electricity."

Instead measure:

```text
kWh / completed job
```

Then compare:

```text
Before ClusterOne
vs
After ClusterOne
```

The existing plan also frames this as an **energy-efficiency baseline**, not a guaranteed electricity saving. 

---

# 20. Authentication

Users need accounts.

Eventually:

```text
University account
        ↓
Authentication
        ↓
ClusterOne
```

Then:

```text
Student
Researcher
Faculty
Admin
```

Different permissions.

Your existing architecture uses university AD/POSIX identity and OIDC for web authentication. 

---

# 21. Security

This cannot be an afterthought.

Implement:

* authentication
* authorization
* isolated compute network
* container isolation
* resource limits
* filesystem permissions
* restricted SSH
* controlled internet access
* secrets management
* audit logs

The pilot plan already specifies these kinds of controls. 

---

# 22. API architecture

Build a proper backend.

For example:

```text
clusterone/
│
├── backend/
│   ├── api/
│   ├── auth/
│   ├── jobs/
│   ├── nodes/
│   ├── scheduler/
│   ├── users/
│   ├── resources/
│   └── monitoring/
│
├── agent/
│
├── frontend/
│
├── distributed/
│
├── infrastructure/
│
├── containers/
│
├── tests/
│
└── docs/
```

---

# 23. Recommended complete repository structure

I would eventually aim for something around:

```text
ClusterOne/
│
├── README.md
├── LICENSE
├── CONTRIBUTING.md
├── SECURITY.md
│
├── docs/
│   ├── architecture/
│   ├── setup/
│   ├── api/
│   ├── deployment/
│   ├── user-guide/
│   └── research/
│
├── frontend/
│   ├── dashboard/
│   ├── jobs/
│   ├── nodes/
│   ├── monitoring/
│   └── users/
│
├── backend/
│   ├── api/
│   ├── auth/
│   ├── jobs/
│   ├── nodes/
│   ├── scheduler/
│   ├── resources/
│   ├── users/
│   └── database/
│
├── agent/
│   ├── collector/
│   ├── executor/
│   ├── heartbeat/
│   └── communication/
│
├── distributed/
│   ├── pytorch/
│   ├── nccl/
│   ├── launcher/
│   └── tests/
│
├── infrastructure/
│   ├── ansible/
│   ├── slurm/
│   ├── networking/
│   ├── storage/
│   └── monitoring/
│
├── containers/
│   ├── pytorch/
│   ├── tensorflow/
│   └── examples/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── system/
│   └── distributed/
│
├── scripts/
│
└── .github/
    ├── workflows/
    ├── ISSUE_TEMPLATE/
    └── pull_request_template.md
```

---

# 24. Your GitHub workflow

Your idea here is **very good**.

I would use:

```text
main
  │
  │ final stable releases only
  │
develop
  │
  ├── feature/user-auth
  ├── feature/job-api
  ├── feature/node-agent
  ├── feature/dashboard
  ├── feature/scheduler
  ├── feature/monitoring
  └── feature/distributed-training
```

### Important correction

You said:

> "we will not push main to even develop"

Correct.

**Never use `main` as the development branch.**

Instead:

```text
feature branch
      ↓
Pull Request
      ↓
Code Review
      ↓
Tests
      ↓
develop
      ↓
Integration testing
      ↓
Release candidate
      ↓
main
```

---

# 25. Your personal workflow as project lead

You should also work through branches.

Don't directly code on `main`.

Even you:

```text
develop
   ↓
reyad/feature-dashboard
   ↓
PR
   ↓
Review
   ↓
develop
```

When the project is stable:

```text
develop
   ↓
release/v1.0
   ↓
final testing
   ↓
main
```

---

# 26. Pull Request rule

Every teammate should:

```text
1. Pull latest develop
2. Create own feature branch
3. Code
4. Test locally
5. Commit
6. Push branch
7. Create PR → develop
8. Reviewer checks
9. CI tests
10. Fix if necessary
11. Merge
```

Nobody should directly push:

```text
❌ main
❌ develop
```

except controlled maintainers/merge process.

---

# 27. GitHub protection

Configure:

### `main`

```text
Require PR
Require approval
Require CI
No direct push
No force push
```

### `develop`

```text
Require PR
Require CI
No direct push
```

This prevents someone accidentally destroying your project.

---

# 28. CI/CD

Every PR should automatically run:

```text
PR
 ↓
GitHub Actions
 ↓
Lint
 ↓
Unit Tests
 ↓
Backend Tests
 ↓
Frontend Build
 ↓
Docker/Container Tests
 ↓
PASS / FAIL
```

If it fails:

```text
❌ PR cannot merge
```

This will make your 20–25-person team much easier to manage.

---

# 29. Development phases

This is how I'd divide the **project itself**, before assigning people.

### Phase 0 — Planning

Define:

* requirements
* architecture
* technologies
* network design
* API specification
* database design
* Git workflow
* coding standards

---

### Phase 1 — Infrastructure

Build:

```text
Network
Linux
Node configuration
GPU drivers
SSH
DNS/hostname
Storage
```

Goal:

> All PCs can communicate reliably.

---

### Phase 2 — Node Management

Build:

```text
ClusterOne Agent
Heartbeat
CPU detection
RAM detection
GPU detection
Node health
```

Goal:

> Controller can see every computer.

---

### Phase 3 — Slurm Integration

Build:

```text
Slurm
Partitions
GPU resources
Queues
Job submission
Job cancellation
Job status
```

Goal:

> ClusterOne can distribute independent jobs.

---

### Phase 4 — Containerization

Build:

```text
Apptainer
GPU containers
PyTorch environment
TensorFlow environment
Custom environments
```

Goal:

> Users can run reproducible AI environments.

---

### Phase 5 — Backend

Build:

```text
API
Database
Authentication
Job management
Node management
Resource management
User management
```

---

### Phase 6 — Frontend

Build:

```text
Dashboard
Node page
Job page
Submit job page
Queue
GPU utilization
User profile
Admin panel
```

---

### Phase 7 — Monitoring

Build:

```text
Prometheus
Grafana
GPU metrics
CPU metrics
RAM
Temperature
Power
Network
Alerts
```

---

### Phase 8 — Distributed AI

Now implement your second major goal:

```text
Multi-node allocation
        ↓
Distributed launcher
        ↓
PyTorch DDP
        ↓
NCCL
        ↓
Multi-GPU training
```

---

### Phase 9 — Security

Harden:

```text
Authentication
Authorization
Network
Containers
Storage
Secrets
SSH
Audit logs
```

---

### Phase 10 — Testing

Test:

```text
Single node
Multiple nodes
Job failure
Node failure
GPU failure
Network failure
Concurrent users
Large datasets
Container isolation
Distributed training
```

---

### Phase 11 — Benchmarking

Measure:

```text
Job throughput
Queue time
GPU utilization
Network performance
Distributed scaling
kWh/job
Failure recovery
```

---

### Phase 12 — Production Release

Finally:

```text
develop
   ↓
full integration testing
   ↓
release candidate
   ↓
security review
   ↓
performance testing
   ↓
main
   ↓
v1.0
```

---

# 30. Final system

At the end, a user should be able to open:

```text
https://clusterone.diu.edu
```

and see:

```text
╔══════════════════════════════════════════╗
║              CLUSTERONE                  ║
╠══════════════════════════════════════════╣
║                                          ║
║  Nodes       GPUs       Jobs             ║
║    6          8          42              ║
║                                          ║
║  GPU Usage: ███████████░░ 78%            ║
║                                          ║
║  ─────────────────────────────────────   ║
║                                          ║
║  GPU01     BUSY       RTX 3050           ║
║  GPU02     BUSY       RTX 3060           ║
║  GPU03     IDLE       RTX 3050           ║
║  GPU04     BUSY       RTX 4060           ║
║                                          ║
║  [ Submit Job ]  [ My Jobs ]             ║
║                                          ║
║  Execution:                              ║
║  ○ Single GPU                            ║
║  ○ Distributed Multi-GPU                 ║
║                                          ║
╚══════════════════════════════════════════╝
```

And behind that UI:

```text
                    ClusterOne
                         │
          ┌──────────────┴──────────────┐
          │                             │
    Independent Jobs              Distributed Jobs
          │                             │
       Slurm                    PyTorch DDP/NCCL
          │                             │
          └──────────────┬──────────────┘
                         │
                  Compute Nodes
                         │
              ┌──────────┼──────────┐
              ↓          ↓          ↓
            GPU01      GPU02      GPU03
```

## 🎯 The project's actual identity

I would describe the final project as:

> **ClusterOne is a distributed AI computing platform that transforms a collection of independent GPU computers into a centrally managed computing cluster, allowing users to either run independent workloads on available GPUs or execute supported AI workloads across multiple GPUs/nodes through distributed computing.**

That is a **much stronger project** than simply saying *“we connected 5 PCs together.”*

And your uploaded pilot architecture gives you a strong foundation for the infrastructure side: Slurm, Apptainer, OOD, Prometheus/Grafana, NFS/ZFS, node qualification, security, and the 12-week pilot structure. 

**Next step:** send me the **full team-member list** (names + preferably what each person is good at). Then I can turn this plan into a **25-person team structure**, with each person's exact module, branch name, tasks, dependencies, PR responsibilities, and what **you personally should code vs delegate**.
