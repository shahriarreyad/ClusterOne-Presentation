import logging
import re
from collections import defaultdict
from datetime import timedelta
from typing import Dict, Iterable, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.config import settings
from app.models import ACTIVE_JOB_STATES, Job, JobStatus, Node, NodeStatus
from app.schemas import (
    GPUInfo,
    NodeHeartbeatRequest,
    NodeJobRef,
    NodeRegisterRequest,
    NodeResponse,
    TelemetryRequest,
)
from app.utils import as_utc, utcnow

log = logging.getLogger(__name__)

_HOSTNAME_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,254}")


def register_node(db: Session, req: NodeRegisterRequest) -> Node:
    """Create the node, or refresh it if the hostname is already known (idempotent; the id is stable)."""
    node = db.query(Node).filter(Node.hostname == req.hostname).one_or_none()

    if node is None:
        node = Node(hostname=req.hostname)
        db.add(node)

    node.ip_address = req.ip_address
    node.cpu_cores = req.cpu_cores
    node.ram_total_mb = req.ram_total_mb
    node.gpus = [g.model_dump() for g in req.gpus]
    node.agent_version = req.agent_version
    node.os_info = req.os_info
    node.capabilities = req.capabilities or node.capabilities
    node.status = NodeStatus.ONLINE
    node.last_heartbeat = utcnow()

    db.commit()
    db.refresh(node)
    return node


def record_heartbeat(db: Session, node_id: str, req: NodeHeartbeatRequest) -> Optional[Node]:
    node = db.query(Node).filter(Node.id == node_id).one_or_none()
    if node is None:
        return None

    node.cpu_util_pct = req.cpu_util_pct
    node.ram_used_mb = req.ram_used_mb
    node.gpus = [g.model_dump() for g in req.gpus]
    node.net_rx_mbps = req.net_rx_mbps
    node.net_tx_mbps = req.net_tx_mbps
    node.status = req.status or NodeStatus.ONLINE
    node.last_heartbeat = utcnow()

    db.commit()
    db.refresh(node)
    return node


def _float(value) -> Optional[float]:
    try:
        return float(value) if value is not None else None
    except (TypeError, ValueError):
        return None


def ingest_telemetry(db: Session, req: TelemetryRequest) -> Optional[Node]:
    """Create/refresh a node from the Linux telemetry agent's payload.

    Fields absent from the payload are left as they were (or unknown for a new node);
    a GPU entry without a VRAM size is skipped rather than guessed.
    """
    hostname = (req.hostname or "").strip()
    if not _HOSTNAME_RE.fullmatch(hostname):
        return None
    node = db.query(Node).filter(Node.hostname == hostname).one_or_none()
    if node is None:
        node = Node(hostname=hostname, cpu_cores=0, ram_total_mb=0, gpus=[])
        db.add(node)

    node.ip_address = req.ip or node.ip_address
    node.os_info = req.os or node.os_info
    node.agent_version = req.agentVersion or node.agent_version
    cpu, ram, net = req.cpu or {}, req.ram or {}, req.network or {}
    if isinstance(cpu.get("cores"), int) and cpu["cores"] > 0:
        node.cpu_cores = cpu["cores"]
    if _float(cpu.get("utilization")) is not None:
        node.cpu_util_pct = max(0.0, _float(cpu.get("utilization")) or 0.0)
    if _float(ram.get("totalGb")) is not None:
        node.ram_total_mb = int((_float(ram.get("totalGb")) or 0) * 1024)
    if _float(ram.get("usedGb")) is not None:
        node.ram_used_mb = int((_float(ram.get("usedGb")) or 0) * 1024)
    rx, tx = _float(net.get("rxKbps")), _float(net.get("txKbps"))
    node.net_rx_mbps = rx / 1000 if rx is not None else node.net_rx_mbps
    node.net_tx_mbps = tx / 1000 if tx is not None else node.net_tx_mbps

    if req.gpus is not None:
        gpus = []
        for g in req.gpus:
            total = _float(g.get("vramTotalMb"))
            if total is None:
                continue
            gpus.append(GPUInfo(
                name=str(g.get("name") or "GPU"), vram_total_mb=int(total),
                vram_used_mb=int(_float(g.get("vramUsedMb")) or 0),
                utilization_pct=_float(g.get("utilizationGpu")) or 0.0,
                index=g.get("index") if isinstance(g.get("index"), int) else None,
                uuid=g.get("uuid"), temperature_c=_float(g.get("temperatureC")),
                power_w=_float(g.get("powerDrawWatts"))).model_dump())
        node.gpus = gpus

    node.status = NodeStatus.ONLINE
    node.last_heartbeat = utcnow()
    db.commit()
    db.refresh(node)
    return node


