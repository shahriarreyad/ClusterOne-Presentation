"""Remote execution workflow: where a job runs, why it is waiting/failed, and the operational scripts."""
import importlib.util
import shlex
import socket
import subprocess
import sys
from pathlib import Path

import pytest

from app.models import Job, JobStatus, Node, NodeStatus
from app.services import job_status, slurm_jobspec
from tests.test_node_lifecycle import age_heartbeat

SCRIPTS = Path(__file__).resolve().parents[1] / "scripts"


def load_script(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


def register_remote(client, hostname="gpu-node-01", ip="10.20.0.21", gpus=1):
    return client.post("/api/v1/nodes/register", json={
        "hostname": hostname, "ip_address": ip, "cpu_cores": 16, "ram_total_mb": 65536,
        "gpus": [{"name": "NVIDIA RTX 4090", "vram_total_mb": 24576, "index": i} for i in range(gpus)]}).json()


# -- the whole flow, as the browser + node agent drive it ------------------------------------
def test_job_runs_on_the_remote_node_and_the_client_sees_everything(client):
    node = register_remote(client)
    job = client.post("/api/v1/jobs", json={
        "name": "satellite-unet", "gpu_count": 1, "cpu_count": 8, "ram": "32G", "time_limit": "04:00:00",
        "command": "python train.py --epochs 50 --batch-size 16"}).json()
    assert job["status"] == "SCHEDULED"
    assert (job["node_hostname"], job["node_ip"]) == ("gpu-node-01", "10.20.0.21")  # executing-on, not the client

    claimed = client.get(f"/api/v1/nodes/{node['id']}/jobs/next").json()  # the remote agent picks it up
    assert claimed["id"] == job["id"] and claimed["status"] == "RUNNING"

    # The remote GPU reports load; the client reads it from ClusterOne.
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat", json={
        "cpu_util_pct": 62.0, "ram_used_mb": 46000,
        "gpus": [{"name": "NVIDIA RTX 4090", "vram_total_mb": 24576, "vram_used_mb": 18636, "utilization_pct": 87,
                  "temperature_c": 71, "power_w": 312.5}]})
    client.post(f"/api/v1/jobs/{job['id']}/report", json={"log_append": "[clusterone] executing on gpu-node-01\nEpoch 1/50\n"})

    metrics = client.get(f"/api/v1/jobs/{job['id']}/metrics").json()
    assert metrics["allocated"] is not None and metrics["requested"]["gpus"] == 1
    assert metrics["node"]["gpus"][0]["utilization_pct"] == 87 and metrics["node"]["gpus"][0]["temperature_c"] == 71
    assert metrics["node"]["cpu_util_pct"] == 62.0 and metrics["runtime_seconds"] is not None

    topo = {n["hostname"]: n for n in client.get("/api/v1/cluster/topology").json()["nodes"]}
    assert [j["name"] for j in topo["gpu-node-01"]["current_jobs"]] == ["satellite-unet"]
    assert topo["gpu-node-01"]["gpus_free"] == 0  # whole GPU is reserved for the job

    logs = client.get(f"/api/v1/jobs/{job['id']}/logs").json()
    assert [line["text"] for line in logs["lines"]][0] == "[clusterone] executing on gpu-node-01"

    done = client.post(f"/api/v1/jobs/{job['id']}/report", json={"status": "COMPLETED", "exit_code": 0}).json()
    assert done["status"] == "COMPLETED"
    assert client.get(f"/api/v1/nodes/{node['id']}").json()["gpus_free"] == 0  # reservation gone, but the GPU still reads 87% busy
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat", json={
        "cpu_util_pct": 3.0, "ram_used_mb": 4000,
        "gpus": [{"name": "NVIDIA RTX 4090", "vram_total_mb": 24576, "vram_used_mb": 300, "utilization_pct": 1}]})
    assert client.get(f"/api/v1/nodes/{node['id']}").json()["gpus_free"] == 1  # next heartbeat shows it idle -> free again


