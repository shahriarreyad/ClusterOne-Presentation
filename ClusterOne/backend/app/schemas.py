from datetime import datetime
from typing import Annotated, Any, Dict, List, Optional, Union

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    computed_field,
    field_validator,
    model_validator,
)

from app import validation
from app.config import settings
from app.models import JobStatus, NodeStatus
from app.utils import as_utc, parse_ram_mb, parse_time_limit_minutes, utcnow


def _iso_utc(dt: datetime) -> str:
    return as_utc(dt).isoformat().replace("+00:00", "Z")


# Datetimes are stored naive-UTC; serialise them with an explicit "Z" so browsers
# do not read them as local time.
UTCDatetime = Annotated[datetime, PlainSerializer(_iso_utc, return_type=str, when_used="json")]


# --------------------------------------------------------------------------
# Nodes
# --------------------------------------------------------------------------
class GPUInfo(BaseModel):
    name: str
    vram_total_mb: int
    vram_used_mb: int = 0
    utilization_pct: float = 0.0
    index: Optional[int] = None
    uuid: Optional[str] = None
    temperature_c: Optional[float] = None
    power_w: Optional[float] = None
    driver_version: Optional[str] = None
    cuda_version: Optional[str] = None  # highest CUDA the driver supports (from nvidia-smi)


