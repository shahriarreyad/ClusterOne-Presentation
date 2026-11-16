# ClusterOne Core Cluster Engine

The central controller/backend: node registration, resource tracking, job
submission and Slurm integration. The user's laptop only runs the browser; jobs
run on the GPU nodes (Slurm + Apptainer in production, a small dev scheduler
before a cluster exists).

```
browser ──HTTP──▶ FastAPI Core Engine (anchor, 10.20.0.10)
                      │  slurmrestd (JWT)         ▲ heartbeats / register
                      ▼                           │
                    Slurm ──allocates──▶ GPU node 10.20.0.21+  ◀── node_agent.py
                                         `apptainer exec --nv … <your command>`
                      Prometheus / Loki / NFS-ZFS are read, not duplicated
```

## Design position

This service follows "prefer upstream tools over custom code"
(`ClusterOne_03`) and "ClusterOne does not design a new job or accounting
schema" (`ClusterOne_07`):

| `CLUSTERONE_SLURM_ENABLED` | Who decides what | Where state lives |
| --- | --- | --- |
| `false` (default) | The built-in dev scheduler (`node_registry.pick_node_for_job`) places jobs on nodes running `agent/node_agent.py`, which runs them. | Local database |
| `true` | **Slurm is the source of truth.** Jobs are submitted/cancelled through slurmrestd; job id, state, partition, user, allocated node, CPUs/RAM/GPUs, start/end time and exit code are synced back from Slurm (slurmctld, then slurmdbd for finished jobs). No competing scheduler runs. | Slurm; the local DB is a cache plus ClusterOne-only fields |

