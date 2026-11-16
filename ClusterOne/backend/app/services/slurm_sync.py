"""Mirror Slurm's view of jobs and nodes into the local database.

In Slurm mode Slurm is the source of truth: every sync overwrites job state,
timing, exit code and allocation from slurmrestd (and from slurmdbd for jobs
slurmctld has already forgotten). The local rows exist so the API can answer
quickly, keep ClusterOne-only fields (image, env keys, ...), and survive a
slurmrestd outage.
"""
import logging
import re
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from app.config import settings
from app.models import TERMINAL_JOB_STATES, Job, JobStatus, Node
from app.services.slurm_client import SlurmError, slurm_client

log = logging.getLogger(__name__)

_STATE_MAP = {
    "PENDING": JobStatus.QUEUED,
    "REQUEUED": JobStatus.QUEUED,
    "REQUEUE_HOLD": JobStatus.QUEUED,
    "REQUEUE_FED": JobStatus.QUEUED,
    "RESV_DEL_HOLD": JobStatus.QUEUED,
    "CONFIGURING": JobStatus.SCHEDULED,
    "RUNNING": JobStatus.RUNNING,
    "COMPLETING": JobStatus.RUNNING,
    "SUSPENDED": JobStatus.RUNNING,
    "STOPPED": JobStatus.RUNNING,
    "SIGNALING": JobStatus.RUNNING,
    "STAGE_OUT": JobStatus.RUNNING,
    "RESIZING": JobStatus.RUNNING,
    "COMPLETED": JobStatus.COMPLETED,
    "CANCELLED": JobStatus.CANCELLED,
    "PREEMPTED": JobStatus.CANCELLED,
    "REVOKED": JobStatus.CANCELLED,
    "FAILED": JobStatus.FAILED,
    "TIMEOUT": JobStatus.FAILED,
    "NODE_FAIL": JobStatus.FAILED,
    "OUT_OF_MEMORY": JobStatus.FAILED,
    "BOOT_FAIL": JobStatus.FAILED,
    "DEADLINE": JobStatus.FAILED,
}


def map_state(states: Any) -> Optional[JobStatus]:
    """Slurm job_state (a list in v0.0.40, a string in older APIs) -> JobStatus.

    Flags such as COMPLETING can accompany another state, so the first state
    that is not a flag wins; unknown states return None (caller keeps its own).
    """
    if isinstance(states, str):
        states = [states]
    states = [str(s).upper() for s in (states or [])]
    # A terminal state beats a trailing COMPLETING flag.
    for s in states:
        if _STATE_MAP.get(s) in TERMINAL_JOB_STATES:
            return _STATE_MAP[s]
    for s in states:
        if s in _STATE_MAP:
            return _STATE_MAP[s]
    return None


def _num(value: Any) -> Optional[int]:
    """slurmrestd's NO_VAL structs ({set, infinite, number}) and plain numbers -> int|None."""
    if isinstance(value, dict):
        if not value.get("set", True) or value.get("infinite"):
            return None
        value = value.get("number")
    if isinstance(value, bool) or value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _epoch(value: Any) -> Optional[datetime]:
    ts = _num(value)
    if not ts or ts <= 0:
        return None
    return datetime.fromtimestamp(ts, timezone.utc).replace(tzinfo=None)


_MEM_RE = re.compile(r"^(\d+(?:\.\d+)?)([KMGTP]?)$", re.IGNORECASE)
_MEM_MB = {"": 1.0, "K": 1 / 1024, "M": 1.0, "G": 1024.0, "T": 1024.0**2, "P": 1024.0**3}


