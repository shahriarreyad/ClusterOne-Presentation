# Running training on another PC's GPU with ClusterOne

Your PC is only the control and viewing machine (browser, VS Code). The training process runs on a
**compute node**: another physical PC with its own NVIDIA GPU, CPU, RAM and storage. Nothing makes the
remote GPU appear inside your PC; ClusterOne sends the *job* to the node and shows you its output and metrics.

```
 YOUR PC (browser, VS Code, YouTube)          never runs the job
        │ HTTP
        ▼
 MASTER / anchor 10.20.0.10  ── ClusterOne API + Slurm controller + slurmrestd
        │ Slurm (6817/6818)
        ▼
 GPU NODE 10.20.0.21 ── slurmd ─▶ Apptainer (--nv) ─▶ PyTorch/CUDA ─▶ the node's NVIDIA GPU
        │ NFS (2049)                                                    ▲
        └── /datasets  /projects  (shared storage)         node agent: GPU/CPU/RAM metrics, heartbeat
```

## Two ways to run it

| | Development mode (`CLUSTERONE_SLURM_ENABLED=false`) | Cluster mode (`true`) |
| --- | --- | --- |
| Scheduler | ClusterOne's built-in best-fit placement | **Slurm** |
| GPU PCs | Windows or Linux, anything with Python + the NVIDIA driver | **Linux** (slurmd does not run on Windows) |
| Job runs via | `node_agent.py` on the PC | slurmd → Apptainer container |
| Isolation | none unless Apptainer is installed (see warning) | Slurm cgroups + container |
| Use for | trying it on lab PCs today | the real cluster |

### Development mode on lab PCs (what works today)

On the master (your PC or a server): `uvicorn app.main:app --host 0.0.0.0 --port 8000` and open the firewall port.
On every GPU PC: `pip install psutil`, then

```
python node_agent.py --server http://<master-ip>:8000 --name gpu02 --allow-host-python
```

> **`--allow-host-python` lets anyone who can submit a job run code on that PC as the logged-in user.** It is off by
> default. Turn it on only on PCs whose owner accepts that, on a trusted network, and set `CLUSTERONE_AGENT_TOKEN`
> (and `CLUSTERONE_AUTH_ENABLED=true` for users). Without the flag, and without Apptainer, the agent *refuses* jobs
> with a clear message. With Apptainer installed the agent runs the job inside the container instead.

The owner can keep using the PC; remember the training shares its CPU/RAM/GPU (dev mode reserves GPUs per job but
cannot fence CPU/RAM the way Slurm does).

## Cluster mode, step by step

1. **Network first.** From the master and from a node run
   `python scripts/check_cluster_network.py --master 10.20.0.10 --node 10.20.0.21 --node 10.20.0.22`.
   It checks name resolution, ping, and the TCP ports that matter: ClusterOne API 8000, slurmctld 6817,
   slurmrestd 6820 (normally localhost-only on the master), slurmd 6818, NFS 2049, SSH 22.
   Giving machines `10.20.0.x` addresses does not connect them. They must be on the same VLAN/subnet (or routed)
   with the ports allowed. On the DIU network that means the lab switch ports must be placed in the cluster VLAN
   described in `ClusterOne_04_Infrastructure_Network_Design.md`; a PC on the general campus Wi-Fi/VLAN will fail
   these checks.
2. **Node OS.** Ubuntu 22.04/24.04 with the NVIDIA driver (`nvidia-smi` works), `munge` with the cluster's key,
   `slurmd`, and `apptainer`. Confirm the same `/etc/slurm/slurm.conf` on every machine.
3. **Slurm GPU config.** Use `deploy/slurm/slurm.conf.example`, `gres.conf.example`, `cgroup.conf.example`.
   Key points: `GresTypes=gpu`, `Gres=gpu:N` per node, `AutoDetect=nvml` (or explicit `/dev/nvidiaN`),
   `ConstrainDevices=yes`, `select/cons_tres`. Verify on the master: `sinfo -N -o "%N %G %T"`.
