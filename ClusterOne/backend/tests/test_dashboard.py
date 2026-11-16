"""Dashboard-support endpoints: activity, storage, partitions, users, telemetry ingestion, retry."""
from pydantic import SecretStr

from app.config import settings
from tests.test_node_lifecycle import age_heartbeat
from tests.test_nodes import register_sample_node


def finish(client, node_id, job_id, status="COMPLETED", code=0):
    client.get(f"/api/v1/nodes/{node_id}/jobs/next")
    return client.post(f"/api/v1/jobs/{job_id}/report", json={"status": status, "exit_code": code}).json()


# -- retry ----------------------------------------------------------------
def test_retry_creates_a_new_job_with_the_same_spec(client):
    node = register_sample_node(client).json()
    spec = {"name": "train", "gpu_count": 0, "cpu_count": 2, "ram": "2G", "command": "echo hi", "env": {"A": "1"},
            "image": "pytorch", "submitted_by": "alice"}
    old = client.post("/api/v1/jobs", json=spec).json()
    finish(client, node["id"], old["id"], "FAILED", 1)

    for path in ("retry", "requeue"):
        new = client.post(f"/api/v1/jobs/{old['id']}/{path}").json()
        assert new["id"] != old["id"] and new["status"] == "SCHEDULED"
        assert (new["name"], new["cpu_cores"], new["ram_mb"], new["command"]) == ("train", 2, 2048, "echo hi")
        assert new["env_keys"] == ["A"] and new["submitted_by"] == "alice"
        client.delete(f"/api/v1/jobs/{new['id']}")
    assert client.get(f"/api/v1/jobs/{old['id']}").json()["status"] == "FAILED"  # original untouched


def test_retry_of_unfinished_job_is_refused(client):
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 0}).json()
    assert client.post(f"/api/v1/jobs/{job['id']}/retry").status_code == 409
    assert client.post("/api/v1/jobs/nope/retry").status_code == 404


# -- activity ---------------------------------------------------------------
def test_activity_lists_job_and_node_events_newest_first(client):
    node = register_sample_node(client).json()
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 0}).json()
    finish(client, node["id"], job["id"])
    events = client.get("/api/v1/cluster/activity").json()
    kinds = [e["event_type"] for e in events]
    assert {"job_submitted", "job_started", "job_completed", "node_heartbeat"} <= set(kinds)
    stamps = [e["timestamp"] for e in events]
    assert stamps == sorted(stamps, reverse=True)
    assert len(client.get("/api/v1/cluster/activity?limit=2").json()) == 2
    assert client.get("/api/v1/cluster/activity?limit=0").status_code == 422


def test_activity_empty_cluster(client):
    assert client.get("/api/v1/cluster/activity").json() == []


# -- storage: measured or unavailable, never invented ------------------------
def test_storage_reports_real_mounts_and_marks_missing_ones_unavailable(client, monkeypatch, tmp_path):
    monkeypatch.setattr(settings, "nfs_home_root", str(tmp_path))
    monkeypatch.setattr(settings, "nfs_projects_root", str(tmp_path / "not-mounted"))
    body = client.get("/api/v1/cluster/storage").json()
    shares = {s["name"]: s for s in body["shares"]}
    home = shares["Home Directories"]
    assert home["status"] in ("HEALTHY", "WARNING", "CRITICAL") and home["total_gb"] > 0
    assert 0 <= home["usage_pct"] <= 100
    missing = shares["Project Workspaces"]
    assert missing["status"] == "UNAVAILABLE"
    assert missing["total_gb"] is None and missing["used_gb"] is None and missing["usage_pct"] is None


def test_storage_with_nothing_mounted_has_null_totals(client, monkeypatch, tmp_path):
    for field in ("nfs_home_root", "nfs_projects_root", "nfs_datasets_root", "scratch_root"):
        monkeypatch.setattr(settings, field, str(tmp_path / "nope" / field))
    body = client.get("/api/v1/cluster/storage").json()
    assert body["total_gb"] is None and all(s["status"] == "UNAVAILABLE" for s in body["shares"])


# -- partitions -------------------------------------------------------------
def test_partitions_come_from_configuration_with_job_counts(client):
    node = register_sample_node(client).json()
    client.post("/api/v1/jobs", json={"name": "a", "gpu_count": 0, "partition": "teaching"})
    client.post("/api/v1/jobs", json={"name": "b", "gpu_count": 0, "partition": "teaching", "cpu_count": 99})
    parts = {p["name"]: p for p in client.get("/api/v1/cluster/partitions").json()}
    assert set(parts) == {"gpu", "interactive", "teaching"}
    assert parts["teaching"]["active_jobs"] == 1 and parts["teaching"]["pending_jobs"] == 1
    assert parts["gpu"]["max_gpus_per_job"] == settings.max_gpus_per_job
    assert parts["gpu"]["nodes_count"] is None  # unknown in dev mode, not guessed
    assert node["id"]


