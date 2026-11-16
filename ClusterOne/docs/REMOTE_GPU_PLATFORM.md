# ClusterOne as a remote GPU platform (not a remote desktop)

You use **your own PC normally**. **Sourav's GPU** does the GPU work for jobs you send. Nothing mirrors his screen,
shares his mouse or keyboard, or touches his desktop.

## 1. Architecture

```
 MY PC (Windows, 192.168.0.104)                          SOURAV PC (Windows, 192.168.0.105)
 ┌──────────────────────────────────────┐                ┌───────────────────────────────────────┐
 │ browser UI  http://localhost:8080    │                │ node agent  (outbound connections only) │
 │ CLI  clusterone_cli.py use / run     │                │   ├─ reports GPU / VRAM / driver / CUDA │
 │                                      │                │   ├─ reports CPU / RAM / what it can run │
 │ ClusterOne controller (Docker)       │◄── HTTP :8000 ─│   └─ pulls ONE assigned job at a time    │
 │   API · scheduler · job + log store  │   (agent → me) │                                         │
 │   whole-GPU reservation              │                │ job runs here ──► NVIDIA GPU (CUDA)      │
 └──────────────────────────────────────┘                │   inside Docker (optional) or on host    │
        no GPU work, no job process                       └───────────────────────────────────────┘
```

* **Sourav's PC opens the connection** to the controller. It listens on no port, so **it needs no inbound firewall
  rule** and exposes no remote-control service. Only the controller PC (yours) must accept connections on TCP 8000.
* The controller never executes a job. The CLI never executes the script locally: `run` sends the text to the chosen
  node. If the node is offline, nothing is submitted and nothing falls back to your PC.
* **One job owns a GPU at a time.** A GPU reserved by a running job is not offered to another (node state BUSY).
* Node states in the UI: **AVAILABLE** (a GPU is free), **BUSY** (all GPUs in use or reserved), **OFFLINE** (no heartbeat),
  **ERROR** (online but no GPU reported).

## 2. What can and cannot use Sourav's GPU

| Goal | Possible? | How |
|---|---|---|
| **A. Remote GPU compute**: PyTorch, TensorFlow, CUDA, ONNX, custom Python GPU programs | **Yes, this is what is built** | `run` a script; it executes on Sourav's PC and returns logs/results |
| **B. GPU media processing**: FFmpeg NVENC/NVDEC transcoding, AI video inference | **Yes, as jobs** | `run` a script/command that calls ffmpeg on the node (`scripts/ffmpeg_gpu_check.py` tests it) |
| **C. Your local Chrome / YouTube / any Windows app rendering on Sourav's GPU** | **No** (see section 9) | not achievable with two separate PCs and ordinary software |

## 3. Commands for SOURAV (PowerShell, on his PC)

Diagnostics, so nothing is guessed. Send me the output of these:

```powershell
nvidia-smi
ipconfig
python --version
docker --version
python -c "import torch; print(torch.__version__, torch.cuda.is_available())"
ffmpeg -hide_banner -encoders | Select-String nvenc
curl.exe http://192.168.0.104:8000/health
```

Setup (once):

```powershell
pip install psutil
# The newest node_agent.py is NOT on GitHub yet: copy it from the controller PC:
#   C:\Users\Reyad\Downloads\My skilled Projects\CSE Tech LAb\Cluster One\ClusterOne\backend\agent\node_agent.py
# Keep the PC awake while it serves jobs:
powercfg /change standby-timeout-ac 0
```

Start the agent (leave the window open). Choose ONE:

```powershell
# (a) Jobs run directly on his PC as his user. Simple; anyone allowed to submit jobs can run Python there.
python node_agent.py --server http://192.168.0.104:8000 --name SOURAV --allow-host-python --token <AGENT_TOKEN>

# (b) Jobs run inside a Docker container with his GPU passed through. Safer: no access to his files or desktop.
python node_agent.py --server http://192.168.0.104:8000 --name SOURAV --docker-image pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime --token <AGENT_TOKEN>
```

`--token` is needed only if the controller was started with `CLUSTERONE_AGENT_TOKEN` (recommended, section 5).
On start the agent prints what it detected, for example `Capabilities: {"torch": "2.6.0+cu124", "torch_cuda_available": true, ...}`.