def test_two_jobs_never_share_one_gpu(client):
    register_remote(client, gpus=1)
    first = client.post("/api/v1/jobs", json={"name": "a", "gpu_count": 1, "command": "x"}).json()
    second = client.post("/api/v1/jobs", json={"name": "b", "gpu_count": 1, "command": "x"}).json()
    assert first["status"] == "SCHEDULED" and second["status"] == "QUEUED"
    assert "gpu-node-01" in second["status_message"] and "only 0 of 1 requested GPU(s) free" in second["status_message"]


def test_multi_gpu_request_lands_on_a_node_with_enough_gpus(client):
    register_remote(client, "small", "10.20.0.21", gpus=1)
    big = register_remote(client, "big", "10.20.0.22", gpus=2)
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 2, "command": "x"}).json()
    assert job["node_id"] == big["id"] and job["node_ip"] == "10.20.0.22"


# -- plain-language status ------------------------------------------------------------------
def test_queued_message_when_no_node_has_connected(client):
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1}).json()
    assert job["status"] == "QUEUED" and "No compute node has connected" in job["status_message"]


def test_queued_message_when_every_node_is_offline(client):
    node = register_remote(client)
    age_heartbeat(client, node["id"], 3600)
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1}).json()
    assert "offline" in job["status_message"] and "gpu-node-01" in job["status_message"]
    assert "remains queued" in job["status_message"]


def test_queued_message_when_request_exceeds_every_node(client):
    register_remote(client, gpus=1)
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 4}).json()
    assert "Requests 4 GPU" in job["status_message"] and "largest online node has 1" in job["status_message"]


def test_job_requeued_after_node_loss_explains_itself(client):
    node = register_remote(client)
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1}).json()
    age_heartbeat(client, node["id"], 3600)
    after = client.get(f"/api/v1/jobs/{job['id']}")
    client.get("/api/v1/nodes")  # sweep
    after = client.get(f"/api/v1/jobs/{job['id']}").json()
    assert after["status"] == "QUEUED" and "offline" in after["status_message"]


def test_running_job_on_silent_node_is_flagged(client):
    node = register_remote(client)
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1}).json()
    client.get(f"/api/v1/nodes/{node['id']}/jobs/next")
    with client.session_factory() as db:  # node silent but not yet swept
        db.get(Node, node["id"]).status = NodeStatus.DOWN
        db.commit()
    msg = client.get(f"/api/v1/jobs/{job['id']}").json()["status_message"]
    assert "stopped sending heartbeats" in msg


def make_failed(client, node_id, log_text, exit_code=1):
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1}).json()
    client.get(f"/api/v1/nodes/{node_id}/jobs/next")
    client.post(f"/api/v1/jobs/{job['id']}/report", json={"log_append": log_text})
    client.post(f"/api/v1/jobs/{job['id']}/report", json={"status": "FAILED", "exit_code": exit_code})
    return client.get(f"/api/v1/jobs/{job['id']}").json()


@pytest.mark.parametrize("log,exit_code,expected", [
    ("RuntimeError: CUDA out of memory. Tried to allocate 2.00 GiB\n", 1, "GPU ran out of memory"),
    ("RuntimeError: Found no NVIDIA driver on your system.\n", 1, "CUDA is not working"),
    ("ModuleNotFoundError: No module named 'timm'\n", 1, "'timm' is not installed"),
    ("apptainer is not installed on this node\n", 127, "container could not be started"),
    ("MemoryError\n", 1, "ran out of system RAM"),
    ("something odd\n", 137, "exit code 137"),
    ("something odd\n", 2, "Exited with code 2"),
])
def test_failure_reasons_are_explained(client, log, exit_code, expected):
    node = register_remote(client)
    msg = make_failed(client, node["id"], log, exit_code)["status_message"]
    assert expected.lower() in msg.lower()


def test_list_does_not_scan_logs_but_detail_does(client):
    node = register_remote(client)
    job = make_failed(client, node["id"], "CUDA out of memory\n")
    assert "GPU ran out of memory" in job["status_message"]
    listed = client.get("/api/v1/jobs").json()[0]
    assert "Exited with code" in listed["status_message"]  # cheap fallback, no file reads for every row


