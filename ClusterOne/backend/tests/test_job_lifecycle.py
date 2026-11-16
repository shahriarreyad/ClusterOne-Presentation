"""Job validation, listing, cancellation, state transitions and the dev-mode scheduler."""
import pytest

from tests.test_node_lifecycle import age_heartbeat
from tests.test_nodes import register_sample_node


def submit(client, **kw):
    body = {"name": "job1", "gpu_count": 0}
    body.update(kw)
    return client.post("/api/v1/jobs", json=body)


def test_full_job_spec_is_stored_and_echoed(client):
    r = submit(client, partition="gpu", cpu_count=8, ram="32G", time_limit="04:00:00",
               image="pytorch", working_dir="/projects/alice/exp1", dataset_path="/datasets/imagenet",
               output_dir="/projects/alice/out", command="python train.py --epochs 3",
               env={"BATCH": "64"})
    assert r.status_code == 200, r.text
    j = r.json()
    assert j["cpu_cores"] == 8 and j["ram_mb"] == 32768 and j["time_limit_minutes"] == 240
    assert j["image"] == "/opt/apptainer/pytorch.sif"
    assert j["partition"] == "gpu" and j["command"] == "python train.py --epochs 3"
    assert j["env_keys"] == ["BATCH"] and "env" not in j and "env_vars" not in j


@pytest.mark.parametrize("field,value", [
    ("name", "bad name; rm -rf /"), ("name", ""), ("partition", "nonexistent"), ("gpu_count", -1),
    ("gpu_count", 99), ("cpu_count", 0), ("cpu_count", 10_000), ("ram", "lots"), ("ram", "99999G"),
    ("time_limit", "soon"), ("time_limit", "999-00:00:00"), ("working_dir", "relative/path"),
    ("working_dir", "/etc"), ("working_dir", "/projects/../etc"), ("dataset_path", "/projects/x;y"),
    ("output_dir", "/root"), ("image", "/tmp/evil.sif"), ("image", "docker://ubuntu"),
    ("command", ""), ("env", {"1BAD": "x"}), ("env", {"LD_PRELOAD": "/x.so"}), ("env", {"PATH": "/x"}),
    ("env", {"SLURM_JOB_ID": "1"}),
])
def test_invalid_fields_are_rejected(client, field, value):
    assert submit(client, **{field: value}).status_code == 422


def test_gpu_flags_must_agree(client):
    assert submit(client, requires_gpu=False, gpu_count=2).status_code == 422
    assert submit(client, requires_gpu=True, gpu_count=0).status_code == 422


def test_legacy_fields_still_accepted(client):
    j = client.post("/api/v1/jobs", json={"name": "legacy", "requires_gpu": True, "cpu_cores": 2, "ram_mb": 2048,
                                          "script": "print(1)", "environment": "whatever"}).json()
    assert j["gpu_count"] == 1 and j["cpu_cores"] == 2 and j["ram_mb"] == 2048 and j["script"] == "print(1)"


def test_list_jobs_filters_and_pagination(client):
    for i in range(3):
        submit(client, name=f"j{i}", submitted_by="alice" if i < 2 else "bob")
    assert len(client.get("/api/v1/jobs").json()) == 3
    assert len(client.get("/api/v1/jobs?user=alice").json()) == 2
    assert len(client.get("/api/v1/jobs?limit=1&offset=1").json()) == 1
    assert len(client.get("/api/v1/jobs?status=QUEUED").json()) == 3  # no nodes registered yet
    assert client.get("/api/v1/jobs?status=RUNNING").json() == []
    assert all(j["logs"] is None for j in client.get("/api/v1/jobs").json())


def test_cancel_via_post_and_delete_are_equivalent_and_idempotent(client):
    a = submit(client, name="a").json()
    b = submit(client, name="b").json()
    ra = client.post(f"/api/v1/jobs/{a['id']}/cancel")
    rb = client.delete(f"/api/v1/jobs/{b['id']}")
    assert ra.json()["status"] == rb.json()["status"] == "CANCELLED"
    assert ra.json()["ended_at"] is not None
    assert client.post(f"/api/v1/jobs/{a['id']}/cancel").json()["status"] == "CANCELLED"
    assert client.post("/api/v1/jobs/nope/cancel").status_code == 404


def test_job_state_machine_via_agent_calls(client):
    node = register_sample_node(client).json()
    job = submit(client).json()
    assert job["status"] == "SCHEDULED"
    claimed = client.get(f"/api/v1/nodes/{node['id']}/jobs/next").json()
    assert claimed["id"] == job["id"] and claimed["status"] == "RUNNING" and claimed["started_at"]
    assert client.get(f"/api/v1/nodes/{node['id']}/jobs/next").json() is None

    done = client.post(f"/api/v1/jobs/{job['id']}/report",
                       json={"log_append": "hello\n", "status": "COMPLETED", "exit_code": 0}).json()
    assert done["status"] == "COMPLETED" and done["exit_code"] == 0 and done["ended_at"]
    assert done["runtime_seconds"] is not None


