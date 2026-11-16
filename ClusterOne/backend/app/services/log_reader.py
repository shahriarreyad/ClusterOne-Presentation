"""Bounded-memory reading of job logs.

Logs can be gigabytes. Nothing here reads a whole file: tail reads blocks
backwards from the end, page/search stream forwards line by line, and each line
is capped at settings.log_max_line_bytes.
"""
import io
import os
import re
from pathlib import Path
from typing import BinaryIO, Iterator, List, Optional, Tuple

from app.config import settings
from app.models import Job
from app.schemas import JobLogs, LogLine
from app.services import slurm_jobspec

_BLOCK = 64 * 1024
_TAIL_MAX_BYTES = 16 * 1024 * 1024  # never read more than this backwards
_COUNT_LINES_MAX_BYTES = 64 * 1024 * 1024  # absolute line numbers need a full newline count

_TS_RE = re.compile(r"^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:[+-]\d{4}|Z)?) (.*)$", re.DOTALL)


class LogUnavailable(Exception):
    """The job has no readable log (yet)."""


def dev_log_path(job_id: str) -> Path:
    return Path(settings.log_dir) / f"{job_id}.log"


def _safe_slurm_path(raw: str) -> Optional[Path]:
    """Resolve symlinks and refuse anything outside the shared-storage roots."""
    real = os.path.realpath(raw)
    roots = [os.path.realpath(r) for r in settings.path_roots]
    if any(real == r or real.startswith(r + os.sep) for r in roots):
        return Path(real)
    return None


def locate(job: Job) -> Tuple[str, Optional[Path]]:
    """('file', path) | ('database', None) | ('none', None)."""
    if settings.slurm_enabled and job.slurm_job_id:
        raw = job.log_path
        if not raw:
            raw = slurm_jobspec.output_pattern(job).replace("%j", job.slurm_job_id)
        path = _safe_slurm_path(raw)
        if path is not None and path.is_file():
            return "file", path
        return "none", None
    path = dev_log_path(job.id)
    if path.is_file():
        return "file", path
    if job.logs:
        return "database", None
    return "none", None


def _split(raw: bytes, timestamps: bool) -> Tuple[str, Optional[str]]:
    truncated = len(raw) > settings.log_max_line_bytes
    text = raw[: settings.log_max_line_bytes].decode("utf-8", errors="replace").rstrip("\r\n")
    ts = None
    m = _TS_RE.match(text)
    if m:
        ts, text = (m.group(1) if timestamps else None), m.group(2)
    if truncated:
        text += " …[line truncated]"
    return text, ts


def _iter_lines(fh: BinaryIO) -> Iterator[bytes]:
    """Lines of at most max_line_bytes+1 bytes; the rest of an over-long line is skipped."""
    cap = settings.log_max_line_bytes + 1
    while True:
        chunk = fh.readline(cap)
        if not chunk:
            return
        if len(chunk) == cap and not chunk.endswith(b"\n"):
            while True:  # drop the remainder of this line without holding it
                rest = fh.readline(_BLOCK)
                if not rest or rest.endswith(b"\n"):
                    break
        yield chunk


def _count_lines(fh: BinaryIO, size: int) -> Optional[int]:
    if size > _COUNT_LINES_MAX_BYTES:
        return None
    fh.seek(0)
    n = 0
    last = b""
    while True:
        block = fh.read(_BLOCK * 16)
        if not block:
            break
        n += block.count(b"\n")
        last = block
    if last and not last.endswith(b"\n"):
        n += 1
    return n


def _tail_lines(fh: BinaryIO, size: int, n: int) -> Tuple[List[bytes], bool]:
    """Last n lines (oldest first) and whether earlier content exists."""
    pos = size
    data = b""
    newlines = 0
    while pos > 0 and newlines <= n and size - pos < _TAIL_MAX_BYTES:
        step = min(_BLOCK, pos)
        pos -= step
        fh.seek(pos)
        block = fh.read(step)
        newlines += block.count(b"\n")
        data = block + data
    lines = data.split(b"\n")
    if lines and lines[-1] == b"":
        lines.pop()
    more_before = pos > 0 or len(lines) > n
    if pos > 0 and lines:
        lines = lines[1:]  # first piece is a partial line cut by the block boundary
    return lines[-n:] if n else [], more_before


def read_logs(
    fh: BinaryIO,
    size: int,
    job_id: str,
    source: str,
    *,
    tail: Optional[int] = None,
    offset: Optional[int] = None,
    limit: Optional[int] = None,
    search: Optional[str] = None,
    timestamps: bool = True,
) -> JobLogs:
    cap = settings.log_tail_max_lines

    if search:
        needle = search.casefold()
        start = max(0, offset or 0)
        want = min(limit or settings.log_search_max_results, settings.log_search_max_results)
        lines: List[LogLine] = []
        truncated = False
        next_offset = None
        fh.seek(0)
        for idx, raw in enumerate(_iter_lines(fh)):
            if idx < start:
                continue
            text, ts = _split(raw, timestamps)
            if needle in text.casefold() or (ts and needle in ts.casefold()):
                if len(lines) >= want:
                    truncated, next_offset = True, idx
                    break
                lines.append(LogLine(line=idx + 1, timestamp=ts, text=text))
        return JobLogs(job_id=job_id, source=source, size_bytes=size, mode="search", lines=lines,
                       next_offset=next_offset, truncated=truncated)

    if offset is not None:
        start = max(0, offset)
        want = min(limit or settings.log_tail_default_lines, cap)
        lines = []
        next_offset = None
        fh.seek(0)
        for idx, raw in enumerate(_iter_lines(fh)):
            if idx < start:
                continue
            if len(lines) >= want:
                next_offset = idx
                break
            text, ts = _split(raw, timestamps)
            lines.append(LogLine(line=idx + 1, timestamp=ts, text=text))
        return JobLogs(job_id=job_id, source=source, size_bytes=size, mode="page", lines=lines,
                       next_offset=next_offset, truncated=next_offset is not None)

    n = min(tail or settings.log_tail_default_lines, cap)
    raw_lines, more_before = _tail_lines(fh, size, n)
    total = _count_lines(fh, size)
    first = (total - len(raw_lines) + 1) if total is not None else None
    lines = []
    for i, raw in enumerate(raw_lines):
        text, ts = _split(raw, timestamps)
        lines.append(LogLine(line=(first + i) if first is not None else None, timestamp=ts, text=text))
    return JobLogs(job_id=job_id, source=source, size_bytes=size, mode="tail", lines=lines,
                   total_lines=total, truncated=more_before)


def get_job_logs(job: Job, **kwargs) -> JobLogs:
    source, path = locate(job)
    if source == "file" and path is not None:
        with open(path, "rb") as fh:
            size = os.fstat(fh.fileno()).st_size
            return read_logs(fh, size, job.id, "file", **kwargs)
    if source == "database":
        data = (job.logs or "").encode("utf-8")
        return read_logs(io.BytesIO(data), len(data), job.id, "database", **kwargs)
    return JobLogs(job_id=job.id, source="none", size_bytes=0, mode="tail", lines=[],
                   message="no log output yet" if not job.slurm_job_id or not settings.slurm_enabled
                   else "log file not found or not readable by the controller (is the output directory on shared storage?)")
