"""Run code on a ClusterOne GPU node from your own laptop's terminal.

    python clusterone_cli.py nodes                      # who is connected, and what is free
    python clusterone_cli.py use gpu02                  # choose "my GPU" (remembered)
    python clusterone_cli.py run train.py --epochs 3    # run train.py ON gpu02, output streams here
    python clusterone_cli.py run --cmd "python /projects/me/train.py --epochs 3"
    python clusterone_cli.py status                     # live GPU / RAM of your node
    python clusterone_cli.py claim                      # reserve the WHOLE node: only your jobs run there
    python clusterone_cli.py release                    # give it back
    python clusterone_cli.py forget <hostname>          # remove an offline node from the list

`run FILE` sends the file's source to the node, which runs it with its own Python, GPU, CPU and RAM. Your
laptop only sends the text and prints the output; Ctrl+C cancels the job on the node. This is for a single
self-contained script (up to ~16 KB). Bigger projects: put them on storage the node can read (NFS, a shared
folder) and use --cmd. The node must be started with `node_agent.py ... --allow-host-python` (development
mode) or have Apptainer; in Slurm mode only --cmd is available.

The server address is read from --api, the CLUSTERONE_API environment variable, or ~/.clusterone.json.
Standard library only.
"""
import argparse
import getpass
import json
import os
import re
import socket
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any, Dict, List, Optional

CONFIG_PATH = Path(os.environ.get("CLUSTERONE_CONFIG", Path.home() / ".clusterone.json"))
MAX_SOURCE_CHARS = 16000
# Runs first on the node: makes sys.argv what you typed on your laptop. One line, so your code starts on line 2.
PRELUDE = 'import sys, os, json; sys.argv = json.loads(os.environ["C1_ARGV"])\n'
TERMINAL = ("COMPLETED", "FAILED", "CANCELLED")


class CliError(SystemExit):
    def __init__(self, message: str) -> None:
        super().__init__(f"error: {message}")


# --------------------------------------------------------------------------
def load_config() -> Dict[str, Any]:
    try:
        return json.loads(CONFIG_PATH.read_text(encoding="utf8"))
    except (OSError, ValueError):
        return {}


def save_config(cfg: Dict[str, Any]) -> None:
    CONFIG_PATH.write_text(json.dumps(cfg, indent=2), encoding="utf8")


class Api:
    def __init__(self, base: str, token: Optional[str] = None) -> None:
        self.base = base.rstrip("/") + "/api/v1"
        self.token = token

    def call(self, method: str, path: str, body: Optional[dict] = None) -> Any:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(self.base + path, data, headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=15) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")
            try:
                detail = json.loads(detail).get("detail", detail)
            except ValueError:
                pass
            raise CliError(f"{method} {path} -> {e.code}: {detail}") from e
        except urllib.error.URLError as e:
            raise CliError(f"cannot reach {self.base} ({e.reason}). Is the ClusterOne backend running and reachable?") from e


# --------------------------------------------------------------------------
def build_run_payload(source: str, name: str, argv: List[str], node_id: Optional[str], gpus: int, cpus: int,
                      ram: str, env: Dict[str, str], user: str) -> Dict[str, Any]:
    """The job request for `run FILE`: the file's source with a one-line prelude that restores sys.argv."""
    if len(PRELUDE) + len(source) > MAX_SOURCE_CHARS:
        raise CliError(f"{name} is too large to send ({len(source)} characters; limit about {MAX_SOURCE_CHARS}). "
                       "Put the project on storage the node can read and use: run --cmd \"python /path/train.py\"")
    clean = re.sub(r"[^A-Za-z0-9._-]", "-", name).strip("-.")[:60] or "script"
    payload: Dict[str, Any] = {
        "name": clean, "gpu_count": gpus, "cpu_count": cpus, "ram": ram, "submitted_by": user,
        "script": PRELUDE + source, "env": {**env, "C1_ARGV": json.dumps(argv)},
    }
    if node_id:
        payload["node_id"] = node_id
    return payload


