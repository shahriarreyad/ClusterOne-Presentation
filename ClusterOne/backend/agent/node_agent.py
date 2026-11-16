"""ClusterOne node agent: run this on each compute PC / GPU node.

Registers the machine with the controller and sends a heartbeat every few
seconds using its real CPU, RAM, network and GPU (nvidia-smi) readings. Nothing
is estimated: if a reading is unavailable (no NVIDIA driver, no sensor) it is
left out rather than invented.

    pip install psutil
    python node_agent.py --server http://10.20.0.10:8000

In development mode (CLUSTERONE_SLURM_ENABLED=false on the controller) the
agent also claims and runs the jobs the dev scheduler places on it. With Slurm
enabled the controller never hands it work, because Slurm starts jobs on the
node itself; the agent then only reports health. Use --no-jobs to make an agent
report-only regardless.
"""
import argparse
import json
import os
import platform
import queue
import re
import shlex
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import traceback
import urllib.error
import urllib.request

try:
    import psutil
except ImportError:  # the parsing helpers below are importable (and tested) without it
    psutil = None

AGENT_VERSION = "0.2.0"
TOKEN = os.environ.get("CLUSTERONE_AGENT_TOKEN")


# --------------------------------------------------------------------------
# GPU readings
# --------------------------------------------------------------------------
def windows_counters():
    """Per-adapter busiest-engine % and dedicated VRAM MB, from the same
    Windows counters Task Manager reads. Returns {adapter: (util_pct, vram_mb)}."""
    ps = (r"$c=(Get-Counter -ErrorAction SilentlyContinue '\GPU Engine(*)\Utilization Percentage','\GPU Adapter Memory(*)\Dedicated Usage')"
          ".CounterSamples; $c | ForEach-Object { $_.Path + '|' + $_.CookedValue }")
    try:
        out = subprocess.check_output(["powershell", "-NoProfile", "-Command", ps], text=True, timeout=10)
    except Exception:
        return {}
    engines, vram = {}, {}
    for line in out.splitlines():
        if "|" not in line or "luid_" not in line:
            continue
        path, val = line.rsplit("|", 1)
        adapter = "luid_" + path.split("luid_")[1].split("_eng_")[0].split(")")[0]
        if "engtype_" in path:
            etype = path.split("engtype_")[1].split(")")[0]
            engines.setdefault(adapter, {})
            engines[adapter][etype] = engines[adapter].get(etype, 0.0) + float(val)
        elif "dedicated usage" in path.lower():
            vram[adapter] = float(val) / (1024 * 1024)
    # Task Manager's headline GPU % is the busiest engine of that adapter.
    return {a: (min(100.0, max(e.values())), vram.get(a, 0.0)) for a, e in engines.items()}


SMI_FIELDS = "index,uuid,name,memory.total,memory.used,utilization.gpu,temperature.gpu,power.draw,driver_version"


def _num(text):
    """nvidia-smi prints '[N/A]' / 'N/A' for unsupported fields."""
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def parse_nvidia_smi(csv_text):
    """Parse `nvidia-smi --query-gpu=<SMI_FIELDS> --format=csv,noheader,nounits` output."""
    gpus = []
    for line in csv_text.strip().splitlines():
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 8:
            continue
        index, uuid, name, total, used, util, temp, power = parts[:8]
        if _num(total) is None:
            continue
        gpu = {"index": int(_num(index) or 0), "uuid": uuid, "name": name,
               "vram_total_mb": int(_num(total)), "vram_used_mb": int(_num(used) or 0),
               "utilization_pct": _num(util) or 0.0}
        if len(parts) > 8 and parts[8] and parts[8] not in ("[N/A]", "N/A"):
            gpu["driver_version"] = parts[8]
        if _num(temp) is not None:
            gpu["temperature_c"] = _num(temp)
        if _num(power) is not None:
            gpu["power_w"] = _num(power)
        gpus.append(gpu)
    return gpus


def parse_cuda_version(smi_text):
    """The 'CUDA Version: 12.4' printed in the header of a plain `nvidia-smi` (the highest CUDA the driver supports)."""
    m = re.search(r"CUDA Version:\s*([0-9]+(?:\.[0-9]+)*)", smi_text or "")
    return m.group(1) if m else None


