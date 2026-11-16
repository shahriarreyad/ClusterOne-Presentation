from pathlib import Path
from typing import List, Optional

from pydantic import AliasChoices, Field, SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


def _split(value: str) -> List[str]:
    return [p.strip() for p in value.split(",") if p.strip()]


class Settings(BaseSettings):
    """All settings come from CLUSTERONE_* environment variables (or a .env file).

    See .env.example for the documented list.
    """

    model_config = SettingsConfigDict(env_prefix="CLUSTERONE_", env_file=".env", extra="ignore")

    # --- Scheduler mode ---------------------------------------------------
    # If false, the built-in dev scheduler assigns nodes directly (used
    # before a real Slurm cluster is deployed). If true, Slurm is the source
    # of truth and job operations are delegated to slurmrestd.
    slurm_enabled: bool = False
    slurmrestd_url: str = Field(
        "http://localhost:6820",
        validation_alias=AliasChoices("CLUSTERONE_SLURMRESTD_URL", "SLURMRESTD_URL"),
    )
    slurmrestd_version: str = "v0.0.40"
    slurmrestd_timeout_seconds: float = 10.0
    # slurmrestd JWT auth: X-SLURM-USER-NAME + X-SLURM-USER-TOKEN.
    slurm_user: str = "clusterone"
    slurm_jwt_token: Optional[SecretStr] = None
    # Re-read on every request so a rotated token is picked up without restart.
    slurm_jwt_token_file: Optional[str] = None
    slurm_default_partition: str = "gpu"
    slurm_partitions: str = "gpu,interactive,teaching"
    # Minimum seconds between Slurm syncs triggered by API reads.
    slurm_sync_ttl_seconds: float = 5.0
    # Background Slurm sync / stale-node sweep period. 0 disables the loop.
    background_interval_seconds: float = 15.0

    # --- Storage ----------------------------------------------------------
    database_url: str = Field(
        "sqlite:///./clusterone.db",
        validation_alias=AliasChoices("CLUSTERONE_DATABASE_URL", "DATABASE_URL"),
    )

    # --- Nodes ------------------------------------------------------------
    # Node is marked DOWN if no heartbeat is received within this window.
    heartbeat_timeout_seconds: int = 30
    master_hostname: str = "c1-anchor"
    master_ip: str = "10.20.0.10"
    # Optional shared secret node agents must send as X-Agent-Token.
    agent_token: Optional[SecretStr] = None

    # --- Job limits and execution model ----------------------------------
    # Dev scheduler only: a GPU busier than this (percent) is treated as in use by someone else (for example
    # the owner of the PC) and is not offered to new jobs. Raise it on a desktop GPU that also draws the display.
    gpu_idle_threshold_pct: float = 10.0
    max_gpus_per_job: int = 8
    max_cpus_per_job: int = 128
    max_ram_gb_per_job: int = 1024
    max_time_limit_minutes: int = 7 * 24 * 60
    default_time_limit: str = "01:00:00"
    default_image: str = "/opt/apptainer/pytorch.sif"
    # Container images must live under one of these (comma separated).
    image_roots: str = "/opt/apptainer"
    # Allow docker:// / library:// image references (pulled at run time).
    allow_remote_images: bool = False
    # Working/dataset/output paths must live under one of these roots.
    # Defaults match the NFS/ZFS layout in ClusterOne_04 (home, projects, datasets, scratch).
    nfs_home_root: str = "/home"
    nfs_projects_root: str = "/projects"
    nfs_datasets_root: str = "/datasets"
    scratch_root: str = "/scratch"
    # Reject paths that do not exist on the controller (only useful if it mounts the NFS shares).
    validate_paths_exist: bool = False

    # --- Logs -------------------------------------------------------------
    # Dev-mode job logs (reported by node agents) are written here.
    log_dir: str = "./job-logs"
    # How much of the log tail is mirrored into the jobs.logs DB column.
    log_db_tail_bytes: int = 32768
    log_tail_default_lines: int = 200
    log_tail_max_lines: int = 5000
    log_max_line_bytes: int = 8192
    log_search_max_results: int = 1000
    # Application logging.
    log_level: str = "INFO"

    # --- Prometheus -------------------------------------------------------
    prometheus_url: Optional[str] = None
    prometheus_timeout_seconds: float = 5.0
    # Label on node_exporter/dcgm series that identifies the machine.
    prometheus_node_label: str = "instance"

    # --- Auth (Keycloak / OIDC) ------------------------------------------
    # Shared key for user-facing endpoints when Keycloak is not used. Empty = no check (isolated dev only).
    api_key: Optional[SecretStr] = None
    auth_enabled: bool = False
    oidc_issuer_url: Optional[str] = None  # e.g. https://sso.example/realms/clusterone
    oidc_jwks_url: Optional[str] = None  # default: <issuer>/protocol/openid-connect/certs
    oidc_audience: Optional[str] = None
    oidc_username_claim: str = "preferred_username"
    oidc_groups_claim: str = "groups"
    oidc_admin_group: str = "clusterone-admins"

    # --- HTTP -------------------------------------------------------------
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Derived helpers -------------------------------------------------------
    @property
    def partitions(self) -> List[str]:
        return _split(self.slurm_partitions)

    @property
    def path_roots(self) -> List[str]:
        roots = (self.nfs_home_root, self.nfs_projects_root, self.nfs_datasets_root, self.scratch_root)
        return [r.rstrip("/") for r in roots if r and r.rstrip("/")]

    @property
    def image_root_list(self) -> List[str]:
        return [r.rstrip("/") for r in _split(self.image_roots) if r.rstrip("/")]

    @property
    def cors_origin_list(self) -> List[str]:
        return _split(self.cors_origins)

    def slurm_token(self) -> Optional[str]:
        if self.slurm_jwt_token_file:
            try:
                return Path(self.slurm_jwt_token_file).read_text(encoding="utf8").strip() or None
            except OSError:
                return None
        return self.slurm_jwt_token.get_secret_value() if self.slurm_jwt_token else None


settings = Settings()