def build_cmd_payload(command: str, name: str, node_id: Optional[str], gpus: int, cpus: int, ram: str,
                      env: Dict[str, str], user: str) -> Dict[str, Any]:
    clean = re.sub(r"[^A-Za-z0-9._-]", "-", name).strip("-.")[:60] or "command"
    payload: Dict[str, Any] = {"name": clean, "gpu_count": gpus, "cpu_count": cpus, "ram": ram, "submitted_by": user,
                               "command": command, "env": env}
    if node_id:
        payload["node_id"] = node_id
    return payload


def parse_env(pairs: List[str]) -> Dict[str, str]:
    out = {}
    for p in pairs:
        if "=" not in p:
            raise CliError(f"--env expects NAME=VALUE, got {p!r}")
        k, v = p.split("=", 1)
        out[k] = v
    return out


def os_user() -> str:
    return re.sub(r"[^A-Za-z0-9_.@-]", "", getpass.getuser()) or "anonymous"


# --------------------------------------------------------------------------
def cmd_nodes(api: Api, _a: argparse.Namespace, cfg: Dict[str, Any]) -> int:
    nodes = api.call("GET", "/nodes")
    if not nodes:
        print("No node is connected. On the GPU PC run: python node_agent.py --server <this server> --name <name>")
        return 1
    for n in nodes:
        mark = "*" if n["id"] == cfg.get("node_id") else " "
        held = f"  [reserved by {n['reserved_by']}]" if n.get("reserved_by") else ""
        gpu = f"{n['gpu_count']} x {n['gpus'][0]['name']}" if n["gpus"] else "no GPU"
        free_ram = max(0, n["ram_total_mb"] - n["ram_used_mb"]) / 1024
        print(f"{mark} {n['hostname']:<16} {n['status']:<8} {gpu:<30} GPU free {n['gpus_free']}/{n['gpu_count']}  "
              f"RAM free {free_ram:.1f}/{n['ram_total_mb'] / 1024:.0f} GB  {n.get('ip_address') or ''}{held}")
    print("\n* = your chosen node" if cfg.get("node_id") else "\nNo node chosen yet: python clusterone_cli.py use <hostname>")
    return 0


def cmd_use(api: Api, a: argparse.Namespace, cfg: Dict[str, Any]) -> int:
    if not a.hostname:
        print(f"Chosen node: {cfg.get('node') or 'none (the scheduler picks)'}")
        return 0
    if a.hostname.lower() in ("any", "none"):
        cfg.pop("node_id", None)
        cfg.pop("node", None)
        save_config(cfg)
        print("No fixed node: the scheduler will choose.")
        return 0
    node = next((n for n in api.call("GET", "/nodes") if n["hostname"] == a.hostname), None)
    if node is None:
        raise CliError(f"no node named {a.hostname!r}. Run: nodes")
    if node["status"] not in ("ONLINE", "BUSY"):
        print(f"warning: {a.hostname} is {node['status']}; jobs cannot start on it until it reconnects")
    cfg.update(node_id=node["id"], node=node["hostname"])
    save_config(cfg)
    print(f"Using {node['hostname']} ({node.get('ip_address')}). Your jobs run on its GPU, CPU and RAM.")
    return 0


def cmd_status(api: Api, _a: argparse.Namespace, cfg: Dict[str, Any]) -> int:
    if not cfg.get("node_id"):
        raise CliError("no node chosen: python clusterone_cli.py use <hostname>")
    n = api.call("GET", f"/nodes/{cfg['node_id']}")
    print(f"{n['hostname']}  {n['status']}  {n.get('ip_address') or ''}  (last heartbeat {n.get('heartbeat_age_seconds')} s ago)")
    for i, g in enumerate(n["gpus"]):
        temp = f"{g['temperature_c']:.0f} C" if g.get("temperature_c") is not None else "temp n/a"
        print(f"  GPU {i}: {g['name']}  {g['utilization_pct']:.0f}% busy  VRAM {g['vram_used_mb'] / 1024:.1f}/"
              f"{g['vram_total_mb'] / 1024:.1f} GB  {temp}")
    print(f"  CPU {n['cpu_util_pct']:.0f}% of {n['cpu_cores']} cores   RAM {n['ram_used_mb'] / 1024:.1f}/{n['ram_total_mb'] / 1024:.1f} GB")
    print("  running: " + (", ".join(j["name"] for j in n["current_jobs"]) or "nothing"))
    return 0


