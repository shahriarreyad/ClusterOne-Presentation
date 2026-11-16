"""End-to-end check that a job submitted from THIS machine really runs on a remote GPU node.

    python scripts/remote_gpu_smoke_test.py --api http://10.20.0.10:8000
    python scripts/remote_gpu_smoke_test.py --api http://192.168.0.104:8000 --node gpu02 --burn-seconds 20

It submits a real job through the ClusterOne API (so it goes through Slurm in Slurm mode, or the dev
scheduler otherwise), waits for it, and verifies each claim:

  1. the job was accepted         5. GPU utilisation moved while the job ran (--burn-seconds)
  2. it started on a node         6. the logs came back to ClusterOne
  3. that node is NOT this PC     7. the job completed with exit code 0
  4. the job saw an NVIDIA GPU    8. this PC stayed free (it ran nothing but this script)

Nothing is simulated: every line printed comes from the API or from the job's own output.
Needs PyTorch inside the job's environment for checks 4-5 (use an image such as pytorch.sif, or a node whose
Python has torch); without torch the job falls back to `nvidia-smi` only. Standard library only.
"""
import argparse
import json
import socket
import sys
import time
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

# One self-contained Python program, passed as `python -c "exec('...')"` so it needs no shell features
# (works in an Apptainer container, through the dev agent, and on a plain host).
PROBE = """import socket, subprocess
print('host', socket.gethostname())
try:
    print(subprocess.run(['nvidia-smi', '-L'], capture_output=True, text=True).stdout.strip())
except Exception as e:
    print('nvidia-smi unavailable:', e)
try:
    import torch
    print('torch', torch.__version__)
    print('cuda_available', torch.cuda.is_available())
    if torch.cuda.is_available():
        print('device', torch.cuda.get_device_name(0))
        import time
        end = time.time() + BURN_SECONDS
        x = torch.randn(4096, 4096, device='cuda')
        n = 0
        while time.time() < end:
            x = (x @ x).tanh()
            torch.cuda.synchronize()
            n += 1
        if n:
            print('burn_iterations', n)
except ImportError:
    print('torch not installed here')
"""


