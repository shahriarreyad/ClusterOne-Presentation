"""Small shared helpers: UTC time, and parsing of user-supplied resource strings."""
import math
import re
from datetime import datetime, timezone


def utcnow() -> datetime:
    """Naive UTC now — SQLite has no timezone-aware type, and mixing naive and
    aware datetimes in comparisons raises TypeError."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def as_utc(dt: datetime) -> datetime:
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


_RAM_RE = re.compile(r"^\s*(\d+(?:\.\d+)?)\s*([KMGT]?)(?:i?B)?\s*$", re.IGNORECASE)
_RAM_FACTORS_MB = {"": 1.0, "K": 1 / 1024, "M": 1.0, "G": 1024.0, "T": 1024.0 * 1024}


def parse_ram_mb(value) -> int:
    """'32G' / '32GB' / '512M' / 32768 (bare number = MB) -> megabytes."""
    if isinstance(value, bool):
        raise ValueError("ram must be a size like '32G' or a number of MB")
    if isinstance(value, (int, float)):
        mb = float(value)
    else:
        m = _RAM_RE.match(str(value))
        if not m:
            raise ValueError("ram must be a size like '32G', '512M' or a number of MB")
        mb = float(m.group(1)) * _RAM_FACTORS_MB[m.group(2).upper()]
    if mb < 1:
        raise ValueError("ram must be at least 1 MB")
    return math.ceil(mb)


_TIME_RE = re.compile(r"^(?:(\d+)-)?(\d{1,3}):(\d{2})(?::(\d{2}))?$")


def parse_time_limit_minutes(value) -> int:
    """'04:00:00', '1-12:00:00' (D-HH:MM:SS), 'HH:MM' or minutes (int/'90') -> minutes (rounded up)."""
    if isinstance(value, bool):
        raise ValueError("invalid time limit")
    if isinstance(value, (int, float)):
        minutes = math.ceil(value)
    else:
        text = str(value).strip()
        if text.isdigit():
            minutes = int(text)
        else:
            m = _TIME_RE.match(text)
            if not m:
                raise ValueError("time_limit must look like 'HH:MM:SS', 'D-HH:MM:SS' or a number of minutes")
            days, hours, mins, secs = (int(g) if g else 0 for g in m.groups())
            if mins > 59 or secs > 59:
                raise ValueError("invalid minutes/seconds in time_limit")
            minutes = math.ceil((days * 86400 + hours * 3600 + mins * 60 + secs) / 60)
    if minutes < 1:
        raise ValueError("time_limit must be at least 1 minute")
    return minutes


def format_slurm_time(minutes: int) -> str:
    """Minutes -> 'D-HH:MM:SS' for #SBATCH --time."""
    days, rem = divmod(minutes, 1440)
    hours, mins = divmod(rem, 60)
    return f"{days}-{hours:02d}:{mins:02d}:00"