def cmd_claim(api: Api, _a: argparse.Namespace, cfg: Dict[str, Any]) -> int:
    if not cfg.get("node_id"):
        raise CliError("no node chosen: python clusterone_cli.py use <hostname>")
    n = api.call("POST", f"/nodes/{cfg['node_id']}/claim", {"user": os_user()})
    print(f"{n['hostname']} is reserved for {n['reserved_by']}: {n['gpu_count']} GPU, {n['cpu_cores']} cores, "
          f"{n['ram_total_mb'] / 1024:.0f} GB RAM. Nobody else's jobs will be placed there until you run: release")
    print("(This reserves it inside ClusterOne; it does not lock the PC itself.)")
    return 0


def cmd_release(api: Api, _a: argparse.Namespace, cfg: Dict[str, Any]) -> int:
    if not cfg.get("node_id"):
        raise CliError("no node chosen: python clusterone_cli.py use <hostname>")
    n = api.call("DELETE", f"/nodes/{cfg['node_id']}/claim?user={os_user()}")
    print(f"{n['hostname']} released.")
    return 0


def cmd_forget(api: Api, a: argparse.Namespace, cfg: Dict[str, Any]) -> int:
    node = next((n for n in api.call("GET", "/nodes") if n["hostname"] == a.hostname), None)
    if node is None:
        raise CliError(f"no node named {a.hostname!r}")
    api.call("DELETE", f"/nodes/{node['id']}")
    if cfg.get("node_id") == node["id"]:
        cfg.pop("node_id", None)
        cfg.pop("node", None)
        save_config(cfg)
    print(f"{a.hostname} removed from the cluster list.")
    return 0


def local_addresses() -> List[str]:
    """This PC's names and IPs, to prove a job did NOT run here."""
    names = {socket.gethostname().lower()}
    try:
        names.update(socket.gethostbyname_ex(socket.gethostname())[2])
    except OSError:
        pass
    return sorted(names)


def is_this_pc(hostname: Optional[str], ip: Optional[str]) -> bool:
    mine = local_addresses()
    return bool((hostname and hostname.lower() in mine) or (ip and ip in mine))


def gpu_line(node: Dict[str, Any]) -> str:
    if not node.get("gpus"):
        return "none reported"
    g = node["gpus"][0]
    extra = " ".join(x for x in (f"driver {g['driver_version']}" if g.get("driver_version") else "",
                                 f"CUDA {g['cuda_version']}" if g.get("cuda_version") else "") if x)
    return f"{g['name']}  VRAM {g['vram_total_mb'] / 1024:.1f} GB  {extra}".rstrip()