4. **Shared storage.** Mount `/datasets` (read-only), `/projects` and `/home` over NFS on the nodes *and* the master
   (the master reads job logs from there). Put images in `/opt/apptainer/*.sif` (`containers/build.sh pytorch`).
5. **slurmrestd.** Enable JWT (`AuthAltTypes=auth/jwt`), run slurmrestd bound to localhost on the master, mint a token
   (`scontrol token username=clusterone lifespan=86400`) into a root-owned `0600` file.
6. **ClusterOne backend** on the master: copy `backend/.env.example` to `.env` and set
   `CLUSTERONE_SLURM_ENABLED=true`, `CLUSTERONE_SLURMRESTD_URL`, `CLUSTERONE_SLURM_JWT_TOKEN_FILE`,
   `CLUSTERONE_AGENT_TOKEN`, `CLUSTERONE_PROMETHEUS_URL`, and the Keycloak settings.
7. **Telemetry agent** on each node, report-only (Slurm starts the jobs): `node_agent.py --server http://10.20.0.10:8000
   --name gpu01 --no-jobs --token <agent token>` as a systemd service. It reports GPU model/count/utilisation/VRAM/
   temperature/power, CPU, RAM, network and heartbeat. The node's name must equal its Slurm `NodeName` so jobs map
   to nodes.
8. **Prove it** (below).

## Prove that the GPU in use is the remote one

On the master, before involving ClusterOne:

```
srun -p gpu --gres=gpu:1 hostname                       # prints gpu01, not the master
srun -p gpu --gres=gpu:1 nvidia-smi -L                  # lists exactly 1 GPU (the allocated one)
srun -p gpu --gres=gpu:1 apptainer exec --nv /opt/apptainer/pytorch.sif \
     python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
```

Then through ClusterOne, from your PC (stdlib only, nothing is simulated):

```
python scripts/remote_gpu_smoke_test.py --api http://10.20.0.10:8000 --image pytorch --burn-seconds 30
```

It submits a real job and checks: accepted → started on a node → **that node is not your PC** → the job saw an
NVIDIA GPU → GPU utilisation rose while it ran → logs came back → exit code 0. The job's own first log lines also
record the executing host and `CUDA_VISIBLE_DEVICES` as seen on the node.

## Resource policy

* **GPUs are whole and exclusive in the `gpu` partition.** Ask for 2, Slurm allocates 2 specific GPUs to that job;
  with `ConstrainDevices=yes` no other job can see them. No fractional sharing there; MPS belongs to `teaching` only.
* **CPU and RAM are reserved per job** (`--cpus-per-task`, `--mem`) and enforced by cgroups. A job asking for
  8 cores / 32 GB gets exactly that. It is not the whole machine.
* **The owner's desktop.** The node keeps whatever you hold back with `CPUSpecList` / `MemSpecLimit` (see
  `slurm.conf.example`); Slurm never allocates those. Light use fits easily. Heavy use of the same GPU does not:
  a GPU that drives a monitor is shared with the desktop, so give the display to an iGPU where possible, and do not
  expect 100% of the machine for a job while the owner also uses 100% of it.

## VS Code Remote-SSH, safely

ClusterOne does not proxy SSH, store keys or give a web shell. Developers use their own SSH keys directly:

1. Request an interactive allocation from ClusterOne (partition `interactive`, e.g. command `sleep 7200`) or with
   `salloc -p interactive --gres=gpu:1 --time=02:00:00`.
2. Enable `pam_slurm_adopt` on the nodes: users can SSH to a node **only while they have a job there**, and the SSH
   session joins the job's cgroup (so it sees only the allocated GPU/CPU/RAM and ends with the job).
