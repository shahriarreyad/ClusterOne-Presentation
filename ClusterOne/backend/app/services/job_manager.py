import logging
import os
from typing import Optional

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.config import settings
from app.models import TERMINAL_JOB_STATES, Job, JobStatus, Node, _uuid
from app.schemas import JobCreateRequest, JobReport
from app.services import log_reader, node_registry, slurm_jobspec
from app.services.slurm_client import SlurmError, slurm_client
from app.utils import utcnow

log = logging.getLogger(__name__)


class SubmissionError(Exception):
    """A request that is well-formed but cannot be accepted (maps to an HTTP error)."""

    def __init__(self, detail: str, status_code: int = 422) -> None:
        super().__init__(detail)
        self.detail = detail
        self.status_code = status_code


class InvalidTransition(Exception):
    pass


# Dev-mode state machine. (Slurm mode takes whatever state Slurm reports.)
_ALLOWED = {
    JobStatus.SUBMITTED: {JobStatus.QUEUED, JobStatus.SCHEDULED, JobStatus.RUNNING, JobStatus.CANCELLED, JobStatus.FAILED},
    JobStatus.QUEUED: {JobStatus.SCHEDULED, JobStatus.CANCELLED, JobStatus.FAILED},
    JobStatus.SCHEDULED: {JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED},
    JobStatus.RUNNING: {JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED},
    JobStatus.COMPLETED: set(),
    JobStatus.FAILED: set(),
    JobStatus.CANCELLED: set(),
}


def transition(job: Job, new: JobStatus) -> None:
    """Move a job to `new`, stamping start/end times. Same-state is a no-op."""
    if new == job.status:
        return
    if new not in _ALLOWED[job.status]:
        raise InvalidTransition(f"job {job.id} cannot go {job.status.value} -> {new.value}")
    job.status = new
    now = utcnow()
    if new == JobStatus.RUNNING and job.started_at is None:
        job.started_at = now
    if new in TERMINAL_JOB_STATES:
        job.ended_at = now


def submit_job(db: Session, req: JobCreateRequest, owner: Optional[str] = None) -> Job:
    command = req.run_command
    if settings.slurm_enabled and not command:
        raise SubmissionError("command is required: Slurm jobs run a command inside a container image")

    job = Job(
        id=_uuid(),
        name=req.name,
        submitted_by=owner or req.submitted_by,
        requires_gpu=int(bool(req.requires_gpu)),
        gpu_count=req.gpu_count,
        min_vram_mb=req.min_vram_mb,
        cpu_cores=req.cpu_cores,
        ram_mb=req.ram_mb,
        time_limit_minutes=req.time_limit_minutes,
        partition=req.partition or settings.slurm_default_partition,
        image=req.image or (settings.default_image if command else None),
        working_dir=req.working_dir,
        dataset_path=req.dataset_path,
        output_dir=req.output_dir,
        command=req.command,
        script=req.script,
        env_vars=req.env or None,
        environment=req.environment,
        requested_node_id=req.node_id,
        status=JobStatus.SUBMITTED,
    )
    db.add(job)

    if settings.slurm_enabled:
        pinned = db.get(Node, req.node_id) if req.node_id else None
        if req.node_id and pinned is None:
            raise SubmissionError("the chosen node is not registered", 404)
        if pinned and pinned.reserved_by and pinned.reserved_by != job.submitted_by:
            raise SubmissionError(f"{pinned.hostname} is reserved by {pinned.reserved_by}", 409)
        # Nodes whole-reserved by other users are excluded from this job's placement.
        excluded = [n.hostname for n in node_registry.reserved_nodes_for_others(db, job.submitted_by)]
        try:
            result = slurm_client.submit_job(
                slurm_jobspec.build_submission(job, node_name=pinned.hostname if pinned else None, exclude=excluded))
        except SlurmError as e:
            db.rollback()
            log.error("slurm submit failed for %s: %s", req.name, e)
            raise SubmissionError(f"Slurm rejected or could not receive the job: {e}", 502) from e
        slurm_id = slurm_jobspec.extract_job_id(result)
        if slurm_id is None:
            db.rollback()
            raise SubmissionError("Slurm accepted the request but returned no job id", 502)
        job.slurm_job_id = slurm_id
        job.log_path = slurm_jobspec.output_pattern(job).replace("%j", slurm_id)
        job.slurm_state = "PENDING"
        job.status = JobStatus.QUEUED
    else:
        # With a chosen node that node is the only candidate (and must have the GPUs/CPU/RAM free);
        # otherwise the best-fitting online node is picked. If nothing fits yet the job waits QUEUED.
        node = node_registry.pick_node_for_job(
            db,
            gpu_count=job.gpus_wanted(),
            min_vram_mb=req.min_vram_mb,
            cpu_cores=req.cpu_cores or 1,
            ram_mb=req.ram_mb or 0,
            only_node_id=req.node_id,
            owner=job.submitted_by,
        )
        if node is None:
            job.status = JobStatus.QUEUED
        else:
            job.node_id = node.id
            job.status = JobStatus.SCHEDULED

    db.commit()
    db.refresh(job)
    return job