def stream(api: Api, job_id: str, timestamps: bool) -> Dict[str, Any]:
    """Print the job's output as it appears until it reaches a final state; returns the final job.

    While the job runs, one `[gpu]` line every few seconds shows the NODE's real GPU load (so you can see
    it rising on the remote machine). `stream.stats` carries the peak and any EXECUTION NODE lines seen.
    """
    seen, last_msg, last_gpu = 0, None, 0.0
    stats: Dict[str, Any] = {"peak_util": None, "exec_lines": []}
    stream.stats = stats  # type: ignore[attr-defined]
    while True:
        job = api.call("GET", f"/jobs/{job_id}")
        if job["status"] in ("QUEUED", "SCHEDULED") and job.get("status_message") and job["status_message"] != last_msg:
            last_msg = job["status_message"]
            print(f"[waiting] {last_msg}", flush=True)
        while True:
            page = api.call("GET", f"/jobs/{job_id}/logs?offset={seen}&limit=500")
            for line in page["lines"]:
                prefix = f"{line['timestamp']} " if timestamps and line.get("timestamp") else ""
                print(prefix + line["text"], flush=True)
                if line["text"].startswith("EXECUTION NODE"):
                    stats["exec_lines"].append(line["text"])
            seen += len(page["lines"])
            if page.get("next_offset") is None:
                break
        if job["status"] == "RUNNING" and job.get("node_id") and time.monotonic() - last_gpu >= 4.0:
            last_gpu = time.monotonic()
            node = api.call("GET", f"/nodes/{job['node_id']}")
            if node.get("gpus"):
                g = node["gpus"][0]
                stats["peak_util"] = max(stats["peak_util"] or 0.0, g["utilization_pct"])
                print(f"[gpu] {node['hostname']}: {g['utilization_pct']:.0f}% busy, VRAM "
                      f"{g['vram_used_mb'] / 1024:.1f}/{g['vram_total_mb'] / 1024:.1f} GB, CPU {node['cpu_util_pct']:.0f}%, "
                      f"RAM {node['ram_used_mb'] / 1024:.1f}/{node['ram_total_mb'] / 1024:.1f} GB", flush=True)
        if job["status"] in TERMINAL:
            return job
        time.sleep(1.0)