## Run

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate            # Linux/macOS: source .venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env              # optional; defaults work for development
uvicorn app.main:app --reload     # API on :8000, docs at /docs
```

With Docker (control plane only; run the node agent on each GPU PC, not in a container): from the repository
root, `docker compose up --build`, then open http://localhost:8080 (UI) and http://localhost:8000/docs (API).
Settings are the same `CLUSTERONE_*` variables, read from the shell or a root `.env`. Data persists in the
`clusterone-data` volume. The Docker files have not been built or run by the author yet.

Frontend (separate app, proxies `/api` to `127.0.0.1:8000`): `cd ../frontend && npm run dev`.

A GPU node (any machine; `psutil` is the only dependency):

```bash
pip install -r requirements-agent.txt
python agent/node_agent.py --server http://10.20.0.10:8000 --name gpu01
# --token <secret> (or CLUSTERONE_AGENT_TOKEN) if the controller sets one; --no-jobs = report health only
# --allow-host-python = DEV ONLY: let this PC run submitted code directly (no container). Off by default.
```

**Start here for the remote-GPU setup (commands for both PCs, firewall, Docker, proof of where a job ran, and why
Chrome/YouTube cannot use a remote GPU): [`../docs/REMOTE_GPU_PLATFORM.md`](../docs/REMOTE_GPU_PLATFORM.md).**

Running training on another PC's GPU (dev mode on lab PCs, or Slurm on the cluster), the network checks and
the end-to-end GPU test are in [`../docs/REMOTE_GPU_COMPUTE.md`](../docs/REMOTE_GPU_COMPUTE.md); example Slurm
configs are in [`../deploy/slurm/`](../deploy/slurm/).

Use a node's GPU/RAM from your laptop's terminal (no UI needed; stdlib only):

```bash
python scripts/clusterone_cli.py nodes                       # connected nodes and what is free
python scripts/clusterone_cli.py use gpu02                   # choose "my GPU" (saved in ~/.clusterone.json)
python scripts/clusterone_cli.py run train.py --epochs 3     # runs ON gpu02; output streams back; Ctrl+C cancels
python scripts/clusterone_cli.py run --cmd "python /projects/me/train.py"   # script already on shared storage
python scripts/clusterone_cli.py status                      # live GPU / RAM of that node
python scripts/clusterone_cli.py claim                       # reserve the WHOLE node: only your jobs are placed there
python scripts/clusterone_cli.py release                     # give it back
```

In the web UI the same choice is the "My GPU" menu in the top bar. Only code started through ClusterOne (UI,
CLI, VS Code Remote-SSH) runs on the node; other apps on your laptop cannot borrow a remote GPU.

```bash
python scripts/check_cluster_network.py --master 10.20.0.10 --node 10.20.0.21     # ping, DNS, Slurm/API/NFS ports
python scripts/remote_gpu_smoke_test.py --api http://10.20.0.10:8000 --burn-seconds 30   # submit a real job, verify it ran remotely
```

Checks:

```bash
pytest                       # no Slurm, GPU, Prometheus or network needed
ruff check .
mypy app
```

## API

Canonical prefix `/api/v1`. The same routes are also served at the root
(`/health`, `/nodes`, `/jobs`, `/cluster/summary`, …) without the prefix, and
nothing from the first release was removed.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Liveness + database / Slurm / Prometheus status (`degraded` ≠ down; 503 only if the DB is) |
| `GET` | `/cluster/summary` | Node, GPU and job counts (public: no per-user data) |
| `GET` | `/cluster/topology` | Master + every registered node, for drawing MASTER → GPU NODE 01…N |
| `GET` | `/nodes`, `/nodes/{id}` | Node id, hostname, IP, status, CPU, RAM, GPU inventory + utilisation/temperature, current jobs, last heartbeat |
| `GET` | `/nodes/{id}/metrics?range=15m&step=15s` | Latest readings; with Prometheus also time series |
| `GET` | `/jobs?status=&user=&node_id=&limit=&offset=` | Job list (log text omitted) |
| `POST` | `/jobs` | Submit (validated, see below) |
| `GET` | `/jobs/{id}` | Job detail |
| `POST` | `/jobs/{id}/cancel` · `DELETE /jobs/{id}` | Cancel (same operation) |
| `POST` | `/jobs/{id}/retry` · `/requeue` | Submit a new job with the same spec (finished jobs only) |
| `GET` | `/jobs/{id}/logs?tail=&offset=&limit=&search=&timestamps=` | Tail / page / search without loading the file |
| `GET` | `/jobs/{id}/metrics` | Runtime, requested vs allocated resources, readings of the node it ran on |
| `GET` | `/cluster/activity`, `/storage`, `/partitions`, `/users` | Dashboard views, computed from recorded data |
| agents | `POST /nodes/register`, `/nodes/{id}/heartbeat`, `GET /nodes/{id}/jobs/next`, `POST /jobs/{id}/report`, `POST /telemetry` | Node-agent endpoints (token-protected when `CLUSTERONE_AGENT_TOKEN` is set) |

Timestamps are ISO-8601 UTC with a trailing `Z`. Every job response also carries `node_hostname`, `node_ip`
(where it runs) and `status_message`, a plain-language reason it is waiting or failed (offline node, no free GPU,
CUDA out of memory, time limit, ...).

### Submitting a job

```json
POST /api/v1/jobs
{
  "name": "resnet-train", "partition": "gpu",
  "gpu_count": 2, "cpu_count": 8, "ram": "32G", "time_limit": "04:00:00",
  "image": "pytorch",
  "working_dir": "/projects/alice/resnet", "dataset_path": "/datasets/imagenet",
  "output_dir": "/projects/alice/resnet/out",
  "command": "python train.py --epochs 90",
  "env": {"BATCH_SIZE": "256"}
}
```

Old requests (`requires_gpu`, `cpu_cores`, `ram_mb`, `script`, `environment`, `node_id`)
still work. Rules (limits and roots are configurable, see `.env.example`):

* `name` `[A-Za-z0-9._-]{1,64}`; `partition` ∈ configured list; GPUs/CPUs/RAM/time within limits.
* `ram`: `32G`, `512M` or MB; `time_limit`: `HH:MM:SS`, `D-HH:MM:SS` or minutes.
* Paths must be absolute, free of `..`/spaces/quotes/`,`/`:`, and under `/home`, `/projects`, `/datasets` or `/scratch`.
* `image`: a `.sif` under `/opt/apptainer` or an alias like `pytorch`; remote `docker://` images only if enabled.
* `env` names can't touch `PATH`, `LD_*`, `SLURM_*`, `APPTAINER*`, `CLUSTERONE_*`, `CUDA_VISIBLE_DEVICES`, …

