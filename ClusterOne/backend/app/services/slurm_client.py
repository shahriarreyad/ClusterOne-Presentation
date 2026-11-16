"""Thin client for slurmrestd, per ClusterOne_07_Database_API_Design.md section 4.1.

ClusterOne does not reimplement scheduling: when CLUSTERONE_SLURM_ENABLED=true,
job submission/query/cancellation is delegated to slurmrestd rather than the
dev-mode scheduler in node_registry.pick_node_for_job.

Authentication is slurmrestd's JWT scheme: the X-SLURM-USER-NAME and
X-SLURM-USER-TOKEN headers (token from CLUSTERONE_SLURM_JWT_TOKEN or the file in
CLUSTERONE_SLURM_JWT_TOKEN_FILE).
"""
from typing import Any, Dict, Optional

import httpx

from app.config import settings


class SlurmError(RuntimeError):
    """slurmrestd was unreachable, rejected the request, or reported errors."""

    def __init__(self, message: str, status_code: Optional[int] = None) -> None:
        super().__init__(message)
        self.status_code = status_code


class SlurmClient:
    def __init__(self, transport: Optional[httpx.BaseTransport] = None) -> None:
        # Tests inject httpx.MockTransport here; production leaves it None.
        self.transport = transport

    # -- plumbing ---------------------------------------------------------
    def _headers(self) -> Dict[str, str]:
        headers = {"X-SLURM-USER-NAME": settings.slurm_user}
        token = settings.slurm_token()
        if token:
            headers["X-SLURM-USER-TOKEN"] = token
        return headers

    def _request(self, method: str, path: str, *, db: bool = False, json: Any = None) -> Dict[str, Any]:
        api = "slurmdb" if db else "slurm"
        url = f"{settings.slurmrestd_url.rstrip('/')}/{api}/{settings.slurmrestd_version}{path}"
        try:
            with httpx.Client(timeout=settings.slurmrestd_timeout_seconds, transport=self.transport) as c:
                r = c.request(method, url, headers=self._headers(), json=json)
        except httpx.HTTPError as e:
            raise SlurmError(f"slurmrestd unreachable: {e}") from e
        if r.status_code >= 400:
            raise SlurmError(f"slurmrestd {method} {path} returned {r.status_code}: {r.text[:300]}", r.status_code)
        try:
            body = r.json() if r.content else {}
        except ValueError as e:
            raise SlurmError(f"slurmrestd returned non-JSON for {method} {path}") from e
        # slurmrestd can answer 200 with an "errors" list.
        errors = [e for e in body.get("errors", []) if e.get("error_number", e.get("errno", 1)) not in (0, None)]
        if errors:
            raise SlurmError("slurmrestd error: " + "; ".join(str(e.get("error") or e) for e in errors)[:300])
        return body

    # -- slurmctld --------------------------------------------------------
    def diag(self) -> Dict[str, Any]:
        return self._request("GET", "/diag")

    def list_jobs(self) -> Dict[str, Any]:
        return self._request("GET", "/jobs")

    def get_job(self, slurm_job_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/job/{slurm_job_id}")

    def submit_job(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        return self._request("POST", "/job/submit", json=payload)

    def cancel_job(self, slurm_job_id: str) -> None:
        self._request("DELETE", f"/job/{slurm_job_id}")

    def list_nodes(self) -> Dict[str, Any]:
        return self._request("GET", "/nodes")

    def list_partitions(self) -> Dict[str, Any]:
        return self._request("GET", "/partitions")

    # -- slurmdbd (finished jobs that slurmctld has already forgotten) ----
    def get_accounting_job(self, slurm_job_id: str) -> Dict[str, Any]:
        return self._request("GET", f"/job/{slurm_job_id}", db=True)


slurm_client = SlurmClient()