_CUDA_VERSION = {"value": None, "checked": False}


def cuda_version():
    """Driver-supported CUDA version, looked up once (it only changes if the driver is updated)."""
    if not _CUDA_VERSION["checked"] and shutil.which("nvidia-smi"):
        try:
            _CUDA_VERSION["value"] = parse_cuda_version(subprocess.check_output(["nvidia-smi"], text=True, timeout=10))
            _CUDA_VERSION["checked"] = True
        except Exception:
            pass
    return _CUDA_VERSION["value"]


def read_gpus():
    smi = []
    if shutil.which("nvidia-smi"):
        try:
            out = subprocess.check_output(
                ["nvidia-smi", f"--query-gpu={SMI_FIELDS}", "--format=csv,noheader,nounits"], text=True, timeout=10)
            smi = parse_nvidia_smi(out)
        except Exception as e:
            print("nvidia-smi failed:", e)
        cv = cuda_version()
        if cv:
            for g in smi:
                g["cuda_version"] = cv

    if sys.platform != "win32":
        return smi  # Linux GPU nodes: nvidia-smi is the source of truth

    counters = windows_counters()
    if not smi:
        return [{"name": f"GPU {i}", "vram_total_mb": 1, "vram_used_mb": int(v), "utilization_pct": round(u, 1)}
                for i, (u, v) in enumerate(counters.values())]
    # Windows laptops also have an Intel GPU. Match each NVIDIA GPU to the Windows
    # adapter whose VRAM usage is closest and report that adapter's utilization, so
    # the number equals what Task Manager shows.
    free = dict(counters)
    for g in smi:
        if not free:
            break
        a = min(free, key=lambda k: abs(free[k][1] - g["vram_used_mb"]))
        g["utilization_pct"] = round(free.pop(a)[0], 1)
    return smi


_TORCH_PROBE = (
    "import json\n"
    "try:\n"
    "    import torch\n"
    "    print(json.dumps({'torch': torch.__version__, 'cuda_available': torch.cuda.is_available(),"
    " 'torch_cuda': torch.version.cuda}))\n"
    "except Exception as e:\n"
    "    print(json.dumps({'torch': None, 'error': type(e).__name__}))\n"
)


def _run_ok(argv, timeout=10):
    try:
        return subprocess.run(argv, capture_output=True, text=True, timeout=timeout, check=False)
    except Exception:
        return None


def probe_capabilities():
    """What this node can actually run, measured once at start-up (not assumed).

    Tells the controller (and the user) up front whether PyTorch+CUDA, FFmpeg NVENC and Docker are usable here,
    instead of finding out when a job fails.
    """
    caps = {"python": platform.python_version(), "nvidia_smi": bool(shutil.which("nvidia-smi")),
            "apptainer": bool(shutil.which("apptainer")), "docker": False, "docker_gpu_image": DOCKER_IMAGE,
            "ffmpeg": bool(shutil.which("ffmpeg")), "ffmpeg_nvenc": False, "torch": None, "torch_cuda_available": False}
    r = _run_ok(["docker", "version", "--format", "{{.Server.Version}}"]) if shutil.which("docker") else None
    caps["docker"] = bool(r and r.returncode == 0 and r.stdout.strip())
    if caps["ffmpeg"]:
        r = _run_ok(["ffmpeg", "-hide_banner", "-encoders"])
        caps["ffmpeg_nvenc"] = bool(r and "h264_nvenc" in r.stdout)
    r = _run_ok([sys.executable, "-c", _TORCH_PROBE], timeout=60)
    if r and r.stdout.strip():
        try:
            info = json.loads(r.stdout.strip().splitlines()[-1])
            caps["torch"] = info.get("torch")
            caps["torch_cuda_available"] = bool(info.get("cuda_available"))
            caps["torch_cuda_version"] = info.get("torch_cuda")
        except ValueError:
            pass
    return caps


