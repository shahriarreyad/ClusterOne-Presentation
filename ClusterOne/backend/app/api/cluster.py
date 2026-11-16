import shutil
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import __version__, auth
from app.config import settings
from app.database import get_db
from app.models import Job, JobStatus, Node, NodeStatus
from app.schemas import (
    ActivityEvent,
    ClusterSummary,
    ClusterTopology,
    ClusterUser,
    MasterInfo,
    PartitionSummary,
    StorageShare,
    StorageSummary,
    TelemetryRequest,
)
from app.services import job_manager, metrics, node_registry, slurm_sync
from app.services.slurm_client import SlurmError, slurm_client
from app.utils import format_slurm_time, utcnow

router = APIRouter(prefix="/cluster", tags=["cluster"])
health_router = APIRouter(tags=["health"])
# The Linux telemetry agent posts to /api/v1/telemetry (no /cluster segment).
telemetry_router = APIRouter(tags=["cluster"])


@router.get("/summary", response_model=ClusterSummary)
def summary(db: Session = Depends(get_db)):
    """Aggregate counts for the wall board. Contains no per-user data, so it is not authenticated."""
    node_registry.sweep_stale_nodes(db)
    slurm_sync.maybe_sync_jobs(db)
    nodes = db.query(Node).all()
    jobs = db.query(Job).all()
    reserved = node_registry.reserved_by_node(db)

    usable = [n for n in nodes if n.status in (NodeStatus.ONLINE, NodeStatus.BUSY)]
    gpus_total = sum(n.gpu_count for n in nodes)
    gpus_unavailable = sum(n.gpu_count for n in nodes if n not in usable)
    gpus_idle = sum(n.free_gpu_count(reserved.get(n.id, (0, 0, 0))[0]) for n in usable)

    return ClusterSummary(
        nodes_total=len(nodes),
        nodes_online=len(usable),
        nodes_down=sum(1 for n in nodes if n.status == NodeStatus.DOWN),
        gpus_total=gpus_total,
        gpus_allocated=gpus_total - gpus_unavailable - gpus_idle,
        gpus_idle=gpus_idle,
        gpus_unavailable=gpus_unavailable,
        jobs_running=sum(1 for j in jobs if j.status == JobStatus.RUNNING),
        jobs_pending=sum(1 for j in jobs if j.status in (JobStatus.SUBMITTED, JobStatus.QUEUED, JobStatus.SCHEDULED)),
        jobs_completed=sum(1 for j in jobs if j.status == JobStatus.COMPLETED),
        jobs_failed=sum(1 for j in jobs if j.status == JobStatus.FAILED),
        mode="slurm" if settings.slurm_enabled else "dev",
        generated_at=utcnow(),
    )


@router.get("/topology", response_model=ClusterTopology, dependencies=[Depends(auth.current_user)])
def topology(db: Session = Depends(get_db)):
    """The master and every GPU node under it, for drawing the cluster. Node count is whatever is registered."""
    node_registry.sweep_stale_nodes(db)
    return ClusterTopology(
        generated_at=utcnow(),
        master=MasterInfo(
            hostname=settings.master_hostname,
            ip_address=settings.master_ip,
            scheduler="slurm" if settings.slurm_enabled else "dev",
            slurm_reachable=slurm_sync.reachable(),
        ),
        nodes=node_registry.node_responses(db, node_registry.sorted_nodes(db)),
    )


@router.get("/healthz")
def healthz():
    """Original liveness endpoint, kept for compatibility."""
    return {"status": "ok"}


@health_router.get("/health")
def health(db: Session = Depends(get_db)):
    """Liveness plus dependency status. 503 only if the database is unusable; an
    unreachable Slurm or Prometheus makes the answer "degraded" but still 200."""
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
    except Exception:  # noqa: BLE001 - any DB failure means unhealthy
        db_ok = False

    slurm: Dict[str, Any] = {"enabled": settings.slurm_enabled, "reachable": None, "error": None}
    if settings.slurm_enabled:
        try:
            slurm_client.diag()
            slurm["reachable"] = True
        except SlurmError as e:
            slurm.update(reachable=False, error=str(e)[:200])

    prom: Dict[str, Any] = {"configured": metrics.enabled(), "reachable": None}
    if metrics.enabled():
        prom["reachable"] = metrics.prometheus.healthy()

    degraded = (not db_ok) or slurm["reachable"] is False or prom["reachable"] is False
    body: Dict[str, Any] = {
        "status": "degraded" if degraded else "ok",
        "version": __version__,
        "mode": "slurm" if settings.slurm_enabled else "dev",
        "time": utcnow().isoformat() + "Z",
        "database": {"ok": db_ok},
        "slurm": slurm,
        "prometheus": prom,
    }
    if not db_ok:
        return JSONResponse(status_code=503, content=body)
    body["nodes"] = {
        "total": db.query(Node).count(),
        "online": db.query(Node).filter(Node.status.in_((NodeStatus.ONLINE, NodeStatus.BUSY))).count(),
    }
    return body


