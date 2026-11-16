"""Validation of user-supplied job fields.

Everything a user can type ends up either in a generated sbatch script or in an
`apptainer exec` argument list, so values are checked against strict patterns
here and additionally shell-quoted when the script is generated
(see app.services.slurm_jobspec). Both layers are intentional.
"""
import posixpath
import re
from typing import Dict, Iterable, Optional

from app.config import settings

NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
USER_RE = re.compile(r"^[A-Za-z0-9_.@-]{1,64}$")
# Deliberately excludes space, quotes, comma and colon: comma/colon are
# separators in `apptainer --bind src:dst:opts,...`.
PATH_RE = re.compile(r"^/[A-Za-z0-9._/@+=-]*$")
IMAGE_ALIAS_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")
REMOTE_IMAGE_RE = re.compile(r"^(docker|library|oras)://[A-Za-z0-9][A-Za-z0-9._/:@-]{0,254}$")
ENV_NAME_RE = re.compile(r"^[A-Za-z_][A-Za-z0-9_]{0,63}$")

MAX_COMMAND_CHARS = 16384
MAX_ENV_VARS = 64
MAX_ENV_VALUE_CHARS = 4096

# Names the user may not set: they would change how the host-side wrapper or
# the container runtime behaves, or impersonate cluster-provided values.
RESERVED_ENV_PREFIXES = ("SLURM_", "APPTAINER", "SINGULARITY", "CLUSTERONE_", "LD_", "BASH_FUNC_")
RESERVED_ENV_NAMES = frozenset({
    "PATH", "HOME", "USER", "LOGNAME", "SHELL", "IFS", "PS4", "ENV", "BASH_ENV",
    "PROMPT_COMMAND", "SHELLOPTS", "BASHOPTS", "CUDA_VISIBLE_DEVICES", "NVIDIA_VISIBLE_DEVICES",
})


def validate_name(value: str) -> str:
    if not NAME_RE.fullmatch(value):
        raise ValueError("name must be 1-64 characters: letters, digits, '.', '_' or '-', starting with a letter or digit")
    return value


def validate_user(value: str) -> str:
    if not USER_RE.fullmatch(value):
        raise ValueError("submitted_by contains invalid characters")
    return value


def validate_partition(value: str) -> str:
    if value not in settings.partitions:
        raise ValueError(f"unknown partition '{value}'; available: {', '.join(settings.partitions)}")
    return value


def _under(path: str, roots: Iterable[str]) -> bool:
    return any(path == r or path.startswith(r + "/") for r in roots)


def validate_path(value: str, field: str, roots: Optional[Iterable[str]] = None) -> str:
    """An absolute, normalised POSIX path inside the allowed shared-storage roots."""
    roots = list(roots if roots is not None else settings.path_roots)
    if len(value) > 4096 or not PATH_RE.fullmatch(value):
        raise ValueError(f"{field} must be an absolute path using only letters, digits and ._/@+=-")
    if ".." in value.split("/"):
        raise ValueError(f"{field} must not contain '..'")
    norm = posixpath.normpath(value)
    if norm.startswith("//"):
        norm = "/" + norm.lstrip("/")
    if not _under(norm, roots):
        raise ValueError(f"{field} must be under one of: {', '.join(roots)}")
    return norm


def validate_image(value: str) -> str:
    """Return the image reference to run: a .sif path under an allowed root.

    A bare alias such as 'pytorch' resolves to <first image root>/pytorch.sif.
    """
    roots = settings.image_root_list
    if REMOTE_IMAGE_RE.fullmatch(value):
        if not settings.allow_remote_images:
            raise ValueError("remote container images are disabled; use a .sif image from " + ", ".join(roots))
        return value
    if IMAGE_ALIAS_RE.fullmatch(value) and "/" not in value:
        value = f"{roots[0]}/{value}.sif" if not value.endswith(".sif") else f"{roots[0]}/{value}"
    path = validate_path(value, "image", roots)
    if not path.endswith(".sif"):
        raise ValueError("image must be an Apptainer .sif file")
    return path


def validate_env(env: Dict[str, str]) -> Dict[str, str]:
    if len(env) > MAX_ENV_VARS:
        raise ValueError(f"at most {MAX_ENV_VARS} environment variables are allowed")
    for key, val in env.items():
        if not ENV_NAME_RE.fullmatch(key):
            raise ValueError(f"invalid environment variable name: {key!r}")
        if key in RESERVED_ENV_NAMES or key.startswith(RESERVED_ENV_PREFIXES):
            raise ValueError(f"environment variable {key} is reserved")
        if not isinstance(val, str) or len(val) > MAX_ENV_VALUE_CHARS or "\x00" in val:
            raise ValueError(f"invalid value for environment variable {key}")
    return env


def validate_command(value: str) -> str:
    if not value.strip():
        raise ValueError("command must not be empty")
    if len(value) > MAX_COMMAND_CHARS or "\x00" in value:
        raise ValueError(f"command must be at most {MAX_COMMAND_CHARS} characters and contain no NUL bytes")
    return value