3. In `~/.ssh/config` on your PC (keys stay on your PC; password logins disabled on the cluster):

   ```
   Host c1-anchor
       HostName 10.20.0.10
       User alice
   Host gpu*
       User alice
       ProxyJump c1-anchor
   ```

   then in VS Code: *Remote-SSH: Connect to Host… → gpu01*. Code and datasets live on NFS, so nothing large passes
   through your PC.

## Security rules this implementation follows

* Users never get a shell through the API. A job is data (validated fields) turned into an sbatch script that can run
  one thing: `apptainer exec … /bin/bash -c "<your command>"` as *that user* inside the container.
* No SSH password or private key is stored by, or sent to, the web app or the browser.
* The slurmrestd JWT, database URL and Keycloak settings exist only in the backend's environment/`.env` (git-ignored),
  never in API responses (`/health` reports only reachability).
* User endpoints can require a Keycloak token; node-agent endpoints require the agent token.
* Jobs never run as root. Slurm runs them as an unprivileged user (today `CLUSTERONE_SLURM_USER`; see the limitation below).

## Failure handling

| Situation | What happens | What the user sees (`status_message`) |
| --- | --- | --- |
| Node offline / lost heartbeat | node → DOWN; waiting jobs re-queue, running dev jobs fail (Slurm: node drained, job re-queued or `NODE_FAIL`) | "gpu01 is currently offline. Your job remains queued." |
| No GPU free | job stays queued | "Waiting for 1 free GPU(s), 8 CPU cores and 32 GB RAM on an online node." |
| Request bigger than any node | stays queued | "Requests 4 GPU(s) but the largest online node has 1." |
| Slurm unavailable | submit returns 502, nothing stored; lists keep last known state; `/health` = degraded | "Slurm rejected or could not receive the job: …" |
| CUDA out of memory / no driver | job fails | "The GPU ran out of memory… reduce the batch size" / "CUDA is not working on the node…" (found in the job's own log) |
| RAM exhausted / time limit | Slurm `OUT_OF_MEMORY` / `TIMEOUT` | "Ran out of RAM (requested 32 GB)" / "Stopped at its time limit (0-04:00:00)" |
| Container/image missing | job fails | "The container could not be started on the node…" |

## Status of this implementation

Verified automatically (mocked Slurm/Prometheus/Keycloak; real scripts run with a fake `apptainer`): job validation,
sbatch generation, state sync, whole-GPU reservation, failure explanations, network-check logic, agent gating, and the
agent's job runner against a fake controller.

Verified live in **development mode on one Windows laptop with an RTX 2050 (4 GB)**, using the real backend, the real
node agent (`--allow-host-python`) and `scripts/remote_gpu_smoke_test.py`, with CUDA-enabled PyTorch 2.6:
a job submitted through the API was placed by the scheduler, started by the agent, printed `cuda_available True` and
the GPU name, drove GPU utilisation to 81-100 %, streamed its output back, and completed with exit code 0; a genuine CUDA
out-of-memory failed with the plain-language message; cancelling an endless GPU job killed the whole process tree and
the GPU returned to idle; a node whose agent stopped went DOWN. **The "remote" node in that test was the same machine
as the client**, so the check that the job ran on a *different* PC is reported as SKIP, not as a pass.

**Not yet verified, needs the physical cluster:** a second physical PC as the node (the cross-machine network path and
`scripts/check_cluster_network.py` against real hosts), Slurm itself (slurmrestd field names on your version,
`--gres` allocation), `--nv` GPU passthrough and `ConstrainDevices` isolation, NFS reads from the master, PyTorch inside
the real Apptainer image, `pam_slurm_adopt`, and VS Code Remote-SSH. The commands above are the acceptance test for each.
The browser UI was type-checked and built but not exercised in a browser by the author.

**Known limitation:** the backend submits as `CLUSTERONE_SLURM_USER`. Running as each researcher (their uid and file
permissions) needs per-user JWTs or an administrator token that may submit on behalf of users. That is a cluster-admin
decision.