# -- users ------------------------------------------------------------------
def test_users_are_derived_from_jobs_only(client):
    assert client.get("/api/v1/cluster/users").json() == []  # no invented placeholder user
    node = register_sample_node(client).json()
    a = client.post("/api/v1/jobs", json={"name": "a", "gpu_count": 1, "submitted_by": "alice"}).json()
    client.post("/api/v1/jobs", json={"name": "b", "gpu_count": 0, "submitted_by": "alice"})
    client.post("/api/v1/jobs", json={"name": "c", "gpu_count": 0, "submitted_by": "bob"})
    finish(client, node["id"], a["id"])
    users = {u["username"]: u for u in client.get("/api/v1/cluster/users").json()}
    assert users["alice"]["total_jobs"] == 2 and users["bob"]["total_jobs"] == 1
    assert users["alice"]["gpu_hours"] >= 0 and users["alice"]["role"] == "user"
    assert list(users)[0] == "alice"  # most jobs first


# -- telemetry ingestion ----------------------------------------------------
LINUX_AGENT_PAYLOAD = {
    "nodeId": "node-gpu03", "hostname": "gpu03", "ip": "10.20.0.23", "os": "Ubuntu 24.04", "agentVersion": "2.4.0",
    "cpu": {"cores": 32, "utilization": 41.5, "temperatureC": 45},
    "ram": {"totalGb": 128.0, "usedGb": 32.5},
    "network": {"rxKbps": 2500.0, "txKbps": 500.0},
    "gpus": [
        {"index": 0, "uuid": "GPU-1", "name": "RTX 3060", "vramTotalMb": 12288, "vramUsedMb": 4096,
         "utilizationGpu": 77, "temperatureC": 64, "powerDrawWatts": 120.5},
        {"index": 1, "name": "no size reported"},
    ],
}


def test_telemetry_registers_and_updates_a_node_from_the_real_payload(client):
    r = client.post("/api/v1/telemetry", json=LINUX_AGENT_PAYLOAD)
    assert r.status_code == 200, r.text
    node = client.get(f"/api/v1/nodes/{r.json()['node_id']}").json()
    assert node["hostname"] == "gpu03" and node["cpu_cores"] == 32 and node["ip_address"] == "10.20.0.23"
    assert node["ram_total_mb"] == 131072 and node["ram_used_mb"] == 33280 and node["cpu_util_pct"] == 41.5
    assert node["net_rx_mbps"] == 2.5 and node["agent_version"] == "2.4.0"
    assert len(node["gpus"]) == 1  # the entry without a VRAM size is skipped, not guessed
    gpu = node["gpus"][0]
    assert (gpu["vram_total_mb"], gpu["vram_used_mb"], gpu["utilization_pct"], gpu["temperature_c"]) == (12288, 4096, 77, 64)
    assert gpu["power_w"] == 120.5 and node["status"] == "ONLINE"

    again = client.post("/api/v1/cluster/telemetry", json={"hostname": "gpu03", "cpu": {"utilization": 5}})
    assert again.json()["node_id"] == r.json()["node_id"]
    refreshed = client.get(f"/api/v1/nodes/{r.json()['node_id']}").json()
    assert refreshed["cpu_util_pct"] == 5 and refreshed["cpu_cores"] == 32 and len(refreshed["gpus"]) == 1  # absent = unchanged


def test_telemetry_does_not_invent_missing_specs(client):
    r = client.post("/api/v1/telemetry", json={"hostname": "bare"})
    node = client.get(f"/api/v1/nodes/{r.json()['node_id']}").json()
    assert node["cpu_cores"] == 0 and node["ram_total_mb"] == 0 and node["gpus"] == []


def test_telemetry_rejects_missing_or_hostile_hostname(client):
    assert client.post("/api/v1/telemetry", json={}).status_code == 422
    assert client.post("/api/v1/telemetry", json={"hostname": "x; drop table"}).status_code == 422


def test_telemetry_requires_the_agent_secret_in_either_header_style(client, monkeypatch):
    monkeypatch.setattr(settings, "agent_token", SecretStr("s3cret"))
    body = {"hostname": "gpu03"}
    assert client.post("/api/v1/telemetry", json=body).status_code == 401
    assert client.post("/api/v1/telemetry", json=body, headers={"Authorization": "Bearer nope"}).status_code == 401
    assert client.post("/api/v1/telemetry", json=body, headers={"Authorization": "Bearer s3cret"}).status_code == 200
    assert client.post("/api/v1/telemetry", json=body, headers={"X-Agent-Token": "s3cret"}).status_code == 200


def test_telemetry_node_then_goes_stale_like_any_other(client):
    node_id = client.post("/api/v1/telemetry", json={"hostname": "gpu03"}).json()["node_id"]
    age_heartbeat(client, node_id, 3600)
    assert client.get(f"/api/v1/nodes/{node_id}").json()["status"] == "DOWN"