# --------------------------------------------------------------------------
# Dashboard views. Everything below is computed from recorded data; when a value is
# not known it is reported as unknown (null / UNAVAILABLE), never estimated.
# --------------------------------------------------------------------------
def _visible_jobs(db: Session, principal: auth.Principal):
    """Jobs the caller may see: everything, or only their own when auth is on and they are not an admin."""
    q = db.query(Job)
    if principal.username is not None and not principal.is_admin:
        q = q.filter(Job.submitted_by == principal.username)
    return q


@router.get("/activity", response_model=List[ActivityEvent])
def activity(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    principal: auth.Principal = Depends(auth.current_user),
):
    """Recent job and node events, newest first, derived from the recorded timestamps."""
    slurm_sync.maybe_sync_jobs(db)
    events: List[ActivityEvent] = []
    for j in _visible_jobs(db, principal).order_by(Job.created_at.desc()).limit(limit).all():
        short = f"Job #{j.id[:8]} '{j.name}'"
        events.append(ActivityEvent(
            id=f"job-sub-{j.id}", timestamp=j.created_at, event_type="job_submitted",
            message=f"{short} submitted by {j.submitted_by}", tone="info", target_id=j.id, target_type="job"))
        if j.started_at:
            where = j.node.hostname if j.node else (j.allocated_nodes or "a compute node")
            events.append(ActivityEvent(
                id=f"job-start-{j.id}", timestamp=j.started_at, event_type="job_started",
                message=f"{short} running on {where}", tone="info", target_id=j.id, target_type="job"))
        if j.ended_at:
            tone = "success" if j.status == JobStatus.COMPLETED else "error" if j.status == JobStatus.FAILED else "warning"
            events.append(ActivityEvent(
                id=f"job-end-{j.id}", timestamp=j.ended_at, event_type=f"job_{j.status.value.lower()}",
                message=f"{short} {j.status.value.lower()}", tone=tone, target_id=j.id, target_type="job"))
    if principal.username is None or principal.is_admin:
        for n in db.query(Node).all():
            if n.last_heartbeat:
                events.append(ActivityEvent(
                    id=f"node-hb-{n.id}", timestamp=n.last_heartbeat, event_type="node_heartbeat",
                    message=f"Last heartbeat from {n.hostname} ({n.gpu_count} GPUs, {n.status.value})",
                    tone="success" if n.status in (NodeStatus.ONLINE, NodeStatus.BUSY) else "warning",
                    target_id=n.id, target_type="node"))
    events.sort(key=lambda e: e.timestamp, reverse=True)
    return events[:limit]


@router.get("/storage", response_model=StorageSummary, dependencies=[Depends(auth.current_user)])
def storage_summary():
    """Capacity of the shared-storage mounts, as seen from the machine running this service.

    Only paths that are actually mounted here are measured; the others are reported as
    UNAVAILABLE instead of being estimated.
    """
    mounts = [
        ("Home Directories", settings.nfs_home_root, "NFS"),
        ("Project Workspaces", settings.nfs_projects_root, "NFS"),
        ("Shared Datasets", settings.nfs_datasets_root, "NFS"),
        ("Fast Scratch", settings.scratch_root, "Node-local"),
    ]
    shares: List[StorageShare] = []
    for name, path, kind in mounts:
        try:
            du = shutil.disk_usage(path)
        except OSError:
            shares.append(StorageShare(name=name, path=path, type=kind, status="UNAVAILABLE"))
            continue
        gb = 1024 ** 3
        pct = round(du.used / du.total * 100, 1) if du.total else 0.0
        shares.append(StorageShare(
            name=name, path=path, type=kind, total_gb=round(du.total / gb, 1), used_gb=round(du.used / gb, 1),
            free_gb=round(du.free / gb, 1), usage_pct=pct,
            status="HEALTHY" if pct < 85 else "WARNING" if pct < 95 else "CRITICAL"))
    measured = [s for s in shares if s.total_gb is not None]
    if not measured:
        return StorageSummary(shares=shares)
    total = sum(s.total_gb or 0 for s in measured)
    used = sum(s.used_gb or 0 for s in measured)
    return StorageSummary(
        total_gb=round(total, 1), used_gb=round(used, 1),
        free_gb=round(sum(s.free_gb or 0 for s in measured), 1),
        usage_pct=round(used / total * 100, 1) if total else None, shares=shares)