def test_slurm_reasons_are_translated():
    job = Job(id="j", name="n", submitted_by="a", status=JobStatus.QUEUED, slurm_job_id="9", gpu_count=1, cpu_cores=1, ram_mb=1024)
    for reason, text in [("Resources", "Waiting for the requested"), ("Priority", "higher priority"),
                         ("ReqNodeNotAvail", "unavailable"), ("SomethingNew", "SomethingNew")]:
        job.state_reason = reason
        assert text in job_status.explain(job, [], None)


@pytest.mark.parametrize("state,expected", [("TIMEOUT", "time limit"), ("OUT_OF_MEMORY", "Ran out of RAM"),
                                            ("NODE_FAIL", "node failed")])
def test_slurm_failure_states_are_translated(state, expected):
    job = Job(id="j", name="n", submitted_by="a", status=JobStatus.FAILED, slurm_job_id="9", slurm_state=state,
              time_limit_minutes=240, ram_mb=32768, gpu_count=1, cpu_cores=1)
    assert expected.lower() in job_status.explain(job, [], None, scan_logs=False).lower()


# -- the script that runs on the compute node proves where it ran ---------------------------------
def test_slurm_script_records_the_executing_host_and_gpus():
    gpu = Job(id="j", name="n", submitted_by="a", gpu_count=2, requires_gpu=1, cpu_cores=8, ram_mb=32768,
              time_limit_minutes=240, command="python train.py")
    script = slurm_jobspec.build_script(gpu)
    assert "executing on $(hostname)" in script and "CUDA_VISIBLE_DEVICES" in script and "nvidia-smi -L" in script
    assert "#SBATCH --gres=gpu:2" in script
    cpu = Job(id="j", name="n", submitted_by="a", gpu_count=0, requires_gpu=0, cpu_cores=1, ram_mb=512,
              time_limit_minutes=5, command="echo")
    assert "nvidia-smi" not in slurm_jobspec.build_script(cpu)


# -- operational scripts ---------------------------------------------------------------------------
def test_network_check_reports_open_and_closed_ports():
    net = load_script("check_cluster_network")
    server = socket.socket()
    server.bind(("127.0.0.1", 0))
    server.listen(1)
    port = server.getsockname()[1]
    try:
        assert net.check_tcp("127.0.0.1", port)[0] is True
    finally:
        server.close()
    ok, detail = net.check_tcp("127.0.0.1", port, timeout=1)
    assert ok is False and ("refused" in detail or "timed out" in detail or detail)


def test_network_check_flags_unreachable_master_and_node(capsys):
    net = load_script("check_cluster_network")
    blocked = lambda host, port, timeout=3.0: (False, "timed out (firewall drop or no route)")  # noqa: E731
    up = lambda host, timeout_s=2: (True, "replied")  # noqa: E731
    dns = lambda name: (True, "10.20.0.21")  # noqa: E731
    rep = net.run_checks("10.20.0.10", ["10.20.0.21"], skip=["nfs"], api_port=8000, tcp=blocked, icmp=up, dns=dns)
    out = capsys.readouterr().out
    assert rep.failed
    assert "master: slurmctld 10.20.0.10:6817" in out and "node: slurmd 10.20.0.21:6818" in out
    assert "VLAN" in out  # the hint explains it is not just an addressing problem
    assert any(r[0] == "SKIP" for r in rep.rows)


def test_network_check_passes_when_everything_answers():
    net = load_script("check_cluster_network")
    rep = net.run_checks("10.20.0.10", ["10.20.0.21"], skip=[], api_port=8000,
                         tcp=lambda h, p, timeout=3.0: (True, "connected"), icmp=lambda h, timeout_s=2: (True, "replied"),
                         dns=lambda n: (True, "x"))
    assert not rep.failed


def test_network_check_cli_exit_codes(monkeypatch):
    net = load_script("check_cluster_network")
    monkeypatch.setattr(net, "check_tcp", lambda host, port, timeout=3.0: (False, "refused"))
    monkeypatch.setattr(net, "ping", lambda host, timeout_s=2: (True, "replied"))
    assert net.main(["--master", "10.20.0.10", "--node", "10.20.0.21"]) == 1


