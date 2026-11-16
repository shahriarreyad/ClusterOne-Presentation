import uuid
import enum
from datetime import datetime

from sqlalchemy import (
    String,
    Integer,
    Float,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SAEnum,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    student = "student"
    researcher = "researcher"
    admin = "admin"


class NodeStatus(str, enum.Enum):
    online = "online"
    offline = "offline"
    busy = "busy"


class JobStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    completed = "completed"
    failed = "failed"
    cancelled = "cancelled"


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole, name="user_role"), nullable=False, default=UserRole.student)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    jobs: Mapped[list["Job"]] = relationship(back_populates="user", cascade="all, delete-orphan")


class Node(Base):
    __tablename__ = "nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    hostname: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    ip_address: Mapped[str] = mapped_column(String(45), nullable=False)
    cpu_cores: Mapped[int] = mapped_column(Integer, nullable=False)
    ram_gb: Mapped[float] = mapped_column(Float, nullable=False)
    status: Mapped[NodeStatus] = mapped_column(SAEnum(NodeStatus, name="node_status"), nullable=False, default=NodeStatus.offline)
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    gpus: Mapped[list["GPU"]] = relationship(back_populates="node", cascade="all, delete-orphan")
    jobs: Mapped[list["Job"]] = relationship(back_populates="node")
    assignments: Mapped[list["NodeAssignment"]] = relationship(back_populates="node")


class GPU(Base):
    __tablename__ = "gpus"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    vram_gb: Mapped[float] = mapped_column(Float, nullable=False)
    utilization_percent: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    node: Mapped["Node"] = relationship(back_populates="gpus")
    assignments: Mapped[list["NodeAssignment"]] = relationship(back_populates="gpu")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    node_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="SET NULL"), nullable=True)
    script_path: Mapped[str] = mapped_column(String(1024), nullable=False)
    status: Mapped[JobStatus] = mapped_column(SAEnum(JobStatus, name="job_status"), nullable=False, default=JobStatus.queued)
    gpu_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    min_vram_gb: Mapped[float | None] = mapped_column(Float, nullable=True)
    submitted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship(back_populates="jobs")
    node: Mapped["Node | None"] = relationship(back_populates="jobs")
    logs: Mapped[list["JobLog"]] = relationship(back_populates="job", cascade="all, delete-orphan")
    distributed_job: Mapped["DistributedJob | None"] = relationship(back_populates="job", uselist=False, cascade="all, delete-orphan")


class JobLog(Base):
    __tablename__ = "job_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    message: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    job: Mapped["Job"] = relationship(back_populates="logs")


class DistributedJob(Base):
    __tablename__ = "distributed_jobs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("jobs.id", ondelete="CASCADE"), unique=True, nullable=False)
    total_nodes: Mapped[int] = mapped_column(Integer, nullable=False)
    total_gpus: Mapped[int] = mapped_column(Integer, nullable=False)
    framework: Mapped[str] = mapped_column(String(100), nullable=False)
    throughput: Mapped[float | None] = mapped_column(Float, nullable=True)
    scaling_efficiency: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    job: Mapped["Job"] = relationship(back_populates="distributed_job")
    assignments: Mapped[list["NodeAssignment"]] = relationship(back_populates="distributed_job", cascade="all, delete-orphan")


class NodeAssignment(Base):
    __tablename__ = "node_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    distributed_job_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("distributed_jobs.id", ondelete="CASCADE"), nullable=False)
    node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    gpu_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("gpus.id", ondelete="SET NULL"), nullable=True)
    rank: Mapped[int] = mapped_column(Integer, nullable=False)

    distributed_job: Mapped["DistributedJob"] = relationship(back_populates="assignments")
    node: Mapped["Node"] = relationship(back_populates="assignments")
    gpu: Mapped["GPU | None"] = relationship(back_populates="assignments")
