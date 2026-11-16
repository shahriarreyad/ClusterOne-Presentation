"""Slurm mode, with slurmrestd mocked at the HTTP layer (no real Slurm needed)."""
import json
import os
import shutil
import subprocess
import sys
import uuid
from pathlib import Path

import httpx
import pytest

from app.config import settings
from app.models import Job, JobStatus
from app.services import slurm_jobspec, slurm_sync
from app.services.slurm_client import SlurmClient, SlurmError, slurm_client
from tests.test_nodes import register_sample_node

API = f"/slurm/{settings.slurmrestd_version}"
DB_API = f"/slurmdb/{settings.slurmrestd_version}"


def ctl_job(job_id, state="RUNNING", **kw):
    """A job as slurmctld's /jobs returns it (v0.0.40 shapes)."""
    base = {
        "job_id": job_id, "name": "train", "job_state": [state], "partition": "gpu", "user_name": "alice",
        "nodes": "gpu01", "cpus": {"set": True, "infinite": False, "number": 8},
        "tres_alloc_str": "cpu=8,mem=32G,node=1,billing=8,gres/gpu=2",
        "start_time": {"set": True, "infinite": False, "number": 1_700_000_000},
        "end_time": {"set": True, "infinite": False, "number": 0},
        "exit_code": {"status": ["SUCCESS"], "return_code": {"set": True, "infinite": False, "number": 0}},
        "state_reason": "None",
        "time_limit": {"set": True, "infinite": False, "number": 240},
    }
    base.update(kw)
    return base