def test_smoke_test_command_is_one_self_contained_python_program():
    smoke = load_script("remote_gpu_smoke_test")
    command = smoke.build_command(0)
    for posix in (True, False):  # Linux agent / Slurm bash -c and the Windows agent split it differently
        argv = shlex.split(command, posix=posix)
        assert argv[0] == "python" and argv[1] == "-c" and len(argv) == 3
    argv = shlex.split(command, posix=True)
    argv[0] = sys.executable
    out = subprocess.run(argv, capture_output=True, text=True, check=False, timeout=60)
    assert out.returncode == 0, out.stderr
    assert f"host {socket.gethostname()}" in out.stdout  # prints where it really ran
    assert "nvidia-smi" in out.stdout or "GPU" in out.stdout or "unavailable" in out.stdout or "torch" in out.stdout


def test_gpu_idle_threshold_is_configurable(client, monkeypatch):
    """A GPU that also draws the owner's desktop can read 30% busy; the cutoff for 'in use' is a setting."""
    from app.config import settings

    node = register_remote(client)
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat", json={
        "cpu_util_pct": 5, "ram_used_mb": 100,
        "gpus": [{"name": "RTX", "vram_total_mb": 4096, "vram_used_mb": 600, "utilization_pct": 29}]})
    assert client.post("/api/v1/jobs", json={"name": "a", "gpu_count": 1, "command": "x"}).json()["status"] == "QUEUED"
    monkeypatch.setattr(settings, "gpu_idle_threshold_pct", 50.0)
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat", json={
        "cpu_util_pct": 5, "ram_used_mb": 100,
        "gpus": [{"name": "RTX", "vram_total_mb": 4096, "vram_used_mb": 600, "utilization_pct": 29}]})  # retries the queue
    assert client.get("/api/v1/jobs").json()[0]["status"] == "SCHEDULED"


def test_queue_message_names_the_actual_shortfall(client):
    node = register_remote(client)
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat", json={
        "cpu_util_pct": 5, "ram_used_mb": 63000,  # only ~2 GB of 64 GB left
        "gpus": [{"name": "RTX", "vram_total_mb": 24576, "vram_used_mb": 0, "utilization_pct": 0}]})
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1, "ram": "8G", "command": "x"}).json()
    assert job["status"] == "QUEUED"
    assert "gpu-node-01" in job["status_message"] and "GB RAM free (needs 8 GB)" in job["status_message"]


# -- choosing the node ---------------------------------------------------------------------------
def test_job_runs_on_the_chosen_node_not_the_best_fit(client):
    small = register_remote(client, "small", "10.20.0.21", gpus=1)
    register_remote(client, "big", "10.20.0.22", gpus=2)  # best-fit would prefer this one for 1 GPU
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1, "command": "x", "node_id": small["id"]}).json()
    assert job["status"] == "SCHEDULED" and job["node_id"] == small["id"] and job["node_hostname"] == "small"
    assert job["requested_node_id"] == small["id"]


def test_chosen_node_is_never_over_committed(client):
    node = register_remote(client, gpus=1)
    other = register_remote(client, "other", "10.20.0.22", gpus=1)
    first = client.post("/api/v1/jobs", json={"name": "a", "gpu_count": 1, "command": "x", "node_id": node["id"]}).json()
    second = client.post("/api/v1/jobs", json={"name": "b", "gpu_count": 1, "command": "x", "node_id": node["id"]}).json()
    assert first["status"] == "SCHEDULED"
    # The GPU on the chosen node is taken, so it waits there even though `other` is free.
    assert second["status"] == "QUEUED" and second["node_id"] is None and second["requested_node_id"] == node["id"]
    assert "the node you chose" in second["status_message"] and "gpu-node-01" in second["status_message"]
    assert client.get(f"/api/v1/nodes/{other['id']}").json()["current_jobs"] == []


def test_waiting_pinned_job_starts_on_its_node_when_resources_free_up(client):
    node = register_remote(client, gpus=1)
    register_remote(client, "other", "10.20.0.22", gpus=1)
    first = client.post("/api/v1/jobs", json={"name": "a", "gpu_count": 1, "command": "x", "node_id": node["id"]}).json()
    second = client.post("/api/v1/jobs", json={"name": "b", "gpu_count": 1, "command": "x", "node_id": node["id"]}).json()
    client.get(f"/api/v1/nodes/{node['id']}/jobs/next")
    client.post(f"/api/v1/jobs/{first['id']}/report", json={"status": "COMPLETED", "exit_code": 0})
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat", json={
        "cpu_util_pct": 1, "ram_used_mb": 100,
        "gpus": [{"name": "NVIDIA RTX 4090", "vram_total_mb": 24576, "vram_used_mb": 0, "utilization_pct": 0}]})
    after = client.get(f"/api/v1/jobs/{second['id']}").json()
    assert after["status"] == "SCHEDULED" and after["node_id"] == node["id"]  # never went to `other`