def check_target(api: Api, cfg: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """The chosen node, or None if none is chosen. Exits (never falls back) if it is offline or gone."""
    node_id = cfg.get("node_id")
    if not node_id:
        return None
    try:
        node = api.call("GET", f"/nodes/{node_id}")
    except CliError as e:
        raise CliError(f"your chosen node {cfg.get('node')!r} is not known to the controller any more ({e}). "
                       "Run: nodes, then: use <hostname>") from e
    if node["status"] not in ("ONLINE", "BUSY"):
        print(f"TARGET NODE: {node['hostname']}\nSTATUS: OFFLINE ({node['status']})\n"
              f"{node['hostname']} is unreachable. Check that its PC is on and awake, the node agent is running, Windows "
              "Firewall on THIS PC allows port 8000, the IP address is right, and both PCs are on the same network.\n"
              "The job was NOT submitted and will not run on any other PC.")
        raise SystemExit(3)
    if (node.get("capabilities") or {}).get("accepts_jobs") is False:
        print(f"TARGET NODE: {node['hostname']}\nSTATUS: REPORT-ONLY\n"
              f"{node['hostname']}'s agent was started with --no-jobs, so it shows telemetry but cannot run jobs. "
              "Restart it without --no-jobs (with --allow-host-python or --docker-image).\n"
              "The job was NOT submitted and will not run on any other PC.")
        raise SystemExit(3)
    return node


def cmd_run(api: Api, a: argparse.Namespace, cfg: Dict[str, Any]) -> int:
    env = parse_env(a.env or [])
    target = None if a.any_node else check_target(api, cfg)
    node_id = target["id"] if target else None
    if a.cmd:
        payload = build_cmd_payload(a.cmd, a.name or "command", node_id, a.gpus, a.cpus, a.ram, env, os_user())
    else:
        if not a.file:
            raise CliError("give a script to run (run train.py) or use --cmd \"...\"")
        if api.call("GET", "/cluster/summary").get("mode") == "slurm":
            raise CliError("the cluster is in Slurm mode: scripts must live on shared storage. Use --cmd \"python /path/train.py\"")
        path = Path(a.file)
        try:
            source = path.read_text(encoding="utf8")
        except OSError as e:
            raise CliError(f"cannot read {a.file}: {e}") from e
        payload = build_run_payload(source, a.name or path.stem, [path.name, *a.args], node_id, a.gpus, a.cpus, a.ram,
                                    env, os_user())
    print("Submitting job...")
    if target:
        print(f"Target     : {target['hostname']} ({target.get('ip_address') or '?'})  state {target.get('availability', target['status'])}")
        print(f"GPU        : {gpu_line(target)}")
    else:
        print("Target     : no node chosen (the scheduler picks an online node; use `use <hostname>` to fix one)")
    job = api.call("POST", "/jobs", payload)
    print(f"Job ID     : {job['id']}\nStatus     : {job.get('status', 'SUBMITTED')}  (runs on the node, not on this PC. Ctrl+C cancels it)",
          flush=True)
    try:
        final = stream(api, job["id"], a.timestamps)
    except KeyboardInterrupt:
        api.call("POST", f"/jobs/{job['id']}/cancel")
        print("\nCancelled on the node.")
        return 130
    stats = getattr(stream, "stats", {"peak_util": None, "exec_lines": []})
    ran_on, ran_ip = final.get("node_hostname"), final.get("node_ip")
    print(f"\nSTATUS         : {final['status']}"
          + (f", exit code {final['exit_code']}" if final.get("exit_code") is not None else ""))
    print(f"TARGET NODE    : {(target or {}).get('hostname') or '(scheduler choice)'}")
    print(f"EXECUTION NODE : {ran_on or '?'} ({ran_ip or '?'})")
    if stats["peak_util"] is not None:
        print(f"PEAK GPU LOAD  : {stats['peak_util']:.0f}% (read from the node's own GPU while the job ran)")
    if ran_on and is_this_pc(ran_on, ran_ip):
        print("WARNING        : the execution node is THIS PC, so the work used your own GPU.")
    elif ran_on:
        print(f"VERIFIED       : ran on {ran_on}, not on this PC ({socket.gethostname()}).")
    if target and ran_on and ran_on != target["hostname"]:
        print(f"WARNING        : asked for {target['hostname']} but it ran on {ran_on}.")
    if final["status"] == "FAILED" and final.get("status_message"):
        print(final["status_message"])
    return 0 if final["status"] == "COMPLETED" else (final.get("exit_code") or 1)


def main(argv: Optional[List[str]] = None) -> int:
    cfg = load_config()
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--api", default=os.environ.get("CLUSTERONE_API") or cfg.get("api") or "http://127.0.0.1:8000",
                    help="ClusterOne backend URL (saved by `use` once given)")
    ap.add_argument("--token", "--api-key", dest="token",
                    default=os.environ.get("CLUSTERONE_API_KEY") or os.environ.get("CLUSTERONE_TOKEN") or cfg.get("token"),
                    help="the controller's API key (CLUSTERONE_API_KEY) or a Keycloak bearer token, if one is required")
    sub = ap.add_subparsers(dest="command", required=True)
    sub.add_parser("nodes", help="list connected nodes")
    p = sub.add_parser("use", help="choose the node whose GPU/RAM your jobs use ('any' clears it)")
    p.add_argument("hostname", nargs="?")
    sub.add_parser("status", help="live GPU/CPU/RAM of your chosen node")
    sub.add_parser("claim", help="reserve your whole chosen node (only your jobs are placed there)")
    sub.add_parser("release", help="release the node you reserved")
    fg = sub.add_parser("forget", help="remove an offline node from the list")
    fg.add_argument("hostname")
    r = sub.add_parser("run", help="run a script (or --cmd) on your node")
    r.add_argument("file", nargs="?", help="a Python file on this PC")
    r.add_argument("args", nargs=argparse.REMAINDER, help="arguments passed to the script")
    r.add_argument("--cmd", help="a command to run on the node instead of a file (paths must exist there)")
    r.add_argument("--name"), r.add_argument("--gpus", type=int, default=1), r.add_argument("--cpus", type=int, default=2)
    r.add_argument("--ram", default="2G"), r.add_argument("--env", action="append", metavar="NAME=VALUE")
    r.add_argument("--any-node", action="store_true", help="ignore the chosen node for this run")
    r.add_argument("--timestamps", action="store_true")
    a = ap.parse_args(argv)

    api = Api(a.api, a.token)
    handler = {"nodes": cmd_nodes, "use": cmd_use, "status": cmd_status, "run": cmd_run,
               "claim": cmd_claim, "release": cmd_release, "forget": cmd_forget}[a.command]
    if a.command == "use" and a.api != cfg.get("api"):
        cfg["api"] = a.api  # remember where the server is the first time
    return handler(api, a, cfg)


if __name__ == "__main__":
    sys.exit(main())
