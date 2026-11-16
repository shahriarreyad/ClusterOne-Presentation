import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.api import cluster, jobs, nodes
from app.config import settings
from app.database import SessionLocal, init_db
from app.services import job_manager, node_registry, slurm_sync

log = logging.getLogger("clusterone")

API_PREFIX = "/api/v1"


def background_tick() -> None:
    """One pass of housekeeping: expire silent nodes, place queued work, mirror Slurm."""
    db = SessionLocal()
    try:
        node_registry.sweep_stale_nodes(db)
        if settings.slurm_enabled:
            slurm_sync.sync_jobs(db)
            slurm_sync.sync_nodes(db)
        else:
            job_manager.retry_queued_jobs(db)
    except Exception:  # noqa: BLE001 - the loop must survive any single failure
        log.exception("background tick failed")
    finally:
        db.close()


async def _background_loop(interval: float) -> None:
    while True:
        await asyncio.to_thread(background_tick)
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(_: FastAPI):
    logging.basicConfig(level=settings.log_level.upper(), format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    init_db()
    task = None
    if settings.background_interval_seconds > 0:
        task = asyncio.create_task(_background_loop(settings.background_interval_seconds))
    try:
        yield
    finally:
        if task:
            task.cancel()


app = FastAPI(
    title="ClusterOne Core Cluster Engine",
    description="Node registration, resource tracking, and job scheduling integration.",
    version=__version__,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Canonical, documented routes live under /api/v1. The same routes are also served
# at the root (/nodes, /jobs, /cluster/summary, /health) without appearing in the schema.
for router in (nodes.router, jobs.router, cluster.router):
    app.include_router(router, prefix=API_PREFIX)
    app.include_router(router, include_in_schema=False)
app.include_router(cluster.telemetry_router, prefix=API_PREFIX)
app.include_router(cluster.health_router, prefix=API_PREFIX)
app.include_router(cluster.health_router, include_in_schema=False)


@app.get("/")
def root():
    return {"service": "clusterone-core", "status": "running", "version": __version__, "docs": "/docs"}