## 4. Commands for MY PC

```powershell
cd "C:\Users\Reyad\Downloads\My skilled Projects\CSE Tech LAb\Cluster One\ClusterOne"
docker compose up --build -d          # controller + UI; open http://localhost:8080

# one time, PowerShell as Administrator: let Sourav's agent reach the controller
New-NetFirewallRule -DisplayName "ClusterOne controller" -Direction Inbound -Protocol TCP -LocalPort 8000 -Action Allow -Profile Private

cd backend
python scripts\clusterone_cli.py nodes                     # SOURAV should be listed, state AVAILABLE
python scripts\clusterone_cli.py use SOURAV                # make it the default GPU worker
python scripts\clusterone_cli.py run scripts\gpu_check.py  # run the GPU test on SOURAV
python scripts\clusterone_cli.py run scripts\ffmpeg_gpu_check.py   # GPU video encode test (needs ffmpeg+NVENC there)
python scripts\clusterone_cli.py status                    # live GPU / VRAM / CPU / RAM of SOURAV
python scripts\clusterone_cli.py claim / release           # reserve / release the whole node
```

In the UI: **Nodes → SOURAV** shows state, GPU, VRAM, utilisation, temperature, driver, CUDA, CPU, RAM, active jobs, what the
node can run, and the buttons **USE GPU**, **RUN JOB**, **STOP JOB**.

## 5. Security

* Set both secrets before exposing the controller to other PCs. In `ClusterOne\.env` (git-ignored):

  ```powershell
  python -c "import secrets; print('CLUSTERONE_AGENT_TOKEN=' + secrets.token_urlsafe(32)); print('CLUSTERONE_API_KEY=' + secrets.token_urlsafe(32))"
  ```
  Paste both lines into `.env`, then `docker compose up -d`. The **agent token** authenticates nodes (register, heartbeat, job pull,
  reports). The **API key** is required to submit, list or cancel jobs (CLI: `--api-key` or env `CLUSTERONE_API_KEY`; web UI:
  Settings → Controller API key). `/health` and the cluster summary stay public. For per-user identity use Keycloak (see `.env.example`).
* Jobs are validated data, not shell text. The CLI sends a Python source file or a command string; the node never runs
  anything that was not assigned to it by the authenticated controller. There is no endpoint that runs "any command".
* Each job has an id, a time limit, and can be cancelled (STOP JOB / Ctrl+C), which kills the whole process tree or the container.
* Network binding: the controller listens on 0.0.0.0:8000 so LAN agents can reach it. On an untrusted network keep the firewall rule on
  the **Private** profile only, and do not forward port 8000 on a router. For use over the internet put a VPN (WireGuard/Tailscale)
  between the PCs instead of opening ports.

## 6. Docker and the GPU runtime on Sourav's PC (only for option b)

* NVIDIA driver on Windows (already needed for `nvidia-smi`). **Do not install a second driver inside Docker.**
* Docker Desktop with the **WSL 2** backend. With a current NVIDIA driver, `docker run --gpus all` works on Windows through WSL 2;
  the separate "NVIDIA Container Toolkit" install is for Linux hosts. Test on his PC:
  `docker run --rm --gpus all nvidia/cuda:12.4.1-base-ubuntu22.04 nvidia-smi` must list his GPU.
* The image you choose must contain Python and PyTorch (the example above does). The image is chosen by the node's owner at agent start;
  job submitters cannot pick arbitrary images.
* **Not verified by the author on a second PC.** The Docker job command is covered by unit tests only.

## 7. Network

Same LAN (Wi-Fi/router): controller `192.168.0.104`, node `192.168.0.105`. From Sourav's PC `curl.exe http://192.168.0.104:8000/health`
must answer `{"status":"ok"...}`. If it times out: wrong IP (`ipconfig` on your PC again, DHCP can change it), the Windows Firewall rule
above is missing, or the PCs are on different networks (guest Wi-Fi isolates clients). Ping can fail even when everything works, because
Windows blocks it by default; the heartbeat is the real test.

## 8. Test procedure and proof that the job ran on Sourav's GPU

1. `clusterone_cli.py nodes` lists SOURAV online. 2. `use SOURAV`. 3. `run scripts\gpu_check.py`. A passing run prints:

