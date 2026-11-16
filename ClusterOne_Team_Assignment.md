# 🚀 ClusterOne — Team Work Assignment

A 14-person team building a distributed AI computing platform. This document lays out **who owns what**, **how the codebase is organized**, and **how the GitHub workflow works**.

---

## 🏗️ Final Team Structure

| # | Member | Main Responsibility |
|---|--------|----------------------|
| 1 | **Rahat Shahriar Reyad** | 🧠 Core Cluster Engine + Scheduler + Integration |
| 2 | **Tanvir** | 🖥️ Node Agent |
| 3 | **Anushka** | 🎨 Main Dashboard |
| 4 | **Sourav Ghosh** | 💼 Job Management UI |
| 5 | **MD Irfanur Islam** | 🔐 Authentication |
| 6 | **Sadik** | ⚡ Full Stack + Admin Panel |
| 7 | **Zafor** (Lead) | 📊 Monitoring + PR/Test Manager |
| 8 | **Tanjimul Islam** | 🐳 Containers / Apptainer |
| 9 | **Sourav Kundu** | 🗄️ Database + 🤖 Distributed AI (support) |
| 10 | **Rubab** | 🧪 Testing |
| 11 | **Md Shanto Ali** | 💾 Storage |
| 12 | **Abir (CSE Tech)** | 🌐 Networking |
| 13 | **Ferdowsi Yarin** | 📚 Documentation + Research |
| 14 | **Sadik Fahim** | 🤖 Distributed AI |

---

## 📊 Zafor — Team Lead, Monitoring + PR Manager

This is an important dual role: **technical work** + **team management**.

**Technical work:**
- Prometheus
- Grafana
- CPU / RAM / GPU monitoring
- Node health
- Cluster metrics
- Monitoring dashboard

**Team management:**
- Check PRs
- Run tests
- Review code
- Verify the feature actually works
- Merge approved PRs into `develop`

> ⚠️ **Zafor should NOT blindly merge PRs.**

```text
PR
 ↓
Code review
 ↓
Run / test feature
 ↓
CI passes
 ↓
Approve
 ↓
Merge → develop
```

---

## 1. Rahat Shahriar Reyad — Core Cluster Engine

**The hardest / core part of the project.**

You build the main **ClusterOne brain** that connects every other module together.

**You handle:**
- Cluster architecture
- Main controller / backend
- CPU / RAM / GPU resource detection and management
- Node registration
- Node communication
- Resource allocation
- Scheduler integration
- Job execution flow
- Slurm integration
- Connecting all modules together
- Final system integration
- Distributed AI integration (later)

```text
             CLUSTERONE CORE
                   │
        ┌──────────┼──────────┐
        ↓          ↓          ↓
      Nodes       Jobs      Resources
        │          │          │
        └──────────┼──────────┘
                   ↓
                Slurm
                   ↓
             Compute PCs
```

> 🧠 You are building the **central nervous system** of ClusterOne. Don't build every UI yourself — your job is making everyone else's modules work together.

---

## 2. Tanvir — Node Agent

Build the software that runs on every compute PC.

**Tasks:**
- ClusterOne Agent
- CPU information
- RAM information
- GPU information
- Disk information
- Node heartbeat
- Node status
- Send information to main server

```text
Node Agent
    ↓
CPU: 16 cores
RAM: 32GB
GPU: RTX 3060
VRAM: 12GB
Status: ONLINE
```

---

## 3. Anushka — Frontend Dashboard

Build the main dashboard.

**Tasks:**
- Dashboard UI
- Total nodes
- Total GPUs
- CPU usage
- RAM usage
- GPU usage
- Cluster status
- Basic navigation

*Focus on frontend only.*

---

## 4. Sourav Ghosh — Job Management UI

Build the frontend for jobs.

**Tasks:**
- Submit Job page
- Job list
- Job details
- Job status (Running / Queued / Completed / Failed)
- Cancel job button
- Job history

---

## 5. MD Irfanur Islam — Authentication & User Management

**Tasks:**
- Login
- Registration (if needed)
- User roles: Student, Researcher, Admin
- Authentication API
- Authorization