class FakeSlurm:
    """In-memory slurmrestd behind httpx.MockTransport."""

    def __init__(self):
        self.requests = []
        self.jobs = []  # what GET /jobs returns
        self.accounting = {}  # job_id -> slurmdb job dict
        self.next_id = 100
        self.fail_all = None  # status code to answer everything with
        self.cancel_status = 200
        self.submit_response = None

    def handler(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        if self.fail_all:
            return httpx.Response(self.fail_all, text="boom")
        path, method = request.url.path, request.method
        if path == f"{API}/job/submit" and method == "POST":
            if self.submit_response is not None:
                return httpx.Response(200, json=self.submit_response)
            self.next_id += 1
            return httpx.Response(200, json={"job_id": self.next_id, "errors": []})
        if path == f"{API}/jobs":
            return httpx.Response(200, json={"jobs": self.jobs, "errors": []})
        if path.startswith(f"{API}/job/") and method == "DELETE":
            return httpx.Response(self.cancel_status, json={"errors": []})
        if path == f"{API}/diag":
            return httpx.Response(200, json={"statistics": {}, "errors": []})
        if path == f"{API}/nodes":
            return httpx.Response(200, json={"nodes": [{"name": "gpu01", "state": ["MIXED"]}], "errors": []})
        if path.startswith(f"{DB_API}/job/"):
            jid = path.rsplit("/", 1)[1]
            if jid in self.accounting:
                return httpx.Response(200, json={"jobs": [self.accounting[jid]], "errors": []})
            return httpx.Response(200, json={"jobs": [], "errors": []})
        return httpx.Response(404, text="unmocked " + path)

    def submitted(self):
        return [json.loads(r.content) for r in self.requests if r.url.path.endswith("/job/submit")]


@pytest.fixture()
def slurm(monkeypatch):
    fake = FakeSlurm()
    monkeypatch.setattr(settings, "slurm_enabled", True)
    monkeypatch.setattr(settings, "slurm_sync_ttl_seconds", 0.0)
    monkeypatch.setattr(slurm_client, "transport", httpx.MockTransport(fake.handler))
    yield fake
    monkeypatch.setattr(slurm_client, "transport", None)


JOB = {
    "name": "resnet", "submitted_by": "alice", "partition": "gpu", "gpu_count": 2, "cpu_count": 8, "ram": "32G",
    "time_limit": "04:00:00", "image": "pytorch", "working_dir": "/projects/alice/exp",
    "dataset_path": "/datasets/imagenet", "output_dir": "/projects/alice/out",
    "command": "python train.py --lr 0.1", "env": {"EPOCHS": "3"},
}


# -- submission -----------------------------------------------------------
def test_submit_sends_gpu_cpu_mem_time_to_slurmrestd(client, slurm, monkeypatch):
    monkeypatch.setattr(settings, "slurm_jwt_token", __import__("pydantic").SecretStr("tok-123"))
    r = client.post("/api/v1/jobs", json=JOB)
    assert r.status_code == 200, r.text
    job = r.json()
    assert job["slurm_job_id"] == "101" and job["status"] == "QUEUED" and job["slurm_state"] == "PENDING"

    req = slurm.requests[0]
    assert req.headers["X-SLURM-USER-NAME"] == settings.slurm_user
    assert req.headers["X-SLURM-USER-TOKEN"] == "tok-123"

    body = slurm.submitted()[0]
    spec = body["job"]
    assert spec["partition"] == "gpu" and spec["cpus_per_task"] == 8
    assert spec["memory_per_node"]["number"] == 32768 and spec["time_limit"]["number"] == 240
    assert spec["tres_per_node"] == "gres:gpu:2"
    assert spec["current_working_directory"] == "/projects/alice/exp"
    script = body["script"]
    assert "#SBATCH --gres=gpu:2" in script
    assert "#SBATCH --cpus-per-task=8" in script
    assert "#SBATCH --mem=32768M" in script
    assert "#SBATCH --time=0-04:00:00" in script
    assert "apptainer exec --nv --cleanenv" in script
    assert "/opt/apptainer/pytorch.sif" in script


def test_cpu_job_requests_no_gres_and_no_nv(client, slurm):
    client.post("/api/v1/jobs", json=dict(JOB, gpu_count=0))
    body = slurm.submitted()[0]
    assert "tres_per_node" not in body["job"]
    assert "--gres" not in body["script"] and "--nv" not in body["script"]


def test_slurm_job_requires_a_command(client, slurm):
    r = client.post("/api/v1/jobs", json={"name": "nocmd", "gpu_count": 1})
    assert r.status_code == 422 and "command" in r.json()["detail"]
    assert slurm.requests == []


def test_legacy_script_field_runs_as_the_container_command(client, slurm):
    client.post("/api/v1/jobs", json={"name": "legacy", "script": "echo from-script"})
    assert "echo from-script" in slurm.submitted()[0]["script"]


def test_slurm_unreachable_on_submit_is_502_and_nothing_is_stored(client, slurm):
    slurm.fail_all = 503
    r = client.post("/api/v1/jobs", json=JOB)
    assert r.status_code == 502
    slurm.fail_all = None
    assert client.get("/api/v1/jobs").json() == []


def test_missing_job_id_in_submit_response_is_502(client, slurm):
    slurm.submit_response = {"errors": []}
    assert client.post("/api/v1/jobs", json=JOB).status_code == 502


def test_dev_scheduler_is_not_used_in_slurm_mode(client, slurm):
    node = register_sample_node(client).json()
    job = client.post("/api/v1/jobs", json=JOB).json()
    assert job["node_id"] is None and job["status"] == "QUEUED"
    client.post(f"/api/v1/nodes/{node['id']}/heartbeat", json={"cpu_util_pct": 0, "ram_used_mb": 0, "gpus": node["gpus"]})
    assert client.get(f"/api/v1/nodes/{node['id']}/jobs/next").json() is None


# -- the generated script cannot be talked into running user text on the host
HOSTILE = [
    "echo hi; touch {canary}",
    "$(touch {canary})",
    "`touch {canary}`",
    "'; touch {canary}; echo '",
    "\"; touch {canary}; \"",
    "echo ok\n#SBATCH --uid=0\ntouch {canary}",
    "echo $HOME && touch {canary}",
]


@pytest.mark.skipif(shutil.which("bash") is None or sys.platform == "win32", reason="needs Linux bash")
@pytest.mark.parametrize("hostile", HOSTILE)
def test_generated_script_treats_user_input_as_data(tmp_path, hostile):
    """Run the real generated script with a fake `apptainer` and check what reaches it."""
    canary = f"/tmp/clusterone-canary-{uuid.uuid4().hex}"
    command = hostile.format(canary=canary)
    out_dir = f"/tmp/clusterone-test-{uuid.uuid4().hex}"
    job = Job(id="job-1", name="t", submitted_by="alice", gpu_count=1, requires_gpu=1, cpu_cores=2, ram_mb=1024,
              time_limit_minutes=60, partition="gpu", image="/opt/apptainer/pytorch.sif", working_dir="/tmp",
              output_dir=out_dir, command=command, env_vars={"MSG": "a 'quoted' $(touch " + canary + ") value"})
    script = tmp_path / "job.sh"
    script.write_text(slurm_jobspec.build_script(job), encoding="utf-8", newline="\n")

    fakebin = tmp_path / "bin"
    fakebin.mkdir()
    argv_file, env_file = tmp_path / "argv.txt", tmp_path / "env.txt"
    shim = fakebin / "apptainer"
    shim.write_text('#!/bin/bash\nprintf "%s\\n" "$@" > "$ARGV_OUT"\nenv | grep ^APPTAINERENV_ > "$ENV_OUT"\n',
                    encoding="utf-8", newline="\n")
    shim.chmod(0o755)
    env = dict(os.environ, PATH=str(fakebin) + os.pathsep + os.environ["PATH"], ARGV_OUT=argv_file.as_posix(),
               ENV_OUT=env_file.as_posix(), SLURM_JOB_ID="7", SLURM_CPUS_PER_TASK="2")
    res = subprocess.run(["bash", script.as_posix()], env=env, capture_output=True, text=True, timeout=30)
    try:
        assert res.returncode == 0, res.stderr
        assert not Path(canary).exists(), "user text was executed on the host"
        argv = argv_file.read_text(encoding="utf-8").split("\n")
        assert argv[:3] == ["exec", "--nv", "--cleanenv"]
        # The user's command arrives as exactly one argument, byte for byte.
        i = argv.index("-c")
        assert "\n".join(argv[i + 1:]).rstrip("\n") == command
        env_dump = env_file.read_text(encoding="utf-8")
        assert "APPTAINERENV_MSG=a 'quoted' $(touch " + canary + ") value" in env_dump
        assert "APPTAINERENV_CLUSTERONE_JOB_ID=job-1" in env_dump
    finally:
        shutil.rmtree(out_dir, ignore_errors=True)


def test_script_has_no_extra_sbatch_lines_from_user_text():
    job = Job(id="j", name="t", submitted_by="alice", gpu_count=0, requires_gpu=0, cpu_cores=1, ram_mb=512,
              time_limit_minutes=5, partition="gpu", command="x\n#SBATCH --uid=0", env_vars={"A": "b\n#SBATCH --x"})
    # sbatch only honours directives in the leading comment block, before the first
    # executable line; user text is placed after it, inside single quotes.
    header = []
    for line in slurm_jobspec.build_script(job).splitlines():
        if line.strip() and not line.startswith("#"):
            break
        header.append(line)
    directives = [ln for ln in header if ln.startswith("#SBATCH")]
    assert directives and not any("uid" in ln or "--x" in ln for ln in directives)


# -- syncing Slurm's state ------------------------------------------------
@pytest.mark.parametrize("states,expected", [
    (["PENDING"], JobStatus.QUEUED), (["RUNNING"], JobStatus.RUNNING), (["COMPLETING", "RUNNING"], JobStatus.RUNNING),
    (["COMPLETED"], JobStatus.COMPLETED), (["FAILED"], JobStatus.FAILED), (["TIMEOUT"], JobStatus.FAILED),
    (["OUT_OF_MEMORY"], JobStatus.FAILED), (["NODE_FAIL"], JobStatus.FAILED), (["CANCELLED"], JobStatus.CANCELLED),
    (["COMPLETING", "CANCELLED"], JobStatus.CANCELLED), ("RUNNING", JobStatus.RUNNING), (["WEIRD"], None), ([], None),
])
def test_slurm_state_mapping(states, expected):
    assert slurm_sync.map_state(states) == expected


def test_running_job_is_synced_from_slurm(client, slurm):
    register_sample_node(client, hostname="gpu01")
    job = client.post("/api/v1/jobs", json=JOB).json()
    slurm.jobs = [ctl_job(101)]
    got = client.get(f"/api/v1/jobs/{job['id']}").json()
    assert got["status"] == "RUNNING" and got["slurm_state"] == "RUNNING"
    assert got["allocated_nodes"] == "gpu01" and got["allocated_cpus"] == 8
    assert got["allocated_ram_mb"] == 32768 and got["allocated_gpus"] == 2
    assert got["started_at"].startswith("2023-11-14") and got["ended_at"] is None
    node = client.get("/api/v1/nodes").json()[0]
    assert got["node_id"] == node["id"]
    assert [j["id"] for j in node["current_jobs"]] == [job["id"]]


def test_completed_and_failed_jobs_get_exit_code_and_end_time(client, slurm):
    a = client.post("/api/v1/jobs", json=JOB).json()
    b = client.post("/api/v1/jobs", json=dict(JOB, name="other")).json()
    slurm.jobs = [
        ctl_job(101, "COMPLETED", end_time={"set": True, "number": 1_700_003_600}),
        ctl_job(102, "FAILED", end_time={"set": True, "number": 1_700_000_100},
                exit_code={"status": ["ERROR"], "return_code": {"set": True, "number": 3}}),
    ]
    ja, jb = (client.get(f"/api/v1/jobs/{j['id']}").json() for j in (a, b))
    assert (ja["status"], ja["exit_code"]) == ("COMPLETED", 0)
    assert ja["runtime_seconds"] == 3600
    assert (jb["status"], jb["exit_code"]) == ("FAILED", 3) and jb["ended_at"]


def test_pending_reason_is_reported(client, slurm):
    job = client.post("/api/v1/jobs", json=JOB).json()
    slurm.jobs = [ctl_job(101, "PENDING", state_reason="Resources", start_time={"set": False, "number": 0}, nodes="")]
    got = client.get(f"/api/v1/jobs/{job['id']}").json()
    assert got["status"] == "QUEUED" and got["state_reason"] == "Resources" and got["started_at"] is None


def test_jobs_submitted_outside_clusterone_are_imported(client, slurm):
    slurm.jobs = [ctl_job(555, name="by-hand", user_name="bob")]
    jobs = client.get("/api/v1/jobs").json()
    assert len(jobs) == 1
    assert jobs[0]["slurm_job_id"] == "555" and jobs[0]["submitted_by"] == "bob" and jobs[0]["gpu_count"] == 2
    assert len(client.get("/api/v1/jobs").json()) == 1  # not imported twice


def test_job_missing_from_slurmctld_falls_back_to_accounting(client, slurm):
    job = client.post("/api/v1/jobs", json=JOB).json()
    slurm.jobs = []  # slurmctld forgot it
    slurm.accounting["101"] = {
        "job_id": 101, "name": "resnet", "user": "alice", "partition": "gpu", "nodes": "gpu01",
        "state": {"current": ["COMPLETED"], "reason": "None"},
        "time": {"start": 1_700_000_000, "end": 1_700_000_500, "limit": {"set": True, "number": 240}},
        "exit_code": {"status": ["SUCCESS"], "return_code": {"set": True, "number": 0}},
        "tres": {"allocated": [{"type": "cpu", "count": 8}, {"type": "mem", "count": 32768},
                               {"type": "gres", "name": "gpu", "count": 2}]},
    }
    got = client.get(f"/api/v1/jobs/{job['id']}").json()
    assert got["status"] == "COMPLETED" and got["exit_code"] == 0 and got["allocated_gpus"] == 2
    assert got["runtime_seconds"] == 500


def test_slurm_outage_keeps_serving_last_known_state(client, slurm):
    job = client.post("/api/v1/jobs", json=JOB).json()
    slurm.fail_all = 500
    r = client.get("/api/v1/jobs")
    assert r.status_code == 200 and r.json()[0]["id"] == job["id"]
    assert slurm_sync.reachable() is False


def test_sync_is_throttled_by_ttl(client, slurm, monkeypatch):
    monkeypatch.setattr(settings, "slurm_sync_ttl_seconds", 3600.0)
    client.post("/api/v1/jobs", json=JOB)
    client.get("/api/v1/jobs")
    client.get("/api/v1/jobs")
    assert sum(1 for r in slurm.requests if r.url.path.endswith("/jobs")) == 1


def test_node_sync_records_slurm_state(client, slurm):
    register_sample_node(client, hostname="gpu01")
    with client.session_factory() as db:
        assert slurm_sync.sync_nodes(db)
    assert client.get("/api/v1/nodes").json()[0]["slurm_state"] == "MIXED"


def test_summary_reports_slurm_mode(client, slurm):
    assert client.get("/api/v1/cluster/summary").json()["mode"] == "slurm"


# -- cancel ---------------------------------------------------------------
def test_cancel_calls_scancel_equivalent(client, slurm):
    job = client.post("/api/v1/jobs", json=JOB).json()
    r = client.post(f"/api/v1/jobs/{job['id']}/cancel")
    assert r.json()["status"] == "CANCELLED"
    assert any(q.method == "DELETE" and q.url.path.endswith("/job/101") for q in slurm.requests)


def test_cancel_of_job_slurm_already_forgot_succeeds(client, slurm):
    job = client.post("/api/v1/jobs", json=JOB).json()
    slurm.cancel_status = 404
    assert client.delete(f"/api/v1/jobs/{job['id']}").json()["status"] == "CANCELLED"


def test_cancel_failure_leaves_job_untouched(client, slurm):
    job = client.post("/api/v1/jobs", json=JOB).json()
    slurm.cancel_status = 500
    assert client.post(f"/api/v1/jobs/{job['id']}/cancel").status_code == 502
    assert client.get(f"/api/v1/jobs/{job['id']}").json()["status"] == "QUEUED"


# -- health ---------------------------------------------------------------
def test_health_ok_and_degraded(client, slurm):
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["slurm"] == {"enabled": True, "reachable": True, "error": None}
    slurm.fail_all = 500
    h = client.get("/health")
    assert h.status_code == 200 and h.json()["status"] == "degraded" and h.json()["slurm"]["reachable"] is False


def test_health_in_dev_mode_has_no_slurm_dependency(client):
    h = client.get("/health").json()
    assert h["status"] == "ok" and h["mode"] == "dev" and h["slurm"]["reachable"] is None


# -- client ---------------------------------------------------------------
def test_client_raises_on_errors_array_in_200_body(monkeypatch):
    transport = httpx.MockTransport(lambda r: httpx.Response(200, json={"errors": [{"error": "invalid partition", "error_number": 2013}]}))
    with pytest.raises(SlurmError, match="invalid partition"):
        SlurmClient(transport).diag()


def test_client_wraps_connection_errors():
    def boom(request):
        raise httpx.ConnectError("refused")
    with pytest.raises(SlurmError, match="unreachable"):
        SlurmClient(httpx.MockTransport(boom)).diag()


def test_jwt_token_file_is_reread_each_request(tmp_path, monkeypatch):
    token_file = tmp_path / "token"
    token_file.write_text("first\n")
    monkeypatch.setattr(settings, "slurm_jwt_token_file", str(token_file))
    seen = []
    client = SlurmClient(httpx.MockTransport(lambda r: seen.append(r.headers.get("X-SLURM-USER-TOKEN")) or httpx.Response(200, json={})))
    client.diag()
    token_file.write_text("second\n")
    client.diag()
    assert seen == ["first", "second"]


def test_chosen_node_is_sent_to_slurm_as_a_node_list(client, slurm):
    node = register_sample_node(client, hostname="gpu01").json()
    job = client.post("/api/v1/jobs", json=dict(JOB, node_id=node["id"])).json()
    body = slurm.submitted()[0]
    assert body["job"]["required_nodes"] == ["gpu01"] and "#SBATCH --nodelist=gpu01" in body["script"]
    assert job["requested_node_id"] == node["id"]


def test_unknown_chosen_node_is_rejected_in_slurm_mode(client, slurm):
    assert client.post("/api/v1/jobs", json=dict(JOB, node_id="nope")).status_code == 404
    assert slurm.requests == []