def parse_tres(tres: Any) -> Dict[str, int]:
    """Allocated TRES -> {'cpus', 'ram_mb', 'gpus'} (only the keys that are present).

    Accepts the 'cpu=8,mem=32G,node=1,gres/gpu=2' string form and the
    slurmdb list form [{'type': 'gres', 'name': 'gpu', 'count': 2}, ...].
    """
    out: Dict[str, int] = {}
    pairs: List[tuple] = []
    if isinstance(tres, str):
        for part in tres.split(","):
            if "=" in part:
                k, v = part.split("=", 1)
                pairs.append((k.strip(), v.strip()))
    elif isinstance(tres, list):
        for t in tres:
            key = t.get("type", "") + (f"/{t['name']}" if t.get("name") else "")
            pairs.append((key, str(t.get("count", 0))))
    for key, val in pairs:
        if key == "cpu" and val.isdigit():
            out["cpus"] = int(val)
        elif key == "mem":
            m = _MEM_RE.match(val)
            if m:
                out["ram_mb"] = int(float(m.group(1)) * _MEM_MB[m.group(2).upper()])
        elif key == "gres/gpu" and val.isdigit():
            out["gpus"] = int(val)
        elif key.startswith("gres/gpu:") and val.isdigit():  # typed GPUs, e.g. gres/gpu:a100
            out["gpus"] = out.get("gpus", 0) + int(val)
    return out


def _exit_code(value: Any) -> Optional[int]:
    if isinstance(value, dict):
        rc = value.get("return_code", value.get("number"))
        return _num(rc)
    return _num(value)


def parse_job(sj: Dict[str, Any]) -> Dict[str, Any]:
    """One entry of slurmctld's /jobs -> normalised fields."""
    tres = parse_tres(sj.get("tres_alloc_str") or sj.get("tres_req_str") or "")
    return {
        "slurm_job_id": str(sj.get("job_id")),
        "name": sj.get("name"),
        "user": sj.get("user_name"),
        "partition": sj.get("partition"),
        "state": sj.get("job_state"),
        "reason": sj.get("state_reason"),
        "nodes": sj.get("nodes") or None,
        "cpus": _num(sj.get("cpus")) or tres.get("cpus"),
        "ram_mb": tres.get("ram_mb") or _num(sj.get("memory_per_node")),
        "gpus": tres.get("gpus"),
        "time_limit_minutes": _num(sj.get("time_limit")),
        "start": _epoch(sj.get("start_time")),
        "end": _epoch(sj.get("end_time")),
        "exit_code": _exit_code(sj.get("exit_code")),
    }


def parse_accounting_job(sj: Dict[str, Any]) -> Dict[str, Any]:
    """One entry of slurmdbd's /job/{id} -> normalised fields (same keys as parse_job)."""
    state = sj.get("state") or {}
    time_info = sj.get("time") or {}
    tres = parse_tres((sj.get("tres") or {}).get("allocated") or [])
    return {
        "slurm_job_id": str(sj.get("job_id")),
        "name": sj.get("name"),
        "user": sj.get("user"),
        "partition": sj.get("partition"),
        "state": state.get("current") if isinstance(state, dict) else state,
        "reason": state.get("reason") if isinstance(state, dict) else None,
        "nodes": sj.get("nodes") or None,
        "cpus": tres.get("cpus"),
        "ram_mb": tres.get("ram_mb"),
        "gpus": tres.get("gpus"),
        "time_limit_minutes": _num(time_info.get("limit")),
        "start": _epoch(time_info.get("start")),
        "end": _epoch(time_info.get("end")),
        "exit_code": _exit_code(sj.get("exit_code")),
    }


def match_node(db: Session, hostlist: Optional[str]) -> Optional[Node]:
    """Resolve a single Slurm node name (not a [range] hostlist) to a registered node."""
    if not hostlist or any(c in hostlist for c in "[,"):
        return None
    short = hostlist.split(".")[0]
    for node in db.query(Node).all():
        if node.hostname == hostlist or node.hostname.split(".")[0] == short:
            return node
    return None


def apply_to_job(db: Session, job: Job, p: Dict[str, Any]) -> None:
    """Overwrite local job state with Slurm's. Slurm wins; nothing is guessed."""
    status = map_state(p["state"])
    states = p["state"] if isinstance(p["state"], list) else [p["state"]] if p["state"] else []
    job.slurm_state = ",".join(str(s) for s in states) or job.slurm_state
    if status is not None:
        job.status = status
    job.state_reason = p["reason"] if p["reason"] not in (None, "None") else None
    if p["partition"]:
        job.partition = p["partition"]
    if p["time_limit_minutes"]:
        job.time_limit_minutes = p["time_limit_minutes"]
    job.started_at = p["start"] or job.started_at
    job.ended_at = p["end"] if job.status in TERMINAL_JOB_STATES else None
    if job.status in TERMINAL_JOB_STATES and p["exit_code"] is not None:
        job.exit_code = p["exit_code"]
    if p["nodes"]:
        job.allocated_nodes = p["nodes"]
        node = match_node(db, p["nodes"])
        if node is not None:
            job.node_id = node.id
    if p["cpus"]:
        job.allocated_cpus = p["cpus"]
    if p["ram_mb"]:
        job.allocated_ram_mb = p["ram_mb"]
    if p["gpus"] is not None:
        job.allocated_gpus = p["gpus"]


