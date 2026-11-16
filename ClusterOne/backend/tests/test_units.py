"""Pure-function tests: resource parsing, validation helpers, DB migration, node agent helpers."""
import importlib.util
import sqlite3
from pathlib import Path

import pytest
from sqlalchemy import create_engine, inspect

from app import validation
from app.config import settings
from app.utils import format_slurm_time, parse_ram_mb, parse_time_limit_minutes

AGENT_PATH = Path(__file__).resolve().parents[1] / "agent" / "node_agent.py"


@pytest.mark.parametrize("text,mb", [("32G", 32768), ("32GB", 32768), ("32GiB", 32768), ("512M", 512), ("1T", 1048576),
                                     (2048, 2048), ("2048", 2048), ("1.5G", 1536), (" 8 g ", 8192), ("1024K", 1)])
def test_parse_ram(text, mb):
    assert parse_ram_mb(text) == mb


@pytest.mark.parametrize("bad", ["", "G", "-4G", "4X", "four", 0, True, "0M"])
def test_parse_ram_rejects(bad):
    with pytest.raises(ValueError):
        parse_ram_mb(bad)


@pytest.mark.parametrize("text,minutes", [("04:00:00", 240), ("00:30:00", 30), ("1-12:00:00", 2160), ("90", 90), (45, 45),
                                          ("02:30", 150), ("00:00:30", 1), ("100:00:00", 6000)])
def test_parse_time_limit(text, minutes):
    assert parse_time_limit_minutes(text) == minutes


@pytest.mark.parametrize("bad", ["", "soon", "-5", "00:99:00", "00:00:99", 0, True, "1-"])
def test_parse_time_limit_rejects(bad):
    with pytest.raises(ValueError):
        parse_time_limit_minutes(bad)


def test_format_slurm_time():
    assert format_slurm_time(240) == "0-04:00:00" and format_slurm_time(1500) == "1-01:00:00"


@pytest.mark.parametrize("path", ["/projects/a", "/home/alice/x_y-1.2", "/datasets", "/scratch/job-1/out"])
def test_valid_paths(path):
    assert validation.validate_path(path, "p") == path


@pytest.mark.parametrize("path", ["", "projects/a", "/etc/passwd", "/projects/../etc", "/projects/a b", "/projects/a;b",
                                  "/projects/$(x)", "/projects/a,b", "/projects/a:b", "/projectsX/a", "/projects/a\n",
                                  "/home/../root", "//etc", "/" + "a" * 5000])
def test_invalid_paths(path):
    with pytest.raises(ValueError):
        validation.validate_path(path, "p")


def test_path_is_normalised():
    assert validation.validate_path("/projects//a/./b", "p") == "/projects/a/b"


def test_images(monkeypatch):
    assert validation.validate_image("pytorch") == "/opt/apptainer/pytorch.sif"
    assert validation.validate_image("tensorflow.sif") == "/opt/apptainer/tensorflow.sif"
    assert validation.validate_image("/opt/apptainer/x/y.sif") == "/opt/apptainer/x/y.sif"
    for bad in ("/opt/apptainer/x.img", "/opt/apptainer-evil/x.sif", "/home/me/x.sif", "docker://ubuntu"):
        with pytest.raises(ValueError):
            validation.validate_image(bad)
    monkeypatch.setattr(settings, "allow_remote_images", True)
    assert validation.validate_image("docker://nvcr.io/nvidia/pytorch:24.01-py3").startswith("docker://")
    with pytest.raises(ValueError):
        validation.validate_image("docker://x; rm -rf /")


def test_env_validation_limits():
    assert validation.validate_env({"A_1": "x"}) == {"A_1": "x"}
    with pytest.raises(ValueError):
        validation.validate_env({f"V{i}": "x" for i in range(65)})
    with pytest.raises(ValueError):
        validation.validate_env({"A": "x" * 5000})
    with pytest.raises(ValueError):
        validation.validate_env({"A": "nul\x00"})
    with pytest.raises(ValueError):
        validation.validate_env({"APPTAINER_BIND": "/"})


