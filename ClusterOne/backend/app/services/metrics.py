"""Node and job metrics.

Prometheus already stores the time series (dcgm-exporter for GPUs, node_exporter
for CPU/RAM/network), so with CLUSTERONE_PROMETHEUS_URL set this module only
runs a fixed set of read-only range queries for one node — no arbitrary PromQL
is accepted from clients. Without Prometheus the answer is the node agent's most
recent heartbeat (real readings, current values only, no history).
"""
import logging
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from app.config import settings
from app.models import TERMINAL_JOB_STATES, Job, Node
from app.schemas import GPUInfo, JobMetrics, MetricPoint, NodeMetrics
from app.utils import as_utc, utcnow

log = logging.getLogger(__name__)

_SAFE_LABEL_VALUE = re.compile(r"^[A-Za-z0-9._-]{1,255}$")
_DURATION_RE = re.compile(r"^(\d+)([smhd])$")
_UNIT_SECONDS = {"s": 1, "m": 60, "h": 3600, "d": 86400}
MAX_RANGE_SECONDS = 7 * 86400
MAX_POINTS = 1000


class PrometheusError(RuntimeError):
    pass


class PrometheusClient:
    def __init__(self, transport: Optional[httpx.BaseTransport] = None) -> None:
        self.transport = transport  # tests inject httpx.MockTransport

    def query_range(self, expr: str, start: float, end: float, step: float) -> List[dict]:
        url = f"{(settings.prometheus_url or '').rstrip('/')}/api/v1/query_range"
        try:
            with httpx.Client(timeout=settings.prometheus_timeout_seconds, transport=self.transport) as c:
                r = c.get(url, params={"query": expr, "start": start, "end": end, "step": step})
            r.raise_for_status()
            body = r.json()
        except (httpx.HTTPError, ValueError) as e:
            raise PrometheusError(f"Prometheus query failed: {e}") from e
        if body.get("status") != "success":
            raise PrometheusError(f"Prometheus error: {body.get('error', 'unknown')}")
        return body["data"]["result"]

    def healthy(self) -> bool:
        try:
            with httpx.Client(timeout=settings.prometheus_timeout_seconds, transport=self.transport) as c:
                return c.get(f"{(settings.prometheus_url or '').rstrip('/')}/-/healthy").status_code == 200
        except httpx.HTTPError:
            return False


prometheus = PrometheusClient()


def enabled() -> bool:
    return bool(settings.prometheus_url)


def parse_duration(text: str) -> int:
    m = _DURATION_RE.match(text.strip())
    if not m:
        raise ValueError("durations look like '30s', '15m', '6h' or '2d'")
    return int(m.group(1)) * _UNIT_SECONDS[m.group(2)]


def _matcher(node: Node) -> Optional[str]:
    """PromQL label matcher selecting this machine's exporters (host or IP, any port)."""
    names = [v for v in (node.hostname, (node.hostname or "").split(".")[0], node.ip_address) if v and _SAFE_LABEL_VALUE.match(v)]
    if not names:
        return None
    alt = "|".join(sorted({re.escape(n) for n in names}))
    return f'{settings.prometheus_node_label}=~"^({alt})(:[0-9]+)?$"'


_PHYSICAL_NICS = 'device!~"lo|veth.*|docker.*|br-.*"'

_NODE_QUERIES = {
    # name -> (PromQL template with {m}, per-GPU?)
    "cpu_util_pct": ('100 - (avg(rate(node_cpu_seconds_total{{mode="idle",{m}}}[1m])) * 100)', False),
    "ram_used_mb": ("(node_memory_MemTotal_bytes{{{m}}} - node_memory_MemAvailable_bytes{{{m}}}) / 1048576", False),
    "net_rx_mbps": ("sum(rate(node_network_receive_bytes_total{{{m}," + _PHYSICAL_NICS + "}}[1m])) * 8 / 1e6", False),
    "net_tx_mbps": ("sum(rate(node_network_transmit_bytes_total{{{m}," + _PHYSICAL_NICS + "}}[1m])) * 8 / 1e6", False),
    "gpu_util_pct": ("DCGM_FI_DEV_GPU_UTIL{{{m}}}", True),
    "gpu_mem_used_mb": ("DCGM_FI_DEV_FB_USED{{{m}}}", True),
    "gpu_temp_c": ("DCGM_FI_DEV_GPU_TEMP{{{m}}}", True),
}