def _import_job(db: Session, p: Dict[str, Any]) -> Job:
    """A job someone submitted with sbatch directly: track it so the cluster view is complete."""
    job = Job(
        name=p["name"] or f"slurm-{p['slurm_job_id']}",
        submitted_by=p["user"] or "unknown",
        slurm_job_id=p["slurm_job_id"],
        requires_gpu=int(bool(p["gpus"])),
        gpu_count=p["gpus"] or 0,
        cpu_cores=p["cpus"] or 1,
        ram_mb=p["ram_mb"] or 0,
        status=JobStatus.QUEUED,
    )
    db.add(job)
    return job


class _SyncState:
    lock = threading.Lock()
    last_ok: Optional[float] = None  # monotonic time of the last good sync; None = never
    last_error: Optional[str] = None


def sync_jobs(db: Session) -> bool:
    """Pull job state from Slurm. Returns False (and keeps local data) if Slurm is unreachable."""
    with _SyncState.lock:
        try:
            listed = slurm_client.list_jobs().get("jobs", [])
        except SlurmError as e:
            _SyncState.last_error = str(e)
            log.warning("slurm job sync failed: %s", e)
            return False

        local = {str(j.slurm_job_id): j for j in db.query(Job).filter(Job.slurm_job_id.isnot(None)).all()}
        seen = set()
        for sj in listed:
            p = parse_job(sj)
            seen.add(p["slurm_job_id"])
            job = local.get(p["slurm_job_id"]) or _import_job(db, p)
            apply_to_job(db, job, p)

        # Tracked jobs slurmctld no longer lists have finished and aged out: ask accounting.
        for sid, job in local.items():
            if sid in seen or job.status in TERMINAL_JOB_STATES:
                continue
            try:
                rows = slurm_client.get_accounting_job(sid).get("jobs", [])
            except SlurmError as e:
                log.warning("slurmdb lookup for job %s failed: %s", sid, e)
                continue
            if rows:
                apply_to_job(db, job, parse_accounting_job(rows[0]))

        db.commit()
        _SyncState.last_ok = time.monotonic()
        _SyncState.last_error = None
        return True


def maybe_sync_jobs(db: Session) -> None:
    """Sync on API reads, at most once per slurm_sync_ttl_seconds, never raising."""
    if not settings.slurm_enabled:
        return
    last = _SyncState.last_ok
    if last is not None and time.monotonic() - last < settings.slurm_sync_ttl_seconds:
        return
    sync_jobs(db)


def sync_nodes(db: Session) -> bool:
    """Record Slurm's node state (IDLE/MIXED/ALLOCATED/DRAIN/DOWN...) on registered nodes."""
    try:
        listed = slurm_client.list_nodes().get("nodes", [])
    except SlurmError as e:
        log.warning("slurm node sync failed: %s", e)
        return False
    for sn in listed:
        node = match_node(db, sn.get("name") or sn.get("hostname"))
        if node is None:
            continue
        state = sn.get("state")
        states = [state] if isinstance(state, str) else state or []
        node.slurm_state = ",".join(str(s) for s in states) or None
    db.commit()
    return True


def reset_for_tests() -> None:
    _SyncState.last_ok = None
    _SyncState.last_error = None


def last_error() -> Optional[str]:
    return _SyncState.last_error


def reachable() -> Optional[bool]:
    """Outcome of the most recent sync; None if Slurm mode is off or no sync has run yet."""
    if not settings.slurm_enabled or (_SyncState.last_ok is None and _SyncState.last_error is None):
        return None
    return _SyncState.last_error is None