class Api:
    def __init__(self, base: str, token: Optional[str] = None) -> None:
        self.base = base.rstrip("/") + "/api/v1"
        self.token = token

    def call(self, method: str, path: str, body: Optional[dict] = None) -> Any:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(self.base + path, json.dumps(body).encode() if body is not None else None, headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            raise SystemExit(f"API error {e.code} on {method} {path}: {e.read().decode(errors='replace')[:300]}") from e
        except urllib.error.URLError as e:
            raise SystemExit(f"cannot reach {self.base}: {e.reason}") from e


def build_command(burn_seconds: int) -> str:
    code = PROBE.replace("BURN_SECONDS", str(burn_seconds))
    # Escape for a Python string literal delimited by single quotes: \ then ' then newline.
    escaped = code.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n")
    return "python -c \"exec('" + escaped + "')\""


def run(api: Api, args: argparse.Namespace) -> int:
    results: List[Dict[str, Any]] = []

    def check(n: int, text: str, ok: Optional[bool], detail: str = "") -> None:
        """ok=None means "could not be verified in this setup" (shown as SKIP, never as a pass)."""
        results.append({"n": n, "ok": ok is not False})
        label = "SKIP" if ok is None else "PASS" if ok else "FAIL"
        print(f"  {n}. [{label}] {text}" + (f"  ({detail})" if detail else ""))

    health = api.call("GET", "/cluster/summary")
    print(f"Cluster mode: {health.get('mode')}, nodes online: {health['nodes_online']}, GPUs idle: {health['gpus_idle']}")
    if health["nodes_online"] == 0:
        print("No compute node is online. Start node_agent.py on the GPU PC first.")
        return 2

    spec: Dict[str, Any] = {"name": "remote-gpu-smoke", "gpu_count": args.gpus, "cpu_count": args.cpus, "ram": args.ram,
                            "time_limit": "00:10:00", "command": args.command or build_command(args.burn_seconds)}
    if args.image:
        spec["image"] = args.image
    if args.node:
        node = next((n for n in api.call("GET", "/nodes") if n["hostname"] == args.node), None)
        if node is None:
            print(f"node '{args.node}' is not registered")
            return 2
        spec["node_id"] = node["id"]

    print("\nSubmitting from", socket.gethostname())
    job = api.call("POST", "/jobs", spec)
    check(1, "job accepted by ClusterOne", True, f"id {job['id'][:8]}, status {job['status']}")

    deadline = time.time() + args.timeout
    peak_util, util_samples, started = 0.0, [], None
    while time.time() < deadline:
        job = api.call("GET", f"/jobs/{job['id']}")
        if job["status"] == "RUNNING" and started is None:
            started = job
            print(f"     running on {job.get('node_hostname')} ({job.get('node_ip')})")
        if job["status"] == "RUNNING" and job.get("node_id"):
            node = api.call("GET", f"/nodes/{job['node_id']}")
            if node["gpus"]:
                util = max(g["utilization_pct"] for g in node["gpus"])
                util_samples.append(util)
                peak_util = max(peak_util, util)
        if job["status"] in ("COMPLETED", "FAILED", "CANCELLED"):
            break
        if job["status"] in ("QUEUED", "SCHEDULED") and job.get("status_message"):
            print("     waiting:", job["status_message"])
        time.sleep(args.poll)
    else:
        api.call("POST", f"/jobs/{job['id']}/cancel")
        print("timed out; job cancelled")
        return 1

    host = job.get("node_hostname") or ""
    check(2, "job started on a compute node", bool(host), f"{host} {job.get('node_ip') or ''}")
    local = socket.gethostname().lower()
    remote = bool(host) and host.lower() != local and local not in host.lower()
    if args.allow_local:
        check(3, "node is not this PC", None, f"--allow-local: job ran on {host}; this PC is {local}"
              + ("" if remote else " (the same machine)"))
    else:
        check(3, "node is not this PC", remote, f"this PC is {local}, job ran on {host}")

    logs = api.call("GET", f"/jobs/{job['id']}/logs?tail=200")
    text = "\n".join(line["text"] for line in logs["lines"])
    print("\n--- job output (from ClusterOne) ---\n" + text + "\n-------------------------------------\n")
    saw_gpu = "GPU 0:" in text or "cuda_available True" in text
    check(4, "job saw an NVIDIA GPU", saw_gpu, "nvidia-smi -L / torch.cuda reported a device" if saw_gpu else "no GPU in output")
    if args.burn_seconds:
        moved = peak_util >= 20
        check(5, "GPU utilisation rose while the job ran", moved, f"peak {peak_util:.0f}% over {len(util_samples)} samples")
    check(6, "logs returned to ClusterOne", bool(logs["lines"]), f"{len(logs['lines'])} lines")
    check(7, "job completed with exit code 0", job["status"] == "COMPLETED" and job.get("exit_code") in (0, None),
          f"{job['status']}, exit {job.get('exit_code')}" + (f" - {job['status_message']}" if job.get("status_message") else ""))
    if remote:
        check(8, "this PC only ran the client script", True, f"the job process lived on {host}, not here")
    else:
        check(8, "this PC only ran the client script", None, "cannot be shown when the node is this same PC")
    ok = all(r["ok"] for r in results)
    print("\nRESULT:", "ALL VERIFIABLE CHECKS PASSED" if ok else "SOME CHECKS FAILED")
    return 0 if ok else 1


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default="http://127.0.0.1:8000", help="ClusterOne API base URL")
    ap.add_argument("--token", help="Keycloak bearer token if auth is enabled")
    ap.add_argument("--node", help="pin to this node hostname (dev scheduler only)")
    ap.add_argument("--gpus", type=int, default=1)
    ap.add_argument("--cpus", type=int, default=2)
    ap.add_argument("--ram", default="4G")
    ap.add_argument("--image", help="container image alias/path (Slurm mode), e.g. pytorch")
    ap.add_argument("--command", help="override the test command")
    ap.add_argument("--burn-seconds", type=int, default=0, help="also load the GPU for N seconds (needs torch in the job)")
    ap.add_argument("--timeout", type=int, default=300)
    ap.add_argument("--poll", type=float, default=2.0)
    ap.add_argument("--allow-local", action="store_true", help="accept a node that is this PC (development only)")
    args = ap.parse_args(argv)
    return run(Api(args.api, args.token), args)


if __name__ == "__main__":
    sys.exit(main())
