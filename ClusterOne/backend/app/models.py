import enum
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import JSON, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.config import settings
from app.database import Base
from app.utils import utcnow as _now


def _uuid() -> str:
    return str(uuid.uuid4())


class NodeStatus(str, enum.Enum):
    ONLINE = "ONLINE"
    BUSY = "BUSY"
    OFFLINE = "OFFLINE"
    DOWN = "DOWN"


class JobStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    QUEUED = "QUEUED"
    SCHEDULED = "SCHEDULED"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"


TERMINAL_JOB_STATES = (JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED)
ACTIVE_JOB_STATES = (JobStatus.SCHEDULED, JobStatus.RUNNING)
PENDING_JOB_STATES = (JobStatus.SUBMITTED, JobStatus.QUEUED, JobStatus.SCHEDULED)


class Node(Base):
    __tablename__ = "nodes"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    hostname: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    cpu_cores: Mapped[int] = mapped_column(Integer, default=0)
    ram_total_mb: Mapped[int] = mapped_column(Integer, default=0)

    # List of {"name", "vram_total_mb", "vram_used_mb", "utilization_pct",
    #          "index", "uuid", "temperature_c", "power_w"} (last four optional)
    gpus: Mapped[List[Dict[str, Any]]] = mapped_column(JSON, default=list)

    cpu_util_pct: Mapped[float] = mapped_column(Float, default=0.0)
    ram_used_mb: Mapped[int] = mapped_column(Integer, default=0)

    status: Mapped[NodeStatus] = mapped_column(Enum(NodeStatus), default=NodeStatus.OFFLINE, nullable=False)

    registered_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    last_heartbeat: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Added after the first schema; see database.add_missing_columns for the in-place migration.
    net_rx_mbps: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    net_tx_mbps: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    agent_version: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    os_info: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    slurm_state: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # raw Slurm node state, e.g. "MIXED"
    # Whole-node reservation: while set, only this user's jobs are placed on the node.
    capabilities: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    reserved_by: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reserved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    jobs: Mapped[List["Job"]] = relationship("Job", back_populates="node")

    @property
    def gpu_count(self) -> int:
        return len(self.gpus or [])

    def free_gpu_count(self, reserved: int = 0, min_vram_mb: int = 0) -> int:
        """GPUs that look idle (and have min_vram_mb free), capped by GPUs not reserved by jobs placed here."""
        idle = sum(
            1 for g in (self.gpus or [])
            if g.get("utilization_pct", 0) < settings.gpu_idle_threshold_pct
            and g.get("vram_total_mb", 0) - g.get("vram_used_mb", 0) >= min_vram_mb
        )
        return max(0, min(idle, self.gpu_count - reserved))

    def max_free_vram_mb(self) -> int:
        free = [
            g.get("vram_total_mb", 0) - g.get("vram_used_mb", 0)
            for g in (self.gpus or [])
            if g.get("utilization_pct", 0) < settings.gpu_idle_threshold_pct
        ]
        return max(free) if free else 0


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    submitted_by: Mapped[str] = mapped_column(String, nullable=False, default="anonymous")

    requires_gpu: Mapped[int] = mapped_column(Integer, default=1)  # boolean, kept int for SQLite simplicity
    min_vram_mb: Mapped[int] = mapped_column(Integer, default=0)
    cpu_cores: Mapped[int] = mapped_column(Integer, default=1)
    ram_mb: Mapped[int] = mapped_column(Integer, default=1024)

    script: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    environment: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.SUBMITTED, nullable=False)

    node_id: Mapped[Optional[str]] = mapped_column(String, ForeignKey("nodes.id"), nullable=True)
    slurm_job_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    logs: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    # --- Added after the first schema -------------------------------------
    gpu_count: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # null on legacy rows
    partition: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    time_limit_minutes: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    image: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    working_dir: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    dataset_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    output_dir: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    command: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    env_vars: Mapped[Optional[Dict[str, str]]] = mapped_column(JSON, nullable=True)  # {NAME: value}

    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    exit_code: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # What Slurm actually allocated (may differ from what was requested).
    allocated_nodes: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # hostlist, e.g. "gpu[01-02]"
    allocated_cpus: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    allocated_ram_mb: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    allocated_gpus: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    slurm_state: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # raw Slurm job state
    state_reason: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Slurm pending/failure reason
    log_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # Slurm-mode stdout file
    # The node the user asked for (kept even while the job waits for it); node_id is where it actually is.
    requested_node_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)

    node: Mapped[Optional[Node]] = relationship("Node", back_populates="jobs")

    def gpus_wanted(self) -> int:
        if self.gpu_count is not None:
            return self.gpu_count
        return 1 if self.requires_gpu else 0