# --------------------------------------------------------------------------
# HTTP helpers
# --------------------------------------------------------------------------
def local_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        return s.getsockname()[0]
    except Exception:
        return None
    finally:
        s.close()


def _request(url, body=None):
    headers = {"Content-Type": "application/json"}
    if TOKEN:
        headers["X-Agent-Token"] = TOKEN
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data, headers)
    with urllib.request.urlopen(req, timeout=5) as r:
        return json.load(r)


def post(url, body):
    return _request(url, body)


def get(url):
    return _request(url)


class NetRate:
    """Network throughput in Mbit/s from the delta between heartbeats."""

    def __init__(self):
        self.last = None

    def sample(self):
        if psutil is None:
            return None, None
        c, now = psutil.net_io_counters(), time.monotonic()
        prev, self.last = self.last, (c.bytes_recv, c.bytes_sent, now)
        if prev is None or now <= prev[2]:
            return None, None
        dt = now - prev[2]
        return round((c.bytes_recv - prev[0]) * 8 / dt / 1e6, 3), round((c.bytes_sent - prev[1]) * 8 / dt / 1e6, 3)


# --------------------------------------------------------------------------
# Job execution (development mode)
# --------------------------------------------------------------------------
# Running a job straight on the host (no container) is arbitrary code execution as the agent's user.
# It is therefore off unless the node's owner starts the agent with --allow-host-python.
ALLOW_HOST_EXEC = False
# Optional container runner: set with --docker-image. Jobs then run in this image, with the node's GPU passed
# through (`docker run --gpus all`), memory/CPU limits from the job, and no access to the host's files or desktop.
DOCKER_IMAGE = None
_PYTHON_NAMES = ("python", "python3", "py")


def container_name(job):
    return "c1-" + re.sub(r"[^A-Za-z0-9_.-]", "", job["id"])[:40]


def _docker_command(job, script_path, env):
    """`docker run` for a job. The user's text only ever appears as an argument, never in a shell on the host."""
    if not shutil.which("docker"):
        return None, env, None, "docker is not installed on this node (or not on PATH)"
    argv = ["docker", "run", "--rm", "--name", container_name(job)]
    if (job.get("gpu_count") or 0) > 0:
        argv += ["--gpus", "all"]
    if job.get("ram_mb"):
        argv += ["--memory", f"{int(job['ram_mb'])}m"]
    if job.get("cpu_cores"):
        argv += ["--cpus", str(int(job["cpu_cores"]))]
    for key, value in (job.get("env") or {}).items():
        argv += ["-e", f"{key}={value}"]
    argv += ["-e", f"CLUSTERONE_JOB_ID={job['id']}"]
    if job.get("command"):
        argv += [DOCKER_IMAGE, "/bin/bash", "-c", job["command"]]
    else:  # legacy Python source, mounted read-only
        argv += ["-v", f"{script_path}:/job/script.py:ro", DOCKER_IMAGE, "python", "/job/script.py"]
    return argv, env, None, None


def _host_argv(command):
    """A user command as an argv list for direct host execution (no shell, so no pipes/redirects)."""
    argv = shlex.split(command, posix=(os.name != "nt"))
    argv = [a[1:-1] if len(a) > 1 and a[0] == a[-1] and a[0] in "\"'" else a for a in argv]
    if argv and argv[0].lower() in _PYTHON_NAMES:
        argv[0] = sys.executable
    return argv


