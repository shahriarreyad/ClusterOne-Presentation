"""Check that a ClusterOne master and its compute nodes can really talk to each other.

Assigning 10.20.0.x addresses does not connect machines; this checks that they are.
Run it from the master, from a node, or from any PC that should reach the cluster:

    python scripts/check_cluster_network.py --master 10.20.0.10 --node 10.20.0.21 --node 10.20.0.22
    python scripts/check_cluster_network.py --master 192.168.0.104 --api-port 8000 --skip slurm nfs

Each check prints PASS / FAIL / SKIP with a hint. Exit status is 1 if any check failed.
Standard library only.
"""
import argparse
import platform
import socket
import subprocess
import sys
from typing import Callable, List, Optional, Tuple

# (label, port, who listens, why it matters)
MASTER_PORTS = {
    "api": (8000, "ClusterOne API", "node agents register/heartbeat here; the browser UI talks to it"),
    "slurmctld": (6817, "slurmctld", "compute nodes and submit hosts talk to the Slurm controller"),
    "slurmrestd": (6820, "slurmrestd", "the ClusterOne backend submits jobs through it (normally localhost only)"),
    "nfs": (2049, "NFSv4", "shared datasets / project directories"),
}
NODE_PORTS = {
    "slurmd": (6818, "slurmd", "the controller starts jobs on the node through it"),
    "ssh": (22, "sshd", "VS Code Remote-SSH / administration"),
}

HINT_UNREACHABLE = (
    "Machines on different subnets/VLANs cannot see each other just because of their addresses. "
    "Check that both ports are on the same VLAN (or that routing/firewall rules allow it), cabling and "
    "the host firewall. See ClusterOne_04_Infrastructure_Network_Design.md."
)


def check_tcp(host: str, port: int, timeout: float = 3.0) -> Tuple[bool, str]:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True, "connected"
    except TimeoutError:
        return False, "timed out (firewall drop or no route)"
    except ConnectionRefusedError:
        return False, "refused (host is up, nothing listening / firewall reject)"
    except OSError as e:
        return False, str(e)


def ping(host: str, timeout_s: int = 2) -> Tuple[bool, str]:
    if platform.system() == "Windows":
        cmd = ["ping", "-n", "1", "-w", str(timeout_s * 1000), host]
    else:
        cmd = ["ping", "-c", "1", "-W", str(timeout_s), host]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s + 5, check=False)
    except (OSError, subprocess.TimeoutExpired) as e:
        return False, f"ping unavailable: {e}"
    return r.returncode == 0 and "unreachable" not in r.stdout.lower(), "replied" if r.returncode == 0 else "no reply"


def resolve(name: str) -> Tuple[bool, str]:
    try:
        return True, socket.gethostbyname(name)
    except OSError as e:
        return False, f"cannot resolve ({e})"


class Report:
    def __init__(self) -> None:
        self.rows: List[Tuple[str, str, str, str]] = []

    def add(self, status: str, name: str, detail: str, hint: str = "") -> None:
        self.rows.append((status, name, detail, hint))
        line = f"[{status:<4}] {name:<38} {detail}"
        print(line)
        if status == "FAIL" and hint:
            print(f"        -> {hint}")

    @property
    def failed(self) -> bool:
        return any(r[0] == "FAIL" for r in self.rows)


def run_checks(master: str, nodes: List[str], skip: List[str], api_port: int, report: Optional[Report] = None,
               tcp: Optional[Callable] = None, icmp: Optional[Callable] = None, dns: Optional[Callable] = None) -> Report:
    # Looked up at call time (not as default arguments) so the real functions can be swapped in tests.
    tcp, icmp, dns = tcp or check_tcp, icmp or ping, dns or resolve
    rep = report or Report()
    here = socket.gethostname()
    print(f"Running from {here}\n")

    targets = [("master", master)] + [(f"node {n}", n) for n in nodes]
    for label, host in targets:
        if not host.replace(".", "").isdigit():
            ok, detail = dns(host)
            rep.add("PASS" if ok else "FAIL", f"{label}: hostname resolves", detail, "Add it to DNS or /etc/hosts.")
        ok, detail = icmp(host)
        # ICMP is often filtered on purpose; a failed ping alone is a warning, TCP below is authoritative.
        rep.add("PASS" if ok else "WARN", f"{label}: ping {host}", detail)

    ports = dict(MASTER_PORTS)
    ports["api"] = (api_port, *MASTER_PORTS["api"][1:])
    for key, (port, svc, why) in ports.items():
        if key in skip:
            rep.add("SKIP", f"master: {svc} {master}:{port}", "skipped")
            continue
        ok, detail = tcp(master, port)
        rep.add("PASS" if ok else "FAIL", f"master: {svc} {master}:{port}", detail, f"{why}. {HINT_UNREACHABLE}")
    for node in nodes:
        for key, (port, svc, why) in NODE_PORTS.items():
            if key in skip or (key == "slurmd" and "slurm" in skip):
                rep.add("SKIP", f"node: {svc} {node}:{port}", "skipped")
                continue
            ok, detail = tcp(node, port)
            rep.add("PASS" if ok else "FAIL", f"node: {svc} {node}:{port}", detail, f"{why}. {HINT_UNREACHABLE}")
    return rep


def main(argv: Optional[List[str]] = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--master", default="10.20.0.10", help="master/anchor IP or hostname")
    ap.add_argument("--node", action="append", default=[], help="compute node IP/hostname (repeatable)")
    ap.add_argument("--api-port", type=int, default=8000)
    ap.add_argument("--skip", nargs="*", default=[], choices=["api", "slurmctld", "slurmrestd", "nfs", "slurmd", "ssh", "slurm"],
                    help="checks to skip, e.g. --skip slurm nfs when running without Slurm")
    a = ap.parse_args(argv)
    skip = ["slurmctld", "slurmrestd", "slurmd"] if "slurm" in a.skip else list(a.skip)
    rep = run_checks(a.master, a.node, skip, a.api_port)
    print("\nRESULT:", "FAIL - fix the items above before submitting jobs" if rep.failed else "OK")
    return 1 if rep.failed else 0


if __name__ == "__main__":
    sys.exit(main())