*Later this can be connected with university SSO.*

---

## 6. Sadik — Full Stack

Strong in frontend + full stack, so:

**Tasks:**
- Admin panel
- User management frontend
- Backend APIs required for the admin panel
- Connect frontend with backend
- Help other frontend developers integrate APIs

> **Role in short: Frontend integration + full-stack support**

---

## 8. Tanjimul Islam — Containers

Handle the AI execution environment.

**Tasks:**
- Apptainer
- GPU containers
- PyTorch container
- TensorFlow container
- Container examples
- Container documentation
- Test GPU access inside containers

```text
ClusterOne
   ↓
Slurm
   ↓
Apptainer
   ↓
PyTorch
   ↓
GPU
```

---

## 9. Sourav Kundu — Database

**Tasks:**

Design and implement the database. Store:

```text
Users
Nodes
GPUs
Jobs
Job history
Resources
Logs
```

Also:
- Database schema
- Migrations
- Models
- Database APIs
- Backup strategy

*You'll work closely with **Rahat**, since the core backend depends on this database.*

**Additional role: Distributed AI support**

Once the database work is stable, you'll also support **Sadik Fahim** on the Distributed AI module:

- Track distributed training job metadata (which nodes/GPUs a job used, run status, timing)
- Store and query multi-node training results and logs
- Help design the data model for distributed job runs (e.g. `distributed_jobs`, `node_assignments`)
- Support benchmarking data collection (throughput, scaling numbers) for later analysis

*This pairs naturally with your database role — distributed jobs generate more complex data to track than single-node jobs.*

---

## 10. Rubab — Testing

**Tasks:**

Create the testing system. Test:
- Backend
- APIs
- Node agent
- Job submission
- Job cancellation
- Authentication
- Database
- Scheduler
- Failure cases

```text
tests/
├── unit/
├── integration/
└── system/
```

*Also write bug reports when something fails.*

---

## 11. Md Shanto Ali — Storage

**Tasks:**
- `/home`
- `/projects`
- `/datasets`
- `/scratch`
- NFS
- Shared storage
- Permissions
- Dataset access
- Storage testing

*Also document how compute nodes access shared data.*

---

## 12. Abir (CSE Tech) — Network

**Tasks:**
- Node-to-node networking
- IP configuration
- Hostnames
- SSH
- Network topology
- Switch configuration
- Network testing
- Distributed AI network requirements

```text
                 Switch
                    │
       ┌────────────┼────────────┐
       ↓            ↓            ↓
   Controller      GPU01        GPU02
                                  │
                                GPU03
```

---

## 13. Ferdowsi Yarin — Documentation + Research

**Tasks:**

Maintain:
```text
README.md
CONTRIBUTING.md
docs/
architecture/
setup/
user-guide/
api/
research/
```

Also research and document:
- Slurm
- Apptainer
- PyTorch DDP
- NCCL
- Distributed AI
- Cluster architecture

*Make sure every module has understandable documentation.*

---

## 14. Sadik Fahim — Distributed AI

**Second-hardest technical module**, after the core engine. Starts later, once the basic cluster works.

*Supported by **Sourav Kundu** for tracking and storing distributed job data (see his section above).*

```text
distributed/
├── pytorch/
├── launcher/
├── tests/
└── examples/
```

**Work on:**
- PyTorch Distributed
- DDP
- Multi-GPU
- Multi-node training
- NCCL
- Distributed job launcher
- Distributed training examples
- Benchmarking

```text
             Training Job
                  │
        ┌─────────┼─────────┐
        ↓         ↓         ↓
      GPU01     GPU02     GPU03
        │         │         │
        └─────────┼─────────┘
                  ↓
             One Model
```

---

## 📂 Project Structure

```text
ClusterOne/
│
├── frontend/
├── backend/
├── agent/
├── scheduler/
├── distributed/
├── database/
├── monitoring/
├── containers/
├── infrastructure/
├── storage/
├── tests/
├── docs/
├── scripts/
│
├── .github/
│   └── workflows/
│
├── README.md
├── CONTRIBUTING.md
└── SECURITY.md
```

### Who mainly works where?