def test_pinned_job_survives_its_node_dying_and_keeps_waiting_for_it(client):
    node = register_remote(client, gpus=1)
    job = client.post("/api/v1/jobs", json={"name": "a", "gpu_count": 1, "command": "x", "node_id": node["id"]}).json()
    age_heartbeat(client, node["id"], 3600)
    client.get("/api/v1/nodes")
    after = client.get(f"/api/v1/jobs/{job['id']}").json()
    assert after["status"] == "QUEUED" and after["requested_node_id"] == node["id"]
    assert "offline" in after["status_message"] and "gpu-node-01" in after["status_message"]


def test_slurm_job_is_pinned_with_nodelist():
    from app.models import Job

    job = Job(id="j", name="n", submitted_by="a", gpu_count=1, requires_gpu=1, cpu_cores=2, ram_mb=1024,
              time_limit_minutes=10, command="x")
    sub = slurm_jobspec.build_submission(job, node_name="gpu02")
    assert sub["job"]["required_nodes"] == ["gpu02"] and "#SBATCH --nodelist=gpu02" in sub["script"]
    free = slurm_jobspec.build_submission(job)
    assert "required_nodes" not in free["job"] and "--nodelist" not in free["script"]


def test_vram_requirement_is_named_when_it_is_the_blocker(client):
    node = client.post("/api/v1/nodes/register", json={
        "hostname": "small", "ip_address": "10.20.0.30", "cpu_cores": 8, "ram_total_mb": 16384,
        "gpus": [{"name": "RTX 2050", "vram_total_mb": 4096}]}).json()
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1, "command": "x", "min_vram_mb": 8192,
                                            "node_id": node["id"]}).json()
    assert job["status"] == "QUEUED"
    assert "8 GB free VRAM" in job["status_message"] and "4 GB in total" in job["status_message"]


# -- reserving a whole node -----------------------------------------------------------------------
def claim(client, node_id, user="alice"):
    return client.post(f"/api/v1/nodes/{node_id}/claim", json={"user": user})


def submit_as(client, user, **kw):
    body = {"name": "j", "gpu_count": 0, "command": "x", "submitted_by": user}
    body.update(kw)
    return client.post("/api/v1/jobs", json=body)


def test_reserving_a_node_shows_the_holder(client):
    node = register_remote(client)
    r = claim(client, node["id"])
    assert r.status_code == 200 and r.json()["reserved_by"] == "alice" and r.json()["reserved_at"].endswith("Z")
    assert client.get(f"/api/v1/nodes/{node['id']}").json()["reserved_by"] == "alice"


def test_only_the_holder_gets_jobs_on_a_reserved_node(client):
    node = register_remote(client)
    claim(client, node["id"], "alice")
    bob = submit_as(client, "bob").json()
    assert bob["status"] == "QUEUED" and bob["node_id"] is None  # the only node is alice's
    alice = submit_as(client, "alice").json()
    assert alice["status"] == "SCHEDULED" and alice["node_id"] == node["id"]


def test_choosing_someone_elses_reserved_node_is_refused(client):
    node = register_remote(client)
    claim(client, node["id"], "alice")
    r = submit_as(client, "bob", node_id=node["id"])
    assert r.status_code == 409 and "reserved by alice" in r.json()["detail"]


def test_unreserved_nodes_stay_available_to_everyone_else(client):
    mine = register_remote(client, "mine", "10.20.0.21")
    free = register_remote(client, "free", "10.20.0.22")
    claim(client, mine["id"], "alice")
    job = submit_as(client, "bob").json()
    assert job["node_id"] == free["id"]