**Execution model (Slurm mode).** The generated batch script requests the
resources (`--gres=gpu:N`, `--cpus-per-task`, `--mem`, `--time`, …) and runs
exactly one thing on the node: `apptainer exec [--nv] --cleanenv --bind … image /bin/bash -c "$COMMAND"`.
Every user value is validated *and* single-quoted into a variable, so it is data to the host
shell and reaches the container as one argument (a test runs the real script with a fake
`apptainer` and hostile input to prove it). Output is timestamped per line into
`<output_dir or home>/clusterone-<slurm id>.out`; that directory must already exist
(Slurm opens stdout before the script starts).

### Logs

`tail` (default 200 lines, capped) reads blocks backwards from the end; `offset`+`limit`
pages forward; `search` is a case-insensitive scan. Lines are capped at 8 KB, files are
never loaded whole. In Slurm mode the backend must mount the output share and the path is
re-checked after resolving symlinks. In dev mode the agent's output goes to
`CLUSTERONE_LOG_DIR/<job>.log` (the DB keeps only a 32 KB tail for the legacy `logs` field).

### Metrics

With `CLUSTERONE_PROMETHEUS_URL` set, `/nodes/{id}/metrics` and `/jobs/{id}/metrics` run a
fixed set of read-only range queries (dcgm-exporter GPU util/memory/temp, node_exporter
CPU/RAM/network) for that one node; clients cannot send PromQL. Without it you get the last
agent heartbeat (real values, no history). GPU/CPU numbers are for the whole node, since jobs
can share one.

## Node agent

`agent/node_agent.py` reports hostname, IP, CPU cores/utilisation, RAM, network rates and, per
GPU, name/uuid/VRAM/utilisation/temperature/power from `nvidia-smi`. Readings that aren't
available (no driver, sensor says `N/A`) are omitted, never invented. Registration is idempotent
by hostname (same id), the agent re-registers if the controller lost its database, and a node
that stays silent for `CLUSTERONE_HEARTBEAT_TIMEOUT_SECONDS` is marked `DOWN` — checked on every
node/summary/topology/submit call and by a background loop. In dev mode, work scheduled to a node
that goes down is re-queued (not started) or failed (was running). In dev mode the agent can
also run the jobs placed on it: `command` + `image` inside `apptainer` when it is installed; otherwise it
**refuses** unless the node's owner starts it with `--allow-host-python` (then `command` runs as a plain argv, no
shell, and legacy `script` runs as Python). With Slurm enabled the controller never hands it work.

## What needs a real cluster

Everything in `pytest` is mocked or local. Not verified against live infrastructure:

* **slurmrestd request/response shapes** (`v0.0.40`): `tres_per_node` spelling (`gres:gpu:N`),
  `memory_per_node`/`time_limit` structs, `environment` as a list, job/node/partition/slurmdb field
  names. They follow the Slurm docs; check `/slurm/<ver>/openapi` on your version and adjust
  `app/services/slurm_jobspec.py` / `slurm_sync.py` if a field differs.
* **Which Slurm user owns the job.** The backend submits as `CLUSTERONE_SLURM_USER`. For jobs to
  run as the researcher (their uid, their file permissions inside the container) the cluster needs
  per-user JWTs or an admin token allowed to submit on behalf of users — an admin decision.
* Apptainer images, `--nv` GPU passthrough, NFS binds, and reading logs from the NFS share.
* Prometheus/dcgm label names (`CLUSTERONE_PROMETHEUS_NODE_LABEL`), Keycloak token claims/JWKS.
* The agent's NVIDIA path was run on one Windows laptop (RTX 2050); the Linux path is the same
  `nvidia-smi` query, parsed by a unit test with real-format output.

## Layout

```
app/api/        routers (nodes, jobs, cluster, health)
app/services/   node_registry (dev scheduler, sweep), job_manager (submit/cancel/state machine),
                slurm_client / slurm_jobspec / slurm_sync, log_reader, metrics
app/validation.py  app/auth.py  app/config.py  app/models.py  app/schemas.py
agent/          node_agent.py (+ gpu_burn.py, open_url.py demo helpers)
tests/          pytest suite (mocked Slurm / Prometheus / Keycloak)
```