def sweep_stale_nodes(db: Session) -> int:
    """Mark nodes DOWN if they've missed their heartbeat window. Returns count updated.

    In dev mode, work that was placed on a node that just went DOWN is recovered:
    SCHEDULED jobs go back to QUEUED for another node, RUNNING jobs are FAILED
    (their process died with the node). In Slurm mode Slurm handles this itself.
    """
    cutoff = utcnow() - timedelta(seconds=settings.heartbeat_timeout_seconds)
    stale = (
        db.query(Node)
        .filter(Node.status != NodeStatus.DOWN)
        .filter((Node.last_heartbeat.is_(None)) | (Node.last_heartbeat < cutoff))
        .all()
    )
    for node in stale:
        node.status = NodeStatus.DOWN
        log.warning("node %s missed its heartbeat window; marked DOWN", node.hostname)
        if not settings.slurm_enabled:
            _recover_jobs_of_lost_node(db, node)
    if stale:
        db.commit()
    return len(stale)


def _recover_jobs_of_lost_node(db: Session, node: Node) -> None:
    now = utcnow()
    for job in db.query(Job).filter(Job.node_id == node.id, Job.status.in_(ACTIVE_JOB_STATES)).all():
        if job.status == JobStatus.SCHEDULED:
            job.status = JobStatus.QUEUED
            job.node_id = None
        else:
            job.status = JobStatus.FAILED
            job.ended_at = now
            job.state_reason = f"node {node.hostname} lost (heartbeat timeout)"
            job.logs = (job.logs or "") + f"\n[ClusterOne] node {node.hostname} stopped sending heartbeats; job failed\n"


# --------------------------------------------------------------------------
# Reservations and placement (dev-mode scheduler)
# --------------------------------------------------------------------------
def reserved_by_node(db: Session) -> Dict[str, Tuple[int, int, int]]:
    """node_id -> (gpus, cpus, ram_mb) already promised to SCHEDULED/RUNNING jobs."""
    out: Dict[str, List[int]] = defaultdict(lambda: [0, 0, 0])
    for job in db.query(Job).filter(Job.node_id.isnot(None), Job.status.in_(ACTIVE_JOB_STATES)).all():
        if job.node_id is None:
            continue
        r = out[job.node_id]
        r[0] += job.allocated_gpus if job.allocated_gpus is not None else job.gpus_wanted()
        r[1] += job.allocated_cpus or job.cpu_cores or 0
        r[2] += job.allocated_ram_mb or job.ram_mb or 0
    return {k: (v[0], v[1], v[2]) for k, v in out.items()}


def accepts_jobs(node: Node) -> bool:
    """False for a node whose agent runs in report-only mode (--no-jobs): it would never start what it is given."""
    return (node.capabilities or {}).get("accepts_jobs", True) is not False


class ReservationError(Exception):
    def __init__(self, detail: str, status_code: int = 409) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


def claim_node(db: Session, node_id: str, user: str) -> Node:
    """Reserve the whole node for `user`: nobody else's jobs are placed on it until it is released.

    Refused if someone else holds it, or if other users' jobs are already running or assigned there.
    This is a ClusterOne scheduling reservation; it cannot stop the PC's own owner from using the machine.
    """
    node = db.get(Node, node_id)
    if node is None:
        raise ReservationError("node not found", 404)
    if node.reserved_by and node.reserved_by != user:
        raise ReservationError(f"{node.hostname} is already reserved by {node.reserved_by}")
    others = [j for j in db.query(Job).filter(Job.node_id == node.id, Job.status.in_(ACTIVE_JOB_STATES)).all()
              if j.submitted_by != user]
    if others:
        names = ", ".join(sorted({j.submitted_by for j in others}))
        raise ReservationError(f"{node.hostname} is running jobs of {names}; reserve it when they finish")
    node.reserved_by, node.reserved_at = user, utcnow()
    db.commit()
    db.refresh(node)
    return node


def release_node(db: Session, node_id: str, user: Optional[str], is_admin: bool) -> Node:
    node = db.get(Node, node_id)
    if node is None:
        raise ReservationError("node not found", 404)
    if node.reserved_by and user is not None and node.reserved_by != user and not is_admin:
        raise ReservationError(f"{node.hostname} is reserved by {node.reserved_by}", 403)
    node.reserved_by, node.reserved_at = None, None
    db.commit()
    db.refresh(node)
    return node


def remove_node(db: Session, node_id: str) -> str:
    """Forget a node that has gone away for good. Refused while it is reporting or has work on it.

    Finished jobs keep their history (they just lose the link to the node); a node whose agent is still
    running would simply re-register, so it must be stopped first.
    """
    sweep_stale_nodes(db)
    node = db.get(Node, node_id)
    if node is None:
        raise ReservationError("node not found", 404)
    if node.status in (NodeStatus.ONLINE, NodeStatus.BUSY):
        raise ReservationError(f"{node.hostname} is still reporting; stop its node agent first")
    if db.query(Job).filter(Job.node_id == node.id, Job.status.in_(ACTIVE_JOB_STATES)).count():
        raise ReservationError(f"{node.hostname} still has active jobs")
    db.query(Job).filter(Job.node_id == node.id).update({Job.node_id: None})
    db.query(Job).filter(Job.requested_node_id == node.id).update({Job.requested_node_id: None})
    hostname = node.hostname
    db.delete(node)
    db.commit()
    return hostname