def fetch_node_series(node: Node, start: float, end: float, step: float) -> Dict[str, List[MetricPoint]]:
    matcher = _matcher(node)
    if matcher is None:
        raise PrometheusError("node name cannot be used as a Prometheus label selector")
    out: Dict[str, List[MetricPoint]] = {}
    failures = 0
    for name, (template, per_gpu) in _NODE_QUERIES.items():
        try:
            result = prometheus.query_range(template.format(m=matcher), start, end, step)
        except PrometheusError as e:
            failures += 1
            log.warning("metric %s for %s failed: %s", name, node.hostname, e)
            continue
        for series in result:
            key = name
            if per_gpu:
                key = name.replace("gpu_", f"gpu{series['metric'].get('gpu', '0')}_", 1)
            out[key] = [MetricPoint(t=float(t), v=float(v)) for t, v in series["values"] if v not in ("NaN", "+Inf", "-Inf")]
    if failures == len(_NODE_QUERIES):
        raise PrometheusError("all Prometheus queries failed")
    return out


def _snapshot(node: Node, source: str = "heartbeat", message: Optional[str] = None) -> NodeMetrics:
    return NodeMetrics(
        node_id=node.id,
        hostname=node.hostname,
        source=source,
        generated_at=utcnow(),
        last_heartbeat=node.last_heartbeat,
        cpu_util_pct=node.cpu_util_pct or 0.0,
        ram_used_mb=node.ram_used_mb or 0,
        ram_total_mb=node.ram_total_mb or 0,
        net_rx_mbps=node.net_rx_mbps,
        net_tx_mbps=node.net_tx_mbps,
        gpus=[GPUInfo(**g) for g in (node.gpus or [])],
        message=message,
    )


def node_metrics(node: Node, range_seconds: int = 900, step_seconds: int = 15) -> NodeMetrics:
    """Latest readings, plus history from Prometheus when it is configured and answering."""
    snap = _snapshot(node)
    if not enabled():
        return snap
    end = datetime.now(timezone.utc).timestamp()
    start = end - min(range_seconds, MAX_RANGE_SECONDS)
    step = max(step_seconds, (end - start) / MAX_POINTS, 1)
    try:
        snap.series = fetch_node_series(node, start, end, step)
        snap.source = "prometheus"
    except PrometheusError as e:
        snap.message = f"Prometheus unavailable, showing last heartbeat only: {e}"
    return snap


def job_metrics(job: Job, node: Optional[Node]) -> JobMetrics:
    now = utcnow()
    runtime = None
    if job.started_at is not None:
        runtime = max(0.0, ((job.ended_at or now) - job.started_at).total_seconds())

    result = JobMetrics(
        job_id=job.id,
        status=job.status,
        runtime_seconds=runtime,
        started_at=job.started_at,
        ended_at=job.ended_at,
        requested={"gpus": job.gpus_wanted(), "cpus": job.cpu_cores, "ram_mb": job.ram_mb,
                   "time_limit_minutes": job.time_limit_minutes},
        allocated={"nodes": job.allocated_nodes, "gpus": job.allocated_gpus, "cpus": job.allocated_cpus,
                   "ram_mb": job.allocated_ram_mb},
    )
    if node is None:
        result.message = "job has not been placed on a node yet" if job.started_at is None else "node unknown to ClusterOne"
        return result

    if enabled() and job.started_at is not None:
        end = as_utc(job.ended_at or now).timestamp() if job.status in TERMINAL_JOB_STATES else as_utc(now).timestamp()
        start = as_utc(job.started_at).timestamp()
        step = max(15, (end - start) / MAX_POINTS)
        snap = _snapshot(node)
        try:
            snap.series = fetch_node_series(node, start, end, step)
            snap.source = "prometheus"
        except PrometheusError as e:
            snap.message = f"Prometheus unavailable: {e}"
        result.node = snap
    elif job.status not in TERMINAL_JOB_STATES:
        result.node = _snapshot(node)
    else:
        result.message = "job finished; per-job history needs Prometheus (CLUSTERONE_PROMETHEUS_URL)"
    return result
