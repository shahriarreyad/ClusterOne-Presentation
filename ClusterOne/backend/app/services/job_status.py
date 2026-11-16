"""Job responses enriched with where the job runs and a plain-language explanation of its state.

Everything here is derived from recorded data (node table, Slurm state/reason, exit code and the
job's own log tail); nothing is guessed. When the cause of a failure cannot be determined the
message just says so.
"""
import re
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models import Job, JobStatus, Node, NodeStatus
from app.schemas import JobResponse
from app.services import log_reader, node_registry
from app.services.node_registry import accepts_jobs
from app.utils import format_slurm_time

_UP = (NodeStatus.ONLINE, NodeStatus.BUSY)

# Slurm pending reasons -> what the user should understand.
_PENDING_REASONS = {
    "Resources": "Waiting for the requested GPUs/CPUs/RAM to become free.",
    "Priority": "Waiting behind jobs with higher priority.",
    "Dependency": "Waiting for a job it depends on.",
    "ReqNodeNotAvail": "The requested nodes are unavailable (offline or drained). Your job remains queued.",
    "Nodes_Required_For_Reservation": "Waiting: the nodes it needs are reserved.",
    "PartitionDown": "The partition is down. Your job remains queued.",
    "PartitionNodeLimit": "The request needs more nodes than the partition allows.",
    "PartitionTimeLimit": "The time limit exceeds what the partition allows.",
    "QOSMaxGRESPerUser": "You have reached your GPU limit; the job starts when one of your jobs ends.",
    "AssocGrpGRES": "The account's GPU allocation is used up.",
    "BadConstraints": "The request cannot be satisfied by any node in the partition.",
}

# Patterns in the log tail of a failed job, most specific first.
_LOG_CAUSES = [
    # Our own check scripts (gpu_check.py, ffmpeg_gpu_check.py) end with `TEST: FAILED (<reason>)`: show that reason.
    (re.compile(r"TEST: FAILED \((.+)\)"), "The node check failed: {0}"),
    (re.compile(r"CUDA out of memory|torch\.OutOfMemoryError|CUDA error: out of memory", re.I),
     "The GPU ran out of memory (CUDA out of memory). Reduce the batch size or request a GPU with more VRAM."),
    (re.compile(r"no CUDA-capable device|Found no NVIDIA driver|CUDA driver initialization failed|"
                r"CUDA error: (?:no kernel image|invalid device|unknown error)|NVIDIA-SMI has failed", re.I),
     "CUDA is not working on the node (driver or device problem). Check nvidia-smi on that node."),
    (re.compile(r"apptainer is not installed|apptainer: command not found|FATAL:.*image", re.I),
     "The container could not be started on the node (Apptainer or the image is missing)."),
    (re.compile(r"MemoryError|Cannot allocate memory|oom-kill|\bKilled\b", re.I),
     "The job ran out of system RAM and was killed. Request more RAM or reduce memory use."),
    (re.compile(r"ModuleNotFoundError: No module named '([^']+)'", re.I),
     "Python module '{0}' is not installed in the container."),
    (re.compile(r"FileNotFoundError.*'([^']+)'", re.I), "File not found: {0}"),
]


def _names(nodes: Iterable[Node]) -> str:
    return ", ".join(sorted(n.hostname for n in nodes))


def _shortfalls(job: Job, node: Node, reserved: Dict[str, Tuple[int, int, int]]) -> List[str]:
    """What exactly keeps `job` off `node` right now, using the node's own numbers."""
    r_gpu, r_cpu, r_ram = reserved.get(node.id, (0, 0, 0))
    out = []
    need_gpu = job.gpus_wanted()
    free_gpu = node.free_gpu_count(r_gpu, job.min_vram_mb or 0)
    if need_gpu and free_gpu < need_gpu:
        if job.min_vram_mb and node.free_gpu_count(r_gpu, 0) >= need_gpu:
            biggest = max((g.get("vram_total_mb", 0) for g in node.gpus), default=0)
            out.append(f"no GPU with {job.min_vram_mb / 1024:g} GB free VRAM (its largest has {biggest / 1024:.0f} GB in total)")
        else:
            busy = " (the rest are busy or reserved)" if node.gpu_count > free_gpu else ""
            out.append(f"only {free_gpu} of {need_gpu} requested GPU(s) free{busy}")
    free_cpu = node.cpu_cores - r_cpu
    if free_cpu < (job.cpu_cores or 1):
        out.append(f"only {max(free_cpu, 0)} of {job.cpu_cores} requested CPU cores free")
    free_ram = min(node.ram_total_mb - node.ram_used_mb, node.ram_total_mb - r_ram)
    if free_ram < (job.ram_mb or 0):
        out.append(f"only {max(free_ram, 0) / 1024:.1f} GB RAM free (needs {(job.ram_mb or 0) / 1024:g} GB)")
    return out