```
Target     : SOURAV (192.168.0.105)  state AVAILABLE
GPU        : NVIDIA GeForce RTX 4050 Laptop GPU  VRAM 6.0 GB  driver 5xx.xx CUDA 12.x
Job ID     : <uuid>
=== ClusterOne GPU check ===
EXECUTION NODE : <Sourav's Windows computer name>
CUDA available : True
GPU            : NVIDIA GeForce RTX 4050 Laptop GPU
Correctness    : GPU matches CPU reference (max error ...)
GPU computation successful
TEST: PASSED
STATUS         : COMPLETED, exit code 0
TARGET NODE    : SOURAV
EXECUTION NODE : SOURAV (192.168.0.105)
PEAK GPU LOAD  : NN% (read from the node's own GPU while the job ran)
VERIFIED       : ran on SOURAV, not on this PC (<your computer name>)
```

The proof is the combination of: the scheduler's recorded execution node, the node's own `socket.gethostname()` printed by the script,
the GPU model/driver read from that machine, a GPU-vs-CPU numeric check that cannot pass without a working CUDA device, and the load
rising on Sourav's GPU in the node's telemetry while your PC's GPU is untouched. If the node were your own PC the CLI prints
`WARNING: the execution node is THIS PC`.

## 9. Chrome / YouTube on your PC using Sourav's GPU: not possible, and why

A normal Chrome process on your PC draws through **ANGLE → Direct3D 11** and decodes video through **D3D11VA/DXVA**, both served by the
**local WDDM graphics driver** (`dxgkrnl` + your GPU's kernel-mode driver). Windows has no supported way to send those calls over a
network to a different computer's adapter. What exists is not applicable to two separate PCs:

| Technology | What it does | Why it does not apply here |
|---|---|---|
| Hyper-V **DDA** | gives one whole GPU to a VM | VM and GPU must be in the **same** physical machine |
| Hyper-V **GPU-P** / WSL2 GPU-PV | shares the host's GPU with VMs on that host | same machine only |
| **SR-IOV** / NVIDIA **vGPU** | hardware/driver partitioning of a datacenter GPU | same host; vGPU needs licensed datacenter cards |
| RemoteFX vGPU | remote GPU for VMs | removed from Windows |
| CUDA-over-network (rCUDA, SCUDA) | forwards **CUDA** calls only | helps compute (like PyTorch), not Direct3D/WebGL/video decode; mostly Linux |
| Direct3D remoting products | experimental or commercial | I could not verify a maintained, generally available one for Windows Chrome |

So: Chrome keeps using **your** GPU for the display and for YouTube decode (a small fixed-function video engine). Turning Chrome's hardware
acceleration off does not move work to Sourav; it moves it to your CPU. The closest honest alternatives are: remote GPU **compute** (built),
GPU **media jobs** (e.g. transcode a file on Sourav's NVENC, results copied back), or **remote application streaming** (Chrome running on
his PC, streamed to you), which you asked not to use.

## 10. Known limitations

* Tested live with the node on the same laptop as the controller (RTX 2050): dispatch, CUDA compute, log streaming, GPU load, cancel.
  **Not yet run against Sourav's PC** (it was offline at the last attempt). The cross-PC steps above are the acceptance test.
* The Docker runner and the capability probe have unit tests but no live Docker-GPU run.
* On Windows a node GPU that also draws the desktop reads busier than a headless server GPU; the scheduler's "GPU free" cutoff is
  `CLUSTERONE_GPU_IDLE_THRESHOLD_PCT` (default 10).
* A job still needs some system RAM and CPU on Sourav's PC; it is limited to what the job requests (Docker `--memory/--cpus`).
  Sourav can use his PC at the same time, and then shares the GPU with the job.
* A single file up to ~16 KB can be sent with `run FILE`; bigger projects need to exist on the node (or shared storage) and use `run --cmd`.

## 11. Next steps for true virtualised GPUs

Only possible inside one physical machine today: put the GPU and the workload in the same host (Hyper-V GPU-P, WSL2, or a Linux host with
NVIDIA vGPU/MIG). For many users sharing several GPUs the next step is the Slurm path already prepared in `deploy/slurm/` and
`docs/REMOTE_GPU_COMPUTE.md` (whole-GPU allocation, Apptainer, shared storage).