def cancel_job(db: Session, job_id: str) -> Optional[Job]:
    job = db.query(Job).filter(Job.id == job_id).one_or_none()
    if job is None:
        return None

    if job.status in TERMINAL_JOB_STATES:
        return job

    if settings.slurm_enabled and job.slurm_job_id:
        try:
            slurm_client.cancel_job(job.slurm_job_id)
        except SlurmError as e:
            if e.status_code != 404:  # 404: Slurm already forgot it, i.e. it has finished
                raise SubmissionError(f"Slurm could not cancel job {job.slurm_job_id}: {e}", 502) from e

    job.status = JobStatus.CANCELLED
    job.ended_at = utcnow()
    db.commit()
    db.refresh(job)
    return job


def retry_job(db: Session, job: Job, owner: Optional[str] = None) -> Job:
    """Submit a fresh copy of a finished job. The original keeps its history (and its Slurm record)."""
    if job.status not in TERMINAL_JOB_STATES:
        raise SubmissionError(f"job is {job.status.value}; only finished jobs can be retried (cancel it first)", 409)
    try:
        req = JobCreateRequest(
            name=job.name, submitted_by=job.submitted_by, partition=job.partition,
            gpu_count=job.gpus_wanted(), min_vram_mb=job.min_vram_mb or 0, cpu_cores=job.cpu_cores or 1,
            ram_mb=job.ram_mb or None, time_limit=job.time_limit_minutes, image=job.image,
            working_dir=job.working_dir, dataset_path=job.dataset_path, output_dir=job.output_dir,
            command=job.command, script=job.script, env=job.env_vars, environment=job.environment,
        )
    except ValidationError as e:
        raise SubmissionError("this job's stored spec no longer validates: " + e.errors()[0]["msg"]) from e
    return submit_job(db, req, owner=owner)


def claim_next_job(db: Session, node_id: str) -> Optional[Job]:
    """Dev mode: hand a node agent the oldest job scheduled to it and mark it RUNNING."""
    job = (
        db.query(Job)
        .filter(Job.node_id == node_id, Job.status == JobStatus.SCHEDULED)
        .order_by(Job.created_at)
        .first()
    )
    if job is None:
        return None
    transition(job, JobStatus.RUNNING)
    db.commit()
    db.refresh(job)
    return job


def apply_report(db: Session, job: Job, report: JobReport) -> Job:
    """Apply a node agent's progress report (log output and/or a state change)."""
    if report.log_append:
        append_log(job, report.log_append)
    # A cancelled (or otherwise finished) job keeps its state; the agent sees that in the
    # response and stops the process.
    if report.status and job.status not in TERMINAL_JOB_STATES:
        transition(job, report.status)
    if report.exit_code is not None and job.status in TERMINAL_JOB_STATES and job.exit_code is None:
        job.exit_code = report.exit_code
    db.commit()
    db.refresh(job)
    return job


def append_log(job: Job, text: str) -> None:
    """Append agent output to the job's log file (timestamped per line) and mirror a bounded tail in the DB."""
    now = utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")
    stamped = "".join(f"{now} {line}\n" for line in text.splitlines())
    path = log_reader.dev_log_path(job.id)
    try:
        os.makedirs(path.parent, exist_ok=True)
        with open(path, "a", encoding="utf-8", errors="replace") as fh:
            fh.write(stamped)
    except OSError as e:
        log.error("could not write log for job %s: %s", job.id, e)
    tail = ((job.logs or "") + text)
    limit = settings.log_db_tail_bytes
    job.logs = tail[-limit:] if len(tail) > limit else tail


def retry_queued_jobs(db: Session) -> int:
    """Try to place any QUEUED dev-mode jobs onto now-available nodes."""
    if settings.slurm_enabled:
        return 0

    queued = db.query(Job).filter(Job.status == JobStatus.QUEUED).order_by(Job.created_at).all()
    placed = 0
    for job in queued:
        node = node_registry.pick_node_for_job(
            db,
            gpu_count=job.gpus_wanted(),
            min_vram_mb=job.min_vram_mb or 0,
            cpu_cores=job.cpu_cores or 1,
            ram_mb=job.ram_mb or 0,
            only_node_id=job.requested_node_id,  # a job pinned to a node waits for that node
            owner=job.submitted_by,
        )
        if node is not None:
            job.node_id = node.id
            transition(job, JobStatus.SCHEDULED)
            db.flush()  # so the next queued job sees this reservation
            placed += 1
    if placed:
        db.commit()
    return placed