def _queued_message(job: Job, nodes: List[Node], node: Optional[Node],
                    reserved: Optional[Dict[str, Tuple[int, int, int]]] = None) -> str:
    if job.slurm_job_id:  # Slurm decides; relay its reason
        reason = (job.state_reason or "").split(",")[0].strip()
        return _PENDING_REASONS.get(reason) or (f"Queued by Slurm ({reason})." if reason else "Queued by Slurm.")
    if node is not None and node.status not in _UP:
        return f"{node.hostname} is currently offline. Your job remains queued."
    if node is not None:  # the user chose this node: say exactly what it is short of
        short = _shortfalls(job, node, reserved or {})
        if short:
            return f"Waiting for resources on {node.hostname}, the node you chose: " + "; ".join(short) + "."
    if not nodes:
        return "No compute node has connected yet. Your job remains queued."
    up = [n for n in nodes if n.status in _UP]
    online = [n for n in up if accepts_jobs(n)]
    if up and not online:
        return (f"The connected node(s) ({_names(up)}) are report-only (agent started with --no-jobs) and cannot run jobs. "
                "Restart an agent without --no-jobs, with --allow-host-python or --docker-image.")
    if not online:
        return f"All compute nodes are offline ({_names(nodes)}). Your job remains queued until one reconnects."
    # Nodes whole-reserved by other users are not available to this job.
    free_of_reservations = [n for n in online if not n.reserved_by or n.reserved_by == job.submitted_by]
    if not free_of_reservations:
        holders = ", ".join(sorted(f"{n.hostname} (reserved by {n.reserved_by})" for n in online))
        return f"Every online node is reserved: {holders}. Your job remains queued until one is released."
    online = free_of_reservations
    need = job.gpus_wanted()
    if need > max(n.gpu_count for n in online):
        return (f"Requests {need} GPU(s) but the largest online node has {max(n.gpu_count for n in online)}. "
                "It stays queued until a larger node connects.")
    if (job.cpu_cores or 1) > max(n.cpu_cores for n in online):
        return f"Requests {job.cpu_cores} CPU cores; no online node has that many."
    if (job.ram_mb or 0) > max(n.ram_total_mb for n in online):
        return f"Requests {(job.ram_mb or 0) // 1024} GB RAM; no online node has that much."
    best = min(((n, _shortfalls(job, n, reserved or {})) for n in online), key=lambda t: len(t[1]))
    if best[1]:
        return f"Waiting for resources on {best[0].hostname}: " + "; ".join(best[1]) + "."
    return "Waiting to be placed on an online node."


def _failure_message(job: Job, scan_logs: bool) -> str:
    state = (job.slurm_state or "").upper()
    if "TIMEOUT" in state:
        return f"Stopped at its time limit ({format_slurm_time(job.time_limit_minutes or 0)})."
    if "OUT_OF_MEMORY" in state:
        return f"Ran out of RAM (requested {(job.ram_mb or 0) // 1024} GB). Request more RAM or reduce memory use."
    if "NODE_FAIL" in state:
        return "The node failed while the job was running. Resubmit to run it on another node."
    if "BOOT_FAIL" in state:
        return "The node could not start the job (boot failure)."
    if job.state_reason and "lost" in job.state_reason:
        return job.state_reason[0].upper() + job.state_reason[1:] + ". Resubmit to run it on another node."
    if scan_logs:
        try:
            tail = log_reader.get_job_logs(job, tail=200)
            text = "\n".join(line.text for line in tail.lines)
        except OSError:
            text = ""
        for pattern, message in _LOG_CAUSES:
            m = pattern.search(text)
            if m:
                return message.format(*m.groups())
    if job.exit_code == 137:
        return "Killed (exit code 137): usually out of RAM or stopped at the time limit."
    if job.exit_code is not None:
        return f"Exited with code {job.exit_code}. See the logs for the error."
    return "The job failed. See the logs for details."


def explain(job: Job, nodes: List[Node], node: Optional[Node], scan_logs: bool = True,
            reserved: Optional[Dict[str, Tuple[int, int, int]]] = None) -> Optional[str]:
    if job.status in (JobStatus.SUBMITTED, JobStatus.QUEUED):
        return _queued_message(job, nodes, node, reserved)
    if job.status == JobStatus.SCHEDULED:
        if node is not None and node.status not in _UP:
            return f"{node.hostname} is currently offline. Your job remains queued."
        return f"Assigned to {node.hostname if node else 'a node'}; waiting for it to start."
    if job.status == JobStatus.RUNNING:
        if node is not None and node.status not in _UP and not job.slurm_job_id:
            return f"{node.hostname} stopped sending heartbeats. The job may be lost and will be marked failed."
        return None
    if job.status == JobStatus.FAILED:
        return _failure_message(job, scan_logs)
    if job.status == JobStatus.CANCELLED:
        return "Cancelled."
    return None


def to_responses(db: Session, jobs: List[Job], scan_logs: bool = False) -> List[JobResponse]:
    nodes = db.query(Node).all()
    by_id: Dict[str, Node] = {n.id: n for n in nodes}
    reserved = node_registry.reserved_by_node(db)
    out = []
    for job in jobs:
        node = by_id.get(job.node_id) if job.node_id else None
        chosen = by_id.get(job.requested_node_id) if job.requested_node_id else None
        r = JobResponse.model_validate(job)
        r.node_hostname = node.hostname if node else None
        r.node_ip = node.ip_address if node else None
        r.status_message = explain(job, nodes, node or chosen, scan_logs, reserved)
        out.append(r)
    return out


def to_response(db: Session, job: Job, scan_logs: bool = True) -> JobResponse:
    return to_responses(db, [job], scan_logs)[0]