def build_job_command(job, script_path):
    """(argv, env, cwd, error) for a claimed job. Never uses a shell: values go in argv / env as data."""
    env = dict(os.environ, PYTHONUNBUFFERED="1", CLUSTERONE_JOB_ID=job["id"],
               CLUSTERONE_AGENT_DIR=os.path.dirname(os.path.abspath(__file__)))
    command = job.get("command")
    if DOCKER_IMAGE:
        return _docker_command(job, script_path, env)
    host_refused = ("this node does not run jobs directly on the host; start the agent with --allow-host-python, "
                    "--docker-image <image>, or install Apptainer")
    if not command:  # legacy: Python source
        if not ALLOW_HOST_EXEC:
            return None, env, None, host_refused
        env.update(job.get("env") or {})
        return [sys.executable, script_path], env, None, None
    if not shutil.which("apptainer"):
        if not ALLOW_HOST_EXEC:
            return None, env, None, "apptainer is not installed on this node; " + host_refused
        env.update(job.get("env") or {})
        cwd = job.get("working_dir")
        return _host_argv(command), env, (cwd if cwd and os.path.isdir(cwd) else None), None
    image = job.get("image")
    argv = ["apptainer", "exec", "--cleanenv"]
    if (job.get("gpu_count") or 0) > 0:
        argv.append("--nv")
    binds = [p for p in (job.get("working_dir"), job.get("output_dir")) if p]
    if job.get("dataset_path"):
        binds.append(job["dataset_path"] + ":" + job["dataset_path"] + ":ro")
    if binds:
        argv += ["--bind", ",".join(b if ":" in b else f"{b}:{b}" for b in dict.fromkeys(binds))]
    if job.get("working_dir"):
        argv += ["--pwd", job["working_dir"]]
    argv += [image, "/bin/bash", "-c", command]
    for key, value in (job.get("env") or {}).items():
        env["APPTAINERENV_" + key] = value
    env["APPTAINERENV_CLUSTERONE_JOB_ID"] = job["id"]
    return argv, env, None, None


def kill_tree(proc):
    """Kill a job and everything it started (data loaders, launcher stubs), so a cancel really frees the GPU."""
    name = getattr(proc, "c1_container", None)
    if name:  # killing the `docker run` client does not stop the container itself
        _run_ok(["docker", "kill", name], timeout=30)
    try:
        parent = psutil.Process(proc.pid)
        for child in parent.children(recursive=True):
            child.kill()
        parent.kill()
    except Exception:  # already gone, or psutil missing
        proc.kill()


def run_job(base, job):
    """Run a claimed job on this machine, streaming output to the controller."""
    def report(body):
        return post(f"{base}/jobs/{job['id']}/report", body)

    print(f"[job {job['id'][:8]}] starting: {job['name']}")
    fd, path = tempfile.mkstemp(suffix=".py", prefix="clusterone_job_")
    with os.fdopen(fd, "w", encoding="utf8") as f:
        f.write(job.get("script") or "print('empty job')")
    try:
        argv, env, cwd, error = build_job_command(job, path)
        if argv is None:
            report({"log_append": f"{error}\n", "status": "FAILED", "exit_code": 127})
            return
        print(f"[job {job['id'][:8]}] running: {argv[0]} ... (cwd={cwd or 'agent dir'})")
        proc = subprocess.Popen(argv, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env, cwd=cwd)
        proc.c1_container = container_name(job) if DOCKER_IMAGE else None
        report({"log_append": f"[clusterone] executing on {socket.gethostname()}\n"})
        lines = queue.Queue()
        threading.Thread(target=lambda: [lines.put(ln) for ln in proc.stdout], daemon=True).start()

        def drain():
            out = []
            while True:
                try:
                    out.append(lines.get_nowait())
                except queue.Empty:
                    return "".join(out)

        while proc.poll() is None:
            time.sleep(1)
            chunk = drain()
            try:
                resp = report({"log_append": chunk} if chunk else {})
                if resp["status"] == "CANCELLED":
                    kill_tree(proc)
                    print(f"[job {job['id'][:8]}] cancelled")
                    return
            except Exception as e:
                print("report failed:", e)
                if chunk:  # keep it for the next report
                    lines.put(chunk)
        time.sleep(0.3)
        chunk = drain()
        status = "COMPLETED" if proc.returncode == 0 else "FAILED"
        if proc.returncode != 0:
            chunk += f"\n[exit code {proc.returncode}]\n"
        report({"log_append": chunk, "status": status, "exit_code": proc.returncode})
        print(f"[job {job['id'][:8]}] {status}")
    finally:
        os.remove(path)