def test_cannot_reserve_a_node_held_by_someone_else_or_busy_with_their_jobs(client):
    node = register_remote(client)
    assert claim(client, node["id"], "alice").status_code == 200
    r = claim(client, node["id"], "bob")
    assert r.status_code == 409 and "already reserved by alice" in r.json()["detail"]
    assert claim(client, node["id"], "alice").status_code == 200  # idempotent for the holder

    other = register_remote(client, "busy", "10.20.0.23")
    submit_as(client, "carol", node_id=other["id"])
    r = claim(client, other["id"], "alice")
    assert r.status_code == 409 and "carol" in r.json()["detail"]


def test_release_frees_the_node_and_waiting_jobs_move_in(client):
    node = register_remote(client)
    claim(client, node["id"], "alice")
    bob = submit_as(client, "bob").json()
    assert bob["status"] == "QUEUED"
    assert client.delete(f"/api/v1/nodes/{node['id']}/claim?user=alice").json()["reserved_by"] is None
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat", json={
        "cpu_util_pct": 1, "ram_used_mb": 1, "gpus": [{"name": "g", "vram_total_mb": 1000, "utilization_pct": 0}]})
    assert client.get(f"/api/v1/jobs/{bob['id']}").json()["status"] == "SCHEDULED"


def test_only_the_holder_can_release(client):
    node = register_remote(client)
    claim(client, node["id"], "alice")
    r = client.delete(f"/api/v1/nodes/{node['id']}/claim?user=bob")
    assert r.status_code == 403 and "reserved by alice" in r.json()["detail"]
    assert client.get(f"/api/v1/nodes/{node['id']}").json()["reserved_by"] == "alice"


def test_claim_needs_a_user_and_a_real_node(client):
    node = register_remote(client)
    assert client.post(f"/api/v1/nodes/{node['id']}/claim", json={}).status_code == 422
    assert client.post(f"/api/v1/nodes/{node['id']}/claim", json={"user": "bad name!"}).status_code == 422
    assert claim(client, "nope").status_code == 404


def test_reservation_follows_keycloak_identity_when_auth_is_on(client, monkeypatch):
    from app import auth
    from app.auth import Principal
    from app.config import settings

    node = register_remote(client)
    monkeypatch.setattr(settings, "auth_enabled", True)
    client.app.dependency_overrides[auth.current_user] = lambda: Principal(username="alice", is_admin=False)
    try:
        r = client.post(f"/api/v1/nodes/{node['id']}/claim", json={"user": "someone-else"})  # body is ignored
        assert r.json()["reserved_by"] == "alice"
        client.app.dependency_overrides[auth.current_user] = lambda: Principal(username="bob", is_admin=False)
        assert client.delete(f"/api/v1/nodes/{node['id']}/claim").status_code == 403
        client.app.dependency_overrides[auth.current_user] = lambda: Principal(username="root", is_admin=True)
        assert client.delete(f"/api/v1/nodes/{node['id']}/claim").json()["reserved_by"] is None  # admin override
    finally:
        client.app.dependency_overrides.pop(auth.current_user, None)


def test_slurm_jobs_exclude_nodes_reserved_by_others(client):
    from app.models import Job

    job = Job(id="j", name="n", submitted_by="bob", gpu_count=0, requires_gpu=0, cpu_cores=1, ram_mb=512,
              time_limit_minutes=5, command="x")
    sub = slurm_jobspec.build_submission(job, exclude=["gpu01", "gpu02"])
    assert sub["job"]["excluded_nodes"] == ["gpu01", "gpu02"] and "#SBATCH --exclude=gpu01,gpu02" in sub["script"]


def test_queue_message_explains_that_every_node_is_reserved(client):
    node = register_remote(client)
    claim(client, node["id"], "alice")
    msg = submit_as(client, "bob", gpu_count=1).json()["status_message"]
    assert "Every online node is reserved" in msg and "gpu-node-01 (reserved by alice)" in msg


# -- removing a node that is gone ---------------------------------------------------------------------
def test_online_node_cannot_be_removed(client):
    node = register_remote(client)
    r = client.delete(f"/api/v1/nodes/{node['id']}")
    assert r.status_code == 409 and "stop its node agent" in r.json()["detail"]
    assert len(client.get("/api/v1/nodes").json()) == 1


