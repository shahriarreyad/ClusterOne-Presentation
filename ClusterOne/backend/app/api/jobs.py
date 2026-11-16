from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app import auth
from app.database import get_db
from app.models import Job, JobStatus, Node, NodeStatus
from app.schemas import JobCreateRequest, JobLogs, JobMetrics, JobReport, JobResponse
from app.services import job_manager, job_status, log_reader, metrics, node_registry, slurm_sync

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _load(db: Session, job_id: str, principal: auth.Principal) -> Job:
    slurm_sync.maybe_sync_jobs(db)
    job = db.query(Job).filter(Job.id == job_id).one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    auth.require_access(principal, job)
    return job


@router.post("", response_model=JobResponse)
def submit_job(
    req: JobCreateRequest,
    db: Session = Depends(get_db),
    principal: auth.Principal = Depends(auth.current_user),
):
    """Validate and submit a job. With Slurm enabled this goes to slurmrestd; otherwise to the dev scheduler."""
    if req.node_id:
        node_registry.sweep_stale_nodes(db)
        node = db.query(Node).filter(Node.id == req.node_id).one_or_none()
        if node is None:
            raise HTTPException(status_code=404, detail="node not found")
        if node.status != NodeStatus.ONLINE:
            raise HTTPException(
                status_code=409,
                detail=(f"{node.hostname} is {node.status.value} and cannot accept jobs, and the job will not run anywhere "
                        "else. Check that its PC is on, its node agent is running, the IP address is right, Windows "
                        "Firewall on the controller PC allows port 8000, and both PCs are on the same network."))
        if not node_registry.accepts_jobs(node):
            raise HTTPException(
                status_code=409,
                detail=(f"{node.hostname} is report-only (its agent was started with --no-jobs), so it cannot run jobs. "
                        "Restart its agent without --no-jobs, with --allow-host-python or --docker-image."))
        owner = principal.username or req.submitted_by
        if node.reserved_by and node.reserved_by != owner:
            raise HTTPException(status_code=409, detail=f"node {node.hostname} is reserved by {node.reserved_by}")
    try:
        return job_status.to_response(db, job_manager.submit_job(db, req, owner=principal.username), scan_logs=False)
    except job_manager.SubmissionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e


@router.get("", response_model=List[JobResponse])
def list_jobs(
    status: Optional[JobStatus] = None,
    user: Optional[str] = Query(None, description="only jobs submitted by this user"),
    node_id: Optional[str] = None,
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    principal: auth.Principal = Depends(auth.current_user),
):
    """Newest first. Log text is omitted from the list; use GET /jobs/{id} or /jobs/{id}/logs."""
    slurm_sync.maybe_sync_jobs(db)
    q = db.query(Job)
    if principal.username is not None and not principal.is_admin:
        q = q.filter(Job.submitted_by == principal.username)
    elif user:
        q = q.filter(Job.submitted_by == user)
    if status:
        q = q.filter(Job.status == status)
    if node_id:
        q = q.filter(Job.node_id == node_id)
    jobs = q.order_by(Job.created_at.desc()).offset(offset).limit(limit).all()
    return [r.model_copy(update={"logs": None}) for r in job_status.to_responses(db, jobs)]


@router.get("/{job_id}", response_model=JobResponse)
def get_job(job_id: str, db: Session = Depends(get_db), principal: auth.Principal = Depends(auth.current_user)):
    return job_status.to_response(db, _load(db, job_id, principal))


def _cancel(job_id: str, db: Session, principal: auth.Principal) -> JobResponse:
    _load(db, job_id, principal)
    try:
        job = job_manager.cancel_job(db, job_id)
    except job_manager.SubmissionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    return job_status.to_response(db, job)


@router.delete("/{job_id}", response_model=JobResponse)
def cancel_job_delete(job_id: str, db: Session = Depends(get_db), principal: auth.Principal = Depends(auth.current_user)):
    """Cancel a job (original endpoint; same as POST /jobs/{id}/cancel)."""
    return _cancel(job_id, db, principal)


@router.post("/{job_id}/cancel", response_model=JobResponse)
def cancel_job(job_id: str, db: Session = Depends(get_db), principal: auth.Principal = Depends(auth.current_user)):
    """Cancel a queued or running job. Cancelling a finished job is a no-op."""
    return _cancel(job_id, db, principal)


@router.get("/{job_id}/logs", response_model=JobLogs)
def job_logs(
    job_id: str,
    tail: Optional[int] = Query(None, ge=1, description="last N lines (default 200); ignored with offset/search"),
    offset: Optional[int] = Query(None, ge=0, description="page from this 0-based line number"),
    limit: Optional[int] = Query(None, ge=1, description="lines per page / max search hits"),
    search: Optional[str] = Query(None, min_length=1, max_length=200, description="case-insensitive substring"),
    timestamps: bool = Query(True, description="include per-line timestamps where the log has them"),
    db: Session = Depends(get_db),
    principal: auth.Principal = Depends(auth.current_user),
):
    """Tail, page through, or search a job's log without loading the file into memory."""
    job = _load(db, job_id, principal)
    return log_reader.get_job_logs(job, tail=tail, offset=offset, limit=limit, search=search, timestamps=timestamps)


@router.get("/{job_id}/metrics", response_model=JobMetrics)
def job_metrics(job_id: str, db: Session = Depends(get_db), principal: auth.Principal = Depends(auth.current_user)):
    """Runtime, requested/allocated resources and the readings of the node the job runs on."""
    job = _load(db, job_id, principal)
    node = db.query(Node).filter(Node.id == job.node_id).one_or_none() if job.node_id else None
    return metrics.job_metrics(job, node)


@router.post("/{job_id}/report", response_model=JobResponse, dependencies=[Depends(auth.agent_only)])
def report_job(job_id: str, report: JobReport, db: Session = Depends(get_db)):
    """Called by a node agent to append log output and/or set the final status."""
    job = db.query(Job).filter(Job.id == job_id).one_or_none()
    if job is None:
        raise HTTPException(status_code=404, detail="job not found")
    try:
        return job_manager.apply_report(db, job, report)
    except job_manager.InvalidTransition as e:
        db.rollback()
        raise HTTPException(status_code=409, detail=str(e)) from e


@router.post("/{job_id}/retry", response_model=JobResponse)
@router.post("/{job_id}/requeue", response_model=JobResponse)
def retry_job(job_id: str, db: Session = Depends(get_db), principal: auth.Principal = Depends(auth.current_user)):
    """Run a finished job again. Creates and returns a NEW job with the same spec; the original is untouched."""
    original = _load(db, job_id, principal)
    try:
        return job_status.to_response(db, job_manager.retry_job(db, original, owner=principal.username), scan_logs=False)
    except job_manager.SubmissionError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
