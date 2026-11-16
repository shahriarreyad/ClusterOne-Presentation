from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import auth, validation
from app.database import get_db
from app.models import Node
from app.schemas import (
    JobClaim,
    NodeHeartbeatRequest,
    NodeMetrics,
    NodeRegisterRequest,
    NodeResponse,
)
from app.services import job_manager, metrics, node_registry

router = APIRouter(prefix="/nodes", tags=["nodes"])


def _get_node(db: Session, node_id: str) -> Node:
    node_registry.sweep_stale_nodes(db)
    node = db.query(Node).filter(Node.id == node_id).one_or_none()
    if node is None:
        raise HTTPException(status_code=404, detail="node not found")
    return node


@router.post("/register", response_model=NodeResponse, dependencies=[Depends(auth.agent_only)])
def register_node(req: NodeRegisterRequest, db: Session = Depends(get_db)):
    """Idempotent: re-registering a known hostname updates it and keeps its id."""
    node = node_registry.register_node(db, req)
    return node_registry.node_responses(db, [node])[0]


@router.post("/{node_id}/heartbeat", response_model=NodeResponse, dependencies=[Depends(auth.agent_only)])
def heartbeat(node_id: str, req: NodeHeartbeatRequest, db: Session = Depends(get_db)):
    node = node_registry.record_heartbeat(db, node_id, req)
    if node is None:
        raise HTTPException(status_code=404, detail="node not found")
    job_manager.retry_queued_jobs(db)
    return node_registry.node_responses(db, [node])[0]


@router.get("", response_model=List[NodeResponse], dependencies=[Depends(auth.current_user)])
def list_nodes(db: Session = Depends(get_db)):
    """All nodes with GPU inventory, utilisation, current jobs and heartbeat age."""
    node_registry.sweep_stale_nodes(db)
    return node_registry.node_responses(db, node_registry.sorted_nodes(db))


@router.get("/{node_id}", response_model=NodeResponse, dependencies=[Depends(auth.current_user)])
def get_node(node_id: str, db: Session = Depends(get_db)):
    node = _get_node(db, node_id)
    return node_registry.node_responses(db, [node])[0]


@router.get("/{node_id}/metrics", response_model=NodeMetrics, dependencies=[Depends(auth.current_user)])
def node_metrics(
    node_id: str,
    range: str = Query("15m", description="History window when Prometheus is configured, e.g. 15m, 6h, 2d"),
    step: str = Query("15s", description="Resolution of the history, e.g. 15s, 1m"),
    db: Session = Depends(get_db),
):
    """Latest CPU/RAM/network/GPU readings; with Prometheus configured also a time series."""
    node = _get_node(db, node_id)
    try:
        range_s, step_s = metrics.parse_duration(range), metrics.parse_duration(step)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    return metrics.node_metrics(node, range_s, step_s)


@router.get("/{node_id}/jobs/next", response_model=Optional[JobClaim], dependencies=[Depends(auth.agent_only)])
def claim_next_job(node_id: str, db: Session = Depends(get_db)):
    """Called by a dev-mode node agent: hands it the oldest job scheduled to it and marks it RUNNING."""
    job = job_manager.claim_next_job(db, node_id)
    if job is None:
        return None
    claim = JobClaim.model_validate(job)
    claim.env = dict(job.env_vars or {})
    return claim


@router.delete("/{node_id}")
def remove_node(node_id: str, db: Session = Depends(get_db), principal: auth.Principal = Depends(auth.current_user)):
    """Remove a node that is offline for good (its agent must be stopped). Admin only when Keycloak auth is on."""
    if principal.username is not None and not principal.is_admin:
        raise HTTPException(status_code=403, detail="only an administrator can remove nodes")
    try:
        hostname = node_registry.remove_node(db, node_id)
    except node_registry.ReservationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
    return {"removed": hostname}


class ClaimRequest(BaseModel):
    user: Optional[str] = None  # only used when Keycloak auth is off; with auth the token's username is used


def _claimant(req: Optional[ClaimRequest], principal: auth.Principal) -> str:
    user = principal.username or (req.user if req else None)
    if not user:
        raise HTTPException(status_code=422, detail="say who is reserving the node: {\"user\": \"<name>\"}")
    try:
        return validation.validate_user(user)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e


@router.post("/{node_id}/claim", response_model=NodeResponse)
def claim_node(
    node_id: str,
    req: Optional[ClaimRequest] = None,
    db: Session = Depends(get_db),
    principal: auth.Principal = Depends(auth.current_user),
):
    """Reserve the whole node: only your jobs are placed on it until you release it."""
    try:
        node = node_registry.claim_node(db, node_id, _claimant(req, principal))
    except node_registry.ReservationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
    return node_registry.node_responses(db, [node])[0]


@router.delete("/{node_id}/claim", response_model=NodeResponse)
def release_node(
    node_id: str,
    user: Optional[str] = Query(None, description="who is releasing (only when Keycloak auth is off)"),
    db: Session = Depends(get_db),
    principal: auth.Principal = Depends(auth.current_user),
):
    """Give the node back. Only the holder (or an admin) can release it."""
    who = principal.username or user
    try:
        node = node_registry.release_node(db, node_id, who, principal.is_admin and principal.username is not None)
    except node_registry.ReservationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.detail) from e
    return node_registry.node_responses(db, [node])[0]