| Folder | Owner(s) |
|--------|----------|
| `frontend/` | Anushka, Sourav Ghosh, Sadik |
| `backend/` | Rahat, Sadik |
| `agent/` | Tanvir |
| `scheduler/` | Rahat |
| `distributed/` | Sadik Fahim (+ Sourav Kundu, data support) |
| `database/` | Sourav Kundu |
| `monitoring/` | Zafor |
| `containers/` | Tanjimul |
| `storage/` | Shanto |
| `infrastructure/` | Abir |
| `tests/` | Rubab |
| `docs/` | Ferdowsi |

---

## 🌿 The GitHub Rule (Simple Version)

```text
main
  │
  └── develop
         │
         ├── reyad/core-engine
         ├── tanvir/node-agent
         ├── anushka/dashboard
         ├── sourav/job-ui
         ├── irfanur/auth
         ├── sadik/fullstack
         ├── zafor/monitoring
         ├── tanjimul/containers
         ├── kundu/database
         ├── rubab/testing
         ├── shanto/storage
         ├── abir/network
         ├── ferdowsi/docs
         └── fahim/distributed-ai
```

### Everyone follows these exact steps

**1. Clone the repository**
```bash
git clone <repository-url>
cd ClusterOne
```

**2. Get the latest `develop`**
```bash
git checkout develop
git pull origin develop
```

**3. Create your own branch**
```bash
# Example: Tanvir
git checkout -b tanvir/node-agent

# Example: Anushka
git checkout -b anushka/dashboard

# Example: Rahat
git checkout -b reyad/core-engine
```

**4. Work and commit**
```bash
git add .
git commit -m "feat: add node heartbeat"
git push origin tanvir/node-agent
```

**5. Open a Pull Request**
```text
tanvir/node-agent
        ↓
Pull Request
        ↓
develop
```

> ❌ **Never:**
> - branch → `main` directly
> - direct push → `main`
> - direct push → `develop`

---

## 👑 Zafor's Job After a PR Arrives

```text
PR received
     ↓
Review code
     ↓
Run tests
     ↓
Check feature
     ↓
CI passes? ── NO ──► Changes requested ──► Developer fixes ──► Push again ──► Zafor tests again
     │
    YES
     ↓
Merge into develop
```

---

## 🚨 One Important Rule

**Nobody works directly inside another person's branch.**

Example: if Tanvir owns `tanvir/node-agent`, Anushka shouldn't modify it directly. If someone needs Tanvir's work, they talk to Tanvir or open their own branch/PR.

> This is what keeps a 14-person project from turning into a Git mess.

---

## 🧠 Development Order

Don't let everyone start coding randomly — follow this sequence.

### Step 1 — Right now
Everyone sets up:
```text
GitHub → Clone → develop → own branch
```

### Step 2 — Foundations (parallel)
- **Abir** → network setup
- **Shanto** → storage planning
- **Tanvir** → node agent skeleton
- **Sourav Kundu** → database structure
- **Rahat** → core backend structure

### Step 3 — Core chain
```text
Node Agent → Core Backend → Database → Scheduler
```

### Step 4 — Frontend
```text
Dashboard → Job UI → Admin UI
```

### Step 5 — Supporting systems
```text
Monitoring → Containers → Testing
```

### Step 6 — The big AI part (final)
```text
Cluster → Slurm → Multi-node allocation → PyTorch DDP → NCCL → Distributed AI
```

---

## 🔥 First Milestone

Don't aim for the complete ClusterOne right away. The **first target** is:

> **"Three PCs are connected, the controller can detect them, each node reports CPU/RAM/GPU information, and the controller can submit a simple job to a selected node."**

Once that works, you have a real cluster. Then keep building:

```text
                    ClusterOne
                         │
              ┌──────────┴──────────┐
              ↓                     ↓
        Normal Jobs           Distributed AI
              │                     │
            Slurm              PyTorch DDP
              │                     │
              └──────────┬──────────┘
                         ↓
                   GPU CLUSTER
```

**That's the starting point.** Don't wait for the whole architecture to be perfect — create the GitHub repo, protect `main`/`develop`, give everyone their branch, and let each person start their assigned module.