# Partition intent from ClusterOne_03/11: whole cards on gpu, MPS sharing on teaching.
_PARTITION_INFO = {
    "gpu": ("Whole-GPU allocation for dedicated model training and benchmarks.", "Whole GPU"),
    "teaching": ("Shared (MPS) GPU allocation for coursework, tutorials and light testing.", "MPS / shared GPU"),
    "interactive": ("Interactive Jupyter and development sessions.", "Interactive"),
}


def _slurm_partition_nodes() -> Dict[str, int]:
    """Node count per partition from slurmrestd; empty if Slurm is off or unreachable."""
    if not settings.slurm_enabled:
        return {}
    try:
        parts = slurm_client.list_partitions().get("partitions", [])
    except SlurmError:
        return {}
    out: Dict[str, int] = {}
    for p in parts:
        total = (p.get("nodes") or {}).get("total")
        if p.get("name") and isinstance(total, int):
            out[p["name"]] = total
    return out


@router.get("/partitions", response_model=List[PartitionSummary], dependencies=[Depends(auth.current_user)])
def cluster_partitions(db: Session = Depends(get_db)):
    """Configured partitions with the limits this service enforces and current job counts."""
    node_counts = _slurm_partition_nodes()
    out = []
    for name in settings.partitions:
        desc, mode = _PARTITION_INFO.get(name, ("", ""))
        active = db.query(Job).filter(Job.partition == name, Job.status.in_((JobStatus.RUNNING, JobStatus.SCHEDULED))).count()
        pending = db.query(Job).filter(Job.partition == name, Job.status.in_((JobStatus.SUBMITTED, JobStatus.QUEUED))).count()
        out.append(PartitionSummary(
            name=name, description=desc, allocation_mode=mode, default_time_limit=settings.default_time_limit,
            max_time_limit=format_slurm_time(settings.max_time_limit_minutes),
            max_gpus_per_job=settings.max_gpus_per_job,
            nodes_count=node_counts.get(name),  # None in dev mode: the dev scheduler has no node-to-partition map
            active_jobs=active, pending_jobs=pending))
    return out


@router.get("/users", response_model=List[ClusterUser])
def cluster_users(db: Session = Depends(get_db), principal: auth.Principal = Depends(auth.current_user)):
    """Job counts and GPU-hours per submitting user, computed from the job records."""
    slurm_sync.maybe_sync_jobs(db)
    users: Dict[str, ClusterUser] = {}
    for j in _visible_jobs(db, principal).all():
        u = users.setdefault(j.submitted_by, ClusterUser(
            username=j.submitted_by, name=j.submitted_by, role="user", total_jobs=0, active_jobs=0, gpu_hours=0.0))
        u.total_jobs += 1
        if j.status in (JobStatus.RUNNING, JobStatus.SCHEDULED):
            u.active_jobs += 1
        if j.started_at:
            seconds = ((j.ended_at or utcnow()) - j.started_at).total_seconds()
            u.gpu_hours = round(u.gpu_hours + max(0.0, seconds) / 3600.0 * (j.allocated_gpus or j.gpus_wanted()), 2)
        if u.last_active is None or j.created_at > u.last_active:
            u.last_active = j.created_at
    return sorted(users.values(), key=lambda x: x.total_jobs, reverse=True)


@router.post("/telemetry", dependencies=[Depends(auth.agent_only)])
@telemetry_router.post("/telemetry", dependencies=[Depends(auth.agent_only)], include_in_schema=False)
def receive_telemetry(req: TelemetryRequest, db: Session = Depends(get_db)):
    """Ingest the payload of the Linux/NVIDIA telemetry agent (gpu_node_agent.py).

    Only values present in the payload are stored; nothing is defaulted. The preferred
    path for new agents is POST /nodes/register followed by /nodes/{id}/heartbeat.
    """
    node = node_registry.ingest_telemetry(db, req)
    if node is None:
        raise HTTPException(status_code=422, detail="telemetry needs a valid hostname")
    job_manager.retry_queued_jobs(db)
    return {"status": "ok", "node_id": node.id, "hostname": node.hostname}