def test_claim_hands_agent_the_env_values(client):
    node = register_sample_node(client).json()
    submit(client, env={"SEED": "7"}, command="echo hi")
    claimed = client.get(f"/api/v1/nodes/{node['id']}/jobs/next").json()
    assert claimed["env"] == {"SEED": "7"} and claimed["command"] == "echo hi"


def test_terminal_jobs_cannot_be_revived_and_cancel_wins(client):
    node = register_sample_node(client).json()
    job = submit(client).json()
    client.get(f"/api/v1/nodes/{node['id']}/jobs/next")
    client.delete(f"/api/v1/jobs/{job['id']}")
    r = client.post(f"/api/v1/jobs/{job['id']}/report", json={"status": "COMPLETED"})
    assert r.json()["status"] == "CANCELLED"


def test_illegal_transition_is_409(client):
    job = submit(client).json()  # QUEUED (no nodes)
    r = client.post(f"/api/v1/jobs/{job['id']}/report", json={"status": "COMPLETED"})
    assert r.status_code == 409


def test_transition_function_rules():
    from app.models import Job, JobStatus
    from app.services.job_manager import InvalidTransition, transition

    j = Job(id="x", name="n", status=JobStatus.QUEUED)
    transition(j, JobStatus.SCHEDULED)
    transition(j, JobStatus.RUNNING)
    assert j.started_at is not None
    transition(j, JobStatus.FAILED)
    assert j.ended_at is not None
    with pytest.raises(InvalidTransition):
        transition(j, JobStatus.RUNNING)


def test_dev_scheduler_does_not_oversubscribe_gpus(client):
    register_sample_node(client)  # one GPU
    first = submit(client, name="a", gpu_count=1).json()
    second = submit(client, name="b", gpu_count=1).json()
    assert first["status"] == "SCHEDULED"
    assert second["status"] == "QUEUED"


def test_dev_scheduler_multi_gpu_needs_enough_gpus(client):
    two = client.post("/api/v1/nodes/register", json={
        "hostname": "two", "cpu_cores": 8, "ram_total_mb": 16384,
        "gpus": [{"name": "g", "vram_total_mb": 8000}] * 2}).json()
    register_sample_node(client, hostname="one")
    j = submit(client, gpu_count=2).json()
    assert j["status"] == "SCHEDULED" and j["node_id"] == two["id"]
    assert submit(client, name="x", gpu_count=3).json()["status"] == "QUEUED"  # nothing can host 3


def test_dev_scheduler_respects_cpu_and_ram(client):
    register_sample_node(client)  # 16 cores, 32 GiB
    assert submit(client, name="big", cpu_count=17).json()["status"] == "QUEUED"
    assert submit(client, name="fat", ram="33G").json()["status"] == "QUEUED"
    assert submit(client, name="ok", cpu_count=16, ram="32G").json()["status"] == "SCHEDULED"


def test_queued_jobs_are_placed_in_submission_order_when_capacity_appears(client):
    a = submit(client, name="first", gpu_count=1).json()
    b = submit(client, name="second", gpu_count=1).json()
    node = register_sample_node(client).json()
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat",
                json={"cpu_util_pct": 0, "ram_used_mb": 0, "gpus": node["gpus"]})
    assert client.get(f"/api/v1/jobs/{a['id']}").json()["status"] == "SCHEDULED"
    assert client.get(f"/api/v1/jobs/{b['id']}").json()["status"] == "QUEUED"


def test_pinning_to_down_node_is_rejected(client):
    node = register_sample_node(client).json()
    age_heartbeat(client, node["id"], 3600)
    r = submit(client, node_id=node["id"])
    assert r.status_code == 409 and "cannot accept jobs" in r.json()["detail"] and "Firewall" in r.json()["detail"]


def test_job_metrics_without_prometheus(client):
    node = register_sample_node(client).json()
    job = submit(client, gpu_count=1).json()
    client.get(f"/api/v1/nodes/{node['id']}/jobs/next")
    m = client.get(f"/api/v1/jobs/{job['id']}/metrics").json()
    assert m["status"] == "RUNNING" and m["requested"]["gpus"] == 1
    assert m["runtime_seconds"] is not None and m["node"]["source"] == "heartbeat"
    assert client.get("/api/v1/jobs/nope/metrics").status_code == 404