def job_loop(base, node_id):
    while True:
        try:
            job = get(f"{base}/nodes/{node_id}/jobs/next")
            if job:
                try:
                    run_job(base, job)
                except Exception as e:  # noqa: BLE001 - a crash must fail the job, never leave it RUNNING forever
                    traceback.print_exc()
                    try:
                        post(f"{base}/jobs/{job['id']}/report", {
                            "log_append": f"[clusterone] the node agent could not run this job: {type(e).__name__}: {e}\n",
                            "status": "FAILED", "exit_code": 1})
                    except Exception as e2:  # noqa: BLE001
                        print("could not report the failure:", e2)
                continue
        except Exception as e:
            print("job poll failed:", e)
        time.sleep(2)


# --------------------------------------------------------------------------
def main():
    global TOKEN, ALLOW_HOST_EXEC, DOCKER_IMAGE
    ap = argparse.ArgumentParser()
    ap.add_argument("--server", required=True, help="e.g. http://10.20.0.10:8000")
    ap.add_argument("--name", default=socket.gethostname(), help="node name shown on the dashboard")
    ap.add_argument("--interval", type=float, default=1.0)
    ap.add_argument("--token", default=TOKEN, help="shared secret (or env CLUSTERONE_AGENT_TOKEN)")
    ap.add_argument("--no-jobs", action="store_true", help="report health only; never run jobs on this machine")
    ap.add_argument("--allow-host-python", action="store_true",
                    help="DEV ONLY: run submitted Python/commands directly on this PC (no container). "
                         "Anyone who can submit jobs can then run code as this user.")
    ap.add_argument("--docker-image", help="run every job inside this Docker image with the GPU passed through "
                                           "(e.g. pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime). Safer than host execution.")
    a = ap.parse_args()
    ALLOW_HOST_EXEC = a.allow_host_python
    DOCKER_IMAGE = a.docker_image
    if DOCKER_IMAGE:
        print(f"Jobs run in Docker image {DOCKER_IMAGE} (GPU passthrough: docker run --gpus all).")
    elif ALLOW_HOST_EXEC and not a.no_jobs:
        print("WARNING: --allow-host-python is on: submitted jobs run directly on this PC as this user.")
    if psutil is None:
        sys.exit("psutil is required: pip install psutil")
    TOKEN = a.token
    base = a.server.rstrip("/") + "/api/v1"

    print("Checking what this machine can run (PyTorch/CUDA, FFmpeg NVENC, Docker)...", flush=True)
    capabilities = probe_capabilities()
    capabilities["accepts_jobs"] = not a.no_jobs  # a report-only agent must never be handed work
    print("Capabilities:", json.dumps(capabilities), flush=True)

    def register():
        return post(f"{base}/nodes/register", {
            "hostname": a.name, "ip_address": local_ip(), "cpu_cores": psutil.cpu_count() or 1,
            "ram_total_mb": psutil.virtual_memory().total // (1024 * 1024), "gpus": read_gpus(),
            "agent_version": AGENT_VERSION, "os_info": f"{platform.system()} {platform.release()}",
            "capabilities": capabilities})

    while True:  # the controller may start after the agent
        try:
            node = register()
            break
        except Exception as e:
            print("register failed, retrying in 5s:", e)
            time.sleep(5)
    print(f"Registered as {a.name} (id {node['id']}). Ctrl+C to stop.")
    if not a.no_jobs:
        threading.Thread(target=job_loop, args=(base, node["id"]), daemon=True).start()

    net = NetRate()
    psutil.cpu_percent()  # first call is meaningless; prime it
    while True:
        try:
            rx, tx = net.sample()
            body = {"cpu_util_pct": psutil.cpu_percent(), "ram_used_mb": psutil.virtual_memory().used // (1024 * 1024),
                    "gpus": read_gpus()}
            if rx is not None:
                body.update(net_rx_mbps=rx, net_tx_mbps=tx)
            post(f"{base}/nodes/{node['id']}/heartbeat", body)
        except urllib.error.HTTPError as e:
            print("heartbeat failed:", e)
            if e.code == 404:  # controller lost its database: register again (same hostname, idempotent)
                try:
                    node = register()
                except Exception as e2:
                    print("re-register failed:", e2)
        except Exception as e:
            print("heartbeat failed:", e)
        time.sleep(a.interval)


if __name__ == "__main__":
    main()