def test_old_database_is_upgraded_in_place(tmp_path):
    """A database created by the first release gains the new columns without losing rows."""
    db_file = tmp_path / "old.db"
    con = sqlite3.connect(db_file)
    con.executescript("""
        CREATE TABLE nodes (id VARCHAR PRIMARY KEY, hostname VARCHAR NOT NULL UNIQUE, ip_address VARCHAR,
            cpu_cores INTEGER, ram_total_mb INTEGER, gpus JSON, cpu_util_pct FLOAT, ram_used_mb INTEGER,
            status VARCHAR(7) NOT NULL, registered_at DATETIME, last_heartbeat DATETIME);
        CREATE TABLE jobs (id VARCHAR PRIMARY KEY, name VARCHAR NOT NULL, submitted_by VARCHAR NOT NULL,
            requires_gpu INTEGER, min_vram_mb INTEGER, cpu_cores INTEGER, ram_mb INTEGER, script VARCHAR,
            environment VARCHAR, status VARCHAR(9) NOT NULL, node_id VARCHAR, slurm_job_id VARCHAR, logs TEXT,
            created_at DATETIME, updated_at DATETIME);
        INSERT INTO jobs (id, name, submitted_by, requires_gpu, status) VALUES ('old', 'legacy', 'bob', 1, 'COMPLETED');
    """)
    con.commit()
    con.close()

    from app import models  # noqa: F401
    from app.database import add_missing_columns

    engine = create_engine(f"sqlite:///{db_file}")
    added = add_missing_columns(engine)
    assert "jobs.gpu_count" in added and "jobs.exit_code" in added and "nodes.net_rx_mbps" in added
    assert {"command", "env_vars", "started_at"} <= {c["name"] for c in inspect(engine).get_columns("jobs")}
    assert add_missing_columns(engine) == []  # idempotent

    from sqlalchemy.orm import sessionmaker
    row = sessionmaker(bind=engine)().get(models.Job, "old")
    assert row.name == "legacy" and row.gpus_wanted() == 1  # legacy row: gpu_count NULL -> derived from requires_gpu