class NodeRegisterRequest(BaseModel):
    hostname: str = Field(min_length=1, max_length=255, pattern=r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
    ip_address: Optional[str] = None
    cpu_cores: int = Field(ge=0)
    ram_total_mb: int = Field(ge=0)
    gpus: List[GPUInfo] = []
    agent_version: Optional[str] = None
    os_info: Optional[str] = None
    # What the node measured about itself at start-up: python, torch / torch_cuda_available, ffmpeg_nvenc, docker, ...
    capabilities: Dict[str, Any] = {}


class NodeHeartbeatRequest(BaseModel):
    cpu_util_pct: float = Field(ge=0)
    ram_used_mb: int = Field(ge=0)
    gpus: List[GPUInfo] = []
    status: Optional[NodeStatus] = None
    net_rx_mbps: Optional[float] = Field(default=None, ge=0)
    net_tx_mbps: Optional[float] = Field(default=None, ge=0)


class NodeJobRef(BaseModel):
    id: str
    name: str
    status: JobStatus
    submitted_by: str
    gpu_count: int
    slurm_job_id: Optional[str] = None


class NodeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    hostname: str
    ip_address: Optional[str]
    cpu_cores: int
    ram_total_mb: int
    ram_used_mb: int
    cpu_util_pct: float
    gpus: List[GPUInfo]
    status: NodeStatus
    registered_at: UTCDatetime
    last_heartbeat: Optional[UTCDatetime]
    net_rx_mbps: Optional[float] = None
    net_tx_mbps: Optional[float] = None
    agent_version: Optional[str] = None
    os_info: Optional[str] = None
    slurm_state: Optional[str] = None
    reserved_by: Optional[str] = None  # whole-node reservation holder, if any
    reserved_at: Optional[UTCDatetime] = None
    capabilities: Optional[Dict[str, Any]] = None  # null until the agent has reported them
    # AVAILABLE (online, a GPU is free) | BUSY (online, every GPU in use or reserved)
    # | OFFLINE | ERROR (online but reports no GPU)
    availability: str = "OFFLINE"
    # Filled in by the API layer (not ORM attributes).
    gpu_count: int = 0
    gpus_free: int = 0
    heartbeat_age_seconds: Optional[float] = None
    current_jobs: List[NodeJobRef] = []


class MasterInfo(BaseModel):
    hostname: str
    ip_address: str
    role: str = "master"
    scheduler: str  # "slurm" or "dev"
    slurm_reachable: Optional[bool] = None


class ClusterTopology(BaseModel):
    generated_at: UTCDatetime
    master: MasterInfo
    nodes: List[NodeResponse]


class MetricPoint(BaseModel):
    t: float  # unix seconds
    v: float


class NodeMetrics(BaseModel):
    node_id: str
    hostname: str
    source: str  # "heartbeat" (last agent report) or "prometheus"
    generated_at: UTCDatetime
    last_heartbeat: Optional[UTCDatetime]
    cpu_util_pct: float
    ram_used_mb: int
    ram_total_mb: int
    net_rx_mbps: Optional[float] = None
    net_tx_mbps: Optional[float] = None
    gpus: List[GPUInfo]
    # Only with Prometheus: metric name -> [{t, v}] over the requested range.
    series: Optional[Dict[str, List[MetricPoint]]] = None
    message: Optional[str] = None


# --------------------------------------------------------------------------
# Jobs
# --------------------------------------------------------------------------
class JobCreateRequest(BaseModel):
    """Job submission.

    Legacy fields (requires_gpu, cpu_cores, ram_mb, script, environment) keep
    working; the newer spelling (gpu_count, cpu_count, ram, command, env, ...)
    is preferred. Normalised values land in gpu_count / cpu_cores / ram_mb /
    time_limit_minutes after validation.
    """

    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    name: str
    submitted_by: str = "anonymous"
    partition: Optional[str] = None

    gpu_count: Optional[int] = Field(default=None, ge=0)
    requires_gpu: Optional[bool] = None
    min_vram_mb: int = Field(default=0, ge=0)
    cpu_cores: Optional[int] = Field(default=None, ge=1, validation_alias=AliasChoices("cpu_cores", "cpu_count"))
    ram_mb: Optional[int] = Field(default=None, ge=1)
    ram: Optional[Union[str, int]] = None  # '32G' | '512M' | MB as a number
    time_limit: Optional[Union[str, int]] = None  # 'HH:MM:SS' | 'D-HH:MM:SS' | minutes

    image: Optional[str] = None  # .sif path under /opt/apptainer, or a bare alias like 'pytorch'
    working_dir: Optional[str] = None
    dataset_path: Optional[str] = None
    output_dir: Optional[str] = None
    command: Optional[str] = None
    script: Optional[str] = None  # legacy: Python source in dev mode, shell command in Slurm mode
    env: Optional[Dict[str, str]] = None
    environment: Optional[str] = None  # legacy free text
    node_id: Optional[str] = None  # run on this specific node instead of letting the scheduler pick

    time_limit_minutes: Optional[int] = Field(default=None, exclude=True)

    @field_validator("name")
    @classmethod
    def _name(cls, v: str) -> str:
        return validation.validate_name(v)

    @field_validator("submitted_by")
    @classmethod
    def _user(cls, v: str) -> str:
        return validation.validate_user(v)

    @field_validator("partition")
    @classmethod
    def _partition(cls, v: Optional[str]) -> Optional[str]:
        return validation.validate_partition(v) if v else v

    @field_validator("image")
    @classmethod
    def _image(cls, v: Optional[str]) -> Optional[str]:
        return validation.validate_image(v) if v else v

    @field_validator("working_dir")
    @classmethod
    def _wd(cls, v: Optional[str]) -> Optional[str]:
        return validation.validate_path(v, "working_dir") if v else v

    @field_validator("dataset_path")
    @classmethod
    def _ds(cls, v: Optional[str]) -> Optional[str]:
        return validation.validate_path(v, "dataset_path") if v else v

    @field_validator("output_dir")
    @classmethod
    def _out(cls, v: Optional[str]) -> Optional[str]:
        return validation.validate_path(v, "output_dir") if v else v

    @field_validator("command", "script")
    @classmethod
    def _cmd(cls, v: Optional[str]) -> Optional[str]:
        return validation.validate_command(v) if v is not None else v

    @field_validator("env")
    @classmethod
    def _env(cls, v: Optional[Dict[str, str]]) -> Optional[Dict[str, str]]:
        return validation.validate_env(v) if v else v

    @model_validator(mode="after")
    def _resolve_resources(self) -> "JobCreateRequest":
        # GPUs: gpu_count wins; legacy requires_gpu means exactly one GPU.
        if self.gpu_count is None:
            self.gpu_count = 0 if self.requires_gpu is False else 1
        elif self.requires_gpu and self.gpu_count == 0:
            raise ValueError("requires_gpu is true but gpu_count is 0")
        elif self.requires_gpu is False and self.gpu_count > 0:
            raise ValueError("requires_gpu is false but gpu_count > 0")
        self.requires_gpu = self.gpu_count > 0
        if self.gpu_count > settings.max_gpus_per_job:
            raise ValueError(f"gpu_count must be at most {settings.max_gpus_per_job}")

        if self.cpu_cores is None:
            self.cpu_cores = 1
        if self.cpu_cores > settings.max_cpus_per_job:
            raise ValueError(f"cpu_count must be at most {settings.max_cpus_per_job}")

        if self.ram is not None:
            self.ram_mb = parse_ram_mb(self.ram)
        elif self.ram_mb is None:
            self.ram_mb = 1024
        if self.ram_mb > settings.max_ram_gb_per_job * 1024:
            raise ValueError(f"ram must be at most {settings.max_ram_gb_per_job}G")

        self.time_limit_minutes = parse_time_limit_minutes(
            self.time_limit if self.time_limit is not None else settings.default_time_limit
        )
        if self.time_limit_minutes > settings.max_time_limit_minutes:
            raise ValueError(f"time_limit must be at most {settings.max_time_limit_minutes} minutes")
        return self

    @property
    def run_command(self) -> Optional[str]:
        return self.command or self.script


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    submitted_by: str
    requires_gpu: bool
    min_vram_mb: int
    cpu_cores: int
    ram_mb: int
    script: Optional[str]
    environment: Optional[str]
    status: JobStatus
    node_id: Optional[str]
    slurm_job_id: Optional[str]
    logs: Optional[str] = None
    created_at: UTCDatetime
    updated_at: UTCDatetime

    gpu_count: Optional[int] = None
    partition: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    image: Optional[str] = None
    working_dir: Optional[str] = None
    dataset_path: Optional[str] = None
    output_dir: Optional[str] = None
    command: Optional[str] = None
    started_at: Optional[UTCDatetime] = None
    ended_at: Optional[UTCDatetime] = None
    exit_code: Optional[int] = None
    allocated_nodes: Optional[str] = None
    allocated_cpus: Optional[int] = None
    allocated_ram_mb: Optional[int] = None
    allocated_gpus: Optional[int] = None
    slurm_state: Optional[str] = None
    state_reason: Optional[str] = None
    # Filled by app.services.job_status: where it runs, and what its state means in plain words.
    node_hostname: Optional[str] = None
    node_ip: Optional[str] = None
    requested_node_id: Optional[str] = None  # the node the user chose, if any
    status_message: Optional[str] = None
    # Values may be secrets, so only the names are exposed (agents get JobClaim.env).
    env_vars: Optional[Dict[str, str]] = Field(default=None, exclude=True)

    @model_validator(mode="after")
    def _effective_gpu_count(self) -> "JobResponse":
        if self.gpu_count is None:
            self.gpu_count = 1 if self.requires_gpu else 0
        return self

    @computed_field  # type: ignore[prop-decorator]
    @property
    def env_keys(self) -> List[str]:
        return sorted(self.env_vars or {})

    @computed_field  # type: ignore[prop-decorator]
    @property
    def runtime_seconds(self) -> Optional[float]:
        if self.started_at is None:
            return None
        end = self.ended_at or utcnow()
        return max(0.0, (end - self.started_at).total_seconds())


class JobClaim(JobResponse):
    """What a node agent receives when it claims a job (includes env values)."""

    env: Dict[str, str] = {}


class JobReport(BaseModel):
    status: Optional[JobStatus] = None
    log_append: Optional[str] = None
    exit_code: Optional[int] = None


class LogLine(BaseModel):
    line: Optional[int] = None  # 1-based line number; null for tails of very large files
    timestamp: Optional[str] = None
    text: str


class JobLogs(BaseModel):
    job_id: str
    source: str  # "file" | "database" | "none"
    size_bytes: int
    mode: str  # "tail" | "page" | "search"
    lines: List[LogLine]
    next_offset: Optional[int] = None  # pass as ?offset= to continue paging
    total_lines: Optional[int] = None  # only known when the whole file was scanned
    truncated: bool = False
    message: Optional[str] = None


class JobMetrics(BaseModel):
    job_id: str
    status: JobStatus
    runtime_seconds: Optional[float]
    started_at: Optional[UTCDatetime]
    ended_at: Optional[UTCDatetime]
    requested: Dict[str, Any]
    allocated: Dict[str, Any]
    # GPU/CPU readings are for the whole node the job ran on (jobs on one node
    # share it); they are not per-process numbers.
    node: Optional[NodeMetrics] = None
    message: Optional[str] = None


# --------------------------------------------------------------------------
# Cluster
# --------------------------------------------------------------------------
class ClusterSummary(BaseModel):
    nodes_total: int
    nodes_online: int
    nodes_down: int
    gpus_total: int
    gpus_allocated: int
    gpus_idle: int
    jobs_running: int
    jobs_pending: int
    # Additive fields.
    gpus_unavailable: int = 0
    jobs_completed: int = 0
    jobs_failed: int = 0
    mode: str = "dev"  # "slurm" | "dev"
    generated_at: Optional[UTCDatetime] = None


# --------------------------------------------------------------------------
# Activity, Storage, Partitions, Users, Telemetry
# --------------------------------------------------------------------------
class ActivityEvent(BaseModel):
    id: str
    timestamp: UTCDatetime
    event_type: str
    message: str
    tone: str  # "info" | "success" | "warning" | "error"
    target_id: Optional[str] = None
    target_type: Optional[str] = None  # "job" | "node"


class StorageShare(BaseModel):
    name: str
    path: str
    type: str  # "NFS" | "Node-local"
    # null when the path is not mounted on the machine running this service
    total_gb: Optional[float] = None
    used_gb: Optional[float] = None
    free_gb: Optional[float] = None
    usage_pct: Optional[float] = None
    status: str  # "HEALTHY" | "WARNING" | "CRITICAL" | "UNAVAILABLE"


class StorageSummary(BaseModel):
    total_gb: Optional[float] = None
    used_gb: Optional[float] = None
    free_gb: Optional[float] = None
    usage_pct: Optional[float] = None
    shares: List[StorageShare]


class PartitionSummary(BaseModel):
    name: str
    description: str
    allocation_mode: str
    default_time_limit: str
    max_time_limit: str
    max_gpus_per_job: int
    nodes_count: Optional[int] = None  # only known from Slurm
    active_jobs: int
    pending_jobs: int = 0


class ClusterUser(BaseModel):
    username: str
    name: str
    role: str
    total_jobs: int
    active_jobs: int
    gpu_hours: float
    last_active: Optional[UTCDatetime] = None


class TelemetryRequest(BaseModel):
    """Payload of the Linux telemetry agent (gpu_node_agent.py). Every field is optional;
    only what is present is stored."""

    model_config = ConfigDict(extra="ignore")

    hostname: Optional[str] = None
    ip: Optional[str] = None
    os: Optional[str] = None
    agentVersion: Optional[str] = None
    cpu: Optional[Dict[str, Any]] = None  # {cores, utilization (%)}
    ram: Optional[Dict[str, Any]] = None  # {totalGb, usedGb}
    network: Optional[Dict[str, Any]] = None  # {rxKbps, txKbps}
    # {index, uuid, name, vramTotalMb, vramUsedMb, utilizationGpu, temperatureC, powerDrawWatts}
    gpus: Optional[List[Dict[str, Any]]] = None