def test_offline_node_is_removed_and_job_history_survives(client):
    node = register_remote(client)
    job = client.post("/api/v1/jobs", json={"name": "old", "gpu_count": 0, "command": "x", "node_id": node["id"]}).json()
    client.get(f"/api/v1/nodes/{node['id']}/jobs/next")
    client.post(f"/api/v1/jobs/{job['id']}/report", json={"status": "COMPLETED", "exit_code": 0})
    age_heartbeat(client, node["id"], 3600)
    r = client.delete(f"/api/v1/nodes/{node['id']}")
    assert r.status_code == 200 and r.json() == {"removed": "gpu-node-01"}
    assert client.get("/api/v1/nodes").json() == []
    kept = client.get(f"/api/v1/jobs/{job['id']}").json()
    assert kept["status"] == "COMPLETED" and kept["node_id"] is None


def test_work_assigned_to_a_dead_node_is_requeued_before_the_node_is_removed(client):
    node = register_remote(client)
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 0, "command": "x", "node_id": node["id"]}).json()
    age_heartbeat(client, node["id"], 3600)
    assert client.delete(f"/api/v1/nodes/{node['id']}").status_code == 200  # sweep re-queued it, nothing is active
    after = client.get(f"/api/v1/jobs/{job['id']}").json()
    assert after["status"] == "QUEUED" and after["node_id"] is None and after["requested_node_id"] is None
    assert client.delete("/api/v1/nodes/nope").status_code == 404


def test_running_job_blocks_removal_of_its_node(client):
    node = register_remote(client)
    client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 0, "command": "x", "node_id": node["id"]})
    client.get(f"/api/v1/nodes/{node['id']}/jobs/next")  # now RUNNING
    with client.session_factory() as db:  # the agent died but the sweep has not run yet
        from app.models import Node, NodeStatus

        db.get(Node, node["id"]).status = NodeStatus.OFFLINE
        db.commit()
    r = client.delete(f"/api/v1/nodes/{node['id']}")
    assert r.status_code == 409 and "still has active jobs" in r.json()["detail"]
    assert len(client.get("/api/v1/nodes").json()) == 1


# -- report-only nodes (agent started with --no-jobs) -----------------------------------------------------------------
def register_report_only(client, hostname="monitor-only", ip="10.20.0.40"):
    return client.post("/api/v1/nodes/register", json={
        "hostname": hostname, "ip_address": ip, "cpu_cores": 8, "ram_total_mb": 16384,
        "gpus": [{"name": "RTX", "vram_total_mb": 8192}], "capabilities": {"accepts_jobs": False}}).json()


def test_report_only_node_is_never_chosen_by_the_scheduler(client):
    register_report_only(client)
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1, "command": "x"}).json()
    assert job["status"] == "QUEUED" and job["node_id"] is None  # not parked on a node that would never start it
    assert "report-only" in job["status_message"] and "monitor-only" in job["status_message"]


def test_a_working_node_is_used_instead_of_the_report_only_one(client):
    register_report_only(client)
    worker = register_remote(client, "worker", "10.20.0.41")
    job = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1, "command": "x"}).json()
    assert job["node_id"] == worker["id"]


def test_choosing_a_report_only_node_is_refused_with_the_reason(client):
    node = register_report_only(client)
    r = client.post("/api/v1/jobs", json={"name": "j", "gpu_count": 1, "command": "x", "node_id": node["id"]})
    assert r.status_code == 409 and "report-only" in r.json()["detail"] and "--no-jobs" in r.json()["detail"]
    assert client.get(f"/api/v1/nodes/{node['id']}").json()["availability"] == "ERROR"


def test_agent_declares_whether_it_accepts_jobs():
    src = (SCRIPTS.parent / "agent" / "node_agent.py").read_text(encoding="utf8")
    assert 'capabilities["accepts_jobs"] = not a.no_jobs' in src


def test_failure_message_shows_the_check_scripts_own_reason(client):
    node = register_remote(client)
    log = "=== ClusterOne GPU check ===\nTEST: FAILED (install the CUDA build of PyTorch on the node: https://pytorch.org)\n"
    msg = make_failed(client, node["id"], log, 1)["status_message"]
    assert msg == "The node check failed: install the CUDA build of PyTorch on the node: https://pytorch.org"
