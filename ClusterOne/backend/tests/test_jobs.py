from tests.test_nodes import register_sample_node


def test_submit_job_with_no_nodes_stays_queued(client):
    resp = client.post(
        "/api/v1/jobs",
        json={"name": "train-resnet", "requires_gpu": True, "min_vram_mb": 8000},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "QUEUED"
    assert body["node_id"] is None


def test_submit_job_schedules_onto_free_gpu_node(client):
    register_sample_node(client, hostname="gpu02")

    resp = client.post(
        "/api/v1/jobs",
        json={"name": "train-resnet", "requires_gpu": True, "min_vram_mb": 8000, "cpu_cores": 4, "ram_mb": 1024},
    )
    body = resp.json()
    assert body["status"] == "SCHEDULED"
    assert body["node_id"] is not None


def test_submit_job_insufficient_vram_stays_queued(client):
    register_sample_node(client, hostname="gpu03")

    resp = client.post(
        "/api/v1/jobs",
        json={"name": "huge-job", "requires_gpu": True, "min_vram_mb": 999999},
    )
    assert resp.json()["status"] == "QUEUED"


def test_heartbeat_retries_queued_jobs_onto_newly_available_node(client):
    # Job submitted before any node exists -> stays QUEUED.
    job = client.post("/api/v1/jobs", json={"name": "wait-for-node", "requires_gpu": True, "min_vram_mb": 4000}).json()
    assert job["status"] == "QUEUED"

    node = register_sample_node(client, hostname="gpu04").json()
    client.post(
        f"/api/v1/nodes/{node['id']}/heartbeat",
        json={"cpu_util_pct": 5, "ram_used_mb": 1024, "gpus": node["gpus"]},
    )

    refreshed = client.get(f"/api/v1/jobs/{job['id']}").json()
    assert refreshed["status"] == "SCHEDULED"
    assert refreshed["node_id"] == node["id"]


def test_cancel_job(client):
    job = client.post("/api/v1/jobs", json={"name": "cancel-me", "requires_gpu": False}).json()
    resp = client.delete(f"/api/v1/jobs/{job['id']}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "CANCELLED"


def test_cancel_unknown_job_404(client):
    resp = client.delete("/api/v1/jobs/does-not-exist")
    assert resp.status_code == 404


def test_job_without_gpu_requirement_schedules_on_any_node(client):
    register_sample_node(client, hostname="gpu05")
    resp = client.post("/api/v1/jobs", json={"name": "cpu-only", "requires_gpu": False, "cpu_cores": 2, "ram_mb": 512})
    assert resp.json()["status"] == "SCHEDULED"


def test_job_can_target_a_specific_node(client):
    node = client.post("/api/v1/nodes/register", json={
        "hostname": "pick-me", "cpu_cores": 4, "ram_total_mb": 8192, "gpus": []}).json()
    job = client.post("/api/v1/jobs", json={"name": "j", "requires_gpu": False, "node_id": node["id"]}).json()
    assert job["node_id"] == node["id"]
    assert job["status"] == "SCHEDULED"


def test_targeting_unknown_node_is_404(client):
    r = client.post("/api/v1/jobs", json={"name": "j", "node_id": "nope"})
    assert r.status_code == 404


def test_requeue_job(client):
    register_sample_node(client, hostname="gpu-rq")
    job = client.post("/api/v1/jobs", json={"name": "rq-job", "requires_gpu": False}).json()
    client.delete(f"/api/v1/jobs/{job['id']}")
    rq_resp = client.post(f"/api/v1/jobs/{job['id']}/requeue")
    assert rq_resp.status_code == 200
    assert rq_resp.json()["status"] in ("QUEUED", "SCHEDULED")