def reserved_nodes_for_others(db: Session, owner: str) -> List[Node]:
    return [n for n in db.query(Node).filter(Node.reserved_by.isnot(None)).all() if n.reserved_by != owner]


def pick_node_for_job(db: Session, gpu_count: int, min_vram_mb: int, cpu_cores: int, ram_mb: int,
                      only_node_id: Optional[str] = None, owner: Optional[str] = None) -> Optional[Node]:
    """Dev-mode placement: among ONLINE nodes with enough unreserved capacity, prefer the one with most free VRAM.

    With only_node_id (the user chose a node) that node is the only candidate, and it must still have the
    GPUs, CPU and RAM free: a chosen node is never over-committed.

    This stands in for real Slurm scheduling (see ClusterOne_07_Database_API_Design.md);
    it is not used when CLUSTERONE_SLURM_ENABLED=true.
    """
    sweep_stale_nodes(db)
    reserved = reserved_by_node(db)
    query = db.query(Node).filter(Node.status == NodeStatus.ONLINE)
    if only_node_id:
        query = query.filter(Node.id == only_node_id)
    # A node reserved by someone else is off limits (the holder's own jobs may still use it).
    candidates = [n for n in query.all() if (not n.reserved_by or n.reserved_by == owner) and accepts_jobs(n)]
    best: Optional[Node] = None
    best_free_vram = -1

    for node in candidates:
        r_gpu, r_cpu, r_ram = reserved.get(node.id, (0, 0, 0))
        if node.cpu_cores - r_cpu < cpu_cores:
            continue
        if min(node.ram_total_mb - node.ram_used_mb, node.ram_total_mb - r_ram) < ram_mb:
            continue
        if gpu_count > 0:
            if node.free_gpu_count(r_gpu, min_vram_mb) < gpu_count:
                continue
            free_vram = node.max_free_vram_mb()
            if free_vram > best_free_vram:
                best = node
                best_free_vram = free_vram
        elif best is None:
            best = node

    return best


# --------------------------------------------------------------------------
# API views
# --------------------------------------------------------------------------
def node_responses(db: Session, nodes: Iterable[Node]) -> List[NodeResponse]:
    """Nodes plus the derived fields the dashboard topology needs (current jobs, free GPUs, heartbeat age)."""
    nodes = list(nodes)
    active: Dict[str, List[Job]] = defaultdict(list)
    for job in db.query(Job).filter(Job.node_id.isnot(None), Job.status.in_(ACTIVE_JOB_STATES)).order_by(Job.created_at).all():
        if job.node_id is not None:
            active[job.node_id].append(job)
    reserved = reserved_by_node(db)
    now = utcnow()

    out = []
    for node in nodes:
        resp = NodeResponse.model_validate(node)
        resp.gpu_count = node.gpu_count
        resp.gpus_free = 0 if node.status in (NodeStatus.DOWN, NodeStatus.OFFLINE) else node.free_gpu_count(
            reserved.get(node.id, (0, 0, 0))[0])
        resp.capabilities = node.capabilities or {}
        if node.status in (NodeStatus.DOWN, NodeStatus.OFFLINE):
            resp.availability = "OFFLINE"
        elif not accepts_jobs(node):
            resp.availability = "ERROR"  # online but will not run jobs (report-only agent)
        elif node.gpu_count == 0:
            resp.availability = "ERROR"
        else:
            resp.availability = "AVAILABLE" if resp.gpus_free > 0 else "BUSY"
        if node.last_heartbeat is not None:
            resp.heartbeat_age_seconds = round(max(0.0, (as_utc(now) - as_utc(node.last_heartbeat)).total_seconds()), 1)
        resp.current_jobs = [
            NodeJobRef(id=j.id, name=j.name, status=j.status, submitted_by=j.submitted_by,
                       gpu_count=j.allocated_gpus if j.allocated_gpus is not None else j.gpus_wanted(),
                       slurm_job_id=j.slurm_job_id)
            for j in active.get(node.id, [])
        ]
        out.append(resp)
    return out


def sorted_nodes(db: Session) -> List[Node]:
    """Nodes in a stable, human order (gpu2 before gpu10) so the topology doesn't shuffle."""
    def key(n: Node):
        return [int(t) if t.isdigit() else t.lower() for t in re.split(r"(\d+)", n.hostname)]

    return sorted(db.query(Node).all(), key=key)