# -- node agent helpers (importable without psutil) -----------------------
@pytest.fixture(scope="module")
def agent():
    spec = importlib.util.spec_from_file_location("node_agent", AGENT_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_parse_nvidia_smi_real_format(agent):
    out = ("0, GPU-1111, NVIDIA A100-SXM4-40GB, 40960, 1234, 87, 61, 250.31\n"
           "1, GPU-2222, NVIDIA A100-SXM4-40GB, 40960, 0, 0, 33, [N/A]\n")
    gpus = agent.parse_nvidia_smi(out)
    assert len(gpus) == 2
    assert gpus[0] == {"index": 0, "uuid": "GPU-1111", "name": "NVIDIA A100-SXM4-40GB", "vram_total_mb": 40960,
                       "vram_used_mb": 1234, "utilization_pct": 87.0, "temperature_c": 61.0, "power_w": 250.31}
    assert "power_w" not in gpus[1] and gpus[1]["temperature_c"] == 33.0  # unsupported sensor is omitted, not faked


def test_parse_nvidia_smi_ignores_garbage_and_empty(agent):
    assert agent.parse_nvidia_smi("") == []
    assert agent.parse_nvidia_smi("No devices were found") == []
    assert agent.parse_nvidia_smi("0, GPU-x, name, [N/A], [N/A], 0, 0, 0") == []


def test_agent_builds_apptainer_argv_without_a_shell(agent, monkeypatch):
    monkeypatch.setattr(agent.shutil, "which", lambda name: "/usr/bin/apptainer")
    job = {"id": "j1", "command": "python train.py; rm -rf /", "image": "/opt/apptainer/pytorch.sif", "gpu_count": 1,
           "working_dir": "/projects/a", "output_dir": "/projects/out", "dataset_path": "/datasets/d",
           "env": {"X": "1"}}
    argv, env, cwd, error = agent.build_job_command(job, "/tmp/unused.py")
    assert error is None and cwd is None
    assert argv[:4] == ["apptainer", "exec", "--cleanenv", "--nv"]
    assert argv[-4:] == ["/opt/apptainer/pytorch.sif", "/bin/bash", "-c", "python train.py; rm -rf /"]
    assert "/datasets/d:/datasets/d:ro" in argv[argv.index("--bind") + 1]
    assert env["APPTAINERENV_X"] == "1" and env["APPTAINERENV_CLUSTERONE_JOB_ID"] == "j1"


def test_agent_refuses_host_execution_by_default(agent, monkeypatch):
    monkeypatch.setattr(agent.shutil, "which", lambda name: None)
    monkeypatch.setattr(agent, "ALLOW_HOST_EXEC", False)
    for job in ({"id": "j", "command": "echo hi", "image": "/opt/apptainer/x.sif"}, {"id": "j", "script": "print(1)"}):
        argv, _, _, error = agent.build_job_command(job, "/tmp/x.py")
        assert argv is None and "--allow-host-python" in error


def test_agent_host_mode_runs_command_as_argv_not_shell(agent, monkeypatch, tmp_path):
    monkeypatch.setattr(agent.shutil, "which", lambda name: None)
    monkeypatch.setattr(agent, "ALLOW_HOST_EXEC", True)
    job = {"id": "j", "command": 'python train.py --epochs 50 --name "my run"; echo pwned', "env": {"A": "b"},
           "working_dir": str(tmp_path)}
    argv, env, cwd, error = agent.build_job_command(job, "/tmp/x.py")
    assert error is None and cwd == str(tmp_path) and env["A"] == "b"
    assert argv[0] == agent.sys.executable and argv[1:5] == ["train.py", "--epochs", "50", "--name"]
    assert "echo" in argv and "pwned" in argv  # `;` is just text here: nothing interprets it as a shell operator
    assert not any(a in ("sh", "bash", "cmd", "powershell", "-c") for a in argv)
    job["working_dir"] = str(tmp_path / "missing")
    assert agent.build_job_command(job, "/tmp/x.py")[2] is None


def test_agent_legacy_script_runs_python_only_when_allowed(agent, monkeypatch):
    monkeypatch.setattr(agent, "ALLOW_HOST_EXEC", True)
    argv, env, _, error = agent.build_job_command({"id": "j", "script": "print(1)", "env": {"A": "b"}}, "/tmp/x.py")
    assert error is None and argv[1:] == ["/tmp/x.py"] and env["A"] == "b" and env["CLUSTERONE_JOB_ID"] == "j"


def test_env_example_loads_and_keeps_safe_defaults():
    from app.config import Settings

    env_file = Path(__file__).resolve().parents[1] / ".env.example"
    s = Settings(_env_file=env_file)
    assert s.slurm_enabled is False and s.auth_enabled is False
    assert s.slurm_token() is None  # empty token file / token must mean "none", not ""
    assert not s.agent_token
    assert s.partitions == ["gpu", "interactive", "teaching"]
    assert s.master_ip == "10.20.0.10"
    assert s.prometheus_url is None


# -- the agent's job runner, against a fake controller ------------------------------------------
def _fake_controller(agent, monkeypatch):
    sent = []
    monkeypatch.setattr(agent, "ALLOW_HOST_EXEC", True)
    monkeypatch.setattr(agent, "post", lambda url, body: sent.append(body) or {"status": "RUNNING"})
    monkeypatch.setattr(agent.time, "sleep", lambda s: None)
    return sent


def test_agent_run_job_reports_logs_and_success(agent, monkeypatch):
    sent = _fake_controller(agent, monkeypatch)
    job = {"id": "job-ok-0001", "name": "t", "command": 'python -c "print(42)"', "env": {}}
    agent.run_job("http://x/api/v1", job)
    text = "".join(b.get("log_append", "") for b in sent)
    assert "executing on" in text and "42" in text
    assert sent[-1]["status"] == "COMPLETED" and sent[-1]["exit_code"] == 0


def test_agent_run_job_reports_failure_exit_code(agent, monkeypatch):
    sent = _fake_controller(agent, monkeypatch)
    job = {"id": "job-bad-0001", "name": "t", "command": 'python -c "import sys; sys.exit(3)"', "env": {}}
    agent.run_job("http://x/api/v1", job)
    assert sent[-1]["status"] == "FAILED" and sent[-1]["exit_code"] == 3


def test_agent_run_job_refusal_is_reported_as_failed(agent, monkeypatch):
    sent = _fake_controller(agent, monkeypatch)
    monkeypatch.setattr(agent, "ALLOW_HOST_EXEC", False)
    monkeypatch.setattr(agent.shutil, "which", lambda name: None)
    agent.run_job("http://x/api/v1", {"id": "job-no-00001", "name": "t", "command": "echo hi", "image": "/opt/apptainer/x.sif"})
    assert sent[-1]["status"] == "FAILED" and "--allow-host-python" in sent[-1]["log_append"]


def test_agent_crash_in_runner_fails_the_job_instead_of_leaving_it_running(agent, monkeypatch):
    sent = []
    calls = {"n": 0}

    def fake_get(url):
        calls["n"] += 1
        if calls["n"] > 1:
            raise KeyboardInterrupt  # stop the endless poll loop after one job
        return {"id": "job-crash-001", "name": "t"}

    def boom(base, job):
        raise RuntimeError("disk exploded")

    monkeypatch.setattr(agent, "get", fake_get)
    monkeypatch.setattr(agent, "run_job", boom)
    monkeypatch.setattr(agent, "post", lambda url, body: sent.append(body) or {})
    with pytest.raises(KeyboardInterrupt):
        agent.job_loop("http://x/api/v1", "node-1")
    assert sent and sent[-1]["status"] == "FAILED" and "disk exploded" in sent[-1]["log_append"]


# -- driver / CUDA reporting, capability probe, Docker runner ---------------------------------------------------
SMI_HEADER = """\
+-----------------------------------------------------------------------------------------+
| NVIDIA-SMI 572.16                 Driver Version: 572.16         CUDA Version: 12.8     |
|-----------------------------------------+------------------------+----------------------+
"""


def test_cuda_version_is_parsed_from_the_nvidia_smi_header(agent):
    assert agent.parse_cuda_version(SMI_HEADER) == "12.8"
    assert agent.parse_cuda_version("no gpu here") is None
    assert agent.parse_cuda_version(None) is None


def test_driver_version_column_is_parsed_and_old_eight_column_output_still_works(agent):
    nine = agent.parse_nvidia_smi("0, GPU-1, RTX 4050, 6141, 900, 3, 51, 12.5, 572.16\n")
    assert nine[0]["driver_version"] == "572.16" and nine[0]["power_w"] == 12.5
    eight = agent.parse_nvidia_smi("0, GPU-1, RTX 4050, 6141, 900, 3, 51, 12.5\n")
    assert "driver_version" not in eight[0]
    na = agent.parse_nvidia_smi("0, GPU-1, RTX 4050, 6141, 900, 3, 51, [N/A], [N/A]\n")
    assert "driver_version" not in na[0] and "power_w" not in na[0]


def test_capability_probe_reports_what_is_really_installed(agent, monkeypatch):
    class R:
        def __init__(self, out, rc=0):
            self.stdout, self.returncode = out, rc

    def fake_run_ok(argv, timeout=10):
        if argv[0] == "docker":
            return R("29.8.2\n")
        if argv[0] == "ffmpeg":
            return R(" V....D h264_nvenc   NVIDIA NVENC H.264 encoder\n")
        return R('warning line\n{"torch": "2.6.0+cu124", "cuda_available": true, "torch_cuda": "12.4"}\n')

    monkeypatch.setattr(agent, "_run_ok", fake_run_ok)
    monkeypatch.setattr(agent.shutil, "which", lambda name: f"/bin/{name}" if name in ("docker", "ffmpeg", "nvidia-smi") else None)
    caps = agent.probe_capabilities()
    assert caps["docker"] and caps["ffmpeg_nvenc"] and caps["nvidia_smi"] and not caps["apptainer"]
    assert caps["torch"] == "2.6.0+cu124" and caps["torch_cuda_available"] is True and caps["torch_cuda_version"] == "12.4"


def test_capability_probe_without_torch_or_tools(agent, monkeypatch):
    monkeypatch.setattr(agent.shutil, "which", lambda name: None)
    monkeypatch.setattr(agent, "_run_ok", lambda argv, timeout=10: None)
    caps = agent.probe_capabilities()
    assert caps["torch"] is None and caps["torch_cuda_available"] is False
    assert not caps["docker"] and not caps["ffmpeg"] and not caps["nvidia_smi"]


def test_docker_runner_isolates_the_job_and_passes_the_gpu(agent, monkeypatch):
    monkeypatch.setattr(agent, "DOCKER_IMAGE", "pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime")
    monkeypatch.setattr(agent, "ALLOW_HOST_EXEC", False)  # Docker needs no host-execution permission
    monkeypatch.setattr(agent.shutil, "which", lambda name: "/usr/bin/" + name)
    job = {"id": "abc-123", "gpu_count": 1, "ram_mb": 4096, "cpu_cores": 2, "env": {"SEED": "7"},
           "command": "python train.py; echo $HOME", "working_dir": "/projects/x"}
    argv, _, cwd, error = agent.build_job_command(job, "/tmp/unused.py")
    assert error is None and cwd is None
    assert argv[:5] == ["docker", "run", "--rm", "--name", "c1-abc-123"]
    assert ["--gpus", "all"] == argv[argv.index("--gpus"):argv.index("--gpus") + 2]
    assert argv[argv.index("--memory") + 1] == "4096m" and argv[argv.index("--cpus") + 1] == "2"
    assert "SEED=7" in argv and "CLUSTERONE_JOB_ID=abc-123" in argv
    assert argv[-4:] == ["pytorch/pytorch:2.6.0-cuda12.4-cudnn9-runtime", "/bin/bash", "-c", "python train.py; echo $HOME"]
    assert "-v" not in argv and "/projects/x" not in argv  # the host's files are not exposed


def test_docker_runner_cpu_job_gets_no_gpu_and_script_jobs_mount_only_the_script(agent, monkeypatch):
    monkeypatch.setattr(agent, "DOCKER_IMAGE", "python:3.12-slim")
    monkeypatch.setattr(agent.shutil, "which", lambda name: "/usr/bin/" + name)
    argv, *_ = agent.build_job_command({"id": "j1", "gpu_count": 0, "script": "print(1)"}, "/tmp/job.py")
    assert "--gpus" not in argv
    assert argv[-5:] == ["-v", "/tmp/job.py:/job/script.py:ro", "python:3.12-slim", "python", "/job/script.py"]


def test_docker_runner_reports_missing_docker(agent, monkeypatch):
    monkeypatch.setattr(agent, "DOCKER_IMAGE", "python:3.12-slim")
    monkeypatch.setattr(agent.shutil, "which", lambda name: None)
    argv, _, _, error = agent.build_job_command({"id": "j1", "command": "echo"}, "/tmp/job.py")
    assert argv is None and "docker is not installed" in error


def test_cancelling_a_docker_job_kills_the_container_not_just_the_client(agent, monkeypatch):
    killed = []
    monkeypatch.setattr(agent, "_run_ok", lambda argv, timeout=10: killed.append(argv))

    class Proc:
        pid = 999999999
        c1_container = "c1-abc"

        def kill(self):
            killed.append("client")

    agent.kill_tree(Proc())
    assert ["docker", "kill", "c1-abc"] in killed
